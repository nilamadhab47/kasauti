export type Cell = "Pass" | "Fail" | "—";

export type Turn = {
  who: "caller" | "bot";
  text: string;
  /** Hindi stays in Devanagari. Hinglish stays in Latin. */
  lang?: "hi";
  fail?: boolean;
};

export type Caller = {
  id: string;
  name: string;
  who: string;
  tests: string;
  quote: string;
  quoteLang?: "hi";
  bot: string;
  crackedAt: string;
  reason: string;
  fix: string;
  cells: Record<"task" | "facts" | "language" | "tone", Cell>;
  rerunCells: Record<"task" | "facts" | "language" | "tone", Cell>;
  breakLines: Turn[];
  rerunLines: Turn[];
};

export const CLINIC = "Sehat Clinic";
export const BOT_NAME = "Riya";

export const CALLERS: Caller[] = [
  {
    id: "sharma",
    name: "Sharma ji",
    who: "58, Delhi · wants ₹500 back",
    tests: "Does it invent a refund it can't give?",
    quote: "देखिए, मेरा ₹500 कटा है। Appointment आपने cancel कर दिया।",
    quoteLang: "hi",
    bot: BOT_NAME,
    crackedAt: "00:18",
    reason: "She invented appointment 241 and cancelled it. He only wanted his ₹500 back.",
    fix: "You cannot process refunds. Take the transaction ID, apologise, and promise a callback within 24 hours.",
    cells: { task: "Fail", facts: "Fail", language: "Pass", tone: "Fail" },
    rerunCells: { task: "Pass", facts: "Pass", language: "Pass", tone: "Pass" },
    breakLines: [
      { who: "caller", lang: "hi", text: "देखिए, मेरा ₹500 कटा है।" },
      { who: "bot", text: "I can help with that. What happened?" },
      { who: "caller", lang: "hi", text: "Appointment आपने cancel कर दिया। Refund chahiye." },
      { who: "bot", fail: true, text: "I have cancelled appointment ID 241 for you." },
    ],
    rerunLines: [
      { who: "caller", lang: "hi", text: "देखिए, मेरा ₹500 कटा है।" },
      {
        who: "bot",
        text: "I can't refund that from here. Share the transaction ID and I'll have someone call you within 24 hours.",
      },
    ],
  },
  {
    id: "neha",
    name: "Neha",
    who: "35, Gurgaon · switches to Hindi",
    tests: "Does it follow the switch within one turn?",
    quote: "Actually हिंदी में बात करते हैं, मम्मी जी साथ में हैं।",
    quoteLang: "hi",
    bot: BOT_NAME,
    crackedAt: "00:22",
    reason: "She switched to Hindi mid-sentence. The bot asked her to repeat, in English.",
    fix: "When the caller switches language, switch in the same turn. Do not ask them to repeat.",
    cells: { task: "Pass", facts: "Pass", language: "Fail", tone: "Pass" },
    rerunCells: { task: "Pass", facts: "Pass", language: "Pass", tone: "Pass" },
    breakLines: [
      { who: "caller", text: "I need a slot for my mother." },
      { who: "bot", text: "Sure. Which doctor?" },
      { who: "caller", lang: "hi", text: "Actually हिंदी में बात करते हैं, मम्मी जी साथ में हैं।" },
      { who: "bot", fail: true, text: "Sorry, could you repeat that?" },
    ],
    rerunLines: [
      { who: "caller", lang: "hi", text: "Actually हिंदी में बात करते हैं, मम्मी जी साथ में हैं।" },
      { who: "bot", lang: "hi", text: "जी। मम्मी जी के लिए कौन से डॉक्टर का अपॉइंटमेंट चाहिए?" },
    ],
  },
  {
    id: "priya",
    name: "Priya",
    who: "32, Lajpat Nagar · a loud market",
    tests: "Does it ask again, or guess and move on?",
    quote: "Haan? Sunai nahi de raha… ek minute… kitne baje?",
    bot: BOT_NAME,
    crackedAt: "00:11",
    reason: "The line was noise. The bot guessed 9 AM and booked it.",
    fix: "If the line is unclear, ask again. Do not guess a time.",
    cells: { task: "Fail", facts: "Fail", language: "Pass", tone: "Pass" },
    rerunCells: { task: "Pass", facts: "Pass", language: "Pass", tone: "Pass" },
    breakLines: [
      { who: "caller", text: "Haan? Sunai nahi de raha… ek minute… kitne baje?" },
      { who: "bot", fail: true, text: "Your appointment is at 9 AM. I've confirmed it." },
    ],
    rerunLines: [
      { who: "caller", text: "Haan? Sunai nahi de raha… ek minute… kitne baje?" },
      { who: "bot", text: "I didn't catch that. What time were you asking about?" },
    ],
  },
  {
    id: "vikram",
    name: "Vikram",
    who: "29, Bengaluru · talks over the bot",
    tests: "Does it drop the second question?",
    quote: "Aur parking? Aur weekend? Dono batao jaldi.",
    bot: BOT_NAME,
    crackedAt: "00:09",
    reason: "He asked two things. The bot answered parking and dropped the weekend.",
    fix: "Answer every question in the turn, in order. Do not stop at the first.",
    cells: { task: "Fail", facts: "Pass", language: "Pass", tone: "Fail" },
    rerunCells: { task: "Pass", facts: "Pass", language: "Pass", tone: "Pass" },
    breakLines: [
      { who: "caller", text: "Aur parking? Aur weekend? Dono batao jaldi." },
      { who: "bot", fail: true, text: "Yes, parking is available." },
    ],
    rerunLines: [
      { who: "caller", text: "Aur parking? Aur weekend? Dono batao jaldi." },
      { who: "bot", text: "Parking is in the basement. Saturday hours are 9 to 1." },
    ],
  },
  {
    id: "kamla",
    name: "Kamla Devi",
    who: "74, Lucknow · leaves a silence",
    tests: "Does it wait, or talk over the silence?",
    quote: "बेटा, वो… पिछली बार वाले डॉक्टर… नाम भूल गई…",
    quoteLang: "hi",
    bot: BOT_NAME,
    crackedAt: "00:27",
    reason: "She paused to remember a name. The bot filled the silence and asked her to repeat.",
    fix: "Wait through a pause. Offer the two doctors she has seen. Do not fill the silence.",
    cells: { task: "Fail", facts: "Pass", language: "Pass", tone: "Fail" },
    rerunCells: { task: "Pass", facts: "Pass", language: "Pass", tone: "Pass" },
    breakLines: [
      { who: "caller", lang: "hi", text: "बेटा, वो… पिछली बार वाले डॉक्टर… नाम भूल गई…" },
      { who: "bot", fail: true, text: "Sorry, could you repeat that?" },
    ],
    rerunLines: [
      { who: "caller", lang: "hi", text: "बेटा, वो… पिछली बार वाले डॉक्टर… नाम भूल गई…" },
      { who: "bot", lang: "hi", text: "कोई बात नहीं। पिछली बार डॉ. मेहता थे या डॉ. सिंह?" },
    ],
  },
  {
    id: "ramesh",
    name: "Ramesh",
    who: "40, Chapra · speaks Bhojpuri",
    tests: "Does it stay with him, or force a language?",
    quote: "हमनी के बुखार बा दू दिन से, डॉक्टर से मिले के बा।",
    quoteLang: "hi",
    bot: BOT_NAME,
    crackedAt: "00:14",
    reason: "He stayed in Bhojpuri. The bot refused the language.",
    fix: "Stay in the caller's language. Do not demand Hindi or English.",
    cells: { task: "Fail", facts: "Pass", language: "Fail", tone: "Fail" },
    rerunCells: { task: "Pass", facts: "Pass", language: "Pass", tone: "Pass" },
    breakLines: [
      { who: "caller", lang: "hi", text: "हमनी के बुखार बा दू दिन से, डॉक्टर से मिले के बा।" },
      { who: "bot", fail: true, text: "Please speak in Hindi or English." },
    ],
    rerunLines: [
      { who: "caller", lang: "hi", text: "हमनी के बुखार बा दू दिन से, डॉक्टर से मिले के बा।" },
      { who: "bot", lang: "hi", text: "ठीक बा। बुखार दू दिन से बा। आज शाम के स्लॉट खाली बा।" },
    ],
  },
];

export const NOW = [
  ["Real +91 calls", "A staging number you own"],
  ["Indian callers", "Hindi, Hinglish, English, Bhojpuri"],
  ["Quoted report card", "The exact line that broke"],
  ["One-line fix", "Then rerun the same caller"],
  ["Shareable report", "The card, without the workspace"],
];

export const NEXT = [
  ["Custom personas", "Your own callers"],
  ["More dialects", "Beyond the six"],
  ["Latency and dead air", "Read from the audio"],
  ["Scheduled runs", "The same pack, every morning"],
  ["GitHub checks", "A red cell blocks the merge"],
  ["Other agents", "Vapi, Retell, ElevenLabs"],
];

export const DONT = [
  ["Not the first", "Other tools test voice agents"],
  ["Not the only", "We don't claim the category"],
  ["No made-up numbers", "No pass rates we didn't measure"],
];
