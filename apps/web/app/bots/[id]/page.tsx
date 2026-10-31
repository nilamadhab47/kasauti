"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { PersonLink } from "@/components/person-link";
import { SEHAT_SCORE } from "@/lib/hundred";
import { LEVEL1_CALLS } from "@/lib/level1-calls";
import { LEVEL1_PATCH } from "@/lib/level1-patch";
import { SHOPS, loadSession, openSession, saveSession, type Session } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

export default function BotWorkbench() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [task, setTask] = useState("");
  const [facts, setFacts] = useState("");
  const [neverSay, setNeverSay] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<"phone" | "patch" | null>(null);

  useEffect(() => {
    const current = openSession();
    const bot = current.bots.find((item) => item.id === params.id);
    if (!current || !bot) {
      router.replace("/workspace");
      return;
    }
    const shop = SHOPS.find((item) => item.id === bot.shop);
    setTask(bot.task || shop?.task || "");
    setFacts(bot.facts || shop?.facts || "");
    setNeverSay(bot.neverSay || shop?.neverSay || "");
    setSession(current);
  }, [params.id, router]);

  if (!session) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const bot = session.bots.find((item) => item.id === params.id);
  if (!bot) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const shop = SHOPS.find((item) => item.id === bot.shop);
  const failed = bot.ran && bot.shop === "clinic";
  const kind = session.kind === "agency" ? "Agency" : "In-house";

  function persist() {
    const current = loadSession();
    if (!current || !task.trim() || !facts.trim()) return;
    const next: Session = {
      ...current,
      bots: current.bots.map((item) => (item.id === bot!.id ? { ...item, task: task.trim(), facts: facts.trim(), neverSay: neverSay.trim() } : item)),
    };
    saveSession(next);
    setSession(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  async function copy(kind: "phone" | "patch", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/workspace" className="shrink-0">
              <Logo size="sm" />
            </Link>
            <span className="hidden h-4 w-px bg-[#E7E5E4]/70 sm:block" />
            <span className={`hidden items-center gap-2 rounded-full bg-[#FAF6F0] px-3 py-1 text-[12px] tracking-[0.08em] text-[#57534E] uppercase sm:inline-flex ${mono}`}>
              <span className="max-w-[10rem] truncate">{session.company}</span>
              <span className="text-[#E7E5E4]">·</span>
              <span className="rounded bg-[#CCE5FF] px-1.5 py-0.5 text-[#00476E]">{kind}</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <nav className="flex items-center gap-4 text-[15px]">
              <Link href="/run" className="text-[#57534E]">
                Live Test
              </Link>
              <Link href="/run?view=report" className="text-[#57534E]">
                Reports
              </Link>
            </nav>
            <PersonLink name={session.name} />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <Link href="/workspace" className="mb-6 inline-flex items-center gap-1 text-[15px] font-medium text-[#57534E] hover:text-[#0F0E0C]">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {session.company} / {bot.name}
        </Link>

        <div className="mb-10 grid items-start gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className={`text-[44px] leading-none font-semibold tracking-tight sm:text-[64px] ${display}`}>{bot.name}</h1>
              {failed && bot.shop === "clinic" ? (
                <Link href="/score/sehat" className={`inline-flex items-center gap-1.5 rounded-full bg-[#FFDAD6] px-3 py-1 text-[12px] font-bold tracking-[0.08em] text-[#410002] uppercase ${mono}`}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#BF0715]" />
                  {SEHAT_SCORE.beforeTotal}/100 · prompt leak
                </Link>
              ) : failed ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#FFDAD6] px-3 py-1 text-[12px] font-bold tracking-[0.08em] text-[#410002] uppercase ${mono}`}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#BF0715]" />
                  Failed
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#FAF6F0] px-3 py-1 text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>
                  Not tested yet
                </span>
              )}
            </div>
            <p className="mt-3 max-w-2xl text-lg leading-7 text-[#57534E]">
              {failed ? "Sharma ji and Neha both failed. The patch below is ready to paste into Bolna." : "Save the job and the facts. A caller only hears what you write here."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => copy("phone", bot.phone)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[13px] shadow-sm hover:bg-[#FAF6F0]">
                <span className="material-symbols-outlined text-[16px] text-[#B8860B]">call</span>
                <span className={mono}>{prettyPhone(bot.phone)}</span>
                <span className="material-symbols-outlined text-[14px] text-[#737373]">{copied === "phone" ? "check" : "content_copy"}</span>
              </button>
              <span className="text-[#E7E5E4]">·</span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[13px] text-[#57534E] shadow-sm">
                <span className="material-symbols-outlined text-[16px] text-[#737373]">local_hospital</span>
                Shop: {shop?.name || "Bot"}
              </span>
              <span className="text-[#E7E5E4]">·</span>
              <Link href={`/connect?bot=${bot.id}`} className={`inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12px] text-[#57534E] shadow-sm hover:bg-[#FAF6F0] ${mono}`}>
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                {bot.bolnaAgentId ? "Bolna linked" : "Link Bolna"}
              </Link>
            </div>
          </div>

          {failed ? (
            <aside className="relative overflow-hidden rounded-xl bg-white p-5 shadow-md lg:col-span-4">
              <span className="absolute top-0 left-0 h-full w-1.5 bg-[#BF0715]" />
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-[10px] font-semibold tracking-[0.08em] text-[#BF0715] uppercase ${mono}`}>The lines that failed</span>
              </div>
              {LEVEL1_CALLS.map((call) => (
                <p key={call.id} className="mt-3 text-[15px] leading-6 font-medium">
                  <span className="text-[#737373]">{call.who}. </span>“{call.line}”
                </p>
              ))}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[13px] text-[#57534E]">Sharma ji, then Neha</span>
                <Link href="/run?view=report" className="text-[14px] font-semibold text-[#BF0715]">
                  See what cracked →
                </Link>
              </div>
            </aside>
          ) : null}
        </div>

        <div className="mb-8 grid items-start gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <h2 className={`flex items-center gap-2 text-[22px] ${display}`}>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0E0D0C]" />
                  What it should do
                </h2>
                <span className={`text-[10px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>You can edit this</span>
              </div>
              <p className="mb-3 text-[13px] text-[#57534E]">What we tell callers your bot is responsible for.</p>
              <textarea
                value={task}
                onChange={(event) => setTask(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg bg-[#FAF6F0] p-4 text-[15px] leading-6 outline-none focus:ring-2 focus:ring-[#FFB800]"
              />
              <p className={`mt-2 text-right text-[10px] text-[#737373] ${mono}`}>{task.length} characters</p>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <h2 className={`flex items-center gap-2 text-[22px] ${display}`}>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#B8860B]" />
                  Facts it&apos;s allowed to say
                </h2>
                <span className={`text-[10px] font-semibold tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>The only truth</span>
              </div>
              <p className="mb-3 text-[13px] text-[#57534E]">Callers will ask past these lines. Anything else is a fail.</p>
              <textarea
                value={facts}
                onChange={(event) => setFacts(event.target.value)}
                rows={6}
                className="w-full resize-none rounded-lg bg-[#FAF6F0] p-4 text-[15px] leading-6 outline-none focus:ring-2 focus:ring-[#FFB800]"
              />
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <h2 className={`flex items-center gap-2 text-[22px] ${display}`}>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#BF0715]" />
                  What it must never say
                </h2>
                <span className={`text-[10px] font-semibold tracking-[0.08em] text-[#BF0715] uppercase ${mono}`}>Security</span>
              </div>
              <p className="mb-3 text-[13px] text-[#57534E]">A leak of any of these is a security fail. Level 3 checks this list.</p>
              <textarea
                value={neverSay}
                onChange={(event) => setNeverSay(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg bg-[#FAF6F0] p-4 text-[15px] leading-6 outline-none focus:ring-2 focus:ring-[#BF0715]"
              />
            </section>
          </div>

          <div className="lg:col-span-5">
            {failed ? (
              <section className="rounded-xl bg-white bg-gradient-to-br from-white to-[#FFF3C4]/40 p-6 shadow-md">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full bg-[#FFF3C4] px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-[#753400] uppercase ${mono}`}>From the last crack</span>
                  <span className={`text-[10px] font-medium text-[#B8860B] ${mono}`}>Ready to paste in Bolna</span>
                </div>
                <h2 className={`mt-3 text-[22px] ${display}`}>The block to paste into Bolna</h2>
                <p className="mt-1 mb-4 text-[13px] text-[#57534E]">One line from each failed call, merged.</p>
                <ol className="mb-4 space-y-2">
                  {LEVEL1_PATCH.lines.map((item, index) => (
                    <li key={item.who} className="text-[14px] leading-6 text-[#57534E]">
                      {index + 1}. {item.who}: {item.line}
                    </li>
                  ))}
                </ol>
                <div className="rounded-xl bg-[#FAF6F0] p-5">
                  <p className={`text-[16px] leading-7 font-medium whitespace-pre-wrap ${display}`}>{LEVEL1_PATCH.block}</p>
                  <div className="mt-4 flex items-center justify-end border-t border-[#E7E5E4]/40 pt-3">
                    <button type="button" onClick={() => copy("patch", LEVEL1_PATCH.block)} className={`inline-flex items-center gap-1 rounded-lg bg-[#0E0D0C] px-3 py-1.5 text-[14px] font-semibold text-white ${display}`}>
                      <span className="material-symbols-outlined text-[16px]">{copied === "patch" ? "check" : "content_copy"}</span>
                      {copied === "patch" ? "Copied" : "Copy patch"}
                    </button>
                  </div>
                </div>
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-[#F5F5F4]/70 p-3 text-[13px] leading-5 text-[#57534E]">
                  <span className="material-symbols-outlined text-[18px] text-[#B8860B]">lightbulb</span>
                  Paste this after the clinic role in Bolna, then run Sharma ji and Neha again.
                </p>
              </section>
            ) : (
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className={`text-[22px] ${display}`}>The line to add to your prompt</h2>
                <p className="mt-2 text-[15px] leading-6 text-[#57534E]">It shows up after a call fails. Nothing has been played on this bot yet.</p>
              </section>
            )}
          </div>
        </div>

        <div className="mb-10 flex flex-col items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-md sm:flex-row">
          <div className="flex items-center gap-4">
            <button type="button" onClick={persist} className={`rounded-lg bg-[#FAF6F0] px-5 py-2.5 text-[15px] font-medium hover:bg-[#F5F5F4] ${display}`}>
              {saved ? "Saved" : "Save changes"}
            </button>
            <span className={`text-[10px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>This page does not place a call</span>
          </div>
          <div className="flex items-center gap-4">
            {failed ? <span className={`text-right text-[12px] text-[#57534E] ${mono}`}>Last call $0.18</span> : null}
            {bot.shop === "clinic" && bot.callers.includes("angry_uncle") ? (
              <Link href="/run" className={`inline-flex items-center rounded-lg bg-[#0E0D0C] px-6 py-3 text-[18px] font-semibold text-white shadow-md ${display}`}>
                {failed ? "Run again →" : "Run the crash test →"}
              </Link>
            ) : null}
          </div>
        </div>

        <section className="border-t border-[#E7E5E4]/40 pt-6 pb-16">
          <div className="mb-4 flex items-center gap-2">
            <h3 className={`text-[22px] ${display}`}>Past crash tests</h3>
            <span className={`rounded bg-[#FAF6F0] px-1.5 py-0.5 text-[10px] text-[#57534E] ${mono}`}>{bot.runs.length ? `${bot.runs.length} ${bot.runs.length === 1 ? "run" : "runs"}` : failed ? "1 run" : "None yet"}</span>
          </div>
          {bot.runs.length > 0 ? (
            <div className="space-y-3">
              {bot.runs.map((run) => (
                <article key={run.id} className="flex flex-col justify-between gap-4 rounded-xl bg-white p-5 shadow-sm md:flex-row md:items-center">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[15px]">
                      <span className={`font-medium ${mono}`}>{run.label}</span>
                      <span className="text-[#E7E5E4]">·</span>
                      <span className="font-medium">Sharma ji, Delhi, wants ₹500 back</span>
                      <span className="text-[#E7E5E4]">·</span>
                      <span className={`text-[12px] text-[#737373] ${mono}`}>2 min 54 sec</span>
                      <span className="text-[#E7E5E4]">·</span>
                      <span className={`text-[12px] text-[#737373] ${mono}`}>$0.18</span>
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[#57534E]">
                      <span className={`rounded bg-[#FFDAD6] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] text-[#410002] uppercase ${mono}`}>Verdict: Failed</span>
                      “{run.quote}”
                    </p>
                  </div>
                  <Link href="/transcript" className={`inline-flex items-center gap-1 text-[14px] font-semibold text-[#B8860B] ${display}`}>
                    View transcript
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </article>
              ))}
              <Link href={`/bots/${bot.id}/compare`} className={`inline-flex items-center gap-1 text-[14px] font-semibold text-[#B8860B] ${display}`}>
                What moved
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          ) : failed ? (
            <article className="flex flex-col justify-between gap-4 rounded-xl bg-white p-5 shadow-sm md:flex-row md:items-center">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-[15px]">
                  <span className={`font-medium ${mono}`}>Sharma ji</span>
                  <span className="text-[#E7E5E4]">·</span>
                  <span className="font-medium">Sharma ji, Delhi, wants ₹500 back</span>
                  <span className="text-[#E7E5E4]">·</span>
                  <span className={`text-[12px] text-[#737373] ${mono}`}>2 min 54 sec</span>
                  <span className="text-[#E7E5E4]">·</span>
                  <span className={`text-[12px] text-[#737373] ${mono}`}>$0.18</span>
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[#57534E]">
                  <span className={`rounded bg-[#FFDAD6] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] text-[#410002] uppercase ${mono}`}>Verdict: Failed</span>
                  “I have cancelled appointment ID 241 for you.”
                </p>
              </div>
              <Link href={`/bots/${bot.id}/compare`} className={`inline-flex items-center gap-1 text-[14px] font-semibold text-[#B8860B] ${display}`}>
                What moved
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </article>
          ) : (
            <p className="text-[15px] text-[#57534E]">No crash test is stored on this bot.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function prettyPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    const national = digits.slice(2);
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return phone || "No number";
}
