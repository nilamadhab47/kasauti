"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { PersonLink } from "@/components/person-link";
import { loadSession, openSession, saveSession, type CallerLanguage, type Session, type TeamKind } from "@/lib/prototype";

const display = "[font-family:var(--font-display)]";
const body = "[font-family:var(--font-hanken)]";
const mono = "[font-family:var(--font-mono)]";

const LANGUAGES: { id: CallerLanguage; name: string; sample: string }[] = [
  { id: "hindi", name: "Hindi", sample: "पैसा वापस चाहिए" },
  { id: "hinglish", name: "Hinglish", sample: "Mera ₹500 kata hai" },
  { id: "english", name: "English", sample: "I want my refund" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [kind, setKind] = useState<TeamKind | "">("");
  const [languages, setLanguages] = useState<CallerLanguage[]>([]);
  const [saved, setSaved] = useState(false);
  const [warn, setWarn] = useState<"name" | "company" | "kind" | "languages" | null>(null);

  useEffect(() => {
    const current = openSession();
    setSession(current);
    setName(current.name);
    setEmail(current.email);
    setCompany(current.company);
    setKind(current.kind);
    setLanguages(current.languages);
  }, [router]);

  if (!session) return <main className="min-h-screen bg-[#FFFDFB]" />;

  function toggle(id: CallerLanguage) {
    setLanguages((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function save() {
    const current = loadSession();
    if (!current) return;
    if (!name.trim()) return setWarn("name");
    if (!company.trim()) return setWarn("company");
    if (!kind) return setWarn("kind");
    if (languages.length === 0) return setWarn("languages");
    const next: Session = { ...current, name: name.trim(), email: email.trim(), company: company.trim(), kind, languages };
    saveSession(next);
    setSession(next);
    setWarn(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <main className={`min-h-screen bg-[#FFFDFB] text-[#0F0E0C] ${body}`}>
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/30 bg-[#FFFDFB]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-8">
          <Link href="/workspace" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <PersonLink name={session.name} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
        <Link href="/workspace" className={`mb-6 inline-flex items-center gap-1 text-[12px] tracking-[0.08em] text-[#57534E] uppercase ${mono}`}>
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to the bench
        </Link>
        <h1 className={`text-[40px] tracking-tight sm:text-[44px] ${display}`}>Settings</h1>
        <p className="mt-2 max-w-xl text-[16px] leading-6 text-[#57534E]">Your name, and the workspace the bots sit in.</p>

        <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className={`text-[22px] ${display}`}>You</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[15px] font-semibold">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`mt-1 rounded-lg bg-[#FAF6F0] px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-[#FFB800] ${warn === "name" ? "ring-2 ring-[#FFB800]" : ""}`}
              />
            </label>
            <label className="flex flex-col gap-1 text-[15px] font-semibold">
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="mt-1 rounded-lg bg-[#FAF6F0] px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-[#FFB800]"
              />
            </label>
          </div>
          <p className="mt-3 text-[13px] text-[#737373]">The email stays on this device. Kasauti does not send a link.</p>
        </section>

        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className={`text-[22px] ${display}`}>Workspace</h2>
          <label className="mt-4 flex flex-col gap-1 text-[15px] font-semibold">
            Company
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className={`mt-1 rounded-lg bg-[#FAF6F0] px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-[#FFB800] ${warn === "company" ? "ring-2 ring-[#FFB800]" : ""}`}
            />
          </label>

          <p className="mt-5 text-[15px] font-semibold">How you ship</p>
          <div className={`mt-2 grid gap-3 sm:grid-cols-2 ${warn === "kind" ? "rounded-xl ring-2 ring-[#FFB800]" : ""}`}>
            <KindButton title="Agency" detail="Bots for clients." selected={kind === "agency"} onSelect={() => setKind("agency")} />
            <KindButton title="In-house" detail="Your own bot." selected={kind === "inhouse"} onSelect={() => setKind("inhouse")} />
          </div>

          <p className="mt-5 text-[15px] font-semibold">Languages callers will use</p>
          <div className={`mt-2 grid gap-3 sm:grid-cols-3 ${warn === "languages" ? "rounded-xl ring-2 ring-[#FFB800]" : ""}`}>
            {LANGUAGES.map((item) => {
              const selected = languages.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(item.id)}
                  className={`rounded-xl px-4 py-3 text-left ${selected ? "bg-[#FFF8E1] shadow-md" : "bg-[#FAF6F0]"}`}
                >
                  <span className={`block text-[18px] ${display}`}>{item.name}</span>
                  <span className="mt-1 block text-[13px] font-normal text-[#57534E]">{item.sample}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-6 flex items-center justify-between pb-16">
          <button type="button" onClick={save} className={`rounded-lg bg-[#0E0D0C] px-5 py-2.5 text-[16px] font-medium text-white ${display}`}>
            {saved ? "Saved" : "Save changes"}
          </button>
          <button type="button" onClick={() => router.push("/")} className="text-[14px] text-[#737373] hover:text-[#0F0E0C]">
            Home
          </button>
        </div>
      </div>
    </main>
  );
}

function KindButton({ title, detail, selected, onSelect }: { title: string; detail: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`rounded-xl px-4 py-3 text-left ${selected ? "bg-[#FFF8E1] shadow-md" : "bg-[#FAF6F0]"}`}>
      <span className={`block text-[18px] ${display}`}>{title}</span>
      <span className="mt-1 block text-[13px] text-[#57534E]">{detail}</span>
    </button>
  );
}
