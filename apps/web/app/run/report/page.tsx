"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

const CALLER: Record<string, { name: string; tag: string }> = {
  angry_uncle: { name: "Sharma ji", tag: "Agitation" },
  lang_switcher: { name: "Neha", tag: "Code-switch" },
  dialect_bhojpuri: { name: "Ramesh", tag: "Vernacular" },
  staff_probe: { name: "Ankit", tag: "Security" },
  records_raider: { name: "Meera", tag: "Security" },
  rohit: { name: "Rohit", tag: "Nosy" },
};

const PILLARS: { key: string; label: string; blurb: string }[] = [
  { key: "task_completion", label: "Task", blurb: "Did the bot do the one thing the caller came for?" },
  { key: "hallucination", label: "Facts", blurb: "Did it make up prices, dates, or policies?" },
  { key: "language_switch", label: "Language", blurb: "Did it hold the caller's language, including Hindi?" },
  { key: "tone_empathy", label: "Tone", blurb: "Did it stay patient without rolling over?" },
  { key: "repair", label: "Repair", blurb: "Did it recover after a stumble?" },
  { key: "interruption_handling", label: "Interrupts", blurb: "Did it stop when the caller spoke?" },
  { key: "dropped_intents", label: "Memory", blurb: "Did it remember earlier asks?" },
];

type Score = { dimension: string; score: number | null; cell: string | null };
type Brief = { sentence?: string; quote?: string; prompt_line?: string } | null;
type Call = {
  id: string;
  persona_id: string;
  status: string;
  verdict: string | null;
  duration_s: number | null;
  cost: number | null;
  brief: Brief;
  scores: Score[];
};
type Run = {
  id: string;
  name: string;
  status: string;
  parent_run_id: string | null;
  desk?: string;
  calls: Call[];
};

