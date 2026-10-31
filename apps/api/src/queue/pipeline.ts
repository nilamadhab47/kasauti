import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import type { JobsOptions } from "bullmq";
import { callerBrief, callVerdict, dimensionCell, judgeView, loadPersonaProfile, loadTargetManifest, manifestSlugOf, metricsOf, parseTranscript } from "../../../../packages/core/src/index.ts";
import { mergePromptLines, patchMode, writeBrief } from "../../../../packages/judge/src/claude.ts";
import { quoteSupportsFailure, scoreCall } from "../../../../packages/judge/src/jev.ts";
import type { Database } from "../db/db.module";
import { callMetrics, calls, fixSuggestions, personaAgents, runs, scores, targets, turns } from "../db/schema";
import { env } from "../env";
import { logLine } from "../log";
import { getExecution, placeCall, readLiveAgent } from "./bolna";
import { executionFields } from "./execution";
import { fixtureFile, isTerminal } from "./guards";
import { clearSharedLine, releaseSharedLine } from "../runs/line-lock";

const repoRoot = join(__dirname, "../../../..");
const TARGET_TASK =
  "Help callers book doctor appointments. Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking. Always try to give an answer.";
const IN_FLIGHT = ["queued", "initiated", "ringing", "in-progress"];
const WATCH_MS = 15_000;
const GIVE_UP_MS = 8 * 60 * 1000;

export type Enqueue = (name: string, data: object, opts?: JobsOptions) => Promise<void>;

const jobDefaults: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { count: 200 },
};

export async function startRun(db: Database, enqueue: Enqueue, runId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error(`Run ${runId} was not found`);
  const pending = await db.select().from(calls).where(and(eq(calls.runId, runId), eq(calls.status, "pending")));
  await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));
  const first = pending.slice(0, env.maxConcurrentCalls);
  for (let index = 0; index < first.length; index += 1) {
    const call = first[index];
    if (!call) continue;
    const fixture = fixtureOf(call.userData);
    await enqueue("call.place", { callId: call.id }, { ...jobDefaults, jobId: `place-${call.id}`, delay: fixture ? 0 : index * 20_000 });
  }
}

