"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { AGENT_BRIEFS, agentFromParam, agentPath, type TestAgent } from "@/lib/agent-briefs";
import { isCategoryId } from "@/lib/caller-packs";
import { openSession, saveSession } from "@/lib/prototype";
import { callerCategories, callerIds } from "@/lib/test-callers";

const DEMO_AGENTS = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;

function deskFor(links: Record<string, string>, vertical: string): TestAgent | null {
  const desk = links[vertical];
  return DEMO_AGENTS.includes(desk as (typeof DEMO_AGENTS)[number]) ? (desk as TestAgent) : null;
}

function verticalFor(links: Record<string, string>, desk: string): string | null {
  return Object.entries(links).find(([, slug]) => slug === desk)?.[0] ?? null;
}

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

export function CallersScreen({ deskForVertical }: { deskForVertical: Record<string, string> }) {
  const router = useRouter();
  const [agent, setAgent] = useState<TestAgent | null>(null);
  const [ownName, setOwnName] = useState("");
  const [ownPhone, setOwnPhone] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [liveName, setLiveName] = useState("");
  const [line, setLine] = useState<{ busy: boolean; yours: boolean; runId: string | null; error?: string }>({
    busy: false,
    yours: false,
    runId: null,
  });
  const [draft, setDraft] = useState<"hidden" | "ready" | "confirm" | "resetting">("hidden");
  const [resetNote, setResetNote] = useState("");

  useEffect(() => {
    const current = openSession();
    setSessionId(current.sessionId);
    const params = new URLSearchParams(window.location.search);
    if (params.get("own") === "1") {
      const category = current.ownTarget?.category;
      if (!isCategoryId(category)) {
        router.replace("/own");
        return;
      }
      const next = deskFor(deskForVertical, category);
      if (!next) {
        router.replace("/own");
        return;
      }
      const known = new Set(callerIds(next));
      setOwnName(current.ownTarget?.name ?? "");
      setOwnPhone(current.ownTarget?.phone ?? "");
      setAgent(next);
      setSelected((current.ownCallerPicks ?? []).filter((id) => known.has(id)));
      return;
    }
    const next: TestAgent = agentFromParam(params.get("agent"));
    const known = new Set(callerIds(next));
    const stored = (current.callerPicks?.[next] ?? []).filter((id) => known.has(id));
    setOwnName("");
    setOwnPhone("");
    setAgent(next);
    setSelected(stored);
  }, [deskForVertical, router]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    async function poll() {
      try {
        const response = await fetch(`/api/inbound?session=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const result = (await response.json()) as { busy?: boolean; yours?: boolean; runId?: string | null; error?: string };
        if (!active) return;
        setLine({
          busy: result.busy === true,
          yours: result.yours === true,
          runId: typeof result.runId === "string" ? result.runId : null,
          error: result.error,
        });
      } catch {
        if (active) setLine((current) => ({ ...current, error: "The number status is unavailable." }));
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!agent) return;
    let active = true;
    void fetch("/api/desks", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { desks?: { slug: string; name: string }[] }) => {
        if (!active) return;
        const found = result.desks?.find((item) => item.slug === agent);
        if (found?.name?.trim()) setLiveName(found.name.trim());
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [agent]);

  useEffect(() => {
    if (!agent || ownName) {
      setDraft("hidden");
      return;
    }
    let active = true;
    setDraft("hidden");
    setResetNote("");
    void fetch(`/api/agent/${agent}/reset`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { footer?: boolean }) => {
        if (active && result.footer) setDraft("ready");
      })
      .catch(() => {
        if (active) setDraft("hidden");
      });
    return () => {
      active = false;
    };
  }, [agent, ownName]);

  async function resetDesk() {
    if (!agent || ownName) return;
    setDraft("resetting");
    setResetNote("");
    try {
      const response = await fetch(`/api/agent/${agent}/reset`, { method: "POST" });
      const result = (await response.json()) as { reset?: boolean; error?: string; message?: string };
      if (result.reset) {
        setDraft("hidden");
        setResetNote(`${AGENT_BRIEFS[agent].name} is back on the first draft.`);
      } else {
        setDraft("confirm");
        setResetNote(result.error || result.message || "The desk stayed as it is.");
      }
    } catch {
      setDraft("confirm");
      setResetNote("The test engine is not reachable.");
    }
  }

  if (!agent) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const brief = AGENT_BRIEFS[agent];
  const categories = callerCategories(agent);
  const all = callerIds(agent);
  const every = all.every((id) => selected.includes(id));

  function toggle(id: string) {
    setSaved(false);
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function setMany(ids: string[], on: boolean) {
    setSaved(false);
    setSelected((current) => {
      if (on) return [...new Set([...current, ...ids])];
      const drop = new Set(ids);
      return current.filter((id) => !drop.has(id));
    });
  }

  function keep() {
    const current = openSession();
    if (ownName) {
      saveSession({ ...current, ownCallerPicks: selected });
    } else if (agent) {
      saveSession({
        ...current,
        callerPicks: { ...current.callerPicks, [agent]: selected },
      });
    }
    setSaved(true);
  }

  async function run() {
    if (!agent || selected.length === 0 || (line.busy && !ownName)) return;
    keep();
    setStarting(true);
    setStartError("");
    const category = verticalFor(deskForVertical, agent);
    if (!category) {
      setStarting(false);
      setStartError("This desk is not in the catalog.");
      return;
    }
    const ownNumber = ownPhone.replace(/\D/g, "");
    if (ownName && ownNumber.length !== 10) {
      setStarting(false);
      setStartError("Enter the 10-digit number before calling.");
      return;
    }
    if (!ownName) {
      const opened = await fetch(`/api/agent/${agent}/open`, { method: "POST" });
      const openedBody = (await opened.json()) as { ok?: boolean; held?: boolean; error?: string; message?: string };
      if (!openedBody.ok) {
        setStarting(false);
        setStartError(openedBody.error || openedBody.message || "The first draft could not be put back.");
        return;
      }
      if (openedBody.held) {
        setStarting(false);
        setStartError("The test bots are in use. Kindly wait.");
        return;
      }
    }
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `${ownName || liveName || brief.name} · ${selected.length} callers`,
        name: ownName || liveName || brief.name,
        session: openSession().sessionId,
        personaIds: selected,
        mode: "live",
        consent: true,
        category,
        taskGoal: brief.prompt,
        ...(ownName ? { phone: `+91${ownNumber}` } : { agent }),
      }),
    });
    const result = (await response.json()) as { ok?: boolean; runId?: string; error?: string };
    if (!result.ok || !result.runId) {
      setStarting(false);
      setStartError(result.error || "Could not start the test.");
      return;
    }
    router.push(`/run/orbit?runId=${result.runId}`);
  }

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/workspace" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-5 text-[13px] text-[#737373]">
            <Link href={ownName ? `/own?name=${encodeURIComponent(ownName)}&phone=${ownPhone}` : agentPath("/run", agent)} className="hover:text-[#0F0E0C]">
              {ownName ? "The category" : "The agent"}
            </Link>
            <Link href="/workspace" className="hover:text-[#0F0E0C]">
              All agents
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 pb-28 sm:px-8">
        <p className={`text-[12px] tracking-[0.14em] text-[#B8860B] uppercase ${mono}`}>Step 2 of 2 · The callers</p>
        <h1 className={`mt-3 text-[40px] leading-tight font-semibold tracking-tight sm:text-[52px] ${display}`}>Who should call {ownName || liveName || brief.name}?</h1>
        <p className="mt-4 max-w-2xl text-lg leading-7 text-[#57534E]">
          {ownName
            ? `These callers know this kind of job. Run the test dials +91 ${ownPhone.slice(0, 5)} ${ownPhone.slice(5)}. They speak this category's lines.`
            : `Pick who calls ${liveName || brief.name}. Run the test puts that desk on the shared number and places the call. You do not assign the number yourself.`}
        </p>

        {line.busy && !ownName ? (
          <div className={`mt-6 max-w-2xl rounded-2xl border px-5 py-4 ${line.yours ? "border-[#F6D77C] bg-[#FFF9E5]" : "border-[#F0C2A6] bg-[#FBEAE5]"}`}>
            {line.yours && line.runId ? (
              <>
                <p className="text-[15px] leading-6">Your test is still running. Wait for it to finish before starting another.</p>
                <Link href={`/run/orbit?runId=${line.runId}`} className="mt-2 inline-flex text-[14px] font-semibold text-[#92400E] underline underline-offset-4">
                  Open the running test
                </Link>
              </>
            ) : (
              <>
                <p className={`text-[16px] font-semibold ${display}`}>The test bots are in use. Kindly wait.</p>
                <p className="mt-1 text-[14px] leading-6 text-[#57534E]">One shared number, one test at a time.</p>
              </>
            )}
          </div>
        ) : null}

        {ownName || draft === "hidden" ? (
          resetNote ? <p className="mt-3 max-w-2xl text-[13px] text-[#57534E]">{resetNote}</p> : null
        ) : (
          <div className="mt-5 max-w-3xl">
            {draft === "ready" ? (
              <div className="rounded-2xl border border-[#F6D77C] bg-[#FFF9E5] p-5 shadow-[0_8px_24px_rgba(217,119,6,0.08)]">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-[22px] text-[#B8860B]">warning</span>
                  <div className="flex-1">
                    <p className={`text-[11px] tracking-[0.1em] uppercase ${mono} text-[#92400E]`}>Before you test</p>
                    <p className="mt-1 text-[15px] leading-6 text-[#0F0E0C]">
                      {brief.name} is not on its initial prompt. Kasauti has already written a patch on top of the first draft. Reset so the test runs against the real starting agent, or keep the current prompt and test the patched version.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setDraft("confirm")}
                        className="rounded-lg bg-[#0E0D0C] px-4 py-2 text-[13px] font-semibold text-white"
                      >
                        Reset to the first draft
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft("hidden");
                          setResetNote(`${brief.name} will be tested on the current patched prompt.`);
                        }}
                        className="rounded-lg border border-[#E7E5E4] bg-white px-4 py-2 text-[13px] font-semibold text-[#57534E]"
                      >
                        Keep as is
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E7E5E4] bg-white p-5">
                <p className="text-[14px] leading-6 text-[#0F0E0C]">
                  This replaces the live prompt on {brief.name} with the first draft and removes the Kasauti footer. The welcome stays.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void resetDesk()}
                    disabled={draft === "resetting"}
                    className="rounded-lg bg-[#0E0D0C] px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
                  >
                    {draft === "resetting" ? "Resetting…" : "Reset the desk"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft("ready");
                      setResetNote("");
                    }}
                    disabled={draft === "resetting"}
                    className="rounded-lg border border-[#0E0D0C] px-4 py-2.5 text-[14px] font-medium text-[#0E0D0C] disabled:opacity-40"
                  >
                    Keep the current prompt
                  </button>
                </div>
              </div>
            )}
            {resetNote ? <p className="mt-2 text-[13px] text-[#57534E]">{resetNote}</p> : null}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMany(all, !every)}
            className={`rounded-lg bg-[#0E0D0C] px-4 py-2.5 text-[14px] font-medium text-white ${display}`}
          >
            {every ? "Clear all" : "Select all"}
          </button>
          <span className={`text-[12px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>
            {selected.length} of {all.length}
          </span>
        </div>

        <div className="mt-10 flex flex-col gap-10">
          {categories.map((category) => {
            const ids = category.callers.map((caller) => caller.id);
            const groupOn = ids.every((id) => selected.includes(id));
            return (
              <section key={category.id}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className={`text-[22px] font-semibold ${display}`}>{category.label}</h2>
                    <p className="mt-1 max-w-xl text-[15px] leading-6 text-[#57534E]">{category.note}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMany(ids, !groupOn)}
                    className={`text-[13px] text-[#B8860B] underline-offset-4 hover:underline ${mono}`}
                  >
                    {groupOn ? "Clear this group" : "Select this group"}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {category.callers.map((caller) => {
                    const on = selected.includes(caller.id);
                    return (
                      <button
                        key={caller.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(caller.id)}
                        className={`flex h-full flex-col rounded-2xl border p-6 text-left shadow-[0_8px_24px_rgba(15,14,12,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,14,12,0.08)] ${on ? "border-[#FFB800] bg-[#FFF8E1]" : "border-[#E7E5E4] bg-white"}`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className={`rounded-full bg-[#FFF4CC] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#92400E] uppercase ${mono}`}>{caller.tag}</span>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-[#0E0D0C] text-white" : "border border-[#E7E5E4] bg-white"}`}>
                            {on ? <span className="material-symbols-outlined text-[16px]">check</span> : null}
                          </span>
                        </span>
                        <span className={`mt-4 block text-[22px] font-semibold ${display}`}>{caller.name}</span>
                        <span className="mt-1 block text-[14px] leading-6 text-[#57534E]">{caller.who}</span>
                        <span className="mt-4 block border-t border-[#E7E5E4] pt-4 text-[14px] leading-6 text-[#0F0E0C]">
                          <span className={`mb-1 block text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>Talks</span>
                          {caller.talk}
                        </span>
                        <span className="mt-3 block text-[14px] leading-6 text-[#0F0E0C]">
                          <span className={`mb-1 block text-[11px] tracking-[0.08em] text-[#B8860B] uppercase ${mono}`}>On this call</span>
                          {caller.tries}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#E7E5E4] bg-[#FFFDFB]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-[#57534E]">
            {startError
              ? startError
              : saved
                ? `${selected.length} kept for ${ownName || brief.name}. Run the test places a real call.`
                : `${selected.length} selected. Run the test places a real call.`}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={keep}
              disabled={selected.length === 0 || starting}
              className={`rounded-lg border border-[#0E0D0C] px-4 py-2.5 text-[15px] font-medium text-[#0E0D0C] disabled:opacity-40 ${display}`}
            >
              Keep this set
            </button>
            <button
              type="button"
              onClick={run}
              disabled={selected.length === 0 || starting || (line.busy && !ownName)}
              className={`inline-flex items-center gap-1.5 rounded-lg bg-[#0E0D0C] px-5 py-2.5 text-[15px] font-medium text-white disabled:opacity-40 ${display}`}
            >
              {starting ? "Starting…" : "Run the test"}
              {starting ? null : <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
