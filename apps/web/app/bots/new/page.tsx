"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { SHOPS, openSession, saveSession, type CallerId, type Session, type ShopId } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

const CALLERS: { id: CallerId; name: string; who: string; tag: string; note: string; rings: boolean; icon: string; well: string; ink: string }[] = [
  {
    id: "angry_uncle",
    name: "Angry Uncle",
    who: "Sharma ji, Delhi",
    tag: "₹500 refund",
    note: "His money was deducted. He wants it back, not an appointment. The slip is a bot that invents one and cancels it.",
    rings: true,
    icon: "priority_high",
    well: "bg-[#FFDAD6] text-[#93000A]",
    ink: "text-[#BA1A1A]",
  },
  {
    id: "lang_switcher",
    name: "Language Switcher",
    who: "Neha, Gurgaon",
    tag: "Hindi, then English",
    note: "Starts in one language and switches. The bot should follow her, not stay stuck on the first one.",
    rings: false,
    icon: "translate",
    well: "bg-[#CCE5FF] text-[#00476E]",
    ink: "text-[#B8860B]",
  },
  {
    id: "noisy_market",
    name: "Noisy Market",
    who: "Priya, Lajpat Nagar",
    tag: "Street noise",
    note: "Asks through market noise. The bot should not invent an answer it did not hear.",
    rings: false,
    icon: "storefront",
    well: "bg-[#FFF3C4] text-[#753400]",
    ink: "text-[#B8860B]",
  },
  {
    id: "interrupter",
    name: "Interrupter",
    who: "Vikram, Bengaluru",
    tag: "Cuts in",
    note: "Talks over the bot. It should stop, listen, and not finish the sentence it had planned.",
    rings: false,
    icon: "graphic_eq",
    well: "bg-[#CCE5FF] text-[#00476E]",
    ink: "text-[#B8860B]",
  },
  {
    id: "elderly_slow",
    name: "Slow Elder",
    who: "Kamla Devi",
    tag: "Long pauses",
    note: "Speaks slowly and repeats herself. The bot should wait, not rush her to the next step.",
    rings: false,
    icon: "hourglass_empty",
    well: "bg-[#F5F5F4] text-[#57534E]",
    ink: "text-[#57534E]",
  },
  {
    id: "dialect_bhojpuri",
    name: "Bhojpuri",
    who: "Ramesh",
    tag: "Dialect",
    note: "Speaks Bhojpuri. The bot should stay with him instead of forcing a language he did not choose.",
    rings: false,
    icon: "forum",
    well: "bg-[#FFF3C4] text-[#753400]",
    ink: "text-[#B8860B]",
  },
];