export async function placeQueuedCall(db: Database, enqueue: Enqueue, callId: string) {
  const call = await loadCall(db, callId);
  if (!call || call.bolnaExecutionId || call.verdict) {
    logLine(`place ${call?.personaId ?? callId} skipped`);
    return;
  }
  const [run] = await db.select().from(runs).where(eq(runs.id, call.runId)).limit(1);
  if (!run) throw new Error(`Run ${call.runId} was not found`);
  const [target] = await db.select().from(targets).where(eq(targets.id, run.targetId)).limit(1);
  if (!target) throw new Error("Target was not found");

  const inflight = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.runId, call.runId), inArray(calls.status, IN_FLIGHT)));
  if (inflight.length >= env.maxConcurrentCalls) {
    logLine(`place ${call.personaId} skipped, another call is in flight`);
    return;
  }

  const fixture = fixtureOf(call.userData);
  if (fixture) {
    const raw = JSON.parse(await readFile(fixtureFile(repoRoot, fixture), "utf8")) as unknown;
    const fields = executionFields(raw);
    // Fixture ids are fixed, so make the stored id unique per call to keep replays repeatable.
    await db
      .update(calls)
      .set({
        bolnaExecutionId: `fixture:${call.id}`,
        status: fields.status,
        executionRaw: fields.raw,
        startedAt: new Date(),
      })
      .where(eq(calls.id, call.id));
    await releaseSharedLine(db, call.runId, fields.status);
    await enqueue("call.ingest", { callId: call.id }, { ...jobDefaults, jobId: `ingest-${call.id}` });
    return;
  }

  const userData = stringMap(call.userData);
  logLine(`placing ${call.personaId}`);
  let placed: { executionId: string; status: string };
  try {
    const agentId = await agentIdFor(db, call.personaId);
    placed = await placeCall({ agentId, to: target.phoneE164, userData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "place failed";
    logLine(`place ${call.personaId} failed: ${message}`);
    throw error;
  }
  await db
    .update(calls)
    .set({ bolnaExecutionId: placed.executionId, status: placed.status, startedAt: new Date() })
    .where(eq(calls.id, call.id));
  await releaseSharedLine(db, call.runId, placed.status);
  await enqueue("call.watchdog", { callId: call.id, n: 1 }, { ...jobDefaults, jobId: `watch-${call.id}-1`, delay: WATCH_MS });
  logLine(`placed ${call.personaId} ${placed.status}`);
}

export async function watchCall(db: Database, enqueue: Enqueue, callId: string, n: number) {
  const call = await loadCall(db, callId);
  if (!call?.bolnaExecutionId || call.verdict || fixtureOf(call.userData)) return;
  const fields = executionFields(await getExecution(call.bolnaExecutionId));
  await db.update(calls).set({ status: fields.status, executionRaw: fields.raw }).where(eq(calls.id, call.id));
  if (!redialing(fields.status, call.attempt)) await releaseSharedLine(db, call.runId, fields.status);
  if (isTerminal(fields.status)) {
    await enqueue("call.ingest", { callId: call.id }, { ...jobDefaults, jobId: `ingest-${call.id}` });
    return;
  }
  const started = call.startedAt?.getTime() ?? Date.now();
  if (Date.now() - started > GIVE_UP_MS) {
    await db.update(calls).set({ status: "failed", hangupReason: "watchdog timed out" }).where(eq(calls.id, call.id));
    await releaseSharedLine(db, call.runId, "failed");
    await enqueue("run.finalize", { runId: call.runId }, jobDefaults);
    return;
  }
  const next = n + 1;
  await enqueue("call.watchdog", { callId, n: next }, { ...jobDefaults, jobId: `watch-${callId}-${next}`, delay: WATCH_MS });
}

export async function ingestCall(db: Database, enqueue: Enqueue, callId: string) {
  const call = await loadCall(db, callId);
  if (!call) return;
  if (call.verdict) {
    await enqueue("run.finalize", { runId: call.runId }, jobDefaults);
    return;
  }

  const fixture = fixtureOf(call.userData);
  const raw = fixture
    ? (JSON.parse(await readFile(fixtureFile(repoRoot, fixture), "utf8")) as unknown)
    : call.bolnaExecutionId
      ? await getExecution(call.bolnaExecutionId)
      : null;
  if (!raw) {
    if (!fixture && call.bolnaExecutionId) await holdForExecution(db, enqueue, call);
    return;
  }
  const fields = executionFields(raw);

  if ((fields.status === "no-answer" || fields.status === "busy") && call.attempt < 2) {
    await db
      .update(calls)
      .set({ attempt: 2, status: "pending", bolnaExecutionId: null, executionRaw: fields.raw })
      .where(eq(calls.id, call.id));
    await enqueue("call.place", { callId: call.id }, { ...jobDefaults, jobId: `place-${call.id}-2`, delay: 60_000 });
    return;
  }

  if (!isTerminal(fields.status)) {
    if (!fixture) await holdForExecution(db, enqueue, call);
    return;
  }

  if (fields.status !== "completed") {
    await db
      .update(calls)
      .set({
        status: fields.status,
        executionRaw: fields.raw,
        durationS: fields.durationS,
        cost: centsToCost(fields.costCents),
        hangupBy: fields.hangupBy,
        hangupReason: fields.hangupReason,
        endedAt: new Date(),
      })
      .where(eq(calls.id, call.id));
    await releaseSharedLine(db, call.runId, fields.status);
    await enqueue("run.finalize", { runId: call.runId }, jobDefaults);
    await placeNext(db, enqueue, call.runId);
    return;
  }

  const parsed = parseTranscript(fields.transcript);
  const metrics = metricsOf(parsed);
  await db.transaction(async (tx) => {
    await tx.delete(turns).where(eq(turns.callId, call.id));
    if (parsed.length > 0) {
      await tx.insert(turns).values(
        parsed.map((turn) => ({
          callId: call.id,
          idx: turn.idx,
          speaker: turn.speaker,
          text: turn.text,
          lang: turn.lang,
        })),
      );
    }
    await tx
      .insert(callMetrics)
      .values({
        callId: call.id,
        personaTurns: metrics.persona_turns,
        targetTurns: metrics.target_turns,
        maxSameSpeakerRun: metrics.max_same_speaker_run,
        personaRepeatCount: metrics.persona_repeat_count,
        targetHindiRatio: String(metrics.target_hindi_ratio),
        raw: metrics,
      })
      .onConflictDoUpdate({
        target: callMetrics.callId,
        set: {
          personaTurns: metrics.persona_turns,
          targetTurns: metrics.target_turns,
          maxSameSpeakerRun: metrics.max_same_speaker_run,
          personaRepeatCount: metrics.persona_repeat_count,
          targetHindiRatio: String(metrics.target_hindi_ratio),
          raw: metrics,
        },
      });
    await tx
      .update(calls)
      .set({
        status: "scoring",
        executionRaw: fields.raw,
        durationS: fields.durationS,
        cost: centsToCost(fields.costCents),
        hangupBy: fields.hangupBy,
        hangupReason: fields.hangupReason,
        ttfaMs: fields.ttfaMs === null ? null : String(Math.round(fields.ttfaMs)),
        endedAt: new Date(),
      })
      .where(eq(calls.id, call.id));
  });

  await db.update(runs).set({ status: "scoring" }).where(eq(runs.id, call.runId));
  await enqueue("call.judge", { callId: call.id }, { ...jobDefaults, jobId: `judge-${call.id}` });
}

export async function judgeCall(db: Database, enqueue: Enqueue, callId: string) {
  const call = await loadCall(db, callId);
  if (!call) return;
  const already = await db.select({ dimension: scores.dimension }).from(scores).where(eq(scores.callId, call.id)).limit(1);
  if (already.length > 0) {
    await enqueue("run.finalize", { runId: call.runId }, jobDefaults);
    await placeNext(db, enqueue, call.runId);
    return;
  }

  const [run] = await db.select().from(runs).where(eq(runs.id, call.runId)).limit(1);
  const [target] = run ? await db.select().from(targets).where(eq(targets.id, run.targetId)).limit(1) : [];
  const profile = await loadPersonaProfile(repoRoot, call.personaId).catch(() => null);
  const storedTurns = await db.select().from(turns).where(eq(turns.callId, call.id));
  const ordered = storedTurns
    .map((turn) => ({
      idx: turn.idx,
      speaker: turn.speaker as "persona" | "target",
      text: turn.text,
      lang: (turn.lang ?? "en") as "hi" | "en" | "mixed",
    }))
    .sort((a, b) => a.idx - b.idx);
  const metric = await db.select().from(callMetrics).where(eq(callMetrics.callId, call.id)).limit(1);

  const slug = manifestSlugOf(target?.name ?? "");
  const manifest = slug ? await loadTargetManifest(repoRoot, slug) : null;
  const caller = profile && manifest ? callerBrief(profile, manifest) : null;
  const viewed = profile && manifest ? judgeView(profile, manifest) : null;
  const card = await scoreCall({
    facts: target?.facts ?? {},
    targetTask: target?.taskGoal || TARGET_TASK,
    callerGoal: viewed?.goal || stringMap(call.userData).goal || caller?.user_data.goal || "",
    successCriteria: viewed?.success_criteria ?? caller?.success_criteria ?? [],
    inScope: manifest?.in_scope ?? [],
    outOfScope: manifest?.out_of_scope ?? [],
    turns: ordered,
  });
  const counted = card.scores.map((item) => ({ dimension: item.dimension, score: item.score }));
  const verdict = callVerdict({
    scores: counted,
    critical: profile?.critical_dimensions ?? [],
    targetTurns: metric[0]?.targetTurns ?? 0,
    status: "completed",
  });

  let draft = await writeBrief({ turns: ordered, scores: card.scores });
  let quoteKept = Boolean(draft.quote);
  if (draft.quote && draft.turn_idx !== null) {
    const turn = ordered.find((item) => item.idx === draft.turn_idx);
    const relation = await quoteSupportsFailure({
      sentence: draft.sentence,
      quote: draft.quote,
      turnText: turn?.text ?? "",
    });
    if (relation !== "supports") {
      quoteKept = false;
      draft = { ...draft, quote: "", turn_idx: null };
    }
  }

  let patchBlock = "";
  if (verdict !== "green" && draft.prompt_line.trim()) {
    try {
      patchBlock = await buildCallerBlock({
        desk: deskOf(call.userData) || target?.name || "",
        targetName: target?.name ?? "",
        taskGoal: target?.taskGoal || TARGET_TASK,
        bolnaAgentId: target?.bolnaAgentId ?? null,
        who: call.personaId,
        quote: draft.quote,
        line: draft.prompt_line,
      });
    } catch (error) {
      console.error(`patch block skipped for ${call.personaId}: ${(error as Error).message}`);
    }
  }

  const brief = {
    sentence: draft.sentence,
    quote: draft.quote,
    turn_idx: draft.turn_idx,
    prompt_line: draft.prompt_line,
    quote_kept: quoteKept,
    ...(patchBlock ? { block: patchBlock } : {}),
  };
  await db.insert(scores).values(
    card.scores.map((item) => ({
      callId: call.id,
      dimension: item.dimension,
      score: item.score,
      verdict: dimensionCell(item.score),
      evidence: {
        raw: item.raw,
        rounded: item.rounded,
        confidence: item.confidence,
        probabilities: item.probabilities,
        ...(item.dimension === "task_completion" ? { brief } : {}),
      },
      fixHint: item.dimension === "task_completion" ? draft.prompt_line : null,
      judgeVersion: card.model,
    })),
  );
  await db.update(calls).set({ status: "completed", verdict }).where(eq(calls.id, call.id));
  logLine(`scored ${call.personaId} ${verdict} (${card.model})`);
  await enqueue("run.finalize", { runId: call.runId }, jobDefaults);
  await placeNext(db, enqueue, call.runId);
}

export async function finalizeRun(db: Database, runId: string) {
  const rows = await db.select().from(calls).where(eq(calls.runId, runId));
  if (rows.length === 0) return;
  const open = rows.some((call) => !call.verdict && !isTerminal(call.status));
  if (open) return;

  const green = rows.filter((call) => call.verdict === "green").length;
  const promptLines: { suggestion: string; callId: string }[] = [];
  const failures: { who: string; quote: string; line: string; callId: string; block: string }[] = [];
  for (const call of rows) {
    const [task] = await db
      .select()
      .from(scores)
      .where(and(eq(scores.callId, call.id), eq(scores.dimension, "task_completion")))
      .limit(1);
    const brief = briefOf(task?.evidence);
    if (brief?.prompt_line) {
      promptLines.push({ suggestion: brief.prompt_line, callId: call.id });
      if (call.verdict && call.verdict !== "green") {
        failures.push({
          who: call.personaId,
          quote: brief.quote ?? "",
          line: brief.prompt_line,
          callId: call.id,
          block: brief.block?.trim() ?? "",
        });
      }
    }
  }

  const blocks: { suggestion: string; callId: string }[] = [];
  const pendingBlocks = failures.filter((failure) => !failure.block);
  if (pendingBlocks.length > 0) {
    const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    const [target] = run ? await db.select().from(targets).where(eq(targets.id, run.targetId)).limit(1) : [];
    const desk = rows.map((call) => deskOf(call.userData)).find((name) => name.length > 0) || target?.name || "";
    for (const failure of pendingBlocks) {
      try {
        const suggestion = await buildCallerBlock({
          desk,
          targetName: target?.name ?? "",
          taskGoal: target?.taskGoal || TARGET_TASK,
          bolnaAgentId: target?.bolnaAgentId ?? null,
          who: failure.who,
          quote: failure.quote,
          line: failure.line,
        });
        if (suggestion) blocks.push({ suggestion, callId: failure.callId });
      } catch (error) {
        console.error(`run ${runId} patch block skipped for ${failure.who}: ${(error as Error).message}`);
      }
    }
  }
  for (const failure of failures) {
    if (failure.block) blocks.push({ suggestion: failure.block, callId: failure.callId });
  }

  await db.transaction(async (tx) => {
    await tx.delete(fixSuggestions).where(eq(fixSuggestions.runId, runId));
    if (promptLines.length > 0) {
      await tx.insert(fixSuggestions).values(
        promptLines.map((line, idx) => ({
          runId,
          idx,
          dimension: "prompt",
          suggestion: line.suggestion,
          evidenceCallIds: [line.callId],
        })),
      );
    }
    if (blocks.length > 0) {
      await tx.insert(fixSuggestions).values(
        blocks.map((item, index) => ({
          runId,
          idx: promptLines.length + index,
          dimension: "block",
          suggestion: item.suggestion,
          evidenceCallIds: [item.callId],
        })),
      );
    }
    await tx
      .update(runs)
      .set({ status: "done", passRate: String(green / rows.length), finishedAt: new Date() })
      .where(eq(runs.id, runId));
  });
  await clearSharedLine(db, runId);
  console.log(`run ${runId} done, ${green} of ${rows.length} passed${blocks.length ? `, ${blocks.length} patch block${blocks.length === 1 ? "" : "s"} written` : ""}`);
}

async function placeNext(db: Database, enqueue: Enqueue, runId: string) {
  const [next] = await db.select().from(calls).where(and(eq(calls.runId, runId), eq(calls.status, "pending"))).limit(1);
  if (!next) {
    logLine(`no caller left in run ${runId}`);
    return;
  }
  logLine(`queue next ${next.personaId}`);
  const busy = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.runId, runId), inArray(calls.status, IN_FLIGHT)));
  if (busy.length >= env.maxConcurrentCalls) return;
  await enqueue("call.place", { callId: next.id }, { ...jobDefaults, jobId: `place-${next.id}` });
}

