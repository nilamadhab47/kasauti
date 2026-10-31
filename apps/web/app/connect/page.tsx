"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { PersonLink } from "@/components/person-link";
import { openSession, saveSession, type Bot, type Session } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

export default function Connect() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [agentId, setAgentId] = useState("");
  const [linkedId, setLinkedId] = useState("");
  const [fromBot, setFromBot] = useState(false);
  const [warn, setWarn] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const current = openSession();
    const requested = new URLSearchParams(window.location.search).get("bot");
    const bot = current?.bots.find((item) => item.id === requested) ?? current?.bots.at(-1);
    setFromBot(Boolean(requested && bot));
    setLinkedId(bot?.bolnaAgentId ?? "");
    setSession(current);
  }, [router]);

  if (!session) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const requested = fromBot ? new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("bot") : null;
  const bot = session.bots.find((item) => item.id === requested) ?? session.bots.at(-1);
  const next = fromBot && bot ? `/bots/${bot.id}` : destination(bot);
  const kind = session.kind === "agency" ? "Agency" : "In-house";

  function saveId(id: string) {
    if (!session || !bot) return;
    const updated = {
      ...session,
      bots: session.bots.map((item) => (item.id === bot.id ? { ...item, bolnaAgentId: id } : item)),
    };
    saveSession(updated);
    setSession(updated);
  }

  function skip() {
    router.push(next);
  }

  function connect() {
    const id = agentId.trim();
    if (!id) {
      setWarn(true);
      window.setTimeout(() => setWarn(false), 1100);
      return;
    }
    saveId(id);
    setLinkedId(id);
  }

  function unlink() {
    saveId("");
    setLinkedId("");
    setAgentId("");
  }

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/workspace" className="shrink-0">
              <Logo size="sm" />
            </Link>
            <span className="hidden h-4 w-px bg-[#E7E5E4]/70 sm:block" />
            <span className={`hidden items-center gap-2 rounded-full bg-[#FAF6F0] px-3 py-1 text-[12px] tracking-[0.08em] text-[#57534E] uppercase sm:inline-flex ${mono}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#0E0D0C]" />
              <span className="max-w-[12rem] truncate">{session.company}</span>
              <span className="text-[#E7E5E4]">·</span>
              <span>{kind}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push("/")} className="text-[13px] text-[#737373] hover:text-[#0F0E0C]">
              Home
            </button>
            <PersonLink name={session.name} />
          </div>
        </div>
      </header>

      <div className="relative flex flex-col items-center px-4 py-12 sm:px-8">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-b from-orange-200/40 via-sky-100/20 to-transparent blur-3xl" />
        <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
          <div className={`mb-5 inline-flex items-center gap-2 rounded-full bg-[#F5F5F4] px-3 py-1 text-[10px] tracking-[0.12em] text-[#57534E] uppercase shadow-sm ${mono}`}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#0E0D0C]" />
            Optional · Bolna
          </div>
          <h1 className={`text-[40px] leading-[1.08] font-medium tracking-tight sm:text-[52px] ${display}`}>
            We bring the callers.
            <br />
            <span className="text-[#D97706]">Linking your agent is optional.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-[#57534E]">
            The test dials the number on the brief, from Kasauti&apos;s callers. Connect a Bolna agent only if you want that id kept with the bot. The transcript and the verdict do not need it.
          </p>
        </div>

        <div className="relative mt-10 w-full max-w-2xl rounded-xl bg-white p-6 shadow-[0_12px_32px_-8px_rgba(28,25,23,0.06)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <Token icon="hearing" name="Kasauti" caption="Crash caller fleet" tone="bg-[#0E0D0C]" />
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <span className={`mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#FAF6F0] px-3 py-0.5 text-[12px] text-[#B8860B] ${mono}`}>
                <span className={`h-2 w-2 rounded-full bg-[#B8860B] ${linkedId ? "" : "animate-ping"}`} />
                {linkedId ? "Linked" : "Ready to link"}
              </span>
              <svg className="h-8 w-full" viewBox="0 0 300 24" fill="none" aria-hidden>
                <path d="M0 12 H300" stroke="#FAF6F0" strokeWidth="4" strokeLinecap="round" />
                <path d="M0 12 H300" stroke="#D97706" strokeWidth="3" strokeLinecap="round" strokeDasharray={linkedId ? undefined : "8 12"}>
                  {linkedId ? null : <animate attributeName="stroke-dashoffset" from="40" to="0" dur="1.6s" repeatCount="indefinite" />}
                </path>
                <circle cx="150" cy="12" r="5" fill="#B8860B" />
              </svg>
            </div>
            <Token icon="record_voice_over" name="Bolna" caption="Your agent" tone="bg-[#B8860B]" />
          </div>
        </div>

        <div className="relative mt-6 w-full max-w-xl rounded-xl bg-white p-6 shadow-[0_12px_32px_-8px_rgba(28,25,23,0.05)] sm:p-8">
          {linkedId ? (
            <div>
              <p className={`text-[10px] tracking-[0.12em] text-[#B8860B] uppercase ${mono}`}>Linked to {bot?.name || "this bot"}</p>
              <h2 className={`mt-2 text-[28px] tracking-tight ${display}`}>The id is saved.</h2>
              <p className="mt-2 text-[15px] leading-6 text-[#57534E]">We have not read the agent&apos;s name or prompt. The test still dials the number on the brief, from Kasauti&apos;s account.</p>
              <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-[#FAF6F0] px-4 py-3">
                <span className={`min-w-0 truncate text-[14px] ${mono}`}>{linkedId}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(linkedId);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className={`shrink-0 text-[12px] tracking-[0.06em] text-[#57534E] uppercase ${mono}`}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button type="button" onClick={skip} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E0D0C] py-3.5 text-[16px] font-medium text-white ${display}`}>
                {next === "/run" ? "Start the run" : fromBot ? "Back to the bot" : "Back to the workspace"}
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
              <button type="button" onClick={unlink} className="mt-3 w-full py-2 text-[15px] text-[#57534E] underline-offset-4 hover:text-[#0F0E0C] hover:underline">
                Remove this link
              </button>
            </div>
          ) : (
            <>
          <label className="flex flex-col gap-2" htmlFor="bolna-agent-id">
            <span className="flex items-center justify-between">
              <span className="text-[14px] font-medium">Bolna agent ID</span>
              <span className={`text-[10px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Optional</span>
            </span>
            <input
              id="bolna-agent-id"
              value={agentId}
              placeholder="Paste the agent id"
              onChange={(event) => setAgentId(event.target.value)}
              className={`rounded-lg bg-[#FAF6F0] px-4 py-3 text-[14px] outline-none ${mono} ${warn ? "ring-2 ring-[#FFB800]" : ""}`}
            />
            <span className="flex items-start gap-1.5 text-[13px] leading-5 text-[#57534E]">
              <span className="material-symbols-outlined text-[16px] text-[#D97706]">info</span>
              In Bolna, open the agent and copy its id. {bot ? `This would link ${bot.name}.` : "Add a bot first if you want to attach an id."}
            </span>
          </label>

          <p className="mt-5 rounded-lg bg-[#FAF6F0] px-4 py-3 text-[14px] leading-6 text-[#57534E]">
            A Bolna API key is not needed. These calls run on Kasauti&apos;s account, so they do not touch your wallet.
          </p>

          <button
            type="button"
            onClick={connect}
            className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E0D0C] py-3.5 text-[16px] font-medium text-white shadow-md transition hover:-translate-y-0.5 ${display}`}
          >
            Connect Bolna
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
          <button type="button" onClick={skip} className="mt-3 w-full py-2 text-[15px] text-[#57534E] underline-offset-4 hover:text-[#0F0E0C] hover:underline">
            Skip for now
          </button>
          <p className={`mt-2 text-center text-[10px] tracking-[0.06em] text-[#737373] uppercase ${mono}`}>
            {next === "/run" ? "Next is the Sehat run, either way." : "Next is the workspace, either way."}
          </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Token({ icon, name, caption, tone }: { icon: string; name: string; caption: string; tone: string }) {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-2">
      <div className="flex h-20 w-20 flex-col items-center justify-center rounded-xl bg-[#FAF6F0]">
        <span className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${tone}`}>
          <span className="material-symbols-outlined text-[26px]">{icon}</span>
        </span>
        <span className={`mt-1 text-[11px] font-semibold tracking-wider uppercase ${display}`}>{name}</span>
      </div>
      <span className={`rounded-full bg-[#F5F5F4] px-2 py-0.5 text-center text-[10px] tracking-wide text-[#57534E] ${mono}`}>{caption}</span>
    </div>
  );
}

function destination(bot: Bot | undefined) {
  if (bot?.shop === "clinic" && bot.callers.includes("angry_uncle")) return "/run";
  return "/workspace";
}
