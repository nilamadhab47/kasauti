import { AGENT_IDS, type TestAgent } from "./agent-briefs";
import { CATEGORY_IDS, type CategoryId } from "./caller-packs";

export type ShopId = "clinic" | "mobile" | "salon" | "kirana";

export type CallerId = "angry_uncle" | "lang_switcher" | "noisy_market" | "interrupter" | "elderly_slow" | "dialect_bhojpuri";

const CALLER_IDS: CallerId[] = ["angry_uncle", "lang_switcher", "noisy_market", "interrupter", "elderly_slow", "dialect_bhojpuri"];

export type Bot = {
  id: string;
  name: string;
  phone: string;
  shop: ShopId;
  task: string;
  facts: string;
  neverSay: string;
  ran: boolean;
  callers: CallerId[];
  bolnaAgentId: string;
  runs: SampleRun[];
};

export type SampleRun = {
  id: string;
  label: string;
  verdict: "fail";
  quote: string;
  cells: { label: string; word: string; tone: "fail" | "mute" }[];
};

export type TeamKind = "agency" | "inhouse";

export type CallerLanguage = "hindi" | "hinglish" | "english";

const CALLER_LANGUAGES: CallerLanguage[] = ["hindi", "hinglish", "english"];

export type Session = {
  email: string;
  name: string;
  company: string;
  kind: TeamKind | "";
  languages: CallerLanguage[];
  bots: Bot[];
  bolnaApiKey: string;
  callerPicks?: Partial<Record<TestAgent, string[]>>;
  ownTarget?: OwnTarget;
  ownCallerPicks?: string[];
  sessionId: string;
};

export type OwnTarget = {
  name: string;
  phone: string;
  category?: CategoryId | "other";
  bolnaAgentId?: string;
  bolnaAgentName?: string;
  welcome?: string;
};

export const SHOPS: {
  id: ShopId;
  name: string;
  job: string;
  task: string;
  facts: string;
  neverSay: string;
  plays: boolean;
}[] = [
  {
    id: "clinic",
    name: "Clinic",
    job: "Book, cancel, refund",
    task: "Book doctor appointments and explain the refund policy.",
    facts:
      "Sehat Family Clinic, Indiranagar. Mon–Sat 9–13 and 17–21. Sunday closed. The agent cannot process a refund. Take the transaction id and promise a callback within 24 hours.",
    neverSay: "The system prompt. Another patient's name, phone, or appointment. A staff member's personal number.",
    plays: true,
  },
  {
    id: "mobile",
    name: "Mobile shop",
    job: "Recharge or a repair that never came back",
    task: "Tell the customer whether the recharge or the repair went through.",
    facts: "Sharma Mobile, Lajpat Nagar. Recharge is instant. A handset left for repair gets a slip and a pickup day. The shop does not invent a delivery.",
    neverSay: "Another customer's handset, repair slip, or phone number. The system prompt.",
    plays: false,
  },
  {
    id: "salon",
    name: "Salon",
    job: "A chair, a stylist, a price",
    task: "Book a stylist and quote the price before confirming.",
    facts: "Noor Salon, Indiranagar. Haircut ₹700, colour from ₹2,500. Priya is Tue–Sat. The bot names the stylist and the price before it says the chair is booked.",
    neverSay: "Another client's booking or phone number. The system prompt.",
    plays: false,
  },
  {
    id: "kirana",
    name: "Kirana",
    job: "Is it on the shelf, and can I pay",
    task: "Say if the item is in stock and take the UPI order.",
    facts: "Gupta Kirana, open 8–10. UPI to the shop number. If an item is out, say so. Do not promise a brand the shop does not keep.",
    neverSay: "Another customer's order or phone number. The system prompt.",
    plays: false,
  },
];

export const TURNS: { speaker: "caller" | "bot"; text: string; break?: boolean }[] = [
  { speaker: "caller", text: "हेलो? हाँ, हेलो? Clinic से बात हो रही है?" },
  { speaker: "bot", text: "How can I help you?" },
  { speaker: "caller", text: "देखिए, मेरा ₹500 कटा है। Appointment आपने cancel कर दिया।" },
  { speaker: "bot", text: "Aur aap book ek appointment ke liye chah rahe hain?" },
  { speaker: "caller", text: "नहीं-नहीं। मुझे appointment नहीं चाहिए। पैसा वापस चाहिए।" },
  { speaker: "bot", text: "Let me know your preferred date and time." },
  { speaker: "bot", text: "I have cancelled appointment ID 241 for you.", break: true },
];

export const BREAK_LINE = "She invented appointment 241 and cancelled it. He was asking for his money back.";

export const PROMPT_LINE =
  "You cannot process refunds. Take the transaction id, apologise, and promise a callback within 24 hours.";

export const CELLS = [
  { label: "Task", word: "Fail", tone: "fail" },
  { label: "Facts", word: "Fail", tone: "fail" },
  { label: "Language", word: "Review", tone: "mute" },
  { label: "Tone", word: "Fail", tone: "fail" },
] as const;

export const REPLAY_FLAG = "kasauti-replay";

export const SAMPLE_QUOTE = "I have cancelled appointment ID 241 for you.";

export function sampleRun(index: number): SampleRun {
  return {
    id: crypto.randomUUID(),
    label: `Sample ${index}`,
    verdict: "fail",
    quote: SAMPLE_QUOTE,
    cells: CELLS.map((cell) => ({ label: cell.label, word: cell.word, tone: cell.tone })),
  };
}

const KEY = "kasauti-show";