async function loadCall(db: Database, callId: string) {
  const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  return call ?? null;
}

async function agentIdFor(db: Database, personaId: string): Promise<string> {
  const [row] = await db.select().from(personaAgents).where(eq(personaAgents.personaId, personaId)).limit(1);
  if (row) return row.bolnaAgentId;
  const file = await readFile(join(repoRoot, "personas", personaId, ".agent_id"), "utf8").catch(() => "");
  const fromFile = file.trim();
  if (fromFile) return fromFile;
  if (personaId === "angry_uncle" && env.personaAgentId) return env.personaAgentId;
  throw new Error(`No Bolna agent for ${personaId}`);
}

/** A finished ingest must not leave the call stuck. Watch again until the execution ends or the give-up. */
async function holdForExecution(
  db: Database,
  enqueue: Enqueue,
  call: { id: string; runId: string; startedAt: Date | null },
) {
  const started = call.startedAt?.getTime() ?? Date.now();
  if (Date.now() - started > GIVE_UP_MS) {
    await db.update(calls).set({ status: "failed", hangupReason: "watchdog timed out" }).where(eq(calls.id, call.id));
    await releaseSharedLine(db, call.runId, "failed");
    await enqueue("run.finalize", { runId: call.runId }, jobDefaults);
    return;
  }
  await enqueue("call.watchdog", { callId: call.id, n: 1 }, { ...jobDefaults, jobId: `watch-${call.id}-rearm`, delay: WATCH_MS });
}

