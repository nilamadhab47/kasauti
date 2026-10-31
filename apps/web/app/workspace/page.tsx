"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { AGENT_IDS, agentPath, type TestAgent } from "@/lib/agent-briefs";
import { cleanBolnaKey } from "@/lib/bolna-key";
import { openSession, saveSession, type Bot, type Session } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";


export default function Workspace() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    setSession(openSession());
  }, [router]);

  if (!session) return <main className="min-h-screen bg-[#FFFDFB]" />;

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <WorkspaceHeader session={session} onSignOut={() => router.push("/")} />
      <div className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-between overflow-hidden px-4 pt-12 pb-10 sm:px-8">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[340px] w-[680px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-200/40 via-amber-50/40 to-transparent opacity-70 blur-3xl" />
        <Start session={session} />
        {session.bots.length > 0 ? <Bench session={session} /> : null}
      </div>
    </main>
  );
}

function WorkspaceHeader({ onSignOut }: { session: Session; onSignOut: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href="/workspace" className="shrink-0">
          <Logo size="sm" />
        </Link>
        <button type="button" onClick={onSignOut} className="text-[13px] text-[#737373] hover:text-[#0F0E0C]">
          Home
        </button>
      </div>
    </header>
  );
}

type LiveDesk = { slug: string; name: string; prompt: string; unread?: boolean };
type LineHold = { busy: boolean; yours: boolean; runId: string | null };

function isDesk(slug: string): slug is TestAgent {
  return (AGENT_IDS as readonly string[]).includes(slug);
}

