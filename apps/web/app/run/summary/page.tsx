"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { openSession } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

const PERSONA_LABEL: Record<string, { name: string; tag: string }> = {
  angry_uncle: { name: "Sharma ji", tag: "Agitation" },
  lang_switcher: { name: "Neha", tag: "Code-switch" },
  dialect_bhojpuri: { name: "Ramesh", tag: "Vernacular" },
  staff_probe: { name: "Ankit", tag: "Security" },
  records_raider: { name: "Meera", tag: "Security" },
  rohit: { name: "Rohit", tag: "Nosy" },
};

const DIMENSIONS: { key: string; label: string }[] = [
  { key: "task_completion", label: "Task" },
  { key: "hallucination", label: "Facts" },
  { key: "language_switch", label: "Language" },
  { key: "dropped_intents", label: "Memory" },
  { key: "interruption_handling", label: "Interrupts" },
  { key: "repair", label: "Repair" },
  { key: "tone_empathy", label: "Tone" },
];

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The judge's score, or the rounded value when confidence gated the score out. */
function scoreOrRounded(row: { score: number | null; rounded?: number | null } | undefined): number | null {
  if (!row) return null;
  if (typeof row.score === "number") return row.score;
  if (typeof row.rounded === "number") return row.rounded;
  return null;
}

function callScore(call: Call): number | null {
  const values = call.scores.map(scoreOrRounded).filter((value): value is number => typeof value === "number");
  const avg = mean(values);
  return avg === null ? null : Math.round((avg / 5) * 100);
}

function pillarAverage(calls: Call[], key: string): number | null {
  const values = calls
    .map((call) => scoreOrRounded(call.scores.find((row) => row.dimension === key)))
    .filter((value): value is number => typeof value === "number");
  return mean(values);
}

type Brief = { sentence?: string; quote?: string; prompt_line?: string; block?: string } | null;
type Call = {
  id: string;
  persona_id: string;
  status: string;
  verdict: string | null;
  duration_s: number | null;
  cost: number | null;
  brief: Brief;
  scores: { dimension: string; score: number | null; rounded?: number | null; cell: string | null }[];
  prior?: { call_id: string; verdict: string | null; score: number | null; scope: string | null } | null;
};
type FixSuggestion = { idx: number; dimension: string | null; suggestion: string | null; evidence_call_ids: string[] };
type Run = {
  id: string;
  label: string;
  status: string;
  parent_run_id: string | null;
  pass_rate: number | null;
  name: string;
  desk?: string;
  cost: number;
  calls: Call[];
  fix_suggestions: FixSuggestion[];
  compare?: { before_held_pct: number; after_held_pct: number; reruns: number; full_reruns?: number; caller_reruns?: number };
};

export default function SummaryPage() {
  return (
    <Suspense fallback={null}>
      <SummaryInner />
    </Suspense>
  );
}

