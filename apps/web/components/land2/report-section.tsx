"use client";

import { useEffect, useState } from "react";
import { ReportView } from "@/components/report/report-view";
import { trustEligible, type BotReport } from "@/lib/report-model";

export function ReportSection({ report, origin }: { report: BotReport; origin: string }) {
  const [preview, setPreview] = useState(false);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [tab, setTab] = useState<"stamp" | "pill">("stamp");
  const [copied, setCopied] = useState(false);
  const passRun = report.runs.slice(1).find((run) => trustEligible(run).ok) ?? null;
  const stampEmbed = `<a href="${origin}/score/${report.slug}"><img src="${origin}/score/${report.slug}/badge.svg?type=trust&form=stamp&theme=light" alt="Stress-tested by Kasauti" height="120"></a>`;
  const pillEmbed = `<a href="${origin}/score/${report.slug}"><img src="${origin}/score/${report.slug}/badge.svg?type=trust&form=pill&theme=light" alt="Stress-tested by Kasauti" height="40"></a>`;
  const embed = tab === "pill" ? pillEmbed : stampEmbed;

  useEffect(() => {
    const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefers);
    if (prefers) {
      setPreview(true);
      setShown(true);
      return;
    }
    const watch = (id: string, set: (value: boolean) => void) => {
      const node = document.getElementById(id);
      if (!node) return () => {};
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          set(true);
          io.disconnect();
        },
        { threshold: 0.35 },
      );
      io.observe(node);
      return () => io.disconnect();
    };
    const stopPreview = watch("report", setPreview);
    const stopBadge = watch("report-badge", setShown);
    return () => {
      stopPreview();
      stopBadge();
    };
  }, []);

  return (
    <section className="border-t border-neutral-200 bg-white py-24" id="report">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl space-y-3 text-center">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#D97706]">The report</span>
          <h2 className="font-display text-3xl font-bold text-neutral-900 sm:text-4xl">One link your whole team understands.</h2>
          <p className="text-sm text-neutral-600 sm:text-base">
            Every test ends in a report: a score out of 100, what broke, how serious it is, and the fix. Share it with your team or your client.
          </p>
        </div>

        <div className="relative mx-auto max-w-3xl" style={{ zoom: 0.86 }}>
          <div className="pointer-events-none absolute inset-8 rounded-full bg-[#FFB800]/25 blur-3xl" />
          <div
            className="relative origin-center rounded-3xl border border-neutral-200 bg-[#FFFDFB] p-4 shadow-2xl sm:p-6"
            style={{
              transform: preview || reduced ? "rotate(0deg)" : "rotate(-2.5deg)",
              transition: reduced ? "none" : "transform 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            <ReportView report={report} origin={origin} mode="compact" />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href={`/score/${report.slug}`} className="rounded-full bg-[#0E0D0C] px-5 py-3 text-sm font-semibold text-white">
            Open the Sehat report
          </a>
          <a href="/workspace" className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900">
            Stress-test my bot
          </a>
        </div>

        <div id="report-badge" className="mx-auto mt-16 max-w-3xl rounded-3xl border border-neutral-200 bg-[#FFFDFB] p-6 sm:p-8">
          <h3 className="font-display text-2xl font-bold text-neutral-900">Passed? Show it.</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
            One line puts a live Kasauti stamp on your site. It always shows your latest score and links to the full report.
          </p>
          <div className="mt-8 grid items-end justify-items-center gap-8 sm:grid-cols-2">
            <figure className="relative text-center">
              <figcaption className="mb-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">Run 1</figcaption>
              <div className="relative mx-auto h-[120px] w-[120px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/score/${report.slug}/badge.svg?type=report&form=stamp&theme=light&run=1`}
                  alt={`${report.name} ${report.runs[0]?.score ?? "—"}/100`}
                  width={120}
                  height={120}
                  className="h-[120px] w-[120px]"
                  style={{
                    opacity: passRun && (shown || reduced) ? 0 : 1,
                    transition: reduced ? "none" : "opacity 0.45s ease 0.55s",
                  }}
                />
                {passRun && shown && !reduced ? (
                  <span className="kx-rub pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-transparent via-[#E8B530] to-transparent opacity-80" style={{ animation: "kx-rub 0.7s ease forwards" }} />
                ) : null}
              </div>
            </figure>
            <figure className="text-center">
              <figcaption className="mb-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">After the fix</figcaption>
              {passRun ? (
                <div className="relative mx-auto h-[120px] w-[120px]">
                  <span
                    className="pointer-events-none absolute inset-0 rounded-full border border-[#B8860B]/50"
                    style={shown && !reduced ? { animation: "kx-spread 0.7s ease 0.72s both" } : { opacity: 0 }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/score/${report.slug}/badge.svg?type=trust&form=stamp&theme=light&run=${report.runs.indexOf(passRun) + 1}`}
                    alt={`Stress-tested by Kasauti ${passRun.score}/100`}
                    width={120}
                    height={120}
                    className="h-[120px] w-[120px]"
                    style={
                      reduced || !shown
                        ? { opacity: reduced ? 1 : 0 }
                        : { animation: "kx-press 0.7s cubic-bezier(0.22, 1.4, 0.36, 1) 0.7s both" }
                    }
                  />
                </div>
              ) : (
                <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center rounded-full border border-dashed border-neutral-300 px-3 text-center text-[11px] leading-4 text-neutral-500">
                  Your badge appears here once you pass
                </div>
              )}
            </figure>
          </div>
          <p className="mt-6 text-xs leading-5 text-neutral-500">
            Public stamps appear only at 70+ with no open critical issues, and expire 30 days after your last test.
          </p>
          <div className="mt-5 flex gap-2">
            {(["stamp", "pill"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTab(item);
                  setCopied(false);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${tab === item ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-hidden rounded-xl bg-[#0E0D0C]">
            <pre className="overflow-hidden whitespace-pre-wrap break-all p-3 font-mono text-xs leading-5 text-emerald-300">{embed}</pre>
            <div className="flex justify-end border-t border-white/10 px-3 py-2">
              <button
                type="button"
                className="rounded-full bg-[#FFB800] px-3 py-1 text-xs font-semibold text-[#0E0D0C]"
                onClick={() => {
                  void navigator.clipboard.writeText(embed).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
