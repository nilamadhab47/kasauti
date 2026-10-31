"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { LEVEL1_CALLS, level1Call, type Level1Call } from "@/lib/level1-calls";
import { LEVEL1_PATCH } from "@/lib/level1-patch";
import { openSession, type Session } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const mono = "[font-family:var(--font-mono)]";

function clock(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes ? `${minutes} min ${rest} sec` : `${rest} sec`;
}

export default function TranscriptPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [call, setCall] = useState<Level1Call>(LEVEL1_CALLS[0]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const current = openSession();
    setSession(current);
    const requested = new URLSearchParams(window.location.search).get("call");
    setCall(level1Call(requested));
  }, [router]);

  function open(id: string) {
    setCall(level1Call(id));
    setCopied(false);
    const url = new URL(window.location.href);
    url.searchParams.set("call", id);
    window.history.replaceState(null, "", url);
  }

  if (!session || !call) return null;

  const breakAt = call.turns.findIndex((turn) => turn.broke);
  const before = breakAt >= 0 ? call.turns.slice(0, breakAt) : call.turns;
  const broken = breakAt >= 0 ? call.turns[breakAt] : null;
  const after = breakAt >= 0 ? call.turns.slice(breakAt + 1) : [];

  return (
    <div className="min-h-screen bg-[#FFFDFB] text-[#0F0E0C]">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link href="/workspace">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-3 text-[14px] text-[#57534E]">
          <span>{session.name}</span>
          <button type="button" onClick={() => router.push("/")} className="text-[#737373] hover:text-[#0F0E0C]">
            Home
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex flex-wrap gap-2">
          {LEVEL1_CALLS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item.id)}
              className={`rounded-full px-4 py-2 text-[14px] ${item.id === call.id ? "bg-[#0F0E0C] text-white" : "bg-white text-[#57534E] shadow-sm"}`}
            >
              {item.who}
            </button>
          ))}
        </div>

        <section className="mb-8">
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] text-[#BF0715] ${mono}`}>Level 1 · {call.who}</p>
          <h1 className={`mt-2 text-4xl ${display}`}>{call.who} × Sehat Clinic</h1>
          <p className={`mt-3 text-[13px] text-[#57534E] ${mono}`}>
            {clock(call.seconds)} · ${call.costUsd.toFixed(2)} · {call.turns.length} turns · {call.role}
          </p>
          {call.recording ? (
            <audio key={call.id} controls preload="metadata" src={call.recording} className="mt-4 w-full" />
          ) : (
            <p className="mt-4 text-[14px] text-[#737373]">The recording did not download.</p>
          )}
        </section>

        <p className={`mb-6 text-lg text-[#57534E] ${display}`}>{call.sentence}</p>

        <ol className="flex flex-col gap-4">
          {before.map((turn, index) => (
            <li key={`${call.id}-before-${index}`} className={`max-w-[85%] rounded-lg px-4 py-3 text-[15px] leading-relaxed ${turn.speaker === "bot" ? "self-start bg-white shadow-sm" : "self-end bg-[#E9E1DD]"}`}>
              <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#737373] ${mono}`}>
                {turn.speaker === "bot" ? "Bot" : call.who}
              </span>
              {turn.text}
            </li>
          ))}
        </ol>

        {broken ? (
          <article className="my-8 rounded-lg border-2 border-[#BF0715] bg-[#FFDAD6] p-5">
            <p className={`text-[11px] font-bold uppercase tracking-[0.14em] text-[#BF0715] ${mono}`}>The line that broke</p>
            <p className={`mt-3 text-2xl leading-snug ${display}`}>{broken.text}</p>
          </article>
        ) : null}

        {after.length ? (
          <ol className="flex flex-col gap-4">
            {after.map((turn, index) => (
              <li key={`${call.id}-after-${index}`} className={`max-w-[85%] rounded-lg px-4 py-3 text-[15px] leading-relaxed ${turn.speaker === "bot" ? "self-start bg-white shadow-sm" : "self-end bg-[#E9E1DD]"}`}>
                <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#737373] ${mono}`}>
                  {turn.speaker === "bot" ? "Bot" : call.who}
                </span>
                {turn.text}
              </li>
            ))}
          </ol>
        ) : null}

        <section className="mt-10 rounded-lg bg-white p-5 shadow-sm">
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] text-[#57534E] ${mono}`}>One line for the prompt</p>
          <p className="mt-3 text-[16px] leading-relaxed">{LEVEL1_PATCH.lines.find((item) => item.who === call.who)?.line ?? call.prompt}</p>
          <button
            type="button"
            onClick={() => {
              const line = LEVEL1_PATCH.lines.find((item) => item.who === call.who)?.line ?? call.prompt;
              void navigator.clipboard.writeText(line).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="mt-4 text-[14px] text-[#8C4A00]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </section>
      </main>
    </div>
  );
}
