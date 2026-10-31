"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { AGENT_BRIEFS, agentFromParam, agentPath, type AgentBrief } from "@/lib/agent-briefs";
import { openSession, type Session } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

type LiveDesk = {
  slug: string;
  name: string;
  welcome: string;
  prompt: string;
  transcriber: string;
  model: string;
  voice: string;
  restored?: boolean;
  held?: boolean;
};

export default function RunPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [slug, setSlug] = useState<AgentBrief["id"]>("sehat");
  const [desk, setDesk] = useState<LiveDesk | null>(null);
  const [deskNote, setDeskNote] = useState("");
  const [settings, setSettings] = useState<{ label: string; value: string }[] | null>(null);
  const [settingsNote, setSettingsNote] = useState("");

  useEffect(() => {
    setSession(openSession());
    const agent = agentFromParam(new URLSearchParams(window.location.search).get("agent"));
    setSlug(agent);
    setDesk(null);
    setDeskNote("");
    setSettings(null);
    setSettingsNote("");
    let active = true;
    void fetch(`/api/agent/${agent}/open`, { method: "POST" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; error?: string; message?: string } & Partial<LiveDesk>) => {
        if (!active) return;
        if (result.ok && result.prompt) {
          setDesk({
            slug: agent,
            name: result.name ?? "",
            welcome: result.welcome ?? "",
            prompt: result.prompt,
            transcriber: result.transcriber ?? "—",
            model: result.model ?? "—",
            voice: result.voice ?? "—",
            restored: result.restored === true,
            held: result.held === true,
          });
        } else setDeskNote(result.error || result.message || "The live desk could not be read.");
      })
      .catch(() => {
        if (active) setDeskNote("The test engine is not reachable.");
      });
    void fetch(`/api/agent/${agent}/settings`)
      .then((response) => response.json())
      .then((result: { ok?: boolean; settings?: { label: string; value: string }[] }) => {
        if (!active) return;
        if (result.ok && result.settings?.length) setSettings(result.settings);
        else setSettingsNote("The live settings could not be read.");
      })
      .catch(() => {
        if (active) setSettingsNote("The live settings could not be read.");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!session) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const callersHref = agentPath("/run/callers", slug);
  const name = desk?.name.trim() || AGENT_BRIEFS[slug].name;

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
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
        <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>Step 1 of 2 · The agent</p>
        <h1 className={`mt-3 text-[40px] leading-tight font-semibold tracking-tight sm:text-[52px] ${display}`}>{name}</h1>
        <p className="mt-4 text-lg leading-7 text-[#57534E]">
          You picked {name}. These are the live settings on that desk right now: what hears the caller, which model answers, and the prompt it is using.
        </p>
        <p className="mt-3 text-lg leading-7 text-[#57534E]">
          Read it, then go to step 2 and choose who calls. Nothing is dialed on this page. Run the test assigns the shared number itself.
        </p>
        {desk?.restored ? (
          <p className="mt-3 text-[15px] leading-6 text-[#92400E]">The previous fix was cleared. The prompt below is the first draft.</p>
        ) : null}
        {desk?.held ? (
          <p className="mt-3 text-[15px] leading-6 text-[#92400E]">A test is still running, so this prompt was left as it is.</p>
        ) : null}

        {desk ? (
          <>
            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              <Fact label="Transcriber" value={desk.transcriber} note="Read from the live agent." />
              <Fact label="Model" value={desk.model} note="Read from the live agent." />
              <Fact label="Voice" value={desk.voice} note="Read from the live agent." />
            </dl>

            {desk.welcome ? (
              <section className="mt-8 rounded-xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
                <h2 className={`text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Welcome</h2>
                <p className={`mt-3 text-[22px] leading-snug font-medium ${display}`}>“{desk.welcome}”</p>
              </section>
            ) : null}

            <section className="mt-4 rounded-xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <h2 className={`text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Initial prompt</h2>
              <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap font-sans text-[16px] leading-7 text-[#0F0E0C]">
                {desk.prompt || "The live prompt is empty."}
              </pre>
            </section>
          </>
        ) : (
          <p className="mt-8 text-[15px] text-[#57534E]">{deskNote || "Putting the first draft back on this desk…"}</p>
        )}

        <section className="mt-8">
          <h2 className={`text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Live on the desk</h2>
          {settings ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {settings.map((item) => (
                <div key={item.label} className="rounded-xl bg-[#FAF6F0] px-4 py-3">
                  <p className={`text-[11px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>{item.label}</p>
                  <p className="mt-1 text-[16px]">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[15px] text-[#57534E]">{settingsNote || "Reading the live desk…"}</p>
          )}
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E7E5E4] bg-[#FFFDFB]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-[#57534E]">
            {desk ? "Step 2 is choosing the callers." : "Putting the first draft back before you pick callers."}
          </p>
          {desk && !desk.held ? (
            <Link href={callersHref} className={`inline-flex items-center gap-1.5 rounded-lg bg-[#0E0D0C] px-5 py-2.5 text-[15px] font-medium text-white ${display}`}>
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          ) : (
            <span className={`inline-flex items-center gap-1.5 rounded-lg bg-[#E7E5E4] px-5 py-2.5 text-[15px] font-medium text-[#78716C] ${display}`}>Next</span>
          )}
        </div>
      </div>
    </main>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
      <dt className={`text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>{label}</dt>
      <dd className={`mt-2 text-[18px] font-semibold leading-snug ${display}`}>{value}</dd>
      <dd className="mt-2 text-[13px] leading-5 text-[#57534E]">{note}</dd>
    </div>
  );
}
