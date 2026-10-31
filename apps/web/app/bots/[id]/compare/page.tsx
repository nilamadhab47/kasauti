"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { PersonLink } from "@/components/person-link";
import { LEVEL1_COMPARE } from "@/lib/level1-compare";
import { openSession, type Session } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

type Row = (typeof LEVEL1_COMPARE.rows)[number];
type Side = Row["before"];
type CellOut = Side["cells"][number];

export default function ComparePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const current = openSession();
    if (!current.bots.some((bot) => bot.id === params.id)) router.replace("/workspace");
    else setSession(current);
  }, [params.id, router]);

  if (!session) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const bot = session.bots.find((item) => item.id === params.id);
  if (!bot) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const beforeCost = LEVEL1_COMPARE.rows.reduce((total, row) => total + (row.before.costUsd ?? 0), 0);
  const afterCost = LEVEL1_COMPARE.rows.reduce((total, row) => total + (row.after.costUsd ?? 0), 0);
  const held = LEVEL1_COMPARE.afterHeldByFloor;

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link href="/workspace">
            <Logo size="sm" />
          </Link>
          <PersonLink name={session.name} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        <Link href={`/bots/${bot.id}`} className={`mb-6 inline-flex items-center gap-1 text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {bot.name}
        </Link>
        <p className={`text-[12px] tracking-[0.14em] text-[#737373] uppercase ${mono}`}>Level 1 · before the patch and after</p>
        <h1 className={`mt-2 text-[40px] tracking-tight sm:text-[52px] ${display}`}>
          Pass rate {LEVEL1_COMPARE.beforePassed}/{LEVEL1_COMPARE.callers} → {LEVEL1_COMPARE.afterPassed}/{LEVEL1_COMPARE.callers}.
        </h1>

        {held > 0 ? (
          <div className="mt-5 rounded-xl border border-[#C8A24B]/40 bg-[#FBF3DC] p-5">
            <p className={`text-[11px] tracking-[0.12em] text-[#8A6D1F] uppercase ${mono}`}>The honest green</p>
            <p className="mt-2 text-[17px] leading-7 text-[#57534E]">
              On the rerun, Neha cleared <strong className="text-[#0F0E0C]">all three critical checks — Facts, Language, Asks — at 4 out of 5</strong>. Kasauti still
              shows them as <strong className="text-[#0F0E0C]">Review, not Pass</strong>, because the judge&rsquo;s confidence on synthetic bot-to-bot audio stays under its
              floor. That floor is the point: <strong className="text-[#0F0E0C]">no fake greens</strong>. On a real human caller the same config clears it.
            </p>
          </div>
        ) : null}

        <p className={`mt-4 text-[12px] text-[#737373] ${mono}`}>
          Before ${beforeCost.toFixed(2)} · after ${afterCost.toFixed(2)} · judge {LEVEL1_COMPARE.rows[0].after.model}
        </p>
        <Link href="/score/sehat" className={`mt-3 inline-flex text-[13px] text-[#B8860B] ${mono}`}>
          The 0–100 score
        </Link>

        <div className="mt-10 space-y-14 pb-16">
          {LEVEL1_COMPARE.rows.map((row) => (
            <CallerCompare key={row.id} row={row} />
          ))}
        </div>
      </div>
    </main>
  );
}

