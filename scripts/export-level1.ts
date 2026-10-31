import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseTranscript } from "../packages/core/src/index.ts";
import { bolna } from "./lib/bolna.js";
import { env, repoRoot } from "./lib/env.js";

const CALLS = [
  {
    id: "sharma",
    who: "Sharma ji",
    role: "Delhi · wants his ₹500 back",
    executionId: "b2984e47-2962-4b32-a557-ab1e835d9417",
    line: "The call will now disconnect. Goodbye.",
    sentence:
      "The bot abruptly disconnected the call when the user requested to speak with a manager instead of attempting to transfer the call or provide alternative support options.",
    prompt:
      "When a user requests to speak with a manager or supervisor, acknowledge their request politely, explain that you cannot transfer calls but provide the support team contact information, and offer to help with appointment booking before ending the conversation.",
    costUsd: 0.0799,
  },
  {
    id: "neha",
    who: "Neha",
    role: "Gurgaon · switches to Hindi",
    executionId: "348c5c92-358f-48d0-b031-4106191b4318",
    line: "Which one would you prefer for Arab's pediatrician appointment?",
    sentence:
      "The bot repeatedly misheard and misspelled the child's name as 'Adolf' and 'Arab' instead of 'Aarav' despite multiple corrections from the caller.",
    prompt:
      "When a caller corrects a name or other information, immediately acknowledge the correction, apologize for the error, and use only the corrected version in all subsequent responses.",
    costUsd: 0.1375,
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function durationSeconds(execution: Record<string, unknown>): number | null {
  if (typeof execution.conversation_duration === "number") return execution.conversation_duration;
  const telephony = asRecord(execution.telephony_data);
  if (typeof telephony.duration === "number") return telephony.duration;
  if (typeof telephony.duration === "string" && telephony.duration.trim()) return Number(telephony.duration);
  return null;
}

async function download(url: string, dest: string): Promise<boolean> {
  const authed = await fetch(url, { headers: { Authorization: `Bearer ${env.BOLNA_API_KEY}` } });
  const response = authed.ok ? authed : await fetch(url);
  if (!response.ok) {
    console.log(`recording failed ${response.status}`);
    return false;
  }
  await writeFile(dest, Buffer.from(await response.arrayBuffer()));
  return true;
}

const outDir = join(repoRoot, "apps/web/public/calls");
await mkdir(outDir, { recursive: true });

const exported = [];
for (const call of CALLS) {
  const execution = asRecord(await bolna("GET", `/executions/${call.executionId}`));
  const transcript = typeof execution.transcript === "string" ? execution.transcript : "";
  const turns = parseTranscript(transcript).map((turn) => ({
    speaker: turn.speaker === "persona" ? "caller" : "bot",
    text: turn.text,
    broke: turn.speaker === "target" && turn.text.includes(call.line),
  }));
  const telephony = asRecord(execution.telephony_data);
  const recordingUrl = typeof telephony.recording_url === "string" ? telephony.recording_url : "";
  const file = join(outDir, `${call.id}.mp3`);
  const saved = recordingUrl ? await download(recordingUrl, file) : false;
  console.log(`${call.who}: ${turns.length} turns, recording ${saved ? "saved" : "missing"}, seconds ${durationSeconds(execution) ?? "?"}`);
  exported.push({
    ...call,
    seconds: durationSeconds(execution),
    recording: saved ? `/calls/${call.id}.mp3` : null,
    turns,
  });
}

const file = join(repoRoot, "apps/web/lib/level1-calls.ts");
const body = `export type Level1Turn = { speaker: "caller" | "bot"; text: string; broke: boolean };

export type Level1Call = {
  id: "sharma" | "neha";
  who: string;
  role: string;
  executionId: string;
  line: string;
  sentence: string;
  prompt: string;
  costUsd: number;
  seconds: number | null;
  recording: string | null;
  turns: Level1Turn[];
};

export const LEVEL1_CALLS: Level1Call[] = ${JSON.stringify(exported, null, 2)};

export function level1Call(id: string | null | undefined): Level1Call {
  return LEVEL1_CALLS.find((call) => call.id === id) ?? LEVEL1_CALLS[0];
}
`;
await writeFile(file, body);
console.log("wrote", file);