function fixtureOf(userData: unknown): string | null {
  const record = userData !== null && typeof userData === "object" ? (userData as Record<string, unknown>) : {};
  return typeof record.fixture === "string" ? record.fixture : null;
}

function stringMap(userData: unknown): Record<string, string> {
  const record = userData !== null && typeof userData === "object" ? (userData as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "fixture") continue;
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function centsToCost(cents: number | null): string | null {
  if (cents === null) return null;
  return (cents / 100).toFixed(4);
}

function redialing(status: string | null, attempt: number): boolean {
  return (status === "no-answer" || status === "busy") && attempt < 2;
}

function deskOf(userData: unknown): string {
  if (!userData || typeof userData !== "object") return "";
  const name = (userData as { target_name?: unknown }).target_name;
  return typeof name === "string" ? name.trim() : "";
}

function briefOf(evidence: unknown): { prompt_line?: string; sentence?: string; quote?: string; turn_idx?: number | null; quote_kept?: boolean; block?: string } | null {
  if (!evidence || typeof evidence !== "object") return null;
  const brief = (evidence as { brief?: unknown }).brief;
  if (!brief || typeof brief !== "object") return null;
  return brief as { prompt_line?: string; sentence?: string; quote?: string; turn_idx?: number | null; quote_kept?: boolean; block?: string };
}

/** The full prompt Claude writes for one caller. Stored on the call so the page can show it before the run ends. */
async function buildCallerBlock(input: {
  desk: string;
  targetName: string;
  taskGoal: string;
  bolnaAgentId: string | null;
  who: string;
  quote: string;
  line: string;
}): Promise<string> {
  const desk = input.desk || input.targetName;
  const slug = manifestSlugOf(desk);
  const manifest = slug ? await loadTargetManifest(repoRoot, slug) : null;
  if (!manifest) {
    console.error(`patch block skipped: no manifest for ${desk || "this target"}`);
    return "";
  }
  const linked = slug && slug in env.demoAgents ? env.demoAgents[slug as keyof typeof env.demoAgents] : "";
  const agentId = linked || input.bolnaAgentId || "";
  let currentPrompt = input.taskGoal || TARGET_TASK;
  let transcriberLanguage: string | null = null;
  if (agentId) {
    try {
      const live = await readLiveAgent(agentId);
      if (live.systemPrompt) currentPrompt = live.systemPrompt;
      transcriberLanguage = live.transcriberLanguage;
    } catch (error) {
      console.error(`patch block live prompt unread: ${(error as Error).message}`);
    }
  }
  const patch = await mergePromptLines({
    targetManifest: manifest,
    currentPrompt,
    failures: [{ who: input.who, quote: input.quote, line: input.line, profile: await loadPersonaProfile(repoRoot, input.who) }],
    mode: patchMode(currentPrompt),
    today: new Date().toISOString().slice(0, 10),
    transcriberLanguage,
  });
  return patch.block.trim();
}

export async function noteExecution(db: Database, enqueue: Enqueue, executionId: string, status: string | null) {
  const [call] = await db.select().from(calls).where(eq(calls.bolnaExecutionId, executionId)).limit(1);
  if (!call || call.verdict) return;
  if (status) await db.update(calls).set({ status }).where(eq(calls.id, call.id));
  if (status && !redialing(status, call.attempt)) await releaseSharedLine(db, call.runId, status);
  if (isTerminal(status)) {
    await enqueue("call.ingest", { callId: call.id }, { ...jobDefaults, jobId: `ingest-${call.id}` });
  }
}