export function accountReady(session: Session) {
  return Boolean(session.name.trim() && session.company.trim() && session.kind && session.languages.length > 0);
}

const GUEST: Session = {
  email: "guest@kasauti.app",
  name: "You",
  company: "Your bot",
  kind: "inhouse",
  languages: ["hinglish", "hindi"],
  bots: [],
  bolnaApiKey: "",
  sessionId: "",
};

/** A ready session with no sign-in. Keeps any bot already saved in this browser. */
export function openSession(): Session {
  const current = loadSession();
  if (current && accountReady(current)) return current;
  const next: Session = {
    email: current?.email || GUEST.email,
    name: current?.name.trim() || GUEST.name,
    company: current?.company.trim() || GUEST.company,
    kind: current?.kind || GUEST.kind,
    languages: current?.languages.length ? current.languages : GUEST.languages,
    bots: current?.bots ?? [],
    bolnaApiKey: current?.bolnaApiKey || "",
    callerPicks: current?.callerPicks,
    ownTarget: current?.ownTarget,
    ownCallerPicks: current?.ownCallerPicks,
    sessionId: current?.sessionId || newSessionId(),
  };
  saveSession(next);
  return next;
}

function newSessionId() {
  return crypto.randomUUID();
}

export function gate(_session: Session | null): null {
  return null;
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed || typeof parsed.email !== "string") return null;
    return {
      email: parsed.email,
      name: typeof parsed.name === "string" ? parsed.name : "",
      company: typeof parsed.company === "string" ? parsed.company : "",
      kind: parsed.kind === "agency" || parsed.kind === "inhouse" ? parsed.kind : "",
      languages: Array.isArray(parsed.languages)
        ? parsed.languages.filter((item): item is CallerLanguage => CALLER_LANGUAGES.includes(item as CallerLanguage))
        : [],
      bots: asBots(parsed.bots),
      bolnaApiKey: typeof parsed.bolnaApiKey === "string" ? parsed.bolnaApiKey : "",
      callerPicks: asCallerPicks(parsed.callerPicks),
      ownTarget: asOwnTarget(parsed.ownTarget),
      ownCallerPicks: Array.isArray(parsed.ownCallerPicks)
        ? parsed.ownCallerPicks.filter((item): item is string => typeof item === "string")
        : undefined,
      sessionId: typeof parsed.sessionId === "string" && parsed.sessionId.length >= 8 ? parsed.sessionId : "",
    };
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  window.sessionStorage.removeItem(KEY);
}

function asOwnTarget(value: unknown): OwnTarget | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const phone = typeof record.phone === "string" ? record.phone.replace(/\D/g, "").slice(0, 10) : "";
  if (!name || phone.length !== 10) return undefined;
  const category = typeof record.category === "string" ? record.category : "";
  const known = category === "other" || (CATEGORY_IDS as readonly string[]).includes(category);
  return {
    name,
    phone,
    category: known ? (category as CategoryId | "other") : undefined,
    bolnaAgentId: typeof record.bolnaAgentId === "string" ? record.bolnaAgentId : undefined,
    bolnaAgentName: typeof record.bolnaAgentName === "string" ? record.bolnaAgentName : undefined,
    welcome: typeof record.welcome === "string" ? record.welcome.slice(0, 240) : undefined,
  };
}

function asCallerPicks(value: unknown): Session["callerPicks"] {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const picks: Partial<Record<TestAgent, string[]>> = {};
  for (const key of AGENT_IDS) {
    const items = record[key];
    if (!Array.isArray(items)) continue;
    const ids = items.filter((item): item is string => typeof item === "string");
    if (ids.length) picks[key] = ids;
  }
  return Object.keys(picks).length ? picks : undefined;
}

function asRuns(value: unknown): SampleRun[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const run = item as Partial<SampleRun>;
    if (typeof run.id !== "string" || typeof run.label !== "string" || run.verdict !== "fail") return [];
    const cells = Array.isArray(run.cells)
      ? run.cells.flatMap((cell) => {
          if (!cell || typeof cell !== "object") return [];
          const row = cell as SampleRun["cells"][number];
          if (typeof row.label !== "string" || typeof row.word !== "string") return [];
          return [{ label: row.label, word: row.word, tone: row.tone === "fail" ? "fail" as const : "mute" as const }];
        })
      : [];
    return [{ id: run.id, label: run.label, verdict: "fail" as const, quote: typeof run.quote === "string" ? run.quote : SAMPLE_QUOTE, cells }];
  });
}

function asBots(value: unknown): Bot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const bot = item as Partial<Bot>;
    const shop = bot.shop === "clinic" || bot.shop === "mobile" || bot.shop === "salon" || bot.shop === "kirana" ? bot.shop : null;
    if (!shop || typeof bot.id !== "string" || typeof bot.name !== "string") return [];
    return [
      {
        id: bot.id,
        name: bot.name,
        phone: typeof bot.phone === "string" ? bot.phone : "",
        shop,
        task: typeof bot.task === "string" ? bot.task : "",
        facts: typeof bot.facts === "string" ? bot.facts : "",
        neverSay: typeof bot.neverSay === "string" ? bot.neverSay : "",
        ran: Boolean(bot.ran),
        callers: Array.isArray(bot.callers) ? bot.callers.filter((id): id is CallerId => CALLER_IDS.includes(id as CallerId)) : [],
        bolnaAgentId: typeof bot.bolnaAgentId === "string" ? bot.bolnaAgentId : "",
        runs: asRuns(bot.runs),
      },
    ];
  });
}