export default function NewBot() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [shopId, setShopId] = useState<ShopId | null>(null);
  const [name, setName] = useState("");
  const [national, setNational] = useState("");
  const [task, setTask] = useState("");
  const [facts, setFacts] = useState("");
  const [neverSay, setNeverSay] = useState("");
  const [consent, setConsent] = useState(false);
  const [callers, setCallers] = useState<CallerId[]>([]);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState<"shop" | "name" | "phone" | "consent" | "callers" | null>(null);

  useEffect(() => {
    const current = openSession();
    setSession(current);
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("shop");
    if (requested === "clinic" || requested === "mobile" || requested === "salon" || requested === "kirana") {
      applyShop(requested);
      return;
    }
    const phone = (params.get("phone") || "").replace(/\D/g, "").slice(-10);
    setShopId("clinic");
    setName(params.get("name")?.trim() || "Your agent");
    setNational(phone);
    setTask("Answer the caller on this number.");
    setFacts("");
    setNeverSay("");
  }, [router]);

  const shop = SHOPS.find((item) => item.id === shopId) ?? null;
  const phone = `+91${national}`;
  const phoneOk = /^\+91\d{10}$/.test(phone);
  const headlineName = name.trim() || shop?.name || "the bot";

  function applyShop(id: ShopId) {
    const next = SHOPS.find((item) => item.id === id);
    if (!next) return;
    setShopId(id);
    setName(id === "clinic" ? "Sehat Clinic" : "");
    setNational(id === "clinic" ? "8064269179" : "");
    setTask(next.task);
    setFacts(next.facts);
    setNeverSay(next.neverSay);
    setConsent(false);
    setError("");
    setWarn(null);
  }

  function toggleCaller(id: CallerId) {
    setCallers((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function flash(next: "shop" | "name" | "phone" | "consent" | "callers") {
    setWarn(next);
    window.setTimeout(() => setWarn(null), 1100);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || !shop) {
      flash("shop");
      return;
    }
    if (!name.trim()) {
      flash("name");
      return;
    }
    if (!phoneOk) {
      setError("Use a 10-digit mobile number.");
      flash("phone");
      return;
    }
    if (!task.trim()) return;
    if (!consent) {
      flash("consent");
      return;
    }
    if (callers.length === 0) {
      flash("callers");
      return;
    }
    const chosen = CALLERS.map((caller) => caller.id).filter((id) => callers.includes(id));
    saveSession({
      ...session,
      bots: [...session.bots, { id: crypto.randomUUID(), name: name.trim(), phone, shop: shop.id, task: task.trim(), facts: facts.trim(), neverSay: neverSay.trim(), ran: false, callers: chosen, bolnaAgentId: "", runs: [] }],
    });
    router.push("/connect");
  }

  if (!session) return <main className="min-h-screen bg-[#FFFDFB]" />;

  const ringsNow = Boolean(shop?.plays && callers.includes("angry_uncle"));

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/workspace" className="shrink-0">
              <Logo size="sm" />
            </Link>
          </div>
          <button type="button" onClick={() => router.push("/")} className="text-[13px] text-[#737373] hover:text-[#0F0E0C]">
            Home
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <div className="mb-8 max-w-3xl">
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full bg-[#F5F5F4] px-3 py-1 text-[10px] tracking-[0.12em] text-[#57534E] uppercase ${mono}`}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#0E0D0C]" />
            The brief
          </div>
          <h1 className={`text-[32px] leading-tight font-medium tracking-tight sm:text-[44px] sm:leading-[52px] ${display}`}>
            Tell us about {headlineName} before we ring.
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-7 text-[#57534E]">
            A sharp friend only breaks what you ask it to protect. Give the callers the ground truth so we catch the exact line where it slips.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-12">
          <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl bg-[#FAF6F0] p-6 shadow-[0_12px_32px_-8px_rgba(30,27,25,0.06)] lg:col-span-5">
            <label className="flex flex-col gap-1" htmlFor="bot-name">
              <span className="flex items-center justify-between">
                <span className="text-[15px] font-medium">Bot name</span>
                <span className={`text-[10px] tracking-[0.06em] text-[#57534E] uppercase ${mono}`}>Required</span>
              </span>
              <input
                id="bot-name"
                value={name}
                placeholder="Sehat Clinic"
                onChange={(event) => setName(event.target.value)}
                className={`rounded-lg bg-white px-4 py-2.5 text-[15px] shadow-sm outline-none ${warn === "name" ? "ring-2 ring-[#FFB800]" : ""}`}
              />
              <span className="text-[13px] text-[#57534E]">The name callers will hear.</span>
            </label>

            <label className="flex flex-col gap-1" htmlFor="phone-number">
              <span className="flex items-center justify-between">
                <span className="text-[15px] font-medium">Phone number</span>
                <span className={`text-[10px] tracking-[0.06em] text-[#B8860B] uppercase ${mono}`}>A number you own</span>
              </span>
              <span className={`flex overflow-hidden rounded-lg bg-white shadow-sm ${warn === "phone" ? "ring-2 ring-[#FFB800]" : ""}`}>
                <span className={`flex items-center gap-2 bg-[#FAF6F0] px-3 text-[12px] text-[#57534E] ${mono}`}>
                  <span className="inline-block h-2.5 w-3.5 rounded-[1px] bg-[#0E0D0C]" />
                  +91
                </span>
                <input
                  id="phone-number"
                  inputMode="numeric"
                  value={pretty(national)}
                  placeholder="79654 80975"
                  onChange={(event) => {
                    setNational(event.target.value.replace(/\D/g, "").slice(0, 10));
                    setError("");
                  }}
                  className={`w-full bg-transparent px-3 py-2.5 text-[15px] outline-none ${mono}`}
                />
              </span>
              <span className="text-[13px] text-[#57534E]">{error || "A staging number you own."}</span>
            </label>

            <label className="flex flex-col gap-1" htmlFor="bot-mission">
              <span className="text-[15px] font-medium">What should it do?</span>
              <input
                id="bot-mission"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                className="rounded-lg bg-white px-4 py-2.5 text-[15px] shadow-sm outline-none"
              />
              <span className="text-[13px] text-[#57534E]">The bot&apos;s job.</span>
            </label>

            <label className="flex flex-col gap-1" htmlFor="facts-allowed">
              <span className="flex items-center justify-between">
                <span className="text-[15px] font-medium">Facts it&apos;s allowed to say</span>
                <span className={`text-[10px] tracking-[0.06em] text-[#BA1A1A] uppercase ${mono}`}>Ground truth</span>
              </span>
              <textarea
                id="facts-allowed"
                value={facts}
                rows={6}
                onChange={(event) => setFacts(event.target.value)}
                className="resize-none rounded-lg bg-white px-4 py-3 text-[15px] leading-6 shadow-sm outline-none"
              />
              <span className="text-[13px] text-[#57534E]">If it claims anything else, we mark it a slip.</span>
            </label>

            <label className="flex flex-col gap-1" htmlFor="never-say">
              <span className="flex items-center justify-between">
                <span className="text-[15px] font-medium">What it must never say</span>
                <span className={`text-[10px] tracking-[0.06em] text-[#BA1A1A] uppercase ${mono}`}>Security</span>
              </span>
              <textarea
                id="never-say"
                value={neverSay}
                rows={3}
                onChange={(event) => setNeverSay(event.target.value)}
                className="resize-none rounded-lg bg-white px-4 py-3 text-[15px] leading-6 shadow-sm outline-none"
              />
              <span className="text-[13px] text-[#57534E]">A leak of any of these is a security fail.</span>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 ${warn === "consent" ? "rounded-lg ring-2 ring-[#FFB800]" : ""}`}>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-[#D97706]" />
              <span className="text-[13px] leading-5">I own this bot or I have permission to call it.</span>
            </label>

            <button
              type="submit"
              className={`flex h-14 items-center justify-center gap-2 rounded-lg bg-[#0E0D0C] text-[18px] font-medium text-white shadow-[0_4px_16px_rgba(14,13,12,0.12)] transition hover:-translate-y-0.5 ${display}`}
            >
              {ringsNow ? "Run clinic pack" : "Save this test"}
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
            <p className="text-center text-[13px] leading-5 text-[#57534E]">
              {callers.length === 0
                ? "Tick at least one caller. That is who runs this test."
                : ringsNow && callers.length > 1
                  ? "This run is Angry Uncle. The others you ticked are saved with the bot."
                  : ringsNow
                    ? "This run is Angry Uncle."
                    : "The callers you ticked are saved. Only Angry Uncle can ring in this build."}
            </p>
            <Link href="/workspace" className="inline-flex items-center justify-center gap-1 text-[13px] text-[#57534E] hover:text-[#0F0E0C]">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to workspace
            </Link>
          </form>

          <section className={`flex flex-col gap-4 lg:col-span-7 ${warn === "callers" ? "rounded-xl ring-2 ring-[#FFB800]" : ""}`}>
            <div>
              <p className={`text-[10px] tracking-[0.08em] text-[#D97706] uppercase ${mono}`}>
                {callers.length === 0 ? "None selected" : `${callers.length} selected`} · tick one or more
              </p>
              <h2 className={`mt-1 text-[32px] leading-10 font-medium tracking-tight ${display}`}>Who should test it</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#57534E]">
                Pick the callers for this test. More than one is fine. Only Angry Uncle can ring in this build.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {CALLERS.map((caller) => {
                const selected = callers.includes(caller.id);
                const onThisCall = selected && caller.rings && Boolean(shop?.plays);
                return (
                  <li key={caller.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCaller(caller.id)}
                      className={`flex w-full items-start gap-4 rounded-xl p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${selected ? "bg-[#FFF8E1] ring-2 ring-[#FFB800]" : "bg-white"}`}
                    >
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${caller.well}`}>
                        <span className="material-symbols-outlined text-[22px]">{caller.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`text-[18px] font-medium ${display}`}>{caller.name}</span>
                            <span className={`rounded bg-[#FAF6F0] px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-[#57534E] uppercase ${mono}`}>{caller.who}</span>
                          </span>
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#0E0D0C] text-white transition ${selected ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
                            <span className="material-symbols-outlined text-[16px]">check</span>
                          </span>
                        </span>
                        <span className={`mt-1 block text-[12px] font-medium ${caller.ink} ${mono}`}>{caller.tag}</span>
                        <span className="mt-1 block text-[13px] leading-5 text-[#57534E]">{caller.note}</span>
                        <span className={`mt-2 block text-[10px] tracking-[0.06em] uppercase ${mono} ${onThisCall ? "text-[#BA1A1A]" : "text-[#737373]"}`}>
                          {onThisCall ? "On this call" : selected ? "Selected · saved, not ringing yet" : "Tap to include"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}

function pretty(digits: string) {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}