/** The card line is the "who you are" paragraph, written as sentences. Headings and duty lists stay off the card. */
function cardBlurb(prompt: string): string {
  const who = prompt.match(/(?:^|\n)#\s*who you are\s*\n+([\s\S]*?)(?=\n#\s|$)/i);
  const body = (who?.[1] ?? prompt)
    .replace(/^#+\s+.*$/gm, " ")
    .replace(/^[-*]\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = body.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map((sentence) => sentence.trim()) ?? [];
  const picked = (sentences.length > 0 ? sentences.slice(0, 2) : [body]).filter(Boolean);
  let text = "";
  for (const sentence of picked) {
    const next = text ? `${text} ${sentence}` : sentence;
    if (text && next.length > 220) break;
    text = next;
  }
  return text || "The live prompt is empty.";
}

function Start({ session }: { session: Session }) {
  const [desks, setDesks] = useState<LiveDesk[] | null>(null);
  const [deskError, setDeskError] = useState("");
  const [line, setLine] = useState<LineHold>({ busy: false, yours: false, runId: null });

  useEffect(() => {
    let active = true;
    void fetch("/api/desks", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; desks?: LiveDesk[]; error?: string }) => {
        if (!active) return;
        if (result.ok && Array.isArray(result.desks)) setDesks(result.desks);
        else setDeskError(result.error || "Could not read the desks.");
      })
      .catch(() => {
        if (active) setDeskError("The test engine is not reachable.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const response = await fetch(`/api/inbound?session=${encodeURIComponent(session.sessionId)}`, { cache: "no-store" });
        const result = (await response.json()) as { busy?: boolean; yours?: boolean; runId?: string | null };
        if (!active) return;
        setLine({
          busy: result.busy === true,
          yours: result.yours === true,
          runId: typeof result.runId === "string" ? result.runId : null,
        });
      } catch {
        /* keep the last reading */
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session.sessionId]);

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <section className="mx-auto max-w-3xl pt-4 text-center">
        <h1 className={`text-[40px] leading-[1.08] font-semibold tracking-tight sm:text-[56px] sm:leading-[1.05] ${display}`}>
          Which voice agent do you want to test?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-7 text-[#57534E]">
          Pick one we already have. Or add yours. A Bolna API key is optional. One test runs at a time.
        </p>
      </section>

      <LineNotice line={line} />

      <section className="mt-12">
        <h2 className={`text-[13px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Existing agents</h2>
        {deskError ? <p className="mt-4 text-[15px] text-[#BA1A1A]">{deskError}</p> : null}
        {desks === null && !deskError ? <p className="mt-4 text-[15px] text-[#57534E]">Reading the desks…</p> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(desks ?? []).filter((desk) => isDesk(desk.slug)).map((desk) => {
            const name = desk.name.trim() || desk.slug;
            return (
              <AgentChoice
                key={desk.slug}
                name={name}
                job={desk.unread ? "This desk could not be read." : cardBlurb(desk.prompt)}
                href={agentPath("/run", desk.slug as TestAgent)}
                action={`Test ${name}`}
                disabled={line.busy}
              />
            );
          })}
        </div>
      </section>

      <SharmaCaller />
      <OwnAgent hasKey={Boolean(session.bolnaApiKey)} />
    </div>
  );
}

function LineNotice({ line }: { line: LineHold }) {
  if (!line.busy) return null;
  if (line.yours && line.runId) {
    return (
      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#F6D77C] bg-[#FFF9E5] px-5 py-4 text-left">
        <p className="text-[15px] leading-6 text-[#0F0E0C]">Your test is still running. The other desks stay closed until it finishes.</p>
        <Link href={`/run/orbit?runId=${line.runId}`} className={`mt-3 inline-flex text-[14px] font-semibold text-[#92400E] underline underline-offset-4 ${display}`}>
          Open the running test
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#F0C2A6] bg-[#FBEAE5] px-5 py-4 text-left">
      <p className={`text-[16px] font-semibold ${display}`}>The test bots are in use. Kindly wait.</p>
      <p className="mt-1 text-[14px] leading-6 text-[#57534E]">One shared number, one test at a time. This page unlocks when that test finishes.</p>
    </div>
  );
}

function AgentChoice({ name, job, href, action, disabled }: { name: string; job: string; href: string; action: string; disabled: boolean }) {
  return (
    <article className={`flex min-h-[220px] flex-col justify-between rounded-xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)] ${disabled ? "opacity-60" : ""}`}>
      <div>
        <h3 className={`mt-2 text-[28px] font-semibold tracking-tight ${display}`}>{name}</h3>
        <p className="mt-3 text-[15px] leading-6 text-[#57534E]">{job}</p>
      </div>
      {disabled ? (
        <span className={`mt-6 inline-flex w-fit cursor-not-allowed rounded-lg bg-[#E7E5E4] px-4 py-2.5 text-[15px] font-medium text-[#78716C] ${display}`}>{action}</span>
      ) : (
        <Link href={href} className={`mt-6 inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0E0D0C] px-4 py-2.5 text-[15px] font-medium text-white ${display}`}>
          {action}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      )}
    </article>
  );
}

function SharmaCaller() {
  const [state, setState] = useState<"hidden" | "ready" | "confirm" | "updating" | "done">("hidden");
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/caller/angry_uncle", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; current?: boolean }) => {
        if (!active || !result.ok) return;
        setState(result.current ? "hidden" : "ready");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function updateCaller() {
    setState("updating");
    setNote("");
    try {
      const response = await fetch("/api/caller/angry_uncle", { method: "POST" });
      const result = (await response.json()) as { ok?: boolean; current?: boolean; message?: string; error?: string };
      if (result.ok && result.current) {
        setState("done");
        setNote("Sharma ji now follows the close rule.");
        return;
      }
      setState("confirm");
      setNote(result.error || result.message || "The caller prompt did not stick.");
    } catch {
      setState("confirm");
      setNote("The test engine is not reachable.");
    }
  }

  if (state === "hidden") return null;
  if (state === "done") return <p className="mx-auto mt-8 max-w-3xl text-[14px] text-[#57534E]">{note}</p>;

  return (
    <section className="mx-auto mt-8 max-w-3xl rounded-xl border border-[#E7E5E4] bg-white p-6">
      <h2 className={`text-[13px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Sharma ji</h2>
      {state === "ready" ? (
        <button
          type="button"
          onClick={() => setState("confirm")}
          className="mt-2 text-[14px] font-semibold text-[#57534E] underline decoration-[#E7E5E4] underline-offset-4 hover:text-[#0F0E0C]"
        >
          Update Sharma ji&apos;s caller
        </button>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-6 text-[#0F0E0C]">
            This replaces Sharma ji&apos;s live caller prompt with the local file. He waits for the desk to name the issue, the desk, and the time, then says the thank-you. The other callers stay as they are.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void updateCaller()}
              disabled={state === "updating"}
              className={`rounded-lg bg-[#0E0D0C] px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50 ${display}`}
            >
              {state === "updating" ? "Updating…" : "Update Sharma ji"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNote("");
                setState("ready");
              }}
              className="rounded-lg border border-[#E7E5E4] px-4 py-2.5 text-[14px] font-medium text-[#0F0E0C]"
            >
              Keep the current caller
            </button>
          </div>
          {note ? <p className="mt-3 text-[13px] text-[#57534E]">{note}</p> : null}
        </>
      )}
    </section>
  );
}

function OwnAgent({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [national, setNational] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the agent a name.");
      return;
    }
    if (!/^\d{10}$/.test(national)) {
      setError("Use a 10-digit mobile number.");
      return;
    }
    const current = openSession();
    const key = cleanBolnaKey(apiKey) || cleanBolnaKey(current.bolnaApiKey || "");
    if (key) {
      setReading(true);
      setError("");
      const response = await fetch("/api/bolna/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      setReading(false);
      if (!result.ok) {
        setError(result.error || "That Bolna key was not accepted.");
        return;
      }
    }
    saveSession({ ...current, bolnaApiKey: key });
    const params = new URLSearchParams({ own: "1", phone: national, name: name.trim() });
    router.push(`/own?${params.toString()}`);
  }

  return (
    <section className="mt-8 rounded-xl border border-[#E7E5E4] bg-white p-6 sm:p-8">
      <h2 className={`text-[13px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>Or add yours</h2>
      <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#57534E]">
        Name the agent and the number it answers. Next you choose the kind of business. A Bolna key lets us read the bot and suggest the category. You can change that suggestion.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1" htmlFor="agent-name">
            <span className="text-[14px] font-medium">Agent name</span>
            <input
              id="agent-name"
              value={name}
              placeholder="My clinic bot"
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              className="rounded-lg bg-[#FAF6F0] px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#FFB800]"
            />
          </label>
          <label className="flex flex-col gap-1" htmlFor="agent-phone">
            <span className="text-[14px] font-medium">Phone number</span>
            <span className="flex overflow-hidden rounded-lg bg-[#FAF6F0] focus-within:ring-2 focus-within:ring-[#FFB800]">
              <span className={`flex items-center px-3 text-[13px] text-[#57534E] ${mono}`}>+91</span>
              <input
                id="agent-phone"
                inputMode="numeric"
                value={prettyPhoneInput(national)}
                placeholder="79654 80975"
                onChange={(event) => {
                  setNational(nationalDigits(event.target.value));
                  setError("");
                }}
                className={`w-full bg-transparent px-3 py-3 text-[15px] outline-none ${mono}`}
              />
            </span>
          </label>
        </div>
        <label className="flex flex-col gap-1" htmlFor="bolna-key">
          <span className="flex items-center justify-between">
            <span className="text-[14px] font-medium">Bolna API key</span>
            <span className={`text-[10px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>Optional</span>
          </span>
          <input
            id="bolna-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={hasKey ? "A key is already saved in this browser" : "Leave empty to test without one"}
            onChange={(event) => setApiKey(event.target.value)}
            className="rounded-lg bg-[#FAF6F0] px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#FFB800]"
          />
        </label>
        {error ? <p className="text-[13px] text-[#BA1A1A]">{error}</p> : null}
        <button type="submit" disabled={reading} className={`h-12 w-fit rounded-lg bg-[#0E0D0C] px-5 text-[15px] font-medium text-white disabled:opacity-40 ${display}`}>
          {reading ? "Reading the bot…" : "Choose the category"}
        </button>
      </form>
    </section>
  );
}

function Bench({ session }: { session: Session }) {
  const cracked = session.bots.filter((bot) => bot.ran && bot.shop === "clinic");
  const count = session.bots.length;

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <header className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className={`mb-3 flex items-center gap-2 text-[12px] tracking-[0.14em] text-[#57534E] uppercase ${mono}`}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#0E0D0C]" />
            On the line
          </p>
          <h1 className={`text-[36px] leading-tight tracking-tight sm:text-[44px] ${display}`}>
            {count} {count === 1 ? "agent" : "agents"} saved.{" "}
            <span className={cracked.length ? "text-[#BF0715]" : "text-[#57534E]"}>
              {cracked.length === 0 ? "None played yet." : cracked.length === 1 ? "One cracked." : `${cracked.length} cracked.`}
            </span>
          </h1>
          <p className="mt-3 text-lg leading-7 text-[#57534E]">{benchNote(session.bots)}</p>
        </div>
        <Link href="/bots/new?own=1" className={`inline-flex items-center gap-2 self-start rounded-lg bg-[#0E0D0C] px-5 py-3 text-[16px] font-medium text-white shadow-md ${display}`}>
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add a number
        </Link>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {session.bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>
    </div>
  );
}

function BotCard({ bot }: { bot: Bot }) {
  const failed = bot.ran && bot.shop === "clinic";
  return (
    <article className={`relative flex min-h-[220px] flex-col justify-between rounded-xl bg-white p-5 shadow-sm ${failed ? "pl-6" : ""}`}>
      {failed ? <span className="absolute top-0 bottom-0 left-0 w-1 rounded-l-xl bg-[#BF0715]" /> : null}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/bots/${bot.id}`} className={`text-[22px] font-semibold hover:text-[#D97706] ${display}`}>
              {bot.name}
            </Link>
            <p className={`mt-1 text-[12px] tracking-wider text-[#57534E] ${mono}`}>{prettyPhone(bot.phone)}</p>
          </div>
          {failed ? (
            <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#FFDAD6] px-3 py-1 text-[12px] font-semibold tracking-wider text-[#BF0715] uppercase ${mono}`}>
              Failed
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#FAF6F0] px-3 py-1 text-[12px] font-semibold tracking-wider text-[#57534E] uppercase ${mono}`}>
              Not played
            </span>
          )}
        </div>
        <p className="mt-3 text-[15px] leading-6 text-[#57534E]">
          {failed ? "Sharma ji asked for his ₹500 back. She invented appointment 241 and cancelled it." : "Saved. No call has been played on this bot."}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className={`text-[10px] tracking-[0.08em] text-[#737373] uppercase ${mono}`}>{failed ? "Latest run · sample replay" : "No run yet"}</span>
        {failed && bot.callers.includes("angry_uncle") ? (
          <Link href="/run" className={`inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-[14px] text-[#BF0715] ${display}`}>
            Watch again
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        ) : (
          <Link href={`/bots/${bot.id}`} className={`inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-[14px] text-[#0F0E0C] ${display}`}>
            Open
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </Link>
        )}
      </div>
    </article>
  );
}

function benchNote(bots: Bot[]) {
  const failed = bots.filter((bot) => bot.ran && bot.shop === "clinic");
  const quiet = bots.filter((bot) => !(bot.ran && bot.shop === "clinic"));
  if (failed.length && quiet.length) {
    const names = quiet.map((bot) => bot.name).join(", ");
    return `${failed.map((bot) => bot.name).join(", ")} failed with Sharma ji. ${names} ${quiet.length === 1 ? "has" : "have"} not been played.`;
  }
  if (failed.length) return `${failed.map((bot) => bot.name).join(", ")} failed with Sharma ji. She invented appointment 241.`;
  return "Nothing has been played yet.";
}

function prettyPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    const national = digits.slice(2);
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return phone || "No number";
}

function prettyPhoneInput(digits: string) {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function nationalDigits(raw: string) {
  const compact = raw.replace(/[\s().-]/g, "");
  let digits = compact.replace(/\D/g, "");
  if (compact.startsWith("+91") || compact.startsWith("0091")) {
    digits = digits.startsWith("0091") ? digits.slice(4) : digits.slice(2);
  } else if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}