function SummaryInner() {
  const router = useRouter();
  const params = useSearchParams();
  const runId = params.get("runId");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyNote, setApplyNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [patchOnAgent, setPatchOnAgent] = useState(false);
  const [bareCall, setBareCall] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [cardNotes, setCardNotes] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    if (!runId) {
      setError("No run id.");
      return;
    }
    let active = true;
    async function load() {
      // The merged view folds the latest result for every caller across the root run and
      // all its reruns, so an individual rerun does not drop the other callers.
      const response = await fetch(`/api/run/${runId}/merged`, { cache: "no-store" });
      const result = (await response.json()) as { ok?: boolean; run?: Run; error?: string };
      if (!active) return;
      if (!result.ok || !result.run) {
        setError(result.error || "Could not read the run.");
        return;
      }
      setRun(result.run);
    }
    void load();
    return () => {
      active = false;
    };
  }, [runId]);

  async function applyPatch() {
    if (!run) return;
    setApplying(true);
    setApplyNote(null);
    try {
      const response = await fetch(`/api/run/${run.id}/apply-patch`, { method: "POST" });
      const result = (await response.json()) as { ok?: boolean; applied?: boolean; enabled?: boolean; error?: string };
      if (result.applied) {
        setPatchOnAgent(true);
        setApplyNote({ ok: true, message: calls.length > 1 ? `The fixes are on ${run.desk?.trim() || run.name}.` : "The patch is on the agent." });
      } else setApplyNote({ ok: false, message: result.error || "The patch could not be applied." });
    } catch {
      setApplyNote({ ok: false, message: "The test engine is not reachable." });
    }
    setApplying(false);
  }

  async function applyCaller(callId: string) {
    setApplyingId(callId);
    setCardNotes((prev) => {
      const next = { ...prev };
      delete next[callId];
      return next;
    });
    try {
      const response = await fetch(`/api/call/${callId}/apply-patch`, { method: "POST" });
      const result = (await response.json()) as { applied?: boolean; error?: string };
      if (result.applied) {
        setPatchOnAgent(true);
        setCardNotes((prev) => ({ ...prev, [callId]: { ok: true, message: "The patch is on the agent." } }));
      } else {
        setCardNotes((prev) => ({ ...prev, [callId]: { ok: false, message: result.error || "The patch could not be applied." } }));
      }
    } catch {
      setCardNotes((prev) => ({ ...prev, [callId]: { ok: false, message: "The test engine is not reachable." } }));
    }
    setApplyingId(null);
  }

  async function replay() {
    if (!run) return;
    setReplaying(true);
    setReplayError("");
    try {
      const response = await fetch(`/api/run/${run.id}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: openSession().sessionId }),
      });
      const result = (await response.json()) as { ok?: boolean; runId?: string; error?: string };
      if (!result.ok || !result.runId) {
        setReplayError(result.error || "Could not start the rerun.");
        setReplaying(false);
        return;
      }
      router.push(`/run/orbit?runId=${result.runId}`);
    } catch {
      setReplayError("The test engine is not reachable.");
      setReplaying(false);
    }
  }

  if (error) {
    return (
      <main className={`min-h-screen bg-[#FFFDFB] p-8 text-[#0F0E0C] ${body}`}>
        <p className="text-[15px] text-[#BA1A1A]">{error}</p>
      </main>
    );
  }
  if (!run) {
    return (
      <main className={`min-h-screen bg-[#FFFDFB] p-8 text-[#0F0E0C] ${body}`}>
        <p className="text-[15px] text-[#57534E]">Reading the summary…</p>
      </main>
    );
  }

  const calls = run.calls;
  const held = calls.filter((call) => call.verdict === "green").length;
  const amber = calls.filter((call) => call.verdict === "amber").length;
  const broke = calls.filter((call) => call.verdict === "red").length;
  const amberRun = calls.length > 0 && broke === 0 && amber > 0 && calls.every((call) => call.verdict === "green" || call.verdict === "amber");
  const heldPct = calls.length ? Math.round((held / calls.length) * 100) : 0;
  // Pass rate counts amber as a pass. Held is a stricter number, broke is the risk.
  const passPct = calls.length ? Math.round(((held + amber) / calls.length) * 100) : 0;
  // Overall score across all callers, 0-100, average of per-caller jev scores. This is the headline number on the dial.
  const scoreValues = calls.map(callScore).filter((value): value is number => typeof value === "number");
  const overallScore = scoreValues.length === 0 ? null : Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length);
  const compare = run.compare ?? null;
  // "Patched" is sticky — once Apply writes any block, the hero banner shows "the fix is on the agent" instead of the Apply button.
  const anyCallApplied = Object.values(cardNotes).some((note) => note.ok);
  const applied = patchOnAgent || anyCallApplied;
  const block = run.fix_suggestions.find((fix) => fix.dimension === "block")?.suggestion ?? "";
  const multi = calls.length > 1;
  const desk = run.desk?.trim() || run.name;
  const deskFixes = calls.filter((call) => call.verdict && call.verdict !== "green" && ownCallerBlock(run.fix_suggestions, call.id));
  const deskFixNames = deskFixes.map((call) => PERSONA_LABEL[call.persona_id]?.name ?? call.persona_id);
  const deskLine = `This writes to ${desk}. The shared number will move to ${desk} before the next call.`;
  const showDeskApply = !applied && multi && deskFixes.length > 0;
  const showSoloApply = !applied && !multi && Boolean(block);

  return (
    <main className={`min-h-screen bg-[#FFFDFB] pb-24 text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/workspace" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-5 text-[13px] text-[#737373]">
            <Link href={`/run/orbit?runId=${run.id}`} className="hover:text-[#0F0E0C]">The live view</Link>
            <Link href="/workspace" className="hover:text-[#0F0E0C]">All agents</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>The run · summary</p>
        <h1 className={`mt-3 text-[34px] leading-tight font-semibold tracking-tight sm:text-[44px] ${display}`}>
          {desk}
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#57534E]">
          {amberRun
            ? "Amber is good enough on the critical dimensions. Call again to hear it, or patch anyway if you want a change."
            : broke === 0
              ? "Every caller held. Share the report, or try a harder caller set."
              : multi
                ? `The callers who did not hold each left a fix. Apply them to ${desk} in one write, then call again so they all ring it again.`
                : "Read what broke below. Apply the patch, then call again so you can hear whether it held."}
        </p>

        {compare && (compare.full_reruns ?? 0) > 0 ? (
          <section className="mt-6 overflow-hidden rounded-3xl border border-[#E7E5E4] bg-white shadow-[0_10px_32px_rgba(15,14,12,0.04)]">
            <div className="grid gap-5 p-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-8 sm:p-7">
              <ComparePane label="Before" pct={compare.before_held_pct} tone="muted" />
              <div className={`flex items-center justify-center text-[26px] text-[#A8A29E] ${display} sm:text-[32px]`}>→</div>
              <ComparePane
                label={compare.reruns === 1 ? "After the rerun" : `After ${compare.reruns} reruns`}
                pct={compare.after_held_pct}
                tone="now"
              />
            </div>
            <p className={`border-t border-[#E7E5E4] bg-[#FAF6F0] px-6 py-3 text-center text-[12px] tracking-[0.1em] uppercase ${mono} text-[#78716C]`}>
              {compare.after_held_pct > compare.before_held_pct
                ? `Improved by ${compare.after_held_pct - compare.before_held_pct} points`
                : compare.after_held_pct < compare.before_held_pct
                  ? `Dropped by ${compare.before_held_pct - compare.after_held_pct} points`
                  : "No change on held rate"}
            </p>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,260px)]">
          <div className="rounded-3xl border border-[#E7E5E4] bg-white p-7 shadow-[0_10px_32px_rgba(15,14,12,0.04)]">
            <OverallDial score={overallScore} />
            <p className={`mt-4 text-center text-[11px] tracking-[0.1em] uppercase ${mono} text-[#78716C]`}>Overall score across all callers</p>
            <p className="mt-2 text-center text-[12px] text-[#78716C]">
              {held} held · {amber} amber · {broke} broke · pass rate {passPct}%
            </p>
          </div>

          <div className="rounded-3xl border border-[#E7E5E4] bg-white p-7 shadow-[0_10px_32px_rgba(15,14,12,0.04)]">
            <p className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>How this run landed</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Chip label="Held" value={held} colour="#059669" bg="#ECFDF5" />
              <Chip label="Amber" value={amber} colour="#92400E" bg="#FFF9E5" />
              <Chip label="Broke" value={broke} colour="#9A3412" bg="#FBEAE5" />
            </div>
            <h3 className={`mt-6 text-[13px] font-semibold ${display}`}>Jev scores across all callers</h3>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DIMENSIONS.map((pillar) => {
                const avg = pillarAverage(calls, pillar.key);
                const score100 = avg === null ? null : Math.round((avg / 5) * 100);
                const barColour = score100 === null ? "#A8A29E" : score100 >= 60 ? "#059669" : score100 >= 40 ? "#D97706" : "#C2410C";
                return (
                  <li key={pillar.key} className="flex items-center gap-3">
                    <span className="w-20 text-[12px] text-[#57534E]">{pillar.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0EDE8]">
                      <span className="block h-full rounded-full" style={{ width: `${score100 ?? 0}%`, background: barColour }} />
                    </span>
                    <span className={`w-10 text-right text-[12px] ${mono}`} style={{ color: barColour }}>{score100 ?? "—"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-3xl border border-[#0E0D0C] bg-[#0E0D0C] p-7 text-white shadow-[0_10px_32px_rgba(15,14,12,0.1)]">
            <p className={`text-[11px] tracking-[0.08em] text-white/60 uppercase ${mono}`}>At a glance</p>
            <dl className="mt-4 space-y-3 text-[14px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-white/70">Callers</dt>
                <dd className={`${display} text-[18px]`}>{calls.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-white/70">Cost</dt>
                <dd className={`${display} text-[18px]`}>${run.cost.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-white/70">Held rate</dt>
                <dd className={`${display} text-[18px]`}>{heldPct}%</dd>
              </div>
            </dl>
            <Link
              href={`/run/report?runId=${run.id}`}
              className={`mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0E0D0C] ${display}`}
            >
              Open the full report
            </Link>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {showDeskApply ? (
            <button
              type="button"
              onClick={applyPatch}
              disabled={applying}
              className="inline-flex items-center gap-2 rounded-full bg-[#0E0D0C] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#2A2724] disabled:opacity-50"
            >
              {applying ? "Pushing to the agent…" : `Apply the fixes to ${desk}`}
            </button>
          ) : showSoloApply ? (
            <button
              type="button"
              onClick={applyPatch}
              disabled={applying}
              className="inline-flex items-center gap-2 rounded-full bg-[#0E0D0C] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#2A2724] disabled:opacity-50"
            >
              {applying ? "Pushing to the agent…" : "Apply the patch to the agent"}
            </button>
          ) : applied ? (
            <span className={`inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-[13px] font-semibold text-emerald-700 ${display}`}>
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              The fix is on the agent
            </span>
          ) : null}
          <button
            type="button"
            onClick={replay}
            disabled={replaying}
            className="inline-flex items-center gap-2 rounded-full border border-[#0E0D0C] px-6 py-3 text-[14px] font-semibold text-[#0E0D0C] transition hover:bg-[#F5F1EA] disabled:opacity-50"
          >
            {replaying ? "Starting the call…" : applied ? "Call again with the patch" : "Call again"}
          </button>
          <Link
            href={`/run/report?runId=${run.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-white px-6 py-3 text-[14px] font-semibold text-[#0F0E0C] transition hover:bg-[#F5F1EA]"
          >
            See the report
          </Link>
        </div>
        {applied ? null : (
          <div className="mt-3">
            {bareCall ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13px] text-[#57534E]">The live prompt is unchanged.</p>
                <button
                  type="button"
                  onClick={replay}
                  disabled={replaying}
                  className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F0E0C] transition hover:bg-[#F5F1EA] disabled:opacity-50"
                >
                  {replaying ? "Starting the call…" : "Place the call"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBareCall(true)}
                className="text-[13px] font-semibold text-[#57534E] underline decoration-[#E7E5E4] underline-offset-4 hover:text-[#0F0E0C]"
              >
                Call again without a patch
              </button>
            )}
          </div>
        )}
        {showDeskApply ? (
          <p className="mt-3 max-w-2xl text-[13px] leading-5 text-[#57534E]">
            {deskFixNames.join(", ")} {deskFixNames.length === 1 ? "goes" : "go"} into {desk}&apos;s prompt in one write. Call again dials every caller you selected.
          </p>
        ) : null}
        <p className="mt-3 text-[13px] text-[#57534E]">{deskLine}</p>
        <div className="mt-1 min-h-[20px] text-[13px]">
          {applyNote ? (
            <span className={applyNote.ok ? "text-emerald-700" : "text-[#78716C]"}>{applyNote.message}</span>
          ) : null}
          {replayError ? <span className="text-[#BA1A1A]">{replayError}</span> : null}
        </div>

        {/* Caller cards */}
        <h2 className={`mt-12 text-[22px] font-semibold ${display}`}>Every caller</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {calls.map((call) => {
            const persona = PERSONA_LABEL[call.persona_id] ?? { name: call.persona_id, tag: "Caller" };
            const amberCall = call.verdict === "amber";
            const broken = call.verdict === "red";
            const held = call.verdict === "green";
            const headline = held ? "Held" : amberCall ? "Amber" : broken ? "Broke" : call.status;
            const bg = held
              ? "bg-emerald-50 border-emerald-200"
              : amberCall
                ? "bg-[#FFF9E5] border-[#F6D77C]"
                : broken
                  ? "bg-[#FBEAE5] border-[#F0C2A6]"
                  : "bg-white border-[#E7E5E4]";
            const ringColour = held ? "#059669" : amberCall ? "#D97706" : broken ? "#C2410C" : "#A8A29E";
            const score = callScore(call);
            return (
              <article key={call.id} className={`flex flex-col rounded-2xl border p-5 shadow-[0_8px_24px_rgba(15,14,12,0.04)] ${bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[10px] tracking-[0.1em] uppercase ${mono}`} style={{ color: ringColour }}>
                      {persona.tag} · {headline}
                    </p>
                    <h3 className={`mt-1 text-[22px] font-semibold ${display}`}>{persona.name}</h3>
                  </div>
                  <div className="text-right">
                    <p className={`text-[26px] leading-none font-semibold ${display}`} style={{ color: ringColour }}>{score ?? "—"}</p>
                    <p className={`text-[10px] ${mono} text-[#78716C]`}>/ 100</p>
                    {call.prior && call.prior.score !== null && score !== null ? (
                      <p className={`mt-1 text-[11px] ${mono}`} style={{ color: score >= call.prior.score ? "#059669" : "#C2410C" }}>
                        {call.prior.score} → {score} ({score - call.prior.score >= 0 ? "+" : ""}{score - call.prior.score})
                      </p>
                    ) : null}
                  </div>
                </div>
                {call.prior && call.prior.scope === "caller" ? (
                  <p className={`mt-2 text-[11px] tracking-[0.08em] uppercase ${mono} text-[#78716C]`}>This caller only</p>
                ) : null}
                <p className={`mt-2 text-[12px] ${mono} text-[#78716C]`}>
                  {call.duration_s ? `${call.duration_s}s` : "—"} · {call.cost === null ? "—" : `$${call.cost.toFixed(2)}`}
                </p>
                {call.brief?.sentence ? (
                  <p className="mt-3 text-[14px] leading-6 text-[#0F0E0C] line-clamp-3">{call.brief.sentence}</p>
                ) : null}
                {(() => {
                  const patch = ownCallerBlock(run.fix_suggestions, call.id) || call.brief?.block?.trim() || "";
                  if (!patch) return null;
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>Paste into the agent prompt</p>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard?.writeText(patch)}
                          className={`rounded-md border border-[#E7E5E4] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#57534E] hover:bg-[#F5F1EA] ${mono}`}
                        >
                          Copy
                        </button>
                      </div>
                      <pre className={`mt-2 max-h-64 overflow-auto rounded-xl border border-[#E7E5E4] bg-[#0E0D0C] p-3 text-[12px] leading-5 whitespace-pre-wrap text-[#F5F1EA] ${mono}`}>
{patch}
                      </pre>
                    </div>
                  );
                })()}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/run/call/${call.id}`}
                    className={`inline-flex items-center gap-1 rounded-full bg-[#0E0D0C] px-3.5 py-1.5 text-[12px] font-semibold text-white ${display}`}
                  >
                    Open call
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                  {(() => {
                    const noteOk = cardNotes[call.id]?.ok === true;
                    const canApply = multi && call.verdict && call.verdict !== "green" && (call.brief?.prompt_line || ownCallerBlock(run.fix_suggestions, call.id));
                    if (!canApply) return null;
                    if (noteOk) {
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 ${display}`}>
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Fix on agent
                        </span>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => void applyCaller(call.id)}
                        disabled={applyingId === call.id}
                        className="rounded-full border border-[#0E0D0C] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#0F0E0C] transition hover:bg-[#F5F1EA] disabled:opacity-50"
                      >
                        {applyingId === call.id ? "Pushing…" : "Apply this fix"}
                      </button>
                    );
                  })()}
                </div>
                {cardNotes[call.id] && !cardNotes[call.id]?.ok ? (
                  <p className="mt-2 text-[12px] text-[#78716C]">{cardNotes[call.id]?.message}</p>
                ) : null}
              </article>
            );
          })}
        </div>

        {/* The one patch */}
        {block && !multi ? (
          <section className="mt-12 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-[0_8px_24px_rgba(15,14,12,0.04)] sm:p-8">
            <p className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>The patch for {desk}</p>
            <h2 className={`mt-1 text-[22px] font-semibold ${display}`}>One block, grounded in this bot&apos;s task</h2>
            <pre className={`mt-4 max-h-96 overflow-auto rounded-xl border border-[#E7E5E4] bg-[#0E0D0C] p-5 text-[13px] leading-6 whitespace-pre-wrap text-[#F5F1EA] ${mono}`}>
              {block}
            </pre>
            <p className="mt-3 text-[13px] text-[#78716C]">
              {deskLine}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ownCallerBlock(fixes: FixSuggestion[], callId: string): string {
  const row = fixes.find((fix) => fix.dimension === "block" && fix.evidence_call_ids?.length === 1 && fix.evidence_call_ids[0] === callId);
  return row?.suggestion?.trim() ?? "";
}

function Chip({ label, value, colour, bg }: { label: string; value: number; colour: string; bg: string }) {
  return (
    <div className="rounded-2xl border border-[#E7E5E4] p-4 text-center" style={{ background: bg }}>
      <p className={`text-[30px] leading-none font-semibold ${display}`} style={{ color: colour }}>{value}</p>
      <p className={`mt-1 text-[11px] tracking-[0.1em] uppercase ${mono}`} style={{ color: colour }}>{label}</p>
    </div>
  );
}

function ComparePane({ label, pct, tone }: { label: string; pct: number; tone: "muted" | "now" }) {
  const colour = tone === "now" ? (pct >= 70 ? "#059669" : pct >= 40 ? "#D97706" : "#C2410C") : "#78716C";
  return (
    <div className="text-center sm:text-left">
      <p className={`text-[11px] tracking-[0.1em] uppercase ${mono} text-[#A8A29E]`}>{label}</p>
      <p className={`mt-1 text-[48px] leading-none font-semibold ${display}`} style={{ color: colour }}>
        {pct}%
      </p>
      <p className={`mt-1 text-[11px] tracking-[0.08em] uppercase ${mono}`} style={{ color: colour }}>
        held rate
      </p>
    </div>
  );
}

function OverallDial({ score }: { score: number | null }) {
  const safe = score ?? 0;
  const colour = safe >= 70 ? "#059669" : safe >= 40 ? "#D97706" : "#C2410C";
  const circumference = 2 * Math.PI * 56;
  const dash = circumference * (safe / 100);
  const grade = score === null ? "No score" : safe >= 70 ? "Strong" : safe >= 40 ? "Mixed" : "Weak";
  return (
    <div className="relative mx-auto flex h-[180px] w-[180px] items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r="56" fill="none" stroke="#F5F1EA" strokeWidth="10" />
        <circle cx="70" cy="70" r="56" fill="none" stroke={colour} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-[46px] leading-none font-semibold ${display}`}>{score ?? "—"}</span>
        <span className={`mt-1 text-[10px] tracking-[0.12em] uppercase ${mono}`} style={{ color: colour }}>
          / 100 · {grade}
        </span>
      </div>
    </div>
  );
}
