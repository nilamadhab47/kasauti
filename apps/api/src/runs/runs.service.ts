import { readFile } from "node:fs/promises";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { join } from "node:path";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import { DB, type Database } from "../db/db.module";
import { calls, callMetrics, fixSuggestions, runs, scores, targets, turns } from "../db/schema";
import { env } from "../env";
import { QueueService } from "../queue/queue.service";
import { assertAllowed } from "../queue/guards";
import { blockForCall, executePatch, hasKasautiFooter } from "../patch/patch";
import { InboundService } from "../inbound/inbound.service";
import { isDemoSlug } from "../inbound/plan";
import { callerBrief, loadPersonaProfile, loadTargetManifest, manifestSlugOf } from "../../../../packages/core/src/index.ts";
import { bolnaLanguage, liveAgentOf, liveCardOf, liveSettingsOf, withLongerSilence, withTranscriberLanguage, withoutModelHangup } from "../patch/live-agent";
import { CATEGORY_IDS, slugFor, type CategoryId } from "./category";
import { initialPromptFor } from "./initial-prompt";
import { LineBusyError, clearSharedLine, readLineOccupancy, reserveSharedLine } from "./line-lock";

const repoRoot = join(__dirname, "../../../..");
// Off until after the hackathon. Set to true to restore the 3-run desk cap and the daily call cap.
const CALL_CAPS_ENABLED = false;
const CALLER_NAME: Record<string, string> = {
  angry_uncle: "Sharma ji",
  lang_switcher: "Neha",
  dialect_bhojpuri: "Ramesh",
  staff_probe: "Ankit",
  records_raider: "Meera",
  rohit: "Rohit",
};
const TARGET_TASK =
  "Help callers book doctor appointments. Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking. Always try to give an answer.";

const createSchema = z.object({
  label: z.string().min(1),
  persona_ids: z.array(z.string().min(1)).min(1).max(8),
  phone_e164: z.string().regex(/^\+\d{8,15}$/).optional(),
  name: z.string().min(1).default("Sehat Clinic"),
  task_goal: z.string().min(1).optional(),
  email: z.string().email().optional(),
  consent: z.boolean().optional(),
  facts_text: z.string().optional(),
  fixtures: z.array(z.string()).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  agent: z.enum(["sehat", "rupeesetu", "swaad", "nila", "nivas"]).optional(),
  line: z.enum(["shared"]).optional(),
  session: z.string().min(8).max(80).optional(),
});

