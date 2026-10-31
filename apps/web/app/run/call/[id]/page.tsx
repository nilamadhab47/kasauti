"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
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

type Turn = { idx: number; speaker: "persona" | "target"; text: string; lang: string | null };
type CallDetail = {
  id: string;
  run_id: string;
  bot_name: string;
  desk?: string;
  persona_id: string;
  status: string;
  verdict: string | null;
  duration_s: number | null;
  cost: number | null;
  hangup_by: string | null;
  hangup_reason: string | null;
  recording_available: boolean;
  metrics: { persona_turns: number | null; target_turns: number | null } | null;
  turns: Turn[];
};

type RunCall = {
  id: string;
  persona_id: string;
  verdict: string | null;
  brief: { sentence?: string; quote?: string; prompt_line?: string; turn_idx?: number | null; block?: string } | null;
  scores: { dimension: string; score: number | null; rounded?: number | null; cell: string | null }[];
  prior?: { call_id: string; verdict: string | null; score: number | null; scope: string | null } | null;
};
type FixSuggestion = { idx: number; dimension: string | null; suggestion: string | null; evidence_call_ids: string[] };
type Run = { id: string; name: string; status?: string; calls: RunCall[]; fix_suggestions: FixSuggestion[] };

export default function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyNote, setApplyNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [patchOnAgent, setPatchOnAgent] = useState(false);
  const [bareCall, setBareCall] = useState(false);
  const [copied, setCopied] = useState(false);
  const [priorCall, setPriorCall] = useState<CallDetail | null>(null);
  const [side, setSide] = useState<"now" | "before">("now");

  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    async function load() {
      const response = await fetch(`/api/call/${id}`, { cache: "no-store" });
      const result = (await response.json()) as { ok?: boolean; call?: CallDetail; error?: string };
      if (!active) return;
      if (!result.ok || !result.call) {
        setError(result.error || "Could not read the call.");
        return;
      }
      setCall(result.call);
      const runResponse = await fetch(`/api/run/${result.call.run_id}`, { cache: "no-store" });
      const runBody = (await runResponse.json()) as { ok?: boolean; run?: Run };
      if (!active) return;
      if (runBody.ok && runBody.run) setRun(runBody.run);
      const runDone = runBody.run?.status === "done";
      const blockReady = Boolean(
        runBody.run?.fix_suggestions?.some(
          (fix) => fix.dimension === "block" && fix.evidence_call_ids?.length === 1 && fix.evidence_call_ids[0] === result.call?.id && fix.suggestion?.trim(),
        ) || runBody.run?.calls.find((entry) => entry.id === result.call?.id)?.brief?.block?.trim(),
      );
      const needsBlock = Boolean(result.call.verdict && result.call.verdict !== "green");
      if (active && !runDone && (!result.call.verdict || (needsBlock && !blockReady))) {
        timer = window.setTimeout(load, 2500);
      }
    }
    void load();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  async function applyPatch() {
    if (!call) return;
    setApplying(true);
    setApplyNote(null);
    try {
      const response = await fetch(`/api/call/${call.id}/apply-patch`, { method: "POST" });
      const result = (await response.json()) as { applied?: boolean; error?: string };
      if (result.applied) {
        setPatchOnAgent(true);
        setApplyNote({ ok: true, message: "The fix is on the agent." });
      } else setApplyNote({ ok: false, message: result.error || "The fix could not be applied." });
    } catch {
      setApplyNote({ ok: false, message: "The test engine is not reachable." });
    }
    setApplying(false);
  }

  async function rerunOne() {
    if (!call) return;
    setReplaying(true);
    setReplayError("");
    try {
      const response = await fetch(`/api/call/${call.id}/rerun`, {
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

  const runCall = useMemo(() => run?.calls.find((entry) => entry.id === call?.id) ?? null, [run, call?.id]);

  useEffect(() => {
    const priorId = runCall?.prior?.call_id;
    if (!priorId) {
      setPriorCall(null);
      return;
    }
    let active = true;
    void (async () => {
      const response = await fetch(`/api/call/${priorId}`, { cache: "no-store" });
      const result = (await response.json()) as { ok?: boolean; call?: CallDetail };
      if (!active) return;
      setPriorCall(result.ok && result.call ? result.call : null);
    })();
    return () => {
      active = false;
    };
  }, [runCall?.prior?.call_id]);
  const brief = runCall?.brief ?? null;
  const scores = runCall?.scores ?? [];
  const brokenTurnIdx = typeof brief?.turn_idx === "number" ? brief.turn_idx : null;
  const ownBlock = useMemo(() => {
    if (!run || !call) return "";
    const row = run.fix_suggestions.find(
      (fix) => fix.dimension === "block" && fix.evidence_call_ids?.length === 1 && fix.evidence_call_ids[0] === call.id,
    );
    return row?.suggestion?.trim() || briefBlock(run, call.id);
  }, [run, call?.id]);

  if (error) {
    return (
      <main className={`min-h-screen bg-[#FFFDFB] p-8 ${body}`}>
        <p className="text-[15px] text-[#BA1A1A]">{error}</p>
      </main>
    );
  }
  if (!call) {
    return (
      <main className={`min-h-screen bg-[#FFFDFB] p-8 ${body}`}>
        <p className="text-[15px] text-[#57534E]">Reading the call…</p>
      </main>
    );
  }

  const desk = call.desk?.trim() || call.bot_name;
  const persona = PERSONA_LABEL[call.persona_id] ?? { name: call.persona_id, tag: "Caller" };
  const verdict = call.verdict as "red" | "amber" | "green" | null;
  const amber = verdict === "amber";
  const broken = verdict === "red";
  const held = verdict === "green";
  const label = held ? "Held" : amber ? "Amber" : broken ? "Broke" : call.status;
  const headline = held ? "The desk held" : amber ? "Good enough on the critical dimensions" : broken ? "The desk broke" : "Still scoring";
  const scoreValues = scores
    .map((score) => (typeof score.score === "number" ? score.score : typeof score.rounded === "number" ? score.rounded : null))
    .filter((value): value is number => typeof value === "number");
  const overall = scoreValues.length === 0 ? null : Math.round((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) * 20);
  const reason = buildReason(scores, verdict);
  const deskLine = `This writes to ${desk}. The shared number will move to ${desk} before the next call.`;
  const shownCall = side === "before" && priorCall ? priorCall : call;

  return (
    <main className={`min-h-screen bg-[#FFFDFB] pb-24 text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/workspace" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-5 text-[13px] text-[#737373]">
            <Link href={`/run/orbit?runId=${call.run_id}`} className="inline-flex items-center gap-1 hover:text-[#0F0E0C]">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              The run
            </Link>
            <Link href={`/run/summary?runId=${call.run_id}`} className="hover:text-[#0F0E0C]">The summary</Link>
            <Link href="/workspace" className="hover:text-[#0F0E0C]">All agents</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>{desk} · the call</p>

        <section
          className={`mt-4 overflow-hidden rounded-3xl border p-7 shadow-[0_10px_40px_rgba(15,14,12,0.05)] ${
            held
              ? "border-emerald-200 bg-emerald-50"
              : amber
                ? "border-[#F6D77C] bg-[#FFF9E5]"
                : broken
                  ? "border-[#F0C2A6] bg-[#FBEAE5]"
                  : "border-[#E7E5E4] bg-white"
          }`}
        >
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <span className={`inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold tracking-wide text-[#92400E] uppercase ${mono}`}>
                {persona.tag}
              </span>
              <h1 className={`mt-3 text-[40px] leading-tight font-semibold tracking-tight sm:text-[52px] ${display}`}>{persona.name}</h1>
              <p className={`mt-2 text-[20px] font-medium leading-7 ${display}`}>{headline}</p>
              <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#57534E]">{reason}</p>
              <dl className={`mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] ${mono} text-[#57534E]`}>
                <Facet label="Time" value={call.duration_s ? `${call.duration_s}s` : "—"} />
                <Facet label="Cost" value={call.cost === null ? "—" : `$${call.cost.toFixed(2)}`} />
                <Facet label="Caller turns" value={String(call.metrics?.persona_turns ?? "—")} />
                <Facet label="Bot turns" value={String(call.metrics?.target_turns ?? "—")} />
                <Facet label="Hangup" value={call.hangup_by ?? "—"} />
              </dl>
            </div>
            <div className="flex flex-col items-center justify-center md:items-end">
              <VerdictDial
                value={overall}
                before={runCall?.prior && runCall.prior.score !== null ? runCall.prior.score : null}
                beforeVerdict={runCall?.prior?.verdict ?? null}
                label={label}
                verdict={verdict}
              />
              {runCall?.prior?.scope === "caller" ? (
                <p className={`mt-2 text-center text-[11px] tracking-[0.08em] uppercase md:text-right ${mono} text-[#78716C]`}>This caller only</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className={`text-[20px] font-semibold ${display}`}>Jev scores</h2>
            <span className={`text-[12px] ${mono} text-[#78716C]`}>Each dimension is scored out of 5. Red is 1, amber is 2, green is 3 or more.</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {DIMENSIONS.map((dim) => {
              const row = scores.find((entry) => entry.dimension === dim.key);
              const value = row?.score ?? row?.rounded ?? null;
              return <ScoreTile key={dim.key} label={dim.label} score={value} cell={row?.cell ?? null} />;
            })}
          </div>
        </section>

        {amber || broken ? (
          <section className="mt-8 rounded-3xl border border-[#E7E5E4] bg-white p-6 shadow-[0_10px_32px_rgba(15,14,12,0.04)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>Paste this into the agent prompt</p>
                <h2 className={`mt-1 text-[22px] font-semibold ${display}`}>Claude’s patch for {persona.name}</h2>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#57534E]">
                  The full block, not the one-line note. Copy it into {desk}&apos;s prompt, or use Apply this fix to write it there.
                </p>
              </div>
              <button
                type="button"
                disabled={!ownBlock}
                onClick={() => {
                  if (!ownBlock) return;
                  void navigator.clipboard?.writeText(ownBlock).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  });
                }}
                className={`shrink-0 rounded-full bg-[#0E0D0C] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 ${display}`}
              >
                {copied ? "Copied" : "Copy block"}
              </button>
            </div>
            {ownBlock ? (
              <pre className={`mt-5 max-h-[28rem] overflow-auto rounded-xl border border-[#E7E5E4] bg-[#0E0D0C] p-5 text-[13px] leading-6 whitespace-pre-wrap text-[#F5F1EA] ${mono}`}>
{ownBlock}
              </pre>
            ) : (
              <p className="mt-5 text-[15px] leading-6 text-[#57534E]">Claude is still writing this block. It will show up here. Nothing to tap.</p>
            )}
          </section>
        ) : null}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className={`text-[20px] font-semibold ${display}`}>The conversation</h2>
              <div className="flex flex-wrap items-center gap-3">
                {runCall?.prior && runCall.prior.score !== null && overall !== null ? (
                  <div className={`inline-flex rounded-full border border-[#E7E5E4] bg-white p-1 ${mono}`}>
                    <button
                      type="button"
                      onClick={() => setSide("before")}
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${side === "before" ? "bg-[#0E0D0C] text-white" : "text-[#57534E]"}`}
                    >
                      Before {runCall.prior.score}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSide("now")}
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${side === "now" ? "bg-[#0E0D0C] text-white" : "text-[#57534E]"}`}
                    >
                      Now {overall}
                    </button>
                  </div>
                ) : null}
                <span className={`text-[12px] ${mono} text-[#78716C]`}>
                  {shownCall.turns.length} turns{side === "now" ? " · breaking turn highlighted" : " · earlier call"}
                </span>
              </div>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-[0_8px_24px_rgba(15,14,12,0.04)]">
              {side === "before" && !priorCall ? (
                <p className="px-2 py-4 text-[14px] text-[#78716C]">Reading the earlier call…</p>
              ) : shownCall.turns.length === 0 ? (
                <p className="px-2 py-4 text-[14px] text-[#78716C]">
                  No transcript for this call. {shownCall.hangup_reason ? `(${shownCall.hangup_reason})` : ""}
                </p>
              ) : (
                <ol className="space-y-3">
                  {shownCall.turns.map((turn) => {
                    const isBreak = side === "now" && brokenTurnIdx !== null && turn.idx === brokenTurnIdx;
                    const isCaller = turn.speaker === "persona";
                    return (
                      <li
                        key={turn.idx}
                        className={`flex ${isCaller ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl border px-4 py-3 text-[15px] leading-7 ${
                            isBreak
                              ? "border-[#C2410C] bg-[#FBEAE5]"
                              : isCaller
                                ? "border-[#E7E5E4] bg-white"
                                : "border-[#E7E5E4] bg-[#FAF6F0]"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`text-[10px] tracking-[0.1em] uppercase ${mono} ${isCaller ? "text-[#B8860B]" : "text-[#57534E]"}`}>
                              {isCaller ? "Caller" : "Bot"}
                            </span>
                            {isBreak ? (
                              <span className={`rounded-md bg-[#C2410C] px-2 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase ${mono}`}>
                                Breakage
                              </span>
                            ) : null}
                          </div>
                          <p>{turn.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <div className="rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-[0_8px_24px_rgba(15,14,12,0.04)]">
              <p className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>Why this verdict</p>
              {side === "before" && overall !== null ? (
                <p className={`mt-2 text-[12px] leading-5 text-[#78716C]`}>This note is for the call that scored {overall}. The transcript and recording are the earlier call.</p>
              ) : null}
              <p className="mt-2 text-[15px] leading-6">{brief?.sentence || reason}</p>
              {brief?.quote ? (
                <p className="mt-3 rounded-lg bg-[#FAF6F0] px-4 py-3 text-[14px] leading-6 text-[#57534E]">“{brief.quote}”</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-[0_8px_24px_rgba(15,14,12,0.04)]">
              <p className={`mb-2 text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>
                The recording{runCall?.prior && overall !== null ? (side === "before" ? ` · before ${runCall.prior.score}` : ` · now ${overall}`) : ""}
              </p>
              {side === "before" && !priorCall ? (
                <p className="text-[14px] text-[#78716C]">Reading the earlier recording…</p>
              ) : shownCall.recording_available ? (
                <audio key={shownCall.id} controls preload="metadata" className="w-full" src={`/api/call/${shownCall.id}/recording`}>
                  Your browser does not support audio.
                </audio>
              ) : (
                <p className="text-[14px] text-[#78716C]">No recording for this call.</p>
              )}
            </div>

            <div className="rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-[0_8px_24px_rgba(15,14,12,0.04)]">
              <p className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>What next</p>
              <div className="mt-3 flex flex-col gap-2">
                {patchOnAgent ? (
                  <span className={`inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-[13px] font-semibold text-emerald-700 ${display}`}>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    The fix is on the agent
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={applyPatch}
                    disabled={applying || (!brief?.prompt_line && !ownBlock)}
                    className="w-full rounded-full bg-[#0E0D0C] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#2A2724] disabled:opacity-50"
                  >
                    {applying ? "Pushing to the agent…" : "Apply this fix"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={rerunOne}
                  disabled={replaying}
                  className="w-full rounded-full border border-[#0E0D0C] px-5 py-2.5 text-[14px] font-semibold text-[#0E0D0C] transition hover:bg-[#F5F1EA] disabled:opacity-50"
                >
                  {replaying ? "Starting the call…" : patchOnAgent ? "Call again with the patch" : "Call this caller again"}
                </button>
                {!held && !amber && !patchOnAgent ? (
                  <div className="pt-1">
                    {bareCall ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-[12px] leading-5 text-[#57534E]">The live prompt is unchanged.</p>
                        <button
                          type="button"
                          onClick={rerunOne}
                          disabled={replaying}
                          className="w-full rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F0E0C] transition hover:bg-[#F5F1EA] disabled:opacity-50"
                        >
                          {replaying ? "Starting the call…" : "Place the call"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBareCall(true)}
                        className="text-[12px] font-semibold text-[#57534E] underline decoration-[#E7E5E4] underline-offset-4 hover:text-[#0F0E0C]"
                      >
                        Call again without a patch
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <p className="mt-4 text-[12px] leading-5 text-[#57534E]">{deskLine}</p>
              <div className="mt-1 min-h-[20px] text-[12px]">
                {applyNote ? (
                  <span className={applyNote.ok ? "text-emerald-700" : "text-[#78716C]"}>{applyNote.message}</span>
                ) : null}
                {replayError ? <span className="text-[#BA1A1A]">{replayError}</span> : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function briefBlock(run: Run, callId: string): string {
  const brief = run.calls.find((entry) => entry.id === callId)?.brief;
  return brief?.block?.trim() ?? "";
}

function Facet({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-[10px] tracking-[0.1em] uppercase ${mono} text-[#A8A29E]`}>{label}</span>
      <span className="text-[14px] text-[#0F0E0C]">{value}</span>
    </div>
  );
}

function ScoreTile({ label, score, cell }: { label: string; score: number | null; cell: string | null }) {
  const colour =
    cell === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : cell === "red"
        ? "border-[#F0C2A6] bg-[#FBEAE5] text-[#9A3412]"
        : cell === "amber"
          ? "border-[#F6D77C] bg-[#FFF9E5] text-[#92400E]"
          : "border-[#E7E5E4] bg-white text-[#78716C]";
  return (
    <div className={`rounded-2xl border p-4 ${colour}`}>
      <p className={`text-[10px] tracking-[0.08em] uppercase ${mono}`}>{label}</p>
      <p className={`mt-2 text-[26px] font-semibold leading-none ${display}`}>{score ?? "—"}</p>
      <p className={`mt-1 text-[11px] ${mono}`}>/ 5</p>
    </div>
  );
}

function VerdictDial({
  value,
  before,
  beforeVerdict,
  label,
  verdict,
}: {
  value: number | null;
  before?: number | null;
  beforeVerdict?: string | null;
  label: string;
  verdict: string | null;
}) {
  const comparing = typeof before === "number" && value !== null;
  if (!comparing) return <ScoreRing value={value} label={label} verdict={verdict} />;
  const delta = value - before;
  const up = delta >= 0;
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <ScoreRing value={before} label="Before" verdict={beforeVerdict ?? null} />
      <div className="flex flex-col items-center px-1">
        <span className="material-symbols-outlined text-[28px]" style={{ color: up ? "#059669" : "#C2410C" }}>
          arrow_forward
        </span>
        <span className={`text-[13px] font-semibold ${mono}`} style={{ color: up ? "#059669" : "#C2410C" }}>
          {up ? "+" : ""}
          {delta}
        </span>
      </div>
      <ScoreRing value={value} label={label} verdict={verdict} />
    </div>
  );
}

function ScoreRing({ value, label, verdict }: { value: number | null; label: string; verdict: string | null }) {
  const safe = value ?? 0;
  const circumference = 2 * Math.PI * 42;
  const dash = circumference * (safe / 100);
  const colour =
    verdict === "green"
      ? "#059669"
      : verdict === "amber"
        ? "#D97706"
        : verdict === "red"
          ? "#C2410C"
          : "#A8A29E";
  return (
    <div className="relative flex h-[118px] w-[118px] items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#E7E5E4" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={colour}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-[28px] leading-none font-semibold ${display}`} style={{ color: colour }}>
          {value === null ? "—" : value}
        </span>
        <span className={`mt-1 text-[10px] tracking-[0.1em] uppercase ${mono}`} style={{ color: colour }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function buildReason(scores: { dimension: string; score: number | null; cell: string | null }[], verdict: string | null): string {
  const labels: Record<string, string> = {
    task_completion: "task completion",
    hallucination: "facts",
    language_switch: "language",
    dropped_intents: "memory for the caller's asks",
    interruption_handling: "interruptions",
    repair: "repair",
    tone_empathy: "tone",
  };
  const red = scores.filter((row) => row.score !== null && row.score <= 1).map((row) => labels[row.dimension] ?? row.dimension);
  const amber = scores.filter((row) => row.score !== null && row.score === 2).map((row) => labels[row.dimension] ?? row.dimension);
  const green = scores.filter((row) => row.score !== null && row.score >= 3).length;
  if (verdict === "green") return `Every dimension landed at 3 or above. ${green} of ${scores.length} scored on this call.`;
  if (verdict === "red" && red.length > 0) return `A critical dimension collapsed: ${red.join(", ")}.`;
  if (verdict === "amber" && amber.length > 0) return `Nothing critical broke. ${amber.join(", ")} is where it was weak.`;
  if (red.length > 0) return `Weakest: ${red.join(", ")}.`;
  if (amber.length > 0) return `Weakest: ${amber.join(", ")}.`;
  return "The judge is still scoring this call.";
}
