"use client";

import { useEffect, useState } from "react";
import {
  formatSeconds,
  formatUsd,
  gradeFor,
  knownCost,
  PILLAR_MAX,
  retestedPillars,
  severityCounts,
  trustEligible,
  topFinding,
  type BotReport,
  type FindingStatus,
  type ReportFinding,
  type ReportRun,
  type Severity,
} from "@/lib/report-model";

const mono = "font-mono";

export function ReportView({
  report,
  origin,
  mode = "full",
}: {
  report: BotReport;
  origin: string;
  mode?: "full" | "compact";
}) {
  const latest = report.runs.length - 1;
  const [index, setIndex] = useState(latest);
  const run = report.runs[index] ?? report.runs[0];
  const previous = index > 0 ? report.runs[index - 1] : null;
  if (!run) return null;
  const compact = mode === "compact";

  return (
    <article className={compact ? "" : "report-sheet mx-auto w-full max-w-[880px] px-4 py-8 sm:px-8 sm:py-12"}>
      {compact ? null : <ReportHeader report={report} origin={origin} runs={report.runs} index={index} onPick={setIndex} />}
      <Summary report={report} run={run} previous={report.runs.length > 1 ? previous : null} compact={compact} />
      <Pillars run={run} compact={compact} />
      <Findings run={run} limit={compact ? 3 : undefined} compact={compact} />
      {compact ? null : (
        <>
          <Calls run={run} />
          <ShareCard report={report} run={run} origin={origin} />
          <Methodology report={report} run={run} />
        </>
      )}
    </article>
  );
}

function ReportHeader({
  report,
  origin,
  runs,
  index,
  onPick,
}: {
  report: BotReport;
  origin: string;
  runs: ReportRun[];
  index: number;
  onPick: (index: number) => void;
}) {
  const page = `${origin}/score/${report.slug}`;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await writeClipboard(page);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${report.name} · Kasauti report`, url: page });
        return;
      } catch {
        return;
      }
    }
    await copyLink();
  }

  return (
    <header className="no-print mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
      <a href="/" className="inline-flex items-center gap-2.5 text-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/touchstone.png" alt="" className="h-8 w-8 rounded-lg bg-[#0E0D0C] object-contain p-0.5" />
        <span className="font-display text-lg font-bold tracking-tight">Kasauti report</span>
      </a>
      <div className="flex flex-wrap items-center gap-2">
        <HeaderButton onClick={copyLink}>{copied ? "Copied" : "Copy link"}</HeaderButton>
        <HeaderButton onClick={() => window.print()}>Download PDF</HeaderButton>
        <HeaderButton onClick={share}>Share</HeaderButton>
      </div>
      {runs.length > 1 ? (
        <label className="flex w-full items-center gap-2 text-sm text-neutral-600">
          <span className={`${mono} text-xs uppercase tracking-wider`}>Run</span>
          <select
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            value={index}
            onChange={(event) => onPick(Number(event.target.value))}
          >
            {runs.map((item, itemIndex) => (
              <option key={item.id} value={itemIndex}>
                {item.label}
                {item.testedAt ? ` · ${item.testedAt.slice(0, 10)}` : ""}
                {itemIndex === runs.length - 1 ? " · latest" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </header>
  );
}

function HeaderButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-800 hover:border-neutral-900 ${mono}`}
    >
      {children}
    </button>
  );
}

