"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { AGENT_BRIEFS, agentPath } from "@/lib/agent-briefs";
import type { BolnaBrief } from "@/lib/bolna-brief";
import { CATEGORY_IDS, type CategoryId } from "@/lib/caller-packs";
import { openSession, saveSession, type OwnTarget } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

const CHOICES: { id: CategoryId; label: string; job: string }[] = [
  { id: "clinic", label: "Clinic", job: "Book a visit, or a fee that was taken and the visit was cancelled." },
  { id: "lender", label: "Loan desk", job: "An EMI, a refund, or something stored on an account." },
  { id: "restaurant", label: "Restaurant", job: "Book a table, or an order that was paid for and never arrived." },
  { id: "clothing", label: "Clothing", job: "A WhatsApp or Shopify order, a size, a delivery, or a refund." },
  { id: "property", label: "Property", job: "Book a site visit, or a token that was paid and the visit was cancelled." },
];

type ListedAgent = { id: string; name: string };

export default function OwnCategoryPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<CategoryId | "other" | null>(null);
  const [suggested, setSuggested] = useState<CategoryId | null>(null);
  const [agents, setAgents] = useState<ListedAgent[]>([]);
  const [found, setFound] = useState<BolnaBrief | null>(null);
  const userPicked = useRef(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");

  useEffect(() => {
    const session = openSession();
    const params = new URLSearchParams(window.location.search);
    const nextName = params.get("name")?.trim() || session.ownTarget?.name || "";
    const nextPhone = (params.get("phone") || session.ownTarget?.phone || "").replace(/\D/g, "").slice(0, 10);
    setName(nextName);
    setPhone(nextPhone);
    if (session.ownTarget?.category) setPicked(session.ownTarget.category);
    setReady(true);
    if (!session.bolnaApiKey || nextPhone.length !== 10) return;
    void loadAgents(session.bolnaApiKey, nextName);
  }, []);

  async function loadAgents(key: string, agentName: string) {
    setReading(true);
    setReadError("");
    const listed = await postKey(key);
    setReading(false);
    if (!listed.ok) {
      setReadError(listed.error || "Bolna could not be read.");
      return;
    }
    const rows = listed.agents ?? [];
    setAgents(rows);
    const savedId = openSession().ownTarget?.bolnaAgentId;
    const wanted = agentName.trim().toLowerCase();
    const named = wanted ? rows.find((agent) => agent.name.toLowerCase().includes(wanted)) : undefined;
    const saved = savedId ? rows.find((agent) => agent.id === savedId) : undefined;
    const chosen = rows.length === 1 ? rows[0] : saved ?? named;
    if (chosen) void loadAgent(key, chosen.id, false);
  }

  async function loadAgent(key: string, agentId: string, fromClick: boolean) {
    setReading(true);
    setReadError("");
    const detail = await postKey(key, agentId);
    setReading(false);
    if (!detail.ok || !detail.agent) {
      setReadError(detail.error || "That agent could not be read.");
      return;
    }
    setFound(detail.agent);
    setSuggested(detail.category ?? null);
    if (fromClick || !userPicked.current) setPicked(detail.category);
  }

  function choose(id: CategoryId | "other") {
    userPicked.current = true;
    setPicked(id);
  }

  function next() {
    if (!name || phone.length !== 10 || !picked || picked === "other") return;
    const current = openSession();
    const ownTarget: OwnTarget = {
      name,
      phone,
      category: picked,
      bolnaAgentId: found?.id,
      bolnaAgentName: found?.name,
      welcome: found?.welcome,
    };
    saveSession({ ...current, ownTarget });
    router.push("/run/callers?own=1");
  }

  if (!ready) return <main className="min-h-screen bg-[#FFFDFB]" />;

  return (
    <main className={`min-h-screen bg-[#FFFDFB] pb-28 text-[#0F0E0C] ${body}`}>
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
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
        {name && phone.length === 10 ? (
          <>
            <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>Your agent · The category</p>
            <h1 className={`mt-3 text-[40px] leading-tight font-semibold tracking-tight sm:text-[52px] ${display}`}>What does {name} do?</h1>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-[#57534E]">
              Select the agent on this key. Its prompt, model, transcriber, and voice are read from Bolna, the same brief as the demo agents. Then pick the category. The number we will use later is +91 {pretty(phone)}. Nothing is dialed on this page.
            </p>

            {reading ? <p className="mt-6 text-[15px] text-[#57534E]">Reading the bot from Bolna…</p> : null}
            {readError ? <p className="mt-6 text-[15px] text-[#57534E]">{readError} Pick the category yourself.</p> : null}

            {agents.length > 1 ? (
              <div className="mt-6">
                <p className="text-[15px] text-[#57534E]">This key has {agents.length} agents. Select one.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {agents.map((agent) => {
                    const on = found?.id === agent.id;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const key = openSession().bolnaApiKey;
                          if (key) void loadAgent(key, agent.id, true);
                        }}
                        className={`rounded-full px-3 py-1.5 text-[13px] ${on ? "bg-[#0E0D0C] text-white" : "bg-white text-[#0F0E0C]"}`}
                      >
                        {agent.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {found ? <AgentBriefView brief={found} suggested={suggested} /> : null}

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {CHOICES.map((choice) => {
                const on = picked === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => choose(choice.id)}
                    className={`flex h-full flex-col rounded-2xl border p-6 text-left ${on ? "border-[#FFB800] bg-[#FFF8E1]" : "border-[#E7E5E4] bg-white"}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>{choice.label}</span>
                      {suggested === choice.id ? <span className={`text-[11px] tracking-[0.08em] text-[#92400E] uppercase ${mono}`}>Suggested</span> : null}
                    </span>
                    <span className="mt-3 block text-[15px] leading-6 text-[#57534E]">{choice.job}</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={picked === "other"}
                onClick={() => choose("other")}
                className={`flex h-full flex-col rounded-2xl border p-6 text-left ${picked === "other" ? "border-[#FFB800] bg-[#FFF8E1]" : "border-[#E7E5E4] bg-white"}`}
              >
                <span className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>Something else</span>
                <span className="mt-3 block text-[15px] leading-6 text-[#57534E]">The job is not a clinic, a loan desk, a restaurant, a clothing shop, or a property desk.</span>
              </button>
            </div>

            {picked === "other" ? (
              <section className="mt-8 rounded-2xl border border-[#E7E5E4] bg-white p-6">
                <h2 className={`text-[28px] font-semibold ${display}`}>We don&apos;t have callers for that job yet.</h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#57534E]">
                  Tell us what the agent does and we&apos;ll add a category for it. Or test one of the demo agents, which already have callers.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/#free-test" className={`inline-flex rounded-lg bg-[#0E0D0C] px-4 py-2.5 text-[15px] font-medium text-white ${display}`}>
                    Write to us
                  </Link>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {CATEGORY_IDS.map((id) => {
                    const agent = agentForDemo(id);
                    return (
                      <Link key={id} href={agentPath("/run", agent)} className="rounded-xl border border-[#E7E5E4] px-4 py-3 hover:border-[#FFB800]">
                        <span className={`block text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>{labelFor(id)}</span>
                        <span className={`mt-1 block text-[18px] font-semibold ${display}`}>{AGENT_BRIEFS[agent].name}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div>
            <h1 className={`text-[40px] font-semibold ${display}`}>Add the agent first.</h1>
            <p className="mt-4 text-lg text-[#57534E]">Start from the bench, with a name and a 10-digit number.</p>
            <Link href="/workspace" className={`mt-6 inline-flex rounded-lg bg-[#0E0D0C] px-4 py-2.5 text-[15px] font-medium text-white ${display}`}>
              Back to agents
            </Link>
          </div>
        )}
      </div>
      {picked && picked !== "other" ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E7E5E4] bg-[#FFFDFB]/95 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <p className="text-[14px] text-[#57534E]">Next is choosing who calls {name}.</p>
            <button type="button" onClick={next} className={`inline-flex items-center gap-1.5 rounded-lg bg-[#0E0D0C] px-5 py-2.5 text-[15px] font-medium text-white ${display}`}>
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function AgentBriefView({ brief, suggested }: { brief: BolnaBrief; suggested: CategoryId | null }) {
  return (
    <div className="mt-8 max-w-3xl">
      <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>Read from Bolna</p>
      <h2 className={`mt-3 text-[32px] leading-tight font-semibold ${display}`}>{brief.name}</h2>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Fact label="Transcriber" value={brief.transcriber} note={brief.transcriberNote} />
        <Fact label="Model" value={brief.model} note={brief.modelNote} />
        <Fact label="Voice" value={brief.voice} note={brief.voiceNote} />
      </dl>
      {brief.welcome ? (
        <section className="mt-4 rounded-xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
          <h3 className={`text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Welcome</h3>
          <p className={`mt-3 text-[22px] leading-snug font-medium ${display}`}>“{brief.welcome}”</p>
        </section>
      ) : null}
      {brief.prompt ? (
        <section className="mt-4 rounded-xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
          <h3 className={`text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Prompt</h3>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-[16px] leading-7 text-[#0F0E0C]">{brief.prompt}</pre>
        </section>
      ) : null}
      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {brief.settings.map((item) => (
          <div key={item.label} className="rounded-xl bg-[#FAF6F0] px-4 py-3">
            <p className={`text-[11px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>{item.label}</p>
            <p className="mt-1 text-[16px]">{item.value}</p>
          </div>
        ))}
      </section>
      <p className="mt-4 text-[14px] text-[#57534E]">
        {suggested ? (
          <>
            This looks like <span className="font-medium text-[#0F0E0C]">{labelFor(suggested)}</span>. You can change it below.
          </>
        ) : (
          "The prompt did not match a category on its own. Choose one below."
        )}
      </p>
    </div>
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

function labelFor(id: CategoryId) {
  return CHOICES.find((choice) => choice.id === id)?.label ?? id;
}

function agentForDemo(id: CategoryId) {
  if (id === "clinic") return "sehat" as const;
  if (id === "lender") return "rupeesetu" as const;
  if (id === "restaurant") return "swaad" as const;
  if (id === "clothing") return "nila" as const;
  return "nivas" as const;
}

function pretty(phone: string) {
  return `${phone.slice(0, 5)} ${phone.slice(5)}`;
}

async function postKey(key: string, agentId?: string): Promise<{ ok: boolean; error?: string; agents?: ListedAgent[]; agent?: BolnaBrief; category?: CategoryId | null }> {
  const response = await fetch("/api/bolna/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agentId ? { key, agentId } : { key }),
  });
  return response.json();
}