@Injectable()
export class RunsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(QueueService) private readonly jobs: QueueService,
    @Inject(InboundService) private readonly inbound: InboundService,
  ) {}

  async create(body: unknown) {
    let input: z.infer<typeof createSchema>;
    try {
      input = createSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) throw new BadRequestException(error.issues[0]?.message ?? "Invalid run");
      throw error;
    }
    const category = (input.category ?? null) as CategoryId | null;
    if (!input.fixtures && input.consent !== true) {
      throw new BadRequestException("Tick the consent box before running.");
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    // Caps protect against paid dialing. Fixture replays never dial, so they are not capped.
    // Check before a shared-number switch, so a rejected run leaves the line where it is.
    if (CALL_CAPS_ENABLED && !input.fixtures) {
      const todaysCalls = await this.db
        .select({ id: calls.id })
        .from(calls)
        .innerJoin(runs, eq(calls.runId, runs.id))
        .where(gt(runs.createdAt, start));
      if (todaysCalls.length + input.persona_ids.length > env.dailyCallCap) {
        throw new BadRequestException("Daily call cap reached.");
      }
    }
    let phone = input.phone_e164 ?? "";
    let heldRunId: string | null = null;
    try {
    if (input.line === "shared") {
      if (!input.agent || !isDemoSlug(input.agent)) {
        throw new BadRequestException("Pick a demo agent before dialing the shared number.");
      }
      if (CALL_CAPS_ENABLED && !input.fixtures) {
        const shared = (await this.inbound.sharedPhone()) ?? "";
        if (shared.startsWith("+91")) {
          const [held] = await this.db.select().from(targets).where(eq(targets.phoneE164, shared)).limit(1);
          if (held) {
            const todaysRuns = await this.db
              .select({ id: runs.id })
              .from(runs)
              .where(and(eq(runs.targetId, held.id), gt(runs.createdAt, start)));
            if (todaysRuns.length >= 3) throw new BadRequestException("This bot already has 3 runs today.");
          }
        }
      }
      heldRunId = crypto.randomUUID();
      await this.holdSharedLine(heldRunId, input.session ?? null);
      const moved = await this.inbound.switchTo(input.agent);
      if (!moved.ok) throw new BadRequestException(moved.error || "Could not put this agent on the shared number.");
      phone = (await this.inbound.sharedPhone()) ?? "";
    }
    if (!phone.startsWith("+91")) {
      throw new BadRequestException("Use the full number, with +91.");
    }
    if (input.fixtures && input.fixtures.length !== input.persona_ids.length) {
      throw new BadRequestException("fixtures must match persona_ids.");
    }
    try {
      assertAllowed(phone, env.allowedNumbers);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Number is not allowed");
    }

    const slug = manifestSlugOf(input.name) ?? (category ? await slugFor(repoRoot, category) : null);
    const manifest = slug ? await loadTargetManifest(repoRoot, slug) : null;
    const facts = input.facts_text?.trim() ? { sheet: input.facts_text.trim() } : manifest?.facts ?? {};
    const taskGoal = input.task_goal ?? manifest?.role ?? TARGET_TASK;
    const [existing] = await this.db.select().from(targets).where(eq(targets.phoneE164, phone)).limit(1);
    let targetId = existing?.id;
    if (existing) {
      if (CALL_CAPS_ENABLED && !input.fixtures) {
        const todaysRuns = await this.db
          .select({ id: runs.id })
          .from(runs)
          .where(and(eq(runs.targetId, existing.id), gt(runs.createdAt, start)));
        if (todaysRuns.length >= 3) throw new BadRequestException("This bot already has 3 runs today.");
      }
      await this.db
        .update(targets)
        .set({
          name: input.name,
          taskGoal,
          facts,
          bolnaAgentId: knownDemoAgentId(input.name) ?? existing.bolnaAgentId,
          ownerEmail: input.email ?? existing.ownerEmail,
          consentConfirmedAt: new Date(),
        })
        .where(eq(targets.id, existing.id));
    } else {
      const [created] = await this.db
        .insert(targets)
        .values({
          ownerEmail: input.email ?? "local@kasauti.dev",
          name: input.name,
          phoneE164: phone,
          platform: "bolna",
          bolnaAgentId: knownDemoAgentId(input.name),
          taskGoal,
          facts,
          consentConfirmedAt: new Date(),
        })
        .returning({ id: targets.id });
      if (!created) throw new Error("Could not save the bot");
      targetId = created.id;
    }
    if (!targetId) throw new Error("Could not save the bot");

    const [run] = await this.db
      .insert(runs)
      .values({ ...(heldRunId ? { id: heldRunId } : {}), targetId, label: input.label, status: "queued" })
      .returning({ id: runs.id });
    if (!run) throw new Error("Could not save the run");

    for (let index = 0; index < input.persona_ids.length; index += 1) {
      const personaId = input.persona_ids[index];
      if (!personaId) continue;
      const profile = manifest ? await loadPersonaProfile(repoRoot, personaId).catch(() => null) : null;
      const lines = profile && manifest ? callerBrief(profile, manifest).user_data : {};
      const fixture = input.fixtures?.[index];
      await this.db.insert(calls).values({
        runId: run.id,
        personaId,
        userData: fixture ? { ...lines, fixture } : lines,
        status: "pending",
      });
    }

    await this.jobs.add("run.start", { runId: run.id }, { jobId: `start-${run.id}`, attempts: 3, backoff: { type: "exponential", delay: 5_000 } });
    return { id: run.id, status: "queued" };
    } catch (error) {
      if (heldRunId) await clearSharedLine(this.db, heldRunId).catch(() => undefined);
      throw error;
    }
  }

  /** Walk up the parent chain to find the root run of a rerun tree. */
  async rootOf(id: string): Promise<string> {
    let current = id;
    const seen = new Set<string>();
    for (let hop = 0; hop < 32; hop += 1) {
      if (seen.has(current)) return current;
      seen.add(current);
      const [row] = await this.db.select({ id: runs.id, parent: runs.parentRunId }).from(runs).where(eq(runs.id, current)).limit(1);
      if (!row) throw new NotFoundException();
      if (!row.parent) return current;
      current = row.parent;
    }
    return current;
  }

  /** Walk down from the root to collect every run id in the rerun tree. */
  async treeIdsOf(rootId: string): Promise<string[]> {
    const ids = [rootId];
    let frontier = [rootId];
    for (let hop = 0; hop < 32 && frontier.length > 0; hop += 1) {
      const kids = await this.db.select({ id: runs.id }).from(runs).where(inArray(runs.parentRunId, frontier));
      frontier = kids.map((row) => row.id);
      for (const id of frontier) if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  /**
   * The merged view of a rerun tree: the root's caller set, but each caller's record
   * is the latest call for that persona across the root and every rerun.
   * This is what the summary page shows after an individual rerun, so the other callers
   * from the original run do not disappear.
   */
  async getMerged(id: string) {
    const rootId = await this.rootOf(id);
    const ids = await this.treeIdsOf(rootId);
    const [root] = await Promise.all([this.get(rootId)]);
    const others = await Promise.all(ids.filter((runId) => runId !== rootId).map((runId) => this.get(runId)));
    const everyRun = [root, ...others];
    const flat = everyRun.flatMap((run) => run.calls.map((call) => ({ ...call, _run_id: run.id })));
    const byPersona = new Map<string, (typeof flat)[number]>();
    for (const call of flat) {
      const current = byPersona.get(call.persona_id);
      if (!current) {
        byPersona.set(call.persona_id, call);
        continue;
      }
      const a = current.started_at ? Date.parse(current.started_at) : 0;
      const b = call.started_at ? Date.parse(call.started_at) : 0;
      if (b >= a) byPersona.set(call.persona_id, call);
    }
    // Keep the root's caller order so the ring on the orbit matches the summary.
    const ordered = root.calls.map((seed) => byPersona.get(seed.persona_id) ?? seed);
    // Fold the fix blocks for the latest call id of each persona so the page keeps the right patch.
    const latestIds = new Set(ordered.map((call) => call.id));
    const fixes = everyRun.flatMap((run) => run.fix_suggestions).filter((fix) => {
      const ids = fix.evidence_call_ids ?? [];
      if (ids.length === 0) return true;
      return ids.every((callId) => latestIds.has(callId));
    });
    const parentHeldPct = root.calls.length
      ? Math.round((root.calls.filter((call) => call.verdict === "green").length / root.calls.length) * 100)
      : 0;
    const currentHeldPct = ordered.length
      ? Math.round((ordered.filter((call) => call.verdict === "green").length / ordered.length) * 100)
      : 0;
    return {
      ...root,
      id: rootId,
      root_run_id: rootId,
      latest_run_id: id,
      cost: ordered.reduce((sum, call) => sum + (call.cost === null ? 0 : Number(call.cost)), 0),
      calls: ordered,
      fix_suggestions: fixes,
      // The before/after lives here so the UI can show it without fetching the parent again.
      compare: {
        before_held_pct: parentHeldPct,
        after_held_pct: currentHeldPct,
        reruns: ids.length - 1,
        full_reruns: everyRun.filter((item) => item.rerun_scope === "full").length,
        caller_reruns: everyRun.filter((item) => item.rerun_scope === "caller").length,
      },
    };
  }

  async get(id: string) {
    const [run] = await this.db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (!run) throw new NotFoundException();
    const [target] = await this.db.select().from(targets).where(eq(targets.id, run.targetId)).limit(1);
    const callRows = await this.db
      .select()
      .from(calls)
      .where(eq(calls.runId, id))
      .orderBy(sql`${calls.startedAt} ASC NULLS LAST, ${calls.id} ASC`);
    const ids = callRows.map((call) => call.id);
    const scoreRows = ids.length === 0 ? [] : await this.db.select().from(scores).where(inArray(scores.callId, ids));
    const fixRows = await this.db
      .select()
      .from(fixSuggestions)
      .where(eq(fixSuggestions.runId, id))
      .orderBy(fixSuggestions.idx);
    const priorByPersona = await priorScores(this.db, run.parentRunId, run.rerunScope);
    return {
      id: run.id,
      label: run.label,
      status: run.status,
      parent_run_id: run.parentRunId,
      rerun_scope: run.rerunScope,
      pass_rate: run.passRate === null ? null : Number(run.passRate),
      name: target?.name ?? "Bot",
      desk: storedDesk(callRows[0]?.userData) || target?.name || "Bot",
      task_goal: target?.taskGoal ?? "",
      cost: callRows.reduce((sum, call) => sum + (call.cost === null ? 0 : Number(call.cost)), 0),
      fix_suggestions: fixRows.map((fix) => ({
        idx: fix.idx,
        dimension: fix.dimension,
        suggestion: fix.suggestion,
        evidence_call_ids: fix.evidenceCallIds ?? [],
      })),
      calls: callRows.map((call) => {
        const mine = scoreRows.filter((score) => score.callId === call.id);
        const task = mine.find((score) => score.dimension === "task_completion");
        const evidence = task?.evidence;
        const brief = evidence && typeof evidence === "object" && "brief" in evidence ? evidence.brief : null;
        return {
          id: call.id,
          persona_id: call.personaId,
          status: call.status,
          verdict: call.verdict,
          execution_id: call.bolnaExecutionId,
          duration_s: call.durationS,
          started_at: call.startedAt ? call.startedAt.toISOString() : null,
          cost: call.cost === null ? null : Number(call.cost),
          brief,
          prior: priorByPersona.get(call.personaId) ?? null,
          scores: mine.map((score) => ({
            dimension: score.dimension,
            score: score.score,
            // The judge drops `score` when its confidence is under the floor.
            // The rounded value is still useful on the UI tiles and pillar bars.
            rounded: readRounded(score.evidence),
            cell: score.verdict,
          })),
        };
      }),
    };
  }

  // Rerun places a new live call on the same target, so the patched agent can be heard.
  async rerun(parentId: string, session: string | null = null) {
    const [parent] = await this.db.select().from(runs).where(eq(runs.id, parentId)).limit(1);
    if (!parent) throw new NotFoundException();
    const [target] = await this.db.select().from(targets).where(eq(targets.id, parent.targetId)).limit(1);
    if (!target) throw new NotFoundException();
    const parentCalls = await this.db.select().from(calls).where(eq(calls.runId, parentId));
    if (parentCalls.length === 0) throw new BadRequestException("Nothing to rerun.");
    const runId = crypto.randomUUID();
    try {
    await this.prepareDemoLine(target, intendedSlug(parentCalls[0]?.userData), runId, session);

    const [run] = await this.db
      .insert(runs)
      .values({ id: runId, targetId: target.id, label: `${parent.label} · rerun`, parentRunId: parent.id, rerunScope: "full", status: "queued" })
      .returning({ id: runs.id });
    if (!run) throw new Error("Could not save the rerun");

    for (const call of parentCalls) {
      await this.db.insert(calls).values({
        runId: run.id,
        personaId: call.personaId,
        userData: withoutFixture(call.userData),
        status: "pending",
      });
    }
    await this.jobs.add("run.start", { runId: run.id }, { jobId: `start-${run.id}`, attempts: 3, backoff: { type: "exponential", delay: 5_000 } });
    return { id: run.id, status: "queued", parent_run_id: parent.id };
    } catch (error) {
      await clearSharedLine(this.db, runId).catch(() => undefined);
      throw error;
    }
  }

  /** Push the merged block to the demo agent's prompt. Gated off until PATCH_ENABLED is true. */
  async applyRunPatch(runId: string) {
    const [run] = await this.db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    if (!run) throw new NotFoundException();
    const [target] = await this.db.select().from(targets).where(eq(targets.id, run.targetId)).limit(1);
    if (!target) throw new NotFoundException();
    const [sample] = await this.db.select({ userData: calls.userData }).from(calls).where(eq(calls.runId, runId)).limit(1);
    const slug = intendedSlug(sample?.userData);
    if (slug) await this.prepareDemoLine(target, slug);
    const fixes = await this.db.select().from(fixSuggestions).where(eq(fixSuggestions.runId, runId));
    const runCalls = await this.db.select().from(calls).where(eq(calls.runId, runId));
    const ordered = [...runCalls].sort((left, right) => (left.startedAt?.getTime() ?? 0) - (right.startedAt?.getTime() ?? 0));
    const parts: { block: string; title: string; hindi: boolean }[] = [];
    for (const call of ordered) {
      if (call.verdict === "green") continue;
      const own = blockForCall(fixes, call.id);
      if (!own) continue;
      const [language] = await this.db
        .select({ score: scores.score })
        .from(scores)
        .where(and(eq(scores.callId, call.id), eq(scores.dimension, "language_switch")))
        .limit(1);
      const spokeHindi = await callerSpokeHindi(this.db, [call.id]);
      parts.push({
        block: own,
        title: CALLER_NAME[call.personaId] ?? call.personaId,
        hindi: language?.score == null || language.score < 3 || spokeHindi,
      });
    }
    const block = parts[0]?.block ?? "";
    const failing = await this.db
      .select({ id: calls.id })
      .from(calls)
      .where(and(eq(calls.runId, runId), inArray(calls.verdict, ["red", "amber"])));
    const failingIds = failing.map((row) => row.id);
    const languageScores = failingIds.length
      ? await this.db
          .select({ callId: scores.callId, score: scores.score })
          .from(scores)
          .where(and(inArray(scores.callId, failingIds), eq(scores.dimension, "language_switch")))
      : [];
    const languageSwitchBelow3 = languageScores.some((row) => row.score !== null && row.score < 3);
    const scoredIds = new Set(languageScores.filter((row) => row.score !== null).map((row) => row.callId));
    const languageMissingOrLow =
      failingIds.length > 0 &&
      failingIds.some((id) => {
        const row = languageScores.find((item) => item.callId === id);
        return !row || row.score === null || row.score < 3;
      });
    const heardHindi = await callerSpokeHindi(this.db, failingIds.filter((id) => !scoredIds.has(id)));
    const spokeHindi = await callerSpokeHindi(this.db, failingIds);
    return runPatch({
      enabled: env.patchEnabled,
      agentId: (slug && env.demoAgents[slug]) || target.bolnaAgentId,
      block,
      parts,
      title: "Kasauti patch",
      scope: "full",
      targetName: target.name,
      languageSwitchBelow3,
      heardHindi,
      hindiClose: languageMissingOrLow || spokeHindi,
    });
  }

  /** Push a single call's prompt line to the same patched section. Gated off until PATCH_ENABLED is true. */
  async applyCallPatch(callId: string) {
    const [call] = await this.db.select().from(calls).where(eq(calls.id, callId)).limit(1);
    if (!call) throw new NotFoundException();
    const [run] = await this.db.select().from(runs).where(eq(runs.id, call.runId)).limit(1);
    const [target] = run ? await this.db.select().from(targets).where(eq(targets.id, run.targetId)).limit(1) : [];
    const [task] = await this.db
      .select()
      .from(scores)
      .where(and(eq(scores.callId, call.id), eq(scores.dimension, "task_completion")))
      .limit(1);
    const brief = briefOf(task?.evidence);
    const line = brief?.prompt_line?.trim() ?? "";
    const fixes = run ? await this.db.select().from(fixSuggestions).where(eq(fixSuggestions.runId, run.id)) : [];
    const ownBlock = blockForCall(fixes, call.id);
    const slug = intendedSlug(call.userData);
    if (target && slug) await this.prepareDemoLine(target, slug);
    const [language] = await this.db
      .select({ score: scores.score })
      .from(scores)
      .where(and(eq(scores.callId, call.id), eq(scores.dimension, "language_switch")))
      .limit(1);
    const spokeHindi = call.verdict !== "green" && (await callerSpokeHindi(this.db, [call.id]));
    const languageSwitchBelow3 = call.verdict !== "green" && language?.score != null && language.score < 3;
    const heardHindi = call.verdict !== "green" && language?.score == null && spokeHindi;
    const hindiClose = call.verdict !== "green" && (language?.score == null || language.score < 3 || spokeHindi);
    return runPatch({
      enabled: env.patchEnabled,
      agentId: (slug && env.demoAgents[slug]) || target?.bolnaAgentId || null,
      block: ownBlock || line,
      title: "Kasauti patch",
      scope: ownBlock ? "full" : "line",
      targetName: storedDesk(call.userData) || target?.name || "",
      languageSwitchBelow3,
      heardHindi,
      hindiClose,
    });
  }

  /** Rerun one call as a child run. The fixture flag is dropped so Bolna places a new call. */
  async rerunCall(callId: string, session: string | null = null) {
    const [call] = await this.db.select().from(calls).where(eq(calls.id, callId)).limit(1);
    if (!call) throw new NotFoundException();
    const [parent] = await this.db.select().from(runs).where(eq(runs.id, call.runId)).limit(1);
    if (!parent) throw new NotFoundException();
    const [target] = await this.db.select().from(targets).where(eq(targets.id, parent.targetId)).limit(1);
    if (!target) throw new NotFoundException();
    const runId = crypto.randomUUID();
    try {
    await this.prepareDemoLine(target, intendedSlug(call.userData), runId, session);

    const [run] = await this.db
      .insert(runs)
      .values({ id: runId, targetId: parent.targetId, label: `${parent.label} · ${call.personaId}`, parentRunId: parent.id, rerunScope: "caller", status: "queued" })
      .returning({ id: runs.id });
    if (!run) throw new Error("Could not save the rerun");

    await this.db.insert(calls).values({
      runId: run.id,
      personaId: call.personaId,
      userData: withoutFixture(call.userData),
      status: "pending",
    });
    await this.jobs.add("run.start", { runId: run.id }, { jobId: `start-${run.id}`, attempts: 3, backoff: { type: "exponential", delay: 5_000 } });
    return { id: run.id, status: "queued", parent_run_id: parent.id, call_id: callId };
    } catch (error) {
      await clearSharedLine(this.db, runId).catch(() => undefined);
      throw error;
    }
  }

  /** Claim the shared line for a new run, or refuse a switch while another run is still connecting. */
  private async holdSharedLine(runId: string | null, session: string | null = null) {
    const phone = (await this.inbound.sharedPhone()) ?? "";
    if (!phone) return;
    try {
      await reserveSharedLine(this.db, phone, runId, session);
    } catch (error) {
      if (error instanceof LineBusyError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** Puts a demo agent on the shared number and points the target at that number. Own numbers stay. */
  private async prepareDemoLine(
    target: { id: string; name: string; bolnaAgentId: string | null; phoneE164: string },
    slug = demoSlugOf(target),
    runId?: string,
    session: string | null = null,
  ) {
    if (!slug) {
      assertAllowed(target.phoneE164, env.allowedNumbers);
      return;
    }
    await this.holdSharedLine(runId ?? null, session);
    const moved = await this.inbound.switchTo(slug);
    if (!moved.ok) throw new BadRequestException(moved.error || "Could not put this agent on the shared number.");
    const phone = await this.inbound.sharedPhone();
    if (!phone) throw new BadRequestException("No shared number is linked to a demo agent.");
    assertAllowed(phone, env.allowedNumbers);
    if (target.phoneE164 !== phone || target.bolnaAgentId !== env.demoAgents[slug]) {
      await this.db
        .update(targets)
        .set({ phoneE164: phone, bolnaAgentId: env.demoAgents[slug] || target.bolnaAgentId })
        .where(eq(targets.id, target.id));
    }
  }

  async sample() {
    const [run] = await this.db.select().from(runs).orderBy(desc(runs.createdAt)).limit(1);
    if (!run) throw new NotFoundException();
    return this.get(run.id);
  }

  async listTargets() {
    const rows = await this.db.select().from(targets).orderBy(desc(targets.createdAt));
    const listed = [];
    for (const target of rows) {
      const [last] = await this.db.select().from(runs).where(eq(runs.targetId, target.id)).orderBy(desc(runs.createdAt)).limit(1);
      listed.push({
        id: target.id,
        name: target.name,
        phone_e164: target.phoneE164,
        task_goal: target.taskGoal,
        last_run_id: last?.id ?? null,
        last_label: last?.label ?? null,
        last_status: last?.status ?? null,
        last_pass_rate: last?.passRate === null || last?.passRate === undefined ? null : Number(last.passRate),
      });
    }
    return listed;
  }

  /** Streams the recording through the backend so the browser never holds a Bolna key. */
  async getRecording(id: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
    const [call] = await this.db.select().from(calls).where(eq(calls.id, id)).limit(1);
    if (!call) throw new NotFoundException();
    const url = recordingUrl(call.executionRaw);
    if (!url) return null;
    const keys = [env.bolnaApiKey, env.demoBolnaApiKey].filter((key) => key.length > 0);
    for (const key of keys) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
      if (response.status === 401 || response.status === 403) continue;
      if (!response.ok) continue;
      return {
        body: await response.arrayBuffer(),
        contentType: response.headers.get("content-type") ?? "audio/mpeg",
      };
    }
    return null;
  }

  async getCall(id: string) {
    const [call] = await this.db.select().from(calls).where(eq(calls.id, id)).limit(1);
    if (!call) throw new NotFoundException();
    const [run] = await this.db.select().from(runs).where(eq(runs.id, call.runId)).limit(1);
    const [target] = run ? await this.db.select().from(targets).where(eq(targets.id, run.targetId)).limit(1) : [];
    const turnRows = await this.db.select().from(turns).where(eq(turns.callId, id));
    const [metric] = await this.db.select().from(callMetrics).where(eq(callMetrics.callId, id)).limit(1);
    return {
      id: call.id,
      run_id: call.runId,
      bot_name: target?.name ?? "Bot",
      desk: storedDesk(call.userData) || target?.name || "Bot",
      persona_id: call.personaId,
      status: call.status,
      verdict: call.verdict,
      duration_s: call.durationS,
      cost: call.cost === null ? null : Number(call.cost),
      hangup_by: call.hangupBy,
      hangup_reason: call.hangupReason,
      recording_available: recordingUrl(call.executionRaw) !== null,
      metrics: metric
        ? {
            persona_turns: metric.personaTurns,
            target_turns: metric.targetTurns,
          }
        : null,
      turns: turnRows
        .map((turn) => ({ idx: turn.idx, speaker: turn.speaker, text: turn.text, lang: turn.lang }))
        .sort((a, b) => a.idx - b.idx),
    };
  }

  /** Live name, welcome, prompt, and engine labels for every demo desk. Cached for a minute. */
  async listDesks() {
    const hit = desksCache;
    if (hit && Date.now() - hit.at < 60_000) return { ok: true, desks: hit.desks };
    const order = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;
    const desks = [];
    for (const slug of order) {
      if (!env.demoAgents[slug]) continue;
      try {
        const agent = (await demoBolna("GET", `/v2/agent/${demoAgentId(slug)}`)) as Record<string, unknown>;
        desks.push({ slug, ...liveCardOf(agent) });
      } catch {
        desks.push({ slug, name: "", welcome: "", prompt: "", transcriber: "—", model: "—", voice: "—", unread: true });
      }
    }
    desksCache = { at: Date.now(), desks };
    return { ok: true, desks };
  }

  /** The live engine numbers for the agent card. Cached for a minute so the page does not re-read Bolna on every refresh. */
  async deskSettings(slug: string) {
    const hit = settingsCache.get(slug);
    if (hit && Date.now() - hit.at < 60_000) return { ok: true, settings: hit.settings };
    const agent = (await demoBolna("GET", `/v2/agent/${demoAgentId(slug)}`)) as Record<string, unknown>;
    const settings = liveSettingsOf(agent);
    settingsCache.set(slug, { at: Date.now(), settings });
    return { ok: true, settings };
  }

  /**
   * Opening a desk for a test puts the first draft back.
   * Name, welcome, voice, and the task list stay. A desk already on that draft is left alone.
   * A test that is still running is left alone too.
   */
  async openDesk(slug: string) {
    const agentId = demoAgentId(slug);
    const manifest = await loadTargetManifest(repoRoot, slug);
    const draft = initialPromptFor(manifest);
    const agent = (await demoBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
    const phone = (await this.inbound.sharedPhone()) ?? "";
    if (phone) {
      const occupy = await readLineOccupancy(this.db, phone, null);
      if (occupy.busy) {
        return { ok: true, restored: false, held: true, ...liveCardOf(agent) };
      }
    }
    const current = liveAgentOf(agent).systemPrompt.trim();
    if (current !== draft) {
      const welcome = agent.agent_welcome_message;
      await demoBolna("PUT", `/v2/agent/${agentId}`, {
        agent_config: {
          agent_name: agent.agent_name,
          agent_type: agent.agent_type,
          agent_welcome_message: welcome,
          webhook_url: agent.webhook_url,
          tasks: agent.tasks,
          ingest_source_config: agent.ingest_source_config,
          calling_guardrails: agent.calling_guardrails,
          call_summary_enabled: agent.call_summary_enabled,
        },
        agent_prompts: { task_1: { system_prompt: draft } },
        composition_by_language: { en: [{ type: "text", text: draft }] },
      });
      const after = (await demoBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
      const written = liveAgentOf(after).systemPrompt.trim();
      if (written !== draft || after.agent_welcome_message !== welcome) {
        throw new BadRequestException("The first draft did not stick.");
      }
      desksCache = null;
      return { ok: true, restored: true, held: false, ...liveCardOf(after) };
    }
    return { ok: true, restored: false, held: false, ...liveCardOf(agent) };
  }

  /** Whether the live desk still carries a Kasauti footer. The first draft does not. */
  async deskDraft(slug: string) {
    const agentId = demoAgentId(slug);
    const agent = (await demoBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
    return { ok: true, footer: hasKasautiFooter(liveAgentOf(agent).systemPrompt) };
  }

  /** Replace the live prompt with the desk's seed prompt. The welcome and the task list stay. */
  async resetDesk(slug: string) {
    const agentId = demoAgentId(slug);
    const manifest = await loadTargetManifest(repoRoot, slug);
    const draft = initialPromptFor(manifest);
    const agent = (await demoBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
    if (liveAgentOf(agent).systemPrompt.trim() === draft) {
      throw new BadRequestException("This desk is already on the first draft.");
    }
    const welcome = agent.agent_welcome_message;
    await demoBolna("PUT", `/v2/agent/${agentId}`, {
      agent_config: {
        agent_name: agent.agent_name,
        agent_type: agent.agent_type,
        agent_welcome_message: welcome,
        webhook_url: agent.webhook_url,
        tasks: agent.tasks,
        ingest_source_config: agent.ingest_source_config,
        calling_guardrails: agent.calling_guardrails,
        call_summary_enabled: agent.call_summary_enabled,
      },
      agent_prompts: { task_1: { system_prompt: draft } },
      composition_by_language: { en: [{ type: "text", text: draft }] },
    });
    const after = (await demoBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
    const written = liveAgentOf(after).systemPrompt.trim();
    if (written !== draft || hasKasautiFooter(written) || after.agent_welcome_message !== welcome) {
      throw new BadRequestException("The first draft did not stick.");
    }
    return { ok: true, reset: true };
  }

  /** Whether Sharma ji's live caller still hangs up before the close line. */
  async callerDraft(persona: string) {
    assertSharma(persona);
    const agent = (await callerBolna("GET", `/v2/agent/${await sharmaAgentId()}`)) as Record<string, unknown>;
    return { ok: true, name: "Sharma ji", current: liveAgentOf(agent).systemPrompt.includes(SHARMA_CLOSE) };
  }

  /** Replace Sharma ji's live caller prompt with the local file. No other caller is written. */
  async pushCallerPrompt(persona: string) {
    assertSharma(persona);
    const local = (await readFile(join(repoRoot, "personas/angry_uncle/prompt.md"), "utf8")).trim();
    if (!local.includes(SHARMA_CLOSE) || !local.includes("{{welcome}}") || !local.includes("{{close_rule}}")) {
      throw new BadRequestException("The local caller file is missing the close rule.");
    }
    const agentId = await sharmaAgentId();
    const agent = (await callerBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
    if (liveAgentOf(agent).systemPrompt.includes(SHARMA_CLOSE)) {
      throw new BadRequestException("Sharma ji already follows the close rule.");
    }
    const welcome = agent.agent_welcome_message;
    await callerBolna("PUT", `/v2/agent/${agentId}`, {
      agent_config: {
        agent_name: agent.agent_name,
        agent_type: agent.agent_type,
        agent_welcome_message: welcome,
        webhook_url: agent.webhook_url,
        tasks: agent.tasks,
        ingest_source_config: agent.ingest_source_config,
        calling_guardrails: agent.calling_guardrails,
        call_summary_enabled: agent.call_summary_enabled,
      },
      agent_prompts: { task_1: { system_prompt: local } },
      composition_by_language: { en: [{ type: "text", text: local }] },
    });
    const after = (await callerBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
    const written = liveAgentOf(after).systemPrompt;
    if (!written.includes(SHARMA_CLOSE) || !written.includes("{{close_rule}}") || after.agent_welcome_message !== welcome) {
      throw new BadRequestException("The caller prompt did not stick.");
    }
    return { ok: true, name: "Sharma ji", current: true };
  }
}

/** The call keeps the business name it was dialed with. The shared target row does not. */
function storedDesk(userData: unknown): string {
  if (!userData || typeof userData !== "object") return "";
  const name = (userData as { target_name?: unknown }).target_name;
  return typeof name === "string" ? name.trim() : "";
}

function intendedSlug(userData: unknown): ReturnType<typeof demoSlugOf> {
  if (!userData || typeof userData !== "object") return null;
  const name = (userData as { target_name?: unknown }).target_name;
  if (typeof name !== "string") return null;
  const agentId = knownDemoAgentId(name);
  if (!agentId) return null;
  const slug = Object.entries(env.demoAgents).find(([, id]) => id === agentId)?.[0];
  return slug && isDemoSlug(slug) ? slug : null;
}

function demoSlugOf(target: { name: string; bolnaAgentId: string | null }) {
  const byId = Object.entries(env.demoAgents).find(([, id]) => id && id === target.bolnaAgentId)?.[0];
  if (byId && isDemoSlug(byId)) return byId;
  const linked = knownDemoAgentId(target.name);
  const byName = Object.entries(env.demoAgents).find(([, agentId]) => agentId && agentId === linked)?.[0];
  return byName && isDemoSlug(byName) ? byName : null;
}

function withoutFixture(userData: unknown): Record<string, unknown> {
  const record = userData !== null && typeof userData === "object" ? { ...(userData as Record<string, unknown>) } : {};
  delete record.fixture;
  return record;
}

function recordingUrl(executionRaw: unknown): string | null {
  if (!executionRaw || typeof executionRaw !== "object") return null;
  const telephony = (executionRaw as { telephony_data?: unknown }).telephony_data;
  if (!telephony || typeof telephony !== "object") return null;
  const url = (telephony as { recording_url?: unknown }).recording_url;
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return null;
  return url;
}

function briefOf(evidence: unknown): { prompt_line?: string } | null {
  if (!evidence || typeof evidence !== "object") return null;
  const brief = (evidence as { brief?: unknown }).brief;
  if (!brief || typeof brief !== "object") return null;
  return brief as { prompt_line?: string };
}

type PriorScore = { call_id: string; verdict: string | null; score: number | null; scope: string | null };

/** The score just before this rerun, per persona, taken from the parent run. */
async function priorScores(db: Database, parentRunId: string | null, scope: string | null): Promise<Map<string, PriorScore>> {
  const out = new Map<string, PriorScore>();
  if (!parentRunId) return out;
  const parentCalls = await db.select().from(calls).where(eq(calls.runId, parentRunId));
  const parentIds = parentCalls.map((call) => call.id);
  const parentScoreRows = parentIds.length === 0 ? [] : await db.select().from(scores).where(inArray(scores.callId, parentIds));
  for (const parentCall of parentCalls) {
    const mine = parentScoreRows.filter((row) => row.callId === parentCall.id);
    out.set(parentCall.personaId, {
      call_id: parentCall.id,
      verdict: parentCall.verdict,
      score: overallOf(mine),
      scope,
    });
  }
  return out;
}

function overallOf(rows: { score: number | null; evidence: unknown }[]): number | null {
  const values = rows
    .map((row) => (typeof row.score === "number" ? row.score : readRounded(row.evidence)))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length / 5) * 100);
}

/** The judge's rounded 1-5 for a dimension, even when the final `score` was gated out by the confidence floor. */
function readRounded(evidence: unknown): number | null {
  if (!evidence || typeof evidence !== "object") return null;
  const rounded = (evidence as { rounded?: unknown }).rounded;
  if (typeof rounded !== "number") return null;
  if (!Number.isFinite(rounded)) return null;
  return Math.round(rounded);
}

const settingsCache = new Map<string, { at: number; settings: { label: string; value: string }[] }>();
let desksCache: { at: number; desks: { slug: string; name: string; welcome: string; prompt: string; transcriber: string; model: string; voice: string; unread?: boolean }[] } | null = null;
const SHARMA_CLOSE = "Do not hang up in the turn where you are still stating the problem.";

function assertSharma(persona: string) {
  if (persona !== "angry_uncle") throw new BadRequestException("Only Sharma ji can be updated from here.");
}

async function sharmaAgentId(): Promise<string> {
  const fromFile = await readFile(join(repoRoot, "personas/angry_uncle/.agent_id"), "utf8").catch(() => "");
  const id = fromFile.trim() || env.personaAgentId;
  if (!id) throw new BadRequestException("Sharma ji has no caller agent.");
  return id;
}

async function callerBolna(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!env.bolnaApiKey) throw new Error("BOLNA_API_KEY is missing");
  const response = await fetch(`${env.bolnaBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.bolnaApiKey}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Bolna ${method} failed (${response.status})`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function demoAgentId(slug: string): string {
  if (!isDemoSlug(slug)) throw new BadRequestException("Unknown desk.");
  const id = env.demoAgents[slug];
  if (!id) throw new BadRequestException("This desk has no agent.");
  return id;
}

/** The target name picked in the UI maps 1:1 to a demo agent id in .env. */
function knownDemoAgentId(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
  const map: Record<string, string> = {
    "sehat clinic": env.demoAgents.sehat,
    rupeesetu: env.demoAgents.rupeesetu,
    "rupeesetu finance": env.demoAgents.rupeesetu,
    "swaad kitchen": env.demoAgents.swaad,
    nila: env.demoAgents.nila,
    nivas: env.demoAgents.nivas,
    "nivas homes": env.demoAgents.nivas,
  };
  const id = map[trimmed];
  return id || null;
}

async function demoBolna(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!env.demoBolnaApiKey) throw new Error("DEMO_BOLNA_API_KEY is missing");
  const response = await fetch(`${env.bolnaBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.demoBolnaApiKey}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Bolna ${method} ${path} failed (${response.status})`);
  return parsed;
}

async function callerSpokeHindi(db: Database, callIds: string[]): Promise<boolean> {
  if (callIds.length === 0) return false;
  const spoken = await db
    .select({ text: turns.text })
    .from(turns)
    .where(and(inArray(turns.callId, callIds), eq(turns.speaker, "persona")));
  return spoken.some((row) => /[\u0900-\u097F]/.test(row.text));
}

/** Reads then writes the Bolna agent prompt. Gated off until PATCH_ENABLED is exactly "true". */
async function runPatch(input: {
  enabled: boolean;
  agentId: string | null;
  block: string;
  parts?: { block: string; title?: string; hindi?: boolean }[];
  title: string;
  scope: "full" | "line";
  targetName: string;
  languageSwitchBelow3: boolean;
  heardHindi: boolean;
  hindiClose: boolean;
}) {
  const slug = manifestSlugOf(input.targetName);
  const manifest = slug ? await loadTargetManifest(repoRoot, slug) : null;
  const requestedLanguage = manifest?.bolna.default_transcriber_language || "multi";
  let transcriber: { flipped: boolean; from: string | null; to: string | null } | null = null;
  const result = await executePatch({
    enabled: input.enabled,
    agentId: input.agentId,
    block: input.block,
    parts: input.parts,
    title: input.title,
    scope: input.scope,
    hindi: input.hindiClose,
    today: new Date().toISOString().slice(0, 10),
    read: async (agentId) => {
      const agent = (await demoBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
      const prompts = (agent.agent_prompts ?? {}) as Record<string, unknown>;
      const task1 = (prompts.task_1 ?? {}) as Record<string, unknown>;
      return typeof task1.system_prompt === "string" ? task1.system_prompt : "";
    },
    write: async (agentId, next) => {
      const agent = (await demoBolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
      const nextLanguage = bolnaLanguage(requestedLanguage, agent.tasks);
      const updated = withTranscriberLanguage(agent.tasks, {
        languageSwitchBelow3: input.languageSwitchBelow3,
        heardHindi: input.heardHindi,
        nextLanguage,
      });
      const silenced = withoutModelHangup(updated.tasks);
      const slower = withLongerSilence(silenced.tasks);
      transcriber = { flipped: updated.flipped, from: updated.from, to: updated.to };
      if (updated.flipped) console.log(`transcriber ${updated.from} -> ${updated.to}`);
      if (silenced.changed) console.log("model hangup off");
      if (slower.changed) console.log("silence hangup raised");
      await demoBolna("PUT", `/v2/agent/${agentId}`, {
        agent_config: {
          agent_name: agent.agent_name,
          agent_type: agent.agent_type,
          agent_welcome_message: agent.agent_welcome_message,
          webhook_url: agent.webhook_url,
          tasks: slower.tasks,
          ingest_source_config: agent.ingest_source_config,
          calling_guardrails: agent.calling_guardrails,
          call_summary_enabled: agent.call_summary_enabled,
        },
        agent_prompts: { task_1: { system_prompt: next } },
        composition_by_language: { en: [{ type: "text", text: next }] },
      });
    },
  });
  return {
    ok: result.ok,
    applied: result.applied,
    mode: result.mode ?? null,
    enabled: input.enabled,
    error: result.reason,
    before_length: result.before?.length ?? null,
    after_length: result.after?.length ?? null,
    transcriber,
  };
}