function Summary({
  report,
  run,
  previous,
  compact,
}: {
  report: BotReport;
  run: ReportRun;
  previous: ReportRun | null;
  compact: boolean;
}) {
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);
  const counts = severityCounts(run);
  const retested = retestedPillars(run);
  const allAfter = retested.done === retested.total;
  const afterTotal = allAfter ? run.pillars.reduce((total, pillar) => total + (pillar.after ?? 0), 0) : null;

  useEffect(() => {
    const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefers);
    const node = document.getElementById(compact ? "report-preview" : "report-summary");
    if (!node || prefers || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [compact]);

  return (
    <section id={compact ? "report-preview" : "report-summary"} className={compact ? "" : "grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center"}>
      <div className="flex flex-wrap items-end gap-6">
        <Gauge score={run.score} label={gradeFor(run.score)} shown={shown || reduced} reduced={reduced} />
        {previous ? (
          <p className={`text-sm text-neutral-700 ${mono}`}>
            {previous.score} → {run.score}, {run.score >= previous.score ? "up" : "down"} {Math.abs(run.score - previous.score)}
          </p>
        ) : null}
        {compact ? null : allAfter && afterTotal != null ? (
          <Gauge score={afterTotal} label="After fix" shown={shown || reduced} reduced={reduced} small />
        ) : compact ? null : (
          <a href="#pillars" className="max-w-[14rem] text-sm font-medium text-[#D97706] underline decoration-[#FFB800] underline-offset-4">
            After fix: {retested.done} of {retested.total} pillars retested
          </a>
        )}
      </div>
      {compact ? null : (
      <div>
        <p className={`text-xs uppercase tracking-wider text-neutral-500 ${mono}`}>
          {report.name} · {report.place}
        </p>
        <p className={`mt-2 text-xs text-neutral-500 ${mono}`}>
          {run.testedAt ? run.testedAt.slice(0, 10) : "—"} · {new Set(run.calls.map((call) => call.caller)).size} callers · {run.calls.length} calls · {formatUsd(knownCost(run))}
        </p>
        <p className="mt-4 text-lg leading-7 text-neutral-800">{run.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <CountChip label="Critical" count={counts.Critical} tone="Critical" />
          <CountChip label="High" count={counts.High} tone="High" />
          <CountChip label="Medium" count={counts.Medium} tone="Medium" />
        </div>
      </div>
      )}
    </section>
  );
}

function Gauge({
  score,
  label,
  shown,
  reduced,
  small = false,
}: {
  score: number;
  label: string;
  shown: boolean;
  reduced: boolean;
  small?: boolean;
}) {
  const [value, setValue] = useState(reduced || shown ? score : 0);
  const size = small ? 92 : 148;
  const stroke = small ? 8 : 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = shown ? score / 100 : 0;
  const tone = score < 40 ? "#9F1239" : score < 70 ? "#D97706" : "#15803D";

  useEffect(() => {
    if (!shown) return;
    if (reduced) {
      setValue(score);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setValue(Math.round(score * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown, reduced, score]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E7E5E4" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: reduced ? "none" : "stroke-dashoffset 0.9s cubic-bezier(0.23, 1, 0.32, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display font-bold leading-none text-neutral-900 ${small ? "text-xl" : "text-4xl"}`}>{value}</span>
        <span className={`text-neutral-500 ${mono} ${small ? "text-[10px]" : "text-xs"}`}>/ 100</span>
        <span className={`mt-0.5 font-medium ${small ? "text-[10px]" : "text-xs"}`} style={{ color: tone }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function Pillars({ run, compact }: { run: ReportRun; compact: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefers) {
      setShown(true);
      return;
    }
    const node = document.getElementById("pillars");
    if (!node) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section id="pillars" className={compact ? "mt-6" : "mt-10"}>
      {compact ? null : <h2 className="font-display text-xl font-bold text-neutral-900">Pillars</h2>}
      <div className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white ${compact ? "" : "mt-4"}`}>
        {run.pillars.map((pillar, index) => (
          <div key={pillar.name} className="border-b border-neutral-100 px-4 py-4 last:border-b-0 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-900">{pillar.name}</p>
                {compact ? null : <p className="text-sm text-neutral-500">{pillar.description}</p>}
              </div>
              <p className={`text-sm text-neutral-800 ${mono}`}>
                {pillar.after == null && pillar.afterNote ? (
                  <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">{pillar.afterNote}</span>
                ) : (
                  <>
                    {pillar.before}
                    <span className="text-neutral-400"> → </span>
                    {pillar.after == null ? <StatusChip status="Not retested" /> : pillar.after}
                  </>
                )}
              </p>
            </div>
            <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: shown ? `${((pillar.after ?? pillar.before) / PILLAR_MAX) * 100}%` : "0%",
                  background: pillar.after == null ? (pillar.before <= 6 ? "#9F1239" : "#D97706") : pillar.after >= 14 ? "#15803D" : "#D97706",
                  transition: shown ? `width 0.6s cubic-bezier(0.23, 1, 0.32, 1) ${index * 120}ms` : "none",
                }}
              />
              <span
                className="absolute top-0 h-full w-0.5 bg-neutral-900"
                style={{ left: `calc(${(pillar.before / PILLAR_MAX) * 100}% - 1px)` }}
                title={`Before ${pillar.before}`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Findings({ run, limit, compact }: { run: ReportRun; limit?: number; compact?: boolean }) {
  const items = typeof limit === "number" ? run.findings.slice(0, limit) : run.findings;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefers) {
      setShown(true);
      return;
    }
    const node = document.getElementById("findings");
    if (!node) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.15 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section id="findings" className="mt-10">
      {typeof limit === "number" ? null : <h2 className="font-display text-xl font-bold text-neutral-900">Findings</h2>}
      <div className="mt-4 space-y-3">
        {items.map((finding, index) => (
          <article
            key={`${finding.caller}-${finding.title}`}
            className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "none" : "translateY(12px)",
              transition: shown ? `opacity 0.45s ease, transform 0.45s ease ${index * 90}ms` : "none",
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityChip severity={finding.severity} />
              <h3 className="font-display text-lg font-bold text-neutral-900">{finding.title}</h3>
              <StatusChip status={finding.status} />
            </div>
            <p className={`mt-2 text-xs uppercase tracking-wider text-neutral-500 ${mono}`}>{finding.caller}</p>
            {finding.quote ? (
              <blockquote className={`mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-800 ${mono}`}>
                “{finding.quote}”
              </blockquote>
            ) : null}
            <p className="mt-3 text-sm leading-6 text-neutral-700">
              <span className="font-semibold text-neutral-900">Why it matters. </span>
              {finding.why}
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-700">
              <span className="font-semibold text-neutral-900">Fix. </span>
              {finding.fix}
            </p>
            {finding.copy && !compact ? <CopyLine text={finding.copy} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Calls({ run }: { run: ReportRun }) {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-neutral-900">Calls</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={`text-xs uppercase tracking-wider text-neutral-500 ${mono}`}>
            <tr className="border-b border-neutral-200">
              <th className="px-4 py-3 font-medium">Caller</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">Recording</th>
            </tr>
          </thead>
          <tbody>
            {run.calls.map((call, index) => {
              const key = `${call.caller}-${index}`;
              return (
                <tr key={key} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-4 py-3">{call.caller}</td>
                  <td className={`px-4 py-3 text-neutral-600 ${mono}`}>{call.level ?? "—"}</td>
                  <td className={`px-4 py-3 ${mono}`}>{formatSeconds(call.seconds)}</td>
                  <td className={`px-4 py-3 ${mono}`}>{formatUsd(call.costUsd)}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={call.result === "Fail" ? "Still failing" : call.result} label={call.result === "Fail" ? "Fail" : undefined} />
                  </td>
                  <td className="px-4 py-3">
                    {call.recording ? (
                      <button
                        type="button"
                        className="rounded-full border border-neutral-300 px-2 py-1 text-xs"
                        aria-label={playing === key ? "Pause recording" : "Play recording"}
                        onClick={() => setPlaying((current) => (current === key ? null : key))}
                      >
                        {playing === key ? "Pause" : "▶"}
                      </button>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                    {playing === key && call.recording ? <audio src={call.recording} autoPlay controls className="mt-2 h-8 max-w-[180px]" /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShareCard({ report, run, origin }: { report: BotReport; run: ReportRun; origin: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const eligible = trustEligible(run);
  const page = `${origin}/score/${report.slug}`;
  const reportAlt = `${report.name} · ${run.score}/100 · ${topFinding(run)}`;
  const trustAlt = "Stress-tested by Kasauti";

  return (
    <section className="no-print mt-10 rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="font-display text-xl font-bold text-neutral-900">Share</h2>
      <div className="mt-3 flex gap-2">
        <ThemeButton on={theme === "light"} onClick={() => setTheme("light")}>
          Light
        </ThemeButton>
        <ThemeButton on={theme === "dark"} onClick={() => setTheme("dark")}>
          Dark
        </ThemeButton>
      </div>
      <BadgeBlock
        title="Report stamp"
        note="For a team or a client."
        src={`/score/${report.slug}/badge.svg?type=report&form=stamp&theme=${theme}`}
        html={embedHtml(page, badgeSrc(origin, report.slug, "report", theme, "stamp"), reportAlt)}
        markdown={embedMarkdown(page, badgeSrc(origin, report.slug, "report", theme, "stamp"), reportAlt)}
        stamp
      />
      <BadgeBlock
        title="Public stamp"
        note={
          eligible.ok
            ? "Live on the latest run."
            : eligible.expired
              ? "Kasauti test expired"
              : "Available once your score is 70+ with no open Critical or High findings."
        }
        src={`/score/${report.slug}/badge.svg?type=trust&form=stamp&theme=${theme}`}
        html={embedHtml(page, badgeSrc(origin, report.slug, "trust", theme, "stamp"), trustAlt)}
        markdown={embedMarkdown(page, badgeSrc(origin, report.slug, "trust", theme, "stamp"), trustAlt)}
        stamp
        muted={!eligible.ok}
      />
      <BadgeBlock
        title="Public pill"
        note={eligible.ok ? "For a footer. Gold only after a pass." : "The pill is gold only after a pass."}
        src={`/score/${report.slug}/badge.svg?type=trust&form=pill&theme=${theme}`}
        html={embedHtml(page, badgeSrc(origin, report.slug, "trust", theme, "pill"), trustAlt)}
        markdown={embedMarkdown(page, badgeSrc(origin, report.slug, "trust", theme, "pill"), trustAlt)}
        muted={!eligible.ok}
      />
    </section>
  );
}

function BadgeBlock({
  title,
  note,
  src,
  html,
  markdown,
  muted = false,
  stamp = false,
}: {
  title: string;
  note: string;
  src: string;
  html: string;
  markdown: string;
  muted?: boolean;
  stamp?: boolean;
}) {
  return (
    <div className={`mt-5 ${muted ? "opacity-80" : ""}`}>
      <p className="font-medium text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{note}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={stamp ? "mt-3 block h-auto w-[200px] max-w-full" : "mt-3 h-10 w-auto max-w-full"} />
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={html}>Copy HTML</CopyButton>
        <CopyButton text={markdown}>Copy Markdown</CopyButton>
      </div>
    </div>
  );
}

function Methodology({ report, run }: { report: BotReport; run: ReportRun }) {
  const callers = new Set(run.calls.map((call) => call.caller)).size;
  const cost = knownCost(run);
  return (
    <section className="mt-10 pb-8">
      <details className="rounded-2xl border border-neutral-200 bg-white px-5 py-4">
        <summary className="cursor-pointer font-display text-lg font-bold text-neutral-900">Methodology</summary>
        <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">
          <p>
            {report.name}, {report.place}. Five pillars, {PILLAR_MAX} points each. Task, Facts, Language, and Tone are the average of the scored callers, converted from the judge’s 0–5 levels. Security starts at {PILLAR_MAX}. Reading the instructions aloud costs 8. Giving a patient name to an unverified caller costs 12.
          </p>
          <p>
            Judge {run.judges.before} before, {run.judges.after} after. Low-confidence scores are shown as Review on the compare page. This report uses the level the judge gave.
          </p>
          <p>
            {callers} callers in this report. Known call cost {formatUsd(cost)}. Test date {run.testedAt ? run.testedAt.slice(0, 10) : "—"}.
          </p>
          <ul className={`space-y-1 text-xs text-neutral-500 ${mono}`}>
            {run.executionIds.map((item) => (
              <li key={`${item.who}-${item.id}`}>
                {item.who}: {item.id}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}

function CountChip({ label, count, tone }: { label: string; count: number; tone: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${severityClass(tone)}`}>
      {label}
      <span className={mono}>{count}</span>
    </span>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${severityClass(severity)}`}>{severity}</span>;
}

function StatusChip({ status, label }: { status: FindingStatus; label?: string }) {
  const tone =
    status === "Fixed"
      ? "bg-emerald-50 text-emerald-800"
      : status === "Improved"
        ? "bg-amber-50 text-amber-900"
        : status === "Still failing"
          ? "bg-red-50 text-red-800"
          : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label ?? status}</span>;
}

function severityClass(severity: Severity): string {
  if (severity === "Critical") return "bg-[#9F1239] text-white";
  if (severity === "High") return "bg-red-600 text-white";
  return "bg-amber-100 text-amber-950";
}

function CopyLine({ text }: { text: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[#0E0D0C] px-3 py-2">
      <pre className={`whitespace-pre-wrap text-xs leading-5 text-emerald-300 ${mono}`}>{text}</pre>
      <CopyButton text={text}>Copy</CopyButton>
    </div>
  );
}

function CopyButton({ text, children }: { text: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`rounded-full bg-[#FFB800] px-3 py-1 text-xs font-semibold text-neutral-950 ${mono}`}
      onClick={async () => {
        await writeClipboard(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : children}
    </button>
  );
}

function ThemeButton({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs ${on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
    >
      {children}
    </button>
  );
}

function badgeSrc(origin: string, slug: string, type: "report" | "trust", theme: "light" | "dark", form: "stamp" | "pill") {
  return `${origin}/score/${slug}/badge.svg?type=${type}&form=${form}&theme=${theme}`;
}

function embedHtml(page: string, src: string, alt: string) {
  const height = src.includes("form=pill") ? 40 : 120;
  return `<a href="${page}"><img src="${src}" alt="${alt}" height="${height}"></a>`;
}

function embedMarkdown(page: string, src: string, alt: string) {
  return `[![${alt}](${src})](${page})`;
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
