import sehat from "../../../demo-target/sehat.manifest.json";
import rupeesetu from "../../../demo-target/rupeesetu.manifest.json";
import swaad from "../../../demo-target/swaad.manifest.json";
import nila from "../../../demo-target/nila.manifest.json";
import nivas from "../../../demo-target/nivas.manifest.json";

export const AGENT_IDS = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;

export type TestAgent = (typeof AGENT_IDS)[number];

export function agentFromParam(value: string | null): TestAgent {
  return value !== null && (AGENT_IDS as readonly string[]).includes(value) ? (value as TestAgent) : "sehat";
}

export function agentPath(base: "/run" | "/run/callers", agent: TestAgent) {
  return agent === "sehat" ? base : `${base}?agent=${agent}`;
}

export type AgentBrief = {
  id: TestAgent;
  name: string;
  role: string;
  transcriber: string;
  transcriberNote: string;
  model: string;
  modelNote: string;
  voice: string;
  voiceNote: string;
  welcome: string;
  prompt: string;
};

export const AGENT_BRIEFS: Record<AgentBrief["id"], AgentBrief> = {
  sehat: {
    id: "sehat",
    name: sehat.display_name,
    role: sehat.role,
    transcriber: "Deepgram nova-3",
    transcriberNote: "Language set to English.",
    model: "gpt-4.1-mini",
    modelNote: "Saved on the agents account as gpt-4.1-mini.",
    voice: "ElevenLabs, Angelica",
    voiceNote: "The same English voice saved on the other agents.",
    welcome: "Hello, Sehat Clinic, this is Riya. How can I help you?",
    prompt: sehat.role,
  },
  rupeesetu: {
    id: "rupeesetu",
    name: rupeesetu.display_name,
    role: rupeesetu.role,
    transcriber: "Deepgram nova-3",
    transcriberNote: "Language set to English.",
    model: "gpt-4.1-mini",
    modelNote: "The v1 note also allows the Bolna dashboard default. It does not record which one was saved.",
    voice: "ElevenLabs, English",
    voiceNote: "The v1 note says any English voice. It does not name which one.",
    welcome: "Hello, RupeeSetu Finance, this is Priya. How can I help you?",
    prompt: rupeesetu.role,
  },
  swaad: {
    id: "swaad",
    name: swaad.display_name,
    role: swaad.role,
    transcriber: "Deepgram nova-3",
    transcriberNote: "Language set to English.",
    model: "gpt-4.1-mini",
    modelNote: "The first draft uses gpt-4.1-mini.",
    voice: "ElevenLabs, Angelica",
    voiceNote: "The same English voice saved on RupeeSetu.",
    welcome: "Hello, Swaad Kitchen, this is Kavya. How can I help you?",
    prompt: swaad.role,
  },
  nila: {
    id: "nila",
    name: nila.display_name,
    role: nila.role,
    transcriber: "Deepgram nova-3",
    transcriberNote: "Language set to English.",
    model: "gpt-4.1-mini",
    modelNote: "The first draft uses gpt-4.1-mini.",
    voice: "ElevenLabs, Angelica",
    voiceNote: "The same English voice saved on RupeeSetu.",
    welcome: "Hello, Nila, this is Ananya. How can I help you?",
    prompt: nila.role,
  },
  nivas: {
    id: "nivas",
    name: nivas.display_name,
    role: nivas.role,
    transcriber: "Deepgram nova-3",
    transcriberNote: "Language set to English.",
    model: "gpt-4.1-mini",
    modelNote: "The first draft uses gpt-4.1-mini.",
    voice: "ElevenLabs, Angelica",
    voiceNote: "The same English voice saved on RupeeSetu.",
    welcome: "Hello, Nivas Homes, this is Isha. How can I help you?",
    prompt: nivas.role,
  },
};