function points(score: number) {
  return Math.round((score / 5) * 20);
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pillarScores(calls: Call[], key: string) {
  return calls
    .map((call) => call.scores.find((score) => score.dimension === key)?.score)
    .filter((score): score is number => typeof score === "number");
}

function hundred(calls: Call[]) {
  const pillars = PILLARS.map((pillar) => mean(pillarScores(calls, pillar.key))).filter((value): value is number => value !== null);
  const avg = mean(pillars);
  return avg === null ? null : Math.round((avg / 5) * 100);
}

function callScore(call: Call) {
  const values = call.scores.map((row) => row.score).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return Math.round((mean(values)! / 5) * 100);
}

function tally(calls: Call[]) {
  let green = 0;
  let amber = 0;
  let red = 0;
  for (const call of calls) {
    if (call.verdict === "green") green += 1;
    else if (call.verdict === "amber") amber += 1;
    else if (call.verdict === "red") red += 1;
  }
  return { green, amber, red };
}

export default function ReportPage() {
  return (
    <Suspense fallback={<main className={`min-h-screen bg-[#FFFDFB] p-8 text-[#57534E] ${body}`}>Reading the report…</main>}>
      <ReportBody />
    </Suspense>
  );
}

function ReportBody() {
  const params = useSearchParams();
  const runId = params.get("runId") ?? "";
  const [run, setRun] = useState<Run | null>(null);
  const [parentScore, setParentScore] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runId) {
      setError("No run to report.");
      return;
    }
    let active = true;
    void fetch(`/api/run/${runId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; run?: Run; error?: string }) => {
        if (!active) return;
        if (!result.ok || !result.run) {
          setError(result.error || "Could not read the run.");
          return;
        }
        setRun(result.run);
      })
      .catch(() => {
        if (active) setError("The test engine is not reachable.");
      });
    return () => {
      active = false;
    };
  }, [runId]);

  useEffect(() => {
    const parentId = run?.parent_run_id;
    if (!parentId) return;
    let active = true;
    void fetch(`/api/run/${parentId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; run?: Run }) => {
        if (active && result.ok && result.run) setParentScore(hundred(result.run.calls));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [run?.parent_run_id]);

  if (error) {
    return (
      <main className={`min-h-screen bg-[#FFFDFB] p-8 text-[#BA1A1A] ${body}`}>
        <p>{error}</p>
      </main>
    );
  }
  if (!run) {
    return (
      <main className={`min-h-screen bg-[#FFFDFB] p-8 text-[#57534E] ${body}`}>
        <p>Reading the report…</p>
      </main>
    );
  }

  const score = hundred(run.calls);
  const grade = score === null ? "Scoring" : score >= 70 ? "Held" : score >= 40 ? "Needs work" : "At risk";
  const dial = score === null ? "#A8A29E" : score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#C2410C";
  const counts = tally(run.calls);
  const broke = run.calls.filter((call) => call.verdict && call.verdict !== "green");
  const delta = parentScore !== null && score !== null ? score - parentScore : null;

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/workspace" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <Link href={`/run/summary?runId=${run.id}`} className="text-[13px] text-[#737373] hover:text-[#0F0E0C]">
            Back to the summary
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>Report · {run.desk ?? "This run"}</p>
        <h1 className={`mt-3 text-[40px] leading-tight font-semibold tracking-tight sm:text-[52px] ${display}`}>{run.name}</h1>

        <section className="mt-8 grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,320px)]">
          <div className="rounded-3xl border border-[#E7E5E4] bg-white p-8 shadow-[0_10px_40px_rgba(15,14,12,0.04)]">
            <OverallDial score={score} grade={grade} colour={dial} />
            {delta !== null ? (
              <p className="mt-4 text-center text-[13px] text-[#57534E]">
                Before {parentScore} → after {score} ({delta >= 0 ? "+" : ""}
                {delta})
              </p>
            ) : (
              <p className="mt-4 text-center text-[13px] text-[#78716C]">0–100, higher is better</p>
            )}
          </div>

          <div className="rounded-3xl border border-[#E7E5E4] bg-white p-8 shadow-[0_10px_40px_rgba(15,14,12,0.04)]">
            <p className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>How the callers landed</p>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <Chip label="Held" value={counts.green} colour="#059669" bg="#ECFDF5" />
              <Chip label="Amber" value={counts.amber} colour="#92400E" bg="#FFF9E5" />
              <Chip label="Broke" value={counts.red} colour="#9A3412" bg="#FBEAE5" />
            </div>
            <p className="mt-6 text-[15px] leading-6 text-[#57534E]">
              {broke.length === 0
                ? "Every caller held on this run. The desk cleared the honest bar."
                : `${broke.length} of ${run.calls.length} callers found a gap. The dashboard below shows which dimensions pulled the score down and what to fix.`}
            </p>
          </div>

          <div className="rounded-3xl border border-[#E7E5E4] bg-[#0E0D0C] p-8 text-white shadow-[0_10px_40px_rgba(15,14,12,0.08)]">
            <p className={`text-[11px] tracking-[0.08em] text-white/60 uppercase ${mono}`}>Next</p>
            <ul className="mt-4 space-y-3 text-[14px] leading-6 text-white/80">
              <li>• Open any caller card to see the breaking turn.</li>
              <li>• Rerun a single caller after a patch to confirm the fix.</li>
              <li>• The honest bar is green on the critical dimensions.</li>
            </ul>
            <Link
              href={`/run/summary?runId=${run.id}`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0E0D0C]"
            >
              Open the summary →
            </Link>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-[#E7E5E4] bg-white p-8 shadow-[0_10px_40px_rgba(15,14,12,0.04)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className={`text-[22px] font-semibold ${display}`}>Where it scored</h2>
            <span className={`text-[12px] ${mono} text-[#78716C]`}>Per-dimension across all callers, out of 100</span>
          </div>
          <ul className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
            {PILLARS.map((pillar) => {
              const value = mean(pillarScores(run.calls, pillar.key));
              const bar = value === null ? 0 : points(value);
              const colour = bar >= 60 ? "#059669" : bar >= 40 ? "#D97706" : "#C2410C";
              return (
                <li key={pillar.key} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-[14px] font-medium ${display}`}>{pillar.label}</span>
                    <span className={`${mono} text-[13px]`} style={{ color: colour }}>
                      {value === null ? "—" : `${bar} / 100`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F5F1EA]">
                    <div className="h-full rounded-full" style={{ width: `${bar}%`, background: colour }} />
                  </div>
                  <span className={`mt-1 text-[12px] text-[#78716C]`}>{pillar.blurb}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className={`text-[22px] font-semibold ${display}`}>Caller-by-caller</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {run.calls.map((call) => {
              const person = CALLER[call.persona_id] ?? { name: call.persona_id, tag: "Caller" };
              const verdict = call.verdict;
              const headline =
                verdict === "green" ? "Held" : verdict === "amber" ? "Amber" : verdict === "red" ? "Broke" : call.status;
              const ring =
                verdict === "green" ? "#059669" : verdict === "amber" ? "#D97706" : verdict === "red" ? "#C2410C" : "#A8A29E";
              const bg =
                verdict === "green"
                  ? "bg-emerald-50 border-emerald-200"
                  : verdict === "amber"
                    ? "bg-[#FFF9E5] border-[#F6D77C]"
                    : verdict === "red"
                      ? "bg-[#FBEAE5] border-[#F0C2A6]"
                      : "bg-white border-[#E7E5E4]";
              const perScore = callScore(call);
              return (
                <article key={call.id} className={`rounded-2xl border p-5 shadow-[0_8px_24px_rgba(15,14,12,0.04)] ${bg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-[10px] tracking-[0.1em] uppercase ${mono}`} style={{ color: ring }}>
                        {person.tag} · {headline}
                      </p>
                      <h3 className={`mt-1 text-[22px] font-semibold ${display}`}>{person.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className={`text-[26px] leading-none font-semibold ${display}`}>{perScore ?? "—"}</p>
                      <p className={`text-[10px] ${mono} text-[#78716C]`}>/ 100</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[14px] leading-6 text-[#0F0E0C]">
                    {call.brief?.sentence || (verdict === "green" ? "Held the ask without drama." : "Still scoring.")}
                  </p>
                  {call.brief?.quote ? (
                    <blockquote className={`mt-3 rounded-lg bg-white/70 px-3 py-2 text-[13px] leading-6 text-[#57534E] ${mono}`}>
                      “{call.brief.quote}”
                    </blockquote>
                  ) : null}
                  <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] ${mono} text-[#78716C]`}>
                    <span>
                      {call.duration_s ? `${call.duration_s}s` : "—"} · {call.cost === null ? "—" : `$${call.cost.toFixed(2)}`}
                    </span>
                    <Link href={`/run/call/${call.id}`} className="font-semibold text-[#B8860B] hover:text-[#0F0E0C]">
                      Open →
                    </Link>
                  </div>
                  <audio controls preload="none" className="mt-3 h-9 w-full" src={`/api/call/${call.id}/recording`} />
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Chip({ label, value, colour, bg }: { label: string; value: number; colour: string; bg: string }) {
  return (
    <div className="rounded-2xl border border-[#E7E5E4] p-4 text-center" style={{ background: bg }}>
      <p className={`text-[30px] leading-none font-semibold ${display}`} style={{ color: colour }}>
        {value}
      </p>
      <p className={`mt-1 text-[11px] tracking-[0.1em] uppercase ${mono}`} style={{ color: colour }}>
        {label}
      </p>
    </div>
  );
}

function OverallDial({ score, grade, colour }: { score: number | null; grade: string; colour: string }) {
  const safe = score ?? 0;
  const circumference = 2 * Math.PI * 56;
  const dash = circumference * (safe / 100);
  return (
    <div className="relative mx-auto flex h-[200px] w-[200px] items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r="56" fill="none" stroke="#F5F1EA" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r="56"
          fill="none"
          stroke={colour}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-[52px] leading-none font-semibold ${display}`}>{score ?? "—"}</span>
        <span className={`mt-1 text-[11px] tracking-[0.12em] uppercase ${mono}`} style={{ color: colour }}>
          / 100 · {grade}
        </span>
      </div>
    </div>
  );
}