function CallerCompare({ row }: { row: Row }) {
  const criticalPass = row.after.cells.filter((c) => c.critical && c.rounded >= 4).length;
  const criticalTotal = row.after.cells.filter((c) => c.critical).length;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className={`text-[28px] ${display}`}>{row.who}</h2>
          {row.after.heldByFloor ? (
            <span className={`rounded-full border border-[#C8A24B]/50 bg-[#FBF3DC] px-2.5 py-0.5 text-[11px] text-[#8A6D1F] ${mono}`}>
              {criticalPass}/{criticalTotal} critical checks passed · held by floor
            </span>
          ) : null}
        </div>
        <Link href={`/transcript?call=${row.id}`} className="text-[14px] text-[#57534E] hover:text-[#0F0E0C]">
          Open first call
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className={`grid grid-cols-[9rem_1fr_1fr] gap-3 border-b border-[#E9E1DD] px-5 py-3 text-[12px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>
          <span>Cell</span>
          <span>Before</span>
          <span>After</span>
        </div>
        {row.before.cells.map((cell) => {
          const after = row.after.cells.find((item) => item.label === cell.label);
          const moved = (after?.word ?? "—") !== cell.word || (after?.rounded ?? -1) !== cell.rounded;
          return (
            <div key={cell.label} className="grid grid-cols-[9rem_1fr_1fr] items-center gap-3 border-b border-[#FAF6F0] px-5 py-4 last:border-0">
              <span className="flex items-center gap-1.5 text-[15px] font-medium">
                {cell.label}
                {cell.critical ? <span className={`text-[10px] tracking-[0.06em] text-[#B8860B] uppercase ${mono}`}>key</span> : null}
              </span>
              <Cell cell={cell} />
              <Cell cell={after} moved={moved} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <CallClip side={row.before} label="Before · v1 bot" />
        <CallClip side={row.after} label="After · patched bot" highlight={row.after.heldByFloor} />
      </div>
    </section>
  );
}

function Cell({ cell, moved }: { cell: CellOut | undefined; moved?: boolean }) {
  if (!cell) return <span className={`text-[12px] text-[#737373] ${mono}`}>—</span>;
  const fail = cell.word === "Fail";
  const pass = cell.word === "Pass";
  const floorPass = cell.heldByFloor;
  const tone = fail
    ? "bg-[#FFDAD6] text-[#BF0715]"
    : pass
      ? "bg-[#D9F2DE] text-[#1F7A3D]"
      : floorPass
        ? "bg-[#FBF3DC] text-[#8A6D1F]"
        : "bg-[#E9E1DD] text-[#57534E]";
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className={`rounded px-1.5 py-0.5 text-[12px] font-bold ${mono} ${tone}`}>{cell.word}</span>
      <span className={`text-[12px] text-[#737373] ${mono}`}>{cell.rounded}/5</span>
      {floorPass ? <span className={`text-[10px] tracking-[0.06em] text-[#8A6D1F] uppercase ${mono}`}>would pass</span> : null}
      {moved && !floorPass ? <span className={`text-[10px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>moved</span> : null}
    </span>
  );
}

function CallClip({ side, label, highlight }: { side: Side; label: string; highlight?: boolean }) {
  const verdict = side.verdict === "green" ? "Passed" : side.verdict === "amber" ? "Mixed" : "Failed";
  const verdictTone = side.verdict === "green" ? "text-[#1F7A3D]" : side.verdict === "amber" ? "text-[#8A6D1F]" : "text-[#BF0715]";
  return (
    <article className={`rounded-xl bg-white p-5 shadow-sm ${highlight ? "ring-1 ring-[#C8A24B]/40" : ""}`}>
      <p className={`text-[10px] tracking-[0.1em] uppercase ${mono} ${verdictTone}`}>
        {label} · {verdict}
      </p>
      <p className={`mt-2 text-[20px] leading-snug ${display}`}>{side.quote ? `\u201c${side.quote}\u201d` : "No line kept."}</p>
      <p className="mt-3 text-[14px] leading-6 text-[#57534E]">{side.sentence}</p>
      {side.recording ? (
        <audio controls src={side.recording} className="mt-4 h-9 w-full">
          Your browser does not support audio playback.
        </audio>
      ) : (
        <p className={`mt-4 text-[12px] text-[#737373] ${mono}`}>Recording unavailable.</p>
      )}
      {side.turns.length ? <TranscriptPeek turns={side.turns} /> : null}
    </article>
  );
}

function TranscriptPeek({ turns }: { turns: Side["turns"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`text-[12px] tracking-[0.06em] text-[#57534E] uppercase hover:text-[#0F0E0C] ${mono}`}
      >
        {open ? "Hide transcript" : `Show transcript · ${turns.length} turns`}
      </button>
      {open ? (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-[#FBF5F1] p-3">
          {turns.map((turn, index) => (
            <p key={index} className="text-[13px] leading-5">
              <span className={`mr-2 text-[10px] tracking-[0.08em] uppercase ${mono} ${turn.speaker === "caller" ? "text-[#B8860B]" : "text-[#737373]"}`}>
                {turn.speaker === "caller" ? "Caller" : "Bot"}
              </span>
              <span className="text-[#0F0E0C]">{turn.text}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
