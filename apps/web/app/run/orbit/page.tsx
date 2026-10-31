"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/logo";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

const PERSONA_LABEL: Record<string, { name: string; tag: string; initials: string }> = {
  angry_uncle: { name: "Sharma ji", tag: "Agitation", initials: "S" },
  lang_switcher: { name: "Neha", tag: "Code-switch", initials: "N" },
  dialect_bhojpuri: { name: "Ramesh", tag: "Vernacular", initials: "R" },
  staff_probe: { name: "Ankit", tag: "Security", initials: "A" },
  records_raider: { name: "Meera", tag: "Security", initials: "M" },
  rohit: { name: "Rohit", tag: "Nosy", initials: "Ro" },
};

type Brief = { sentence?: string; quote?: string; prompt_line?: string } | null;
type Call = {
  id: string;
  persona_id: string;
  status: string;
  verdict: string | null;
  duration_s: number | null;
  started_at: string | null;
  cost: number | null;
  brief: Brief;
  scores: { dimension: string; score: number | null; cell: string | null }[];
};
type FixSuggestion = { idx: number; dimension: string | null; suggestion: string | null; evidence_call_ids: string[] };
type Run = {
  id: string;
  label: string;
  status: string;
  parent_run_id: string | null;
  pass_rate: number | null;
  name: string;
  cost: number;
  calls: Call[];
  fix_suggestions: FixSuggestion[];
};

const DONE = new Set(["completed", "failed", "no-answer", "busy", "canceled", "cancelled", "stopped", "error", "balance-low"]);
const WAITING = new Set(["pending", "queued"]);
const SCORING = new Set(["scoring"]);

// A call is "on the line" when Bolna has moved it past queued and it has not yet
// landed in scoring or a terminal status. The judge's verdict means it is done.
function isOnTheLine(call: Call): boolean {
  if (call.verdict) return false;
  if (DONE.has(call.status)) return false;
  if (WAITING.has(call.status)) return false;
  if (SCORING.has(call.status)) return false;
  return true;
}

// Rough per-call budget used only for the UI countdown. Picked to cover a typical
// one-caller test; the real time varies.
const CALL_SECONDS = 90;

type NodeState = "waiting" | "dialing" | "online" | "scoring" | "amber" | "broke" | "held" | "ended";

function personaName(personaId: string): string {
  return PERSONA_LABEL[personaId]?.name ?? personaId;
}

function stateOf(call: Call, activeId: string | null, dialingId: string | null): NodeState {
  if (call.verdict === "green") return "held";
  if (call.verdict === "amber") return "amber";
  if (call.verdict) return "broke";
  if (SCORING.has(call.status)) return "scoring";
  if (DONE.has(call.status)) return "ended";
  if (activeId === call.id) return "online";
  if (dialingId === call.id) return "dialing";
  return "waiting";
}

function isSettled(call: Call): boolean {
  return Boolean(call.verdict) || DONE.has(call.status);
}

function fmtClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function OrbitPage() {
  return (
    <Suspense fallback={null}>
      <OrbitInner />
    </Suspense>
  );
}

type Toast =
  | { kind: "call"; id: string; callId: string; name: string; broke: boolean }
  | { kind: "run"; id: string; runId: string; name: string; held: number; broke: number };

