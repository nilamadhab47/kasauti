"use client";

import { useEffect, useRef, useState } from "react";
import { BREAK_LINE, TURNS } from "@/lib/prototype";
const display = "[font-family:var(--font-display)]";
const mono = "[font-family:var(--font-mono)]";

type Phase = "ring" | "live" | "ended" | "transcript";

export function CallScene({ botName, onOpenReport }: { botName: string; onOpenReport: () => void }) {
  const [phase, setPhase] = useState<Phase>("ring");
  const [index, setIndex] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [frozen, setFrozen] = useState<number | null>(null);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase("live"), 1600),
      window.setTimeout(() => setPhase("ended"), 5200),
      window.setTimeout(() => {
        setPhase("transcript");
        setIndex(0);
      }, 7000),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (phase === "ring" || frozen !== null) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase, frozen]);

  useEffect(() => {
    if (phase !== "transcript" || index < 0) return;
    const turn = TURNS[index];
    if (turn?.break) {
      setFrozen((value) => value ?? elapsedRef.current);
      return;
    }
    const timer = window.setTimeout(() => setIndex(index + 1), 1400);
    return () => window.clearTimeout(timer);
  }, [phase, index]);

  const turn = index >= 0 ? TURNS[index] : null;
  const broken = Boolean(turn?.break);
  const clock = formatClock(frozen ?? elapsed);
  const speakerLive = phase === "live" || (phase === "transcript" && !broken);

  return (
    <section data-phase={broken ? "crack" : phase} className="relative mx-auto w-full max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase ${mono} ${broken ? "bg-[#FFDAD6] text-[#93000A]" : "bg-[#FAF6F0] text-[#57534E]"}`}>
            <span className={`h-2 w-2 rounded-full ${broken ? "bg-[#BF0715]" : "animate-pulse bg-[#B8860B]"}`} />
            {broken ? "Crack detected · call severed" : phase === "ring" ? "Ringing" : phase === "ended" ? "Call disconnected" : "Crash test in progress · live call"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-[10px] tracking-[0.14em] text-[#737373] uppercase ${mono}`}>{broken ? "Frozen at" : "Duration"}</span>
          <span className={`rounded bg-[#FAF6F0] px-2 py-0.5 text-[12px] font-semibold ${mono}`}>{clock}</span>
          {broken ? (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.08em] text-[#BF0715] uppercase ${mono}`}>
              <span className="material-symbols-outlined text-[16px]">pause_circle</span>
              Test ended
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid items-center gap-6 md:grid-cols-12">
        <Party
          kicker="Caller"
          aside="Sharma ji"
          name="Sharma ji"
          detail={broken ? "Delhi · Wants ₹500 back · Disbelieving" : "Delhi · Wants ₹500 back"}
          live={speakerLive && turn?.speaker === "caller"}
          fault={false}
        />
        <Bridge broken={broken} connected={phase !== "ring"} />
        <Party
          kicker="Target under test"
          aside={broken ? "The slip" : "Live"}
          name={botName}
          detail="Clinic bot"
          live={speakerLive && turn?.speaker === "bot"}
          fault={broken}
        />
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center px-2 pt-16 text-center">
        {broken ? (
          <>
            <p className={`mb-4 inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-[#BF0715] uppercase ${mono}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#BF0715]" />
              {botName} · invented an appointment
            </p>
            <div className="relative px-4 py-2">
              <div className="absolute inset-0 -rotate-1 rounded-lg bg-[#FFDAD6]/70" />
              <h1 className={`relative text-[32px] leading-tight font-semibold tracking-tight sm:text-5xl sm:leading-[1.18] ${display}`}>
                “I have cancelled appointment ID 241 for you.”
              </h1>
            </div>
            <p className="mt-6 max-w-2xl text-[22px] leading-8 text-[#57534E]">{BREAK_LINE}</p>
            <div className={`mt-8 flex flex-wrap items-center justify-center gap-4 text-[12px] text-[#57534E] ${mono}`}>
              <span>
                <span className="text-[#737373]">Expected </span>Acknowledge the ₹500 refund
              </span>
              <span className="text-[#E7E5E4]">/</span>
              <span>
                <span className="text-[#BF0715]">Delivered </span>Invented appointment 241
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenReport}
              className="mt-12 flex w-full max-w-md items-center justify-between rounded-xl bg-[#0E0D0C] p-4 text-left text-[#FFFDFB] shadow-xl transition hover:bg-neutral-800"
            >
              <span>
                <span className={`block text-[22px] font-medium ${display}`}>Review the crash report</span>
                <span className="mt-0.5 block text-[13px] text-neutral-300">The brief, the quote, and the one prompt change</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </span>
            </button>
          </>
        ) : (
          <>
            <p key={index} className={`text-[32px] leading-tight font-medium tracking-tight text-[#0F0E0C] sm:text-[44px] ${display}`}>
              {turn ? `“${turn.text}”` : phase === "ended" ? "Waiting for the transcript." : phase === "ring" ? "The clinic number is ringing." : "They are on the phone."}
            </p>
            <p className={`mt-4 text-[10px] tracking-[0.12em] text-[#737373] uppercase ${mono}`}>
              {turn ? (turn.speaker === "caller" ? "Sharma ji" : botName) : "Words arrive when the call is completed"}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Party({
  kicker,
  aside,
  name,
  detail,
  live,
  fault,
}: {
  kicker: string;
  aside: string;
  name: string;
  detail: string;
  live: boolean;
  fault: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white p-5 shadow-sm md:col-span-4 ${fault ? "border-l-4 border-[#BF0715]" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`text-[10px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>{kicker}</span>
        <span className={`text-[10px] tracking-[0.06em] uppercase ${mono} ${fault ? "rounded bg-[#FFDAD6] px-2 py-0.5 text-[#93000A]" : "text-[#737373]/70"}`}>{aside}</span>
      </div>
      <h2 className={`text-[22px] font-semibold tracking-tight ${display}`}>{name}</h2>
      <p className="mt-0.5 text-[13px] text-[#57534E]">{detail}</p>
      <div className="mt-4 flex h-8 items-center gap-[3px] rounded bg-[#FAF2EE] px-3">
        {live ? (
          Array.from({ length: 18 }, (_, i) => (
            <i key={i} className="block w-1 animate-pulse rounded-full bg-[#D97706]" style={{ height: `${8 + ((i * 17) % 18)}px`, animationDelay: `${i * 70}ms` }} />
          ))
        ) : fault ? (
          <>
            <span className="h-[2px] w-7/12 rounded-full bg-[#E7E5E4]" />
            <span className="h-4 w-1 rounded-full bg-[#BF0715]" />
            <span className="h-[2px] w-4/12 rounded-full bg-[#E7E5E4]" />
          </>
        ) : (
          <span className="h-[2px] w-full rounded-full bg-[#E7E5E4]" />
        )}
      </div>
    </div>
  );
}

function Bridge({ broken, connected }: { broken: boolean; connected: boolean }) {
  return (
    <div className="relative flex h-28 flex-col items-center justify-center md:col-span-4">
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center">
        <div className={`h-[2px] flex-1 ${connected ? "bg-[#E7E5E4]" : "bg-[#FAF6F0]"}`} />
        <div className="w-16" />
        <div className={`h-[2px] flex-1 ${broken ? "bg-[#E7E5E4]" : connected ? "bg-[#D97706]" : "bg-[#FAF6F0]"}`} />
      </div>
      {broken ? (
        <div className="relative z-10 flex animate-pulse flex-col items-center">
          <svg className="h-24 w-16 text-[#BF0715]" viewBox="0 0 76 110" fill="none" aria-hidden>
            <path d="M38 2L48 28L28 42L52 64L24 78L44 94L36 108" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          </svg>
          <span className={`text-[10px] font-semibold tracking-[0.14em] text-[#BF0715] uppercase ${mono}`}>Line severed</span>
        </div>
      ) : (
        <span className={`relative z-10 rounded-full bg-[#FFFDFB] px-2 text-[10px] tracking-[0.12em] text-[#B8860B] uppercase ${mono}`}>
          {connected ? "On the call" : "Ringing"}
        </span>
      )}
    </div>
  );
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
