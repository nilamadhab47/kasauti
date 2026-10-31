"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SEHAT_SCORE } from "@/lib/hundred";
import { LEVEL1_CALLS } from "@/lib/level1-calls";
import { LEVEL1_PATCH } from "@/lib/level1-patch";
import { REPLAY_FLAG, loadSession, sampleRun, saveSession } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const mono = "[font-family:var(--font-mono)]";

export function Scorecard({ botName, onReplay }: { botName: string; onReplay: () => void }) {
  const [copied, setCopied] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    const clinic = [...session.bots].reverse().find((bot) => bot.shop === "clinic");
    setBotId(clinic?.id ?? null);
    const replay = window.sessionStorage.getItem(REPLAY_FLAG) === "1";
    window.sessionStorage.removeItem(REPLAY_FLAG);
    saveSession({
      ...session,
      bots: session.bots.map((bot) => {
        if (bot.shop !== "clinic") return bot;
        if (bot.runs.length === 0) return { ...bot, ran: true, runs: [sampleRun(1)] };
        if (replay) return { ...bot, ran: true, runs: [...bot.runs, sampleRun(bot.runs.length + 1)] };
        return { ...bot, ran: true };
      }),
    });
  }, []);

  async function copyPatch() {
    try {
      await navigator.clipboard.writeText(LEVEL1_PATCH.block);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="mx-auto w-full max-w-4xl space-y-8">
      <section>
        <p className={`flex items-center gap-2 text-[12px] tracking-[0.14em] text-[#737373] uppercase ${mono}`}>
          <span className="h-2 w-2 rounded-full bg-[#BF0715]" />
          Level 1 · {botName} · Sharma ji and Neha
        </p>
        <div className="mt-3 flex flex-col gap-x-6 gap-y-1 md:flex-row md:items-baseline">
          <h1 className={`text-[64px] leading-none font-bold tracking-tight text-[#BF0715] ${display}`}>Failed</h1>
          <p className={`text-[28px] font-medium tracking-tight sm:text-[32px] ${display}`}>0 of 2 callers passed.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-white p-6 shadow-[0_12px_32px_-8px_rgba(30,27,25,0.04)] sm:p-8">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>The lines that failed</span>
          <span className="material-symbols-outlined text-[20px] text-[#BF0715]">record_voice_over</span>
        </div>
        {LEVEL1_CALLS.map((call) => (
          <div key={call.id}>
            <blockquote className={`text-[22px] leading-relaxed font-semibold tracking-tight sm:text-[28px] ${display}`}>“{call.line}”</blockquote>
            <p className="mt-2 text-[15px] text-[#57534E]">{call.who}</p>
          </div>
        ))}
      </section>

      <section className="relative overflow-hidden rounded-xl bg-[#FAF6F0] p-6 sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#0E0D0C]" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`rounded bg-[#0E0D0C]/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>The fix</span>
            <span className={`text-[10px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>Paste into the bot prompt</span>
          </div>
          <button type="button" onClick={copyPatch} className={`inline-flex items-center gap-1 rounded bg-[#E9E1DD] px-3 py-1.5 text-[12px] text-[#0F0E0C] ${mono}`}>
            <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
            {copied ? "Copied" : "Copy patch"}
          </button>
        </div>
        <ol className="mb-4 space-y-3">
          {LEVEL1_PATCH.lines.map((item, index) => (
            <li key={item.who} className="text-[15px] leading-6">
              <span className={`mr-2 text-[12px] text-[#737373] ${mono}`}>{index + 1}. {item.who}</span>
              {item.line}
            </li>
          ))}
        </ol>
        <div className="rounded-lg bg-white p-4">
          <p className={`text-[15px] leading-7 whitespace-pre-wrap ${mono}`}>{LEVEL1_PATCH.block}</p>
        </div>
      </section>

      <p className={`text-center text-[12px] text-[#737373] ${mono}`}>This run cost ${LEVEL1_CALLS.reduce((total, call) => total + call.costUsd, 0).toFixed(2)}.</p>

      <section className="flex flex-col items-center justify-center gap-4 pb-10 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.setItem(REPLAY_FLAG, "1");
            onReplay();
          }}
          className={`inline-flex items-center justify-center gap-1 rounded bg-[#0E0D0C] px-6 py-3 text-lg font-medium text-white ${display}`}
        >
          <span className="material-symbols-outlined text-[20px]">replay</span>
          Run again
        </button>
        <Link href="/transcript" className={`inline-flex items-center justify-center gap-1 rounded bg-white px-6 py-3 text-lg font-medium shadow-sm ${display}`}>
          See the full call
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
        <Link href="/score/sehat" className="px-4 py-2 text-[15px] text-[#57534E] hover:text-[#0F0E0C]">
          {SEHAT_SCORE.beforeTotal}/100 · share
        </Link>
        {botId ? (
          <>
            <Link href={`/bots/${botId}/compare`} className="px-4 py-2 text-[15px] text-[#57534E] hover:text-[#0F0E0C]">
              What moved
            </Link>
            <Link href={`/bots/${botId}`} className="px-4 py-2 text-[15px] text-[#57534E] hover:text-[#0F0E0C]">
              Open {botName}
            </Link>
          </>
        ) : null}
        <Link href="/workspace" className="px-4 py-2 text-[15px] text-[#57534E] hover:text-[#0F0E0C]">
          ← Back to workspace
        </Link>
      </section>
    </article>
  );
}