function OrbitInner() {
  const router = useRouter();
  const params = useSearchParams();
  const runId = params.get("runId");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const settledIds = useRef<Set<string>>(new Set());
  const userPicked = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!runId) {
      setError("No run id.");
      return;
    }
    setRun(null);
    setSelectedId(null);
    setError("");
    setToasts([]);
    settledIds.current = new Set();
    firstPoll.current = true;
    userPicked.current = false;
    let active = true;
    async function poll() {
      const response = await fetch(`/api/run/${runId}`, { cache: "no-store" });
      const result = (await response.json()) as { ok?: boolean; run?: Run; error?: string };
      if (!active) return;
      if (!result.ok || !result.run) {
        setError(result.error || "Could not read the run.");
        return;
      }
      setRun(result.run);
      if (result.run.status !== "done") timer.current = window.setTimeout(poll, 2500);
    }
    void poll();
    return () => {
      active = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [runId]);

  // Fire a toast once per call as it settles.
  // On the first fetch we seed the set so already-settled calls do not toast past events.
  const firstPoll = useRef(true);
  useEffect(() => {
    if (!run) return;
    const seeding = firstPoll.current;
    firstPoll.current = false;
    const fresh: Toast[] = [];
    for (const call of run.calls) {
      const done = Boolean(call.verdict) || DONE.has(call.status);
      if (!done || settledIds.current.has(call.id)) continue;
      settledIds.current.add(call.id);
      if (seeding) continue;
      const persona = PERSONA_LABEL[call.persona_id] ?? { name: call.persona_id };
      fresh.push({
        kind: "call",
        id: `${call.id}:${Date.now()}`,
        callId: call.id,
        name: persona.name,
        broke: Boolean(call.verdict && call.verdict !== "green"),
      });
    }
    if (fresh.length > 0) setToasts((current) => [...current, ...fresh]);
  }, [run]);

  // One run-complete toast when the whole run finishes.
  const runToastFired = useRef(false);
  useEffect(() => {
    if (!run || run.status !== "done" || runToastFired.current) return;
    runToastFired.current = true;
    const held = run.calls.filter((call) => call.verdict === "green").length;
    const broke = run.calls.filter((call) => call.verdict && call.verdict !== "green").length;
    setToasts((current) => [
      ...current,
      { kind: "run", id: `run:${run.id}`, runId: run.id, name: run.name, held, broke },
    ]);
  }, [run?.status, run?.id]);

  // One-second tick so the countdown and elapsed clock update between polls.
  const [, setClock] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  // Move to the summary once every caller has a verdict, even if the server is still writing patches.
  // A short delay keeps the per-call toasts readable on fast fixture replays.
  useEffect(() => {
    if (!run?.id || run.calls.length === 0) return;
    const allScored = run.calls.every((call) => Boolean(call.verdict));
    if (!allScored && run.status !== "done") return;
    const timeout = window.setTimeout(() => {
      router.replace(`/run/summary?runId=${run.id}`);
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [run?.id, run?.status, run?.calls, router]);

  const calls = run?.calls ?? [];
  const finished = calls.filter((call) => call.verdict || DONE.has(call.status)).length;
  const held = calls.filter((call) => call.verdict === "green").length;
  const amberCount = calls.filter((call) => call.verdict === "amber").length;
  const broke = calls.filter((call) => call.verdict === "red").length;
  const allScored = calls.length > 0 && calls.every((call) => Boolean(call.verdict));
  const isDone = run?.status === "done" || allScored;
  // Pick the on-line caller by status, not by array order. Only one call is live at a time.
  const active = calls.find(isOnTheLine) ?? null;
  const activeId = active?.id ?? null;
  const scoringCount = calls.filter((call) => SCORING.has(call.status) && !call.verdict).length;
  const queued = calls.filter((call) => !call.verdict && (WAITING.has(call.status) || SCORING.has(call.status))).length;
  // The next caller Bolna is about to place. Shown as "Dialing …" so the ring never looks idle.
  const dialing =
    !isDone && !active && scoringCount === 0
      ? (calls.find((call) => WAITING.has(call.status) && !call.verdict) ?? null)
      : null;
  const dialingId = dialing?.id ?? null;

  // Countdown for the live call. 0 if nothing is on the line yet or the budget has elapsed.
  const callRemaining = (() => {
    if (!active?.started_at) return null;
    const started = new Date(active.started_at).getTime();
    if (!Number.isFinite(started)) return null;
    const elapsed = (Date.now() - started) / 1000;
    return Math.max(0, CALL_SECONDS - elapsed);
  })();

  // Rough overall ETA = time left on the current call + a budget for each still-queued call.
  const runRemaining = isDone
    ? 0
    : (callRemaining ?? CALL_SECONDS) + Math.max(0, queued - (active ? 1 : 0)) * CALL_SECONDS;

  // Follow the live call, then settle on the first break, until the user clicks a node.
  useEffect(() => {
    if (userPicked.current || calls.length === 0) return;
    if (isDone) {
      const firstBroke = calls.find((call) => call.verdict && call.verdict !== "green");
      setSelectedId((firstBroke ?? calls[0]).id);
    } else if (activeId) {
      setSelectedId(activeId);
    } else if (dialingId) {
      setSelectedId(dialingId);
    }
  }, [activeId, dialingId, isDone, calls.length]);

  const selected =
    calls.find((call) => call.id === selectedId) ?? (userPicked.current ? null : (active ?? dialing ?? null));

  const positions = useMemo(() => ringPositions(calls.length), [calls.length]);


  return (
    <main className={`min-h-screen bg-[#FFFDFB] pb-24 text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/workspace" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <Link href="/workspace" className="text-[13px] text-[#737373] hover:text-[#0F0E0C]">
            All agents
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>The run · replay</p>
        <h1 className={`mt-3 text-[34px] leading-tight font-semibold tracking-tight sm:text-[44px] ${display}`}>
          {!run
            ? error
              ? "The run did not start"
              : "Dialing the first caller…"
            : isDone
              ? `${run.name} · ${held} held${amberCount ? `, ${amberCount} amber` : ""}${broke ? `, ${broke} broke` : ""}`
              : active
                ? `Calling ${run.name}`
                : dialing
                  ? `Dialing ${personaName(dialing.persona_id)}…`
                  : `Scoring ${run.name}`}
        </h1>
        {error ? <p className="mt-4 text-[15px] text-[#BA1A1A]">{error}</p> : null}
        {run || !error ? (
          <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#57534E]">
            {run
              ? isDone
                ? "Every caller is done. Tap a caller to open its page, or wait for the summary."
                : active
                  ? `${personaName(active.persona_id)} is on the line. ${queued > 1 ? `${queued - 1} ${queued - 1 === 1 ? "caller" : "callers"} waiting.` : "The others are done."}`
                  : dialing
                    ? `${personaName(dialing.persona_id)} is being dialed. The call starts on its own.`
                    : "Every caller is done talking. The judge is reading the transcripts."
              : "The call starts on its own. Nothing to tap."}
          </p>
        ) : null}
        {run && !isDone ? (
          <div className={`mt-3 flex flex-wrap gap-5 text-[12px] tracking-[0.1em] uppercase ${mono} text-[#78716C]`}>
            {active && callRemaining !== null ? (
              <span>
                ETA this call <span className="text-[#0F0E0C]">{fmtClock(callRemaining)}</span>
              </span>
            ) : dialing ? (
              <span>
                This call <span className="text-[#0F0E0C]">dialing now</span>
              </span>
            ) : null}
            <span>
              ETA whole run <span className="text-[#0F0E0C]">{fmtClock(runRemaining)}</span>
            </span>
            <span className={`${mono} text-[#A8A29E] normal-case tracking-normal text-[11px]`}>
              rough guess, actual call can be shorter or longer
            </span>
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* The orbit */}
          <div className="relative mx-auto aspect-square w-full max-w-[520px]">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
              <circle cx="50" cy="50" r="38" fill="none" stroke="#E7E5E4" strokeWidth="0.3" strokeDasharray="1.4 1.6" />
              {calls.map((call, index) => {
                const pos = positions[index];
                const node = stateOf(call, activeId, dialingId);
                const stroke = node === "online" || node === "dialing" ? "#FFB800" : node === "held" ? "#059669" : node === "broke" ? "#C2410C" : "#E7E5E4";
                return (
                  <line
                    key={call.id}
                    x1="50"
                    y1="50"
                    x2={pos.x}
                    y2={pos.y}
                    stroke={stroke}
                    strokeWidth={node === "online" || node === "dialing" ? 0.7 : 0.4}
                    strokeDasharray={node === "online" || node === "dialing" ? "1.2 1.2" : undefined}
                    className={node === "online" || node === "dialing" ? "kx-wire" : undefined}
                    opacity={node === "waiting" ? 0.5 : 1}
                  />
                );
              })}
            </svg>

            {/* Center: the agent under test */}
            <div className="absolute left-1/2 top-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#E7E5E4] bg-[#0E0D0C] text-center text-white shadow-[0_18px_40px_rgba(15,14,12,0.18)]">
              <span className={`px-2 text-[13px] font-semibold leading-tight sm:text-[15px] ${display}`}>{run?.name ?? "Agent"}</span>
              <span className={`mt-1 text-[9px] tracking-[0.12em] text-white/60 uppercase ${mono}`}>under test</span>
            </div>

            {/* Caller nodes */}
            {!run && !error ? <DialingPlaceholder /> : null}
            {calls.map((call, index) => {
              const pos = positions[index];
              const persona = PERSONA_LABEL[call.persona_id] ?? { name: call.persona_id, tag: "Caller", initials: "?" };
              const node = stateOf(call, activeId, dialingId);
              const isSel = selectedId === call.id;
              const ring =
                node === "online" || node === "dialing"
                  ? "border-[#FFB800] bg-[#FFF8E1] text-[#92400E]"
                  : node === "scoring"
                    ? "border-[#B8860B] bg-[#FFF4CC] text-[#92400E]"
                    : node === "held"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : node === "amber"
                        ? "border-[#F6D77C] bg-[#FFF9E5] text-[#92400E]"
                        : node === "broke"
                          ? "border-[#C2410C] bg-[#FBEAE5] text-[#9A3412]"
                          : node === "ended"
                            ? "border-[#E7E5E4] bg-white text-[#737373]"
                            : "border-[#E7E5E4] bg-white text-[#A8A29E]";
              const settled = isSettled(call);
              const classes = `absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 ${settled ? "cursor-pointer" : ""}`;
              const style = { left: `${pos.x}%`, top: `${pos.y}%` };
              const body = (
                <>
                  <span
                    className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 text-[16px] font-semibold transition sm:h-16 sm:w-16 ${ring} ${isSel ? "ring-2 ring-[#0E0D0C] ring-offset-2 ring-offset-[#FFFDFB]" : ""} ${node === "online" || node === "dialing" ? "kx-pulse" : ""}`}
                  >
                    {node === "held" ? (
                      <span className="material-symbols-outlined text-[22px]">check</span>
                    ) : node === "amber" ? (
                      <span className="material-symbols-outlined text-[22px]">priority_high</span>
                    ) : node === "broke" ? (
                      <span className="material-symbols-outlined text-[22px]">close</span>
                    ) : (
                      persona.initials
                    )}
                  </span>
                  <span className={`text-[12px] font-semibold ${display}`}>{persona.name}</span>
                  <span className={`text-[9px] tracking-[0.08em] uppercase ${mono} ${node === "online" || node === "dialing" || node === "scoring" ? "text-[#92400E]" : "text-[#A8A29E]"}`}>
                    {node === "online"
                      ? "on the line"
                      : node === "dialing"
                        ? "dialing"
                      : node === "scoring"
                        ? "scoring"
                        : node === "held"
                          ? "held"
                          : node === "amber"
                            ? "amber"
                            : node === "broke"
                              ? "broke"
                              : node === "ended"
                                ? call.status
                                : "waiting"}
                  </span>
                </>
              );
              return settled ? (
                <Link
                  key={call.id}
                  href={`/run/call/${call.id}`}
                  style={style}
                  className={classes}
                  onClick={() => {
                    userPicked.current = true;
                    setSelectedId(call.id);
                  }}
                >
                  {body}
                </Link>
              ) : (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => {
                    userPicked.current = true;
                    setSelectedId(call.id);
                  }}
                  style={style}
                  className={classes}
                >
                  {body}
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <aside className="lg:pt-2">
            <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-[0_8px_24px_rgba(15,14,12,0.04)]">
              {!run ? (
                error ? (
                  <p className="text-[15px] leading-6 text-[#57534E]">The run did not start. The message above says why.</p>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#92400E]">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#FFB800]" />
                      dialing
                    </span>
                    <h2 className={`mt-2 text-[26px] font-semibold ${display}`}>The first caller</h2>
                    <p className="mt-3 text-[14px] leading-6 text-[#57534E]">
                      Dialing now. The call starts on its own — nothing to tap.
                    </p>
                  </div>
                )
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold tracking-wide uppercase ${mono} text-[#57534E]`}>
                        {finished} of {calls.length} done
                      </span>
                    </div>
                    {isDone ? (
                      <span className={`text-[11px] font-bold tracking-wide uppercase ${mono} text-[#57534E]`}>${run.cost.toFixed(2)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#92400E]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFB800]" />live
                      </span>
                    )}
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F0EDE8]">
                    <div className="h-full rounded-full bg-[#0E0D0C] transition-all" style={{ width: `${calls.length ? (finished / calls.length) * 100 : 0}%` }} />
                  </div>

                  {selected ? (
                    <>
                      <CallDetail
                        call={selected}
                        dialing={selected.id === dialingId}
                        remainingSeconds={selected.id === activeId ? callRemaining : null}
                      />
                      {isSettled(selected) ? (
                        <Link
                          href={`/run/call/${selected.id}`}
                          className={`mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#0E0D0C] px-4 py-2 text-[13px] font-semibold text-white ${display}`}
                        >
                          Open this caller
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-6 text-[15px] text-[#57534E]">Tap a caller on the ring.</p>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {isDone && run ? (
          <p className={`mt-10 text-[14px] text-[#78716C] ${mono}`}>Taking you to the summary…</p>
        ) : null}
      </div>

      {/* Toasts anchored to the top, enlarged so they read from across the room. */}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex flex-col items-center gap-3 px-4">
        {toasts.map((toast) => {
          if (toast.kind === "run") {
            const headline = toast.broke === 0
              ? "The report is ready. Every caller held."
              : toast.held === 0
                ? "The report is ready. Nothing held."
                : `The report is ready. ${toast.held} held, ${toast.broke} ${toast.broke === 1 ? "broke" : "broke"}.`;
            return (
              <div
                key={toast.id}
                className="pointer-events-auto flex w-full max-w-xl items-center gap-4 rounded-2xl border border-[#0E0D0C] bg-[#0E0D0C] px-5 py-4 text-white shadow-[0_20px_48px_rgba(15,14,12,0.25)]"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0E0D0C]">
                  <span className="material-symbols-outlined text-[22px]">insights</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[16px] font-semibold leading-tight ${display}`}>{toast.name} · report ready</p>
                  <p className={`mt-1 text-[13px] text-white/70 ${mono}`}>{headline}</p>
                </div>
                <Link
                  href={`/run/summary?runId=${toast.runId}`}
                  className={`shrink-0 rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0E0D0C] hover:bg-[#F5F1EA] ${mono}`}
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 text-white/60 hover:text-white"
                  aria-label="Dismiss"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            );
          }
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full max-w-xl items-center gap-4 rounded-2xl border px-5 py-4 shadow-[0_20px_48px_rgba(15,14,12,0.15)] ${
                toast.broke ? "border-[#F0C2A6] bg-[#FBEAE5]" : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${toast.broke ? "bg-[#C2410C]" : "bg-emerald-500"}`}
              >
                <span className="material-symbols-outlined text-[22px]">{toast.broke ? "close" : "check"}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[16px] font-semibold leading-tight ${display}`}>Report for {toast.name} is ready</p>
                <p className={`mt-1 text-[13px] ${mono} ${toast.broke ? "text-[#9A3412]" : "text-emerald-700"}`}>
                  {toast.broke ? "The caller broke the agent." : "The caller held."}
                </p>
              </div>
              <Link
                href={`/run/call/${toast.callId}`}
                className={`shrink-0 rounded-md border border-[#0E0D0C] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0E0D0C] hover:bg-[#F5F1EA] ${mono}`}
              >
                Open
              </Link>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 text-[#A8A29E] hover:text-[#0F0E0C]"
                aria-label="Dismiss"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes kxDash { to { stroke-dashoffset: -8; } }
        .kx-wire { animation: kxDash 0.9s linear infinite; }
        @keyframes kxPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,184,0,0.5); } 50% { box-shadow: 0 0 0 10px rgba(255,184,0,0); } }
        .kx-pulse { animation: kxPulse 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .kx-wire, .kx-pulse { animation: none; } }
      `}</style>
    </main>
  );
}

function DialingPlaceholder() {
  return (
    <div className="absolute left-1/2 top-[12%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
      <span className="kx-pulse relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#FFB800] bg-[#FFF8E1] text-[#92400E] sm:h-16 sm:w-16">
        <span className="material-symbols-outlined text-[22px]">call</span>
      </span>
      <span className={`text-[12px] font-semibold ${display}`}>First caller</span>
      <span className={`text-[9px] tracking-[0.08em] text-[#92400E] uppercase ${mono}`}>dialing</span>
    </div>
  );
}

function CallDetail({ call, dialing, remainingSeconds }: { call: Call; dialing: boolean; remainingSeconds: number | null }) {
  const persona = PERSONA_LABEL[call.persona_id] ?? { name: call.persona_id, tag: "Caller", initials: "?" };
  const settled = Boolean(call.verdict) || DONE.has(call.status);
  const amber = call.verdict === "amber";
  const broke = call.verdict === "red";
  const held = call.verdict === "green";
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className={`rounded-full bg-[#FFF4CC] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#92400E] uppercase ${mono}`}>{persona.tag}</span>
          <h2 className={`mt-2 text-[26px] font-semibold ${display}`}>{persona.name}</h2>
        </div>
        {settled ? (
          <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${mono} ${amber ? "bg-[#FFF4CC] text-[#92400E]" : broke ? "bg-[#C2410C] text-white" : held ? "bg-emerald-500 text-white" : "bg-[#E7E5E4] text-[#57534E]"}`}>
            {amber ? "Amber" : broke ? "Broke" : held ? "Held" : call.status}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#92400E]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#FFB800]" />
            {dialing ? "dialing" : "on the line"}
          </span>
        )}
      </div>

      {settled ? (
        <p className={`mt-3 text-[13px] ${mono} text-[#57534E]`}>
          {call.duration_s ? `${call.duration_s}s` : "—"} · {call.cost === null ? "—" : `$${call.cost.toFixed(2)}`}
        </p>
      ) : dialing ? (
        <p className="mt-3 text-[14px] leading-6 text-[#57534E]">
          Dialing {persona.name}. The call starts on its own — nothing to tap.
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-[14px] text-[#57534E]">Talking to the agent now. The verdict appears when the call ends.</p>
          {remainingSeconds !== null ? (
            <p className={`mt-2 text-[12px] tracking-[0.1em] uppercase ${mono} text-[#78716C]`}>
              Rough countdown · <span className="text-[#0F0E0C]">{fmtClock(remainingSeconds)}</span>
            </p>
          ) : null}
        </div>
      )}

      {call.brief?.sentence ? (
        <>
          <p className={`mt-5 mb-1 text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>Why</p>
          <p className="text-[15px] leading-6 text-[#0F0E0C]">{call.brief.sentence}</p>
        </>
      ) : null}
      {call.brief?.quote ? (
        <p className="mt-3 rounded-lg bg-[#FAF6F0] px-4 py-3 text-[14px] leading-6 text-[#57534E]">“{call.brief.quote}”</p>
      ) : null}
      {call.brief?.prompt_line ? (
        <>
          <p className={`mt-4 mb-1 text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>The fix</p>
          <p className="text-[15px] leading-6 text-[#0F0E0C]">{call.brief.prompt_line}</p>
        </>
      ) : null}

      {call.scores.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {call.scores.map((score) => (
            <span
              key={score.dimension}
              className={`rounded-md px-2 py-1 text-[10px] font-medium ${mono} ${
                score.cell === "green"
                  ? "bg-emerald-50 text-emerald-700"
                  : score.cell === "red"
                    ? "bg-[#FBEAE5] text-[#9A3412]"
                    : score.cell === "amber"
                      ? "bg-[#FFF4CC] text-[#92400E]"
                      : "bg-[#F0EDE8] text-[#78716C]"
              }`}
            >
              {DIM_LABEL[score.dimension] ?? score.dimension} {score.score ?? "—"}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const DIM_LABEL: Record<string, string> = {
  task_completion: "Task",
  hallucination: "Facts",
  language_switch: "Language",
  dropped_intents: "Memory",
  interruption_handling: "Interrupts",
  repair: "Repair",
  tone_empathy: "Tone",
};

function ringPositions(n: number): { x: number; y: number }[] {
  if (n === 0) return [];
  const radius = 38;
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
  });
}
