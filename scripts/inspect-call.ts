import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { bolna } from "./lib/bolna.js";
import { env, repoRoot } from "./lib/env.js";

const execFileAsync = promisify(execFile);
const executionId = process.argv[2];
if (!executionId) {
  console.error("usage: pnpm inspect -- <execution_id>");
  process.exit(1);
}

const execution = asRecord(await bolna("GET", `/executions/${executionId}`));
const dir = join(repoRoot, "runs/phase0", executionId);
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "execution.json"), JSON.stringify(execution, null, 2));

const telephony = asRecord(execution.telephony_data);
const latency = asRecord(execution.latency_data);
console.log("status:", execution.status ?? "");
console.log("duration:", execution.conversation_duration ?? telephony.duration ?? execution.duration ?? "");
console.log("hangup_by:", telephony.hangup_by ?? execution.hangup_by ?? "");
console.log("hangup_reason:", telephony.hangup_reason ?? execution.hangup_reason ?? "");
console.log("cost:", JSON.stringify(execution.cost_breakdown ?? null, null, 2));
console.log("time_to_first_audio:", latency.time_to_first_audio ?? "");

const transcript = typeof execution.transcript === "string" ? execution.transcript : "";
printTurns(transcript, "persona");

const recordingUrl = typeof telephony.recording_url === "string" ? telephony.recording_url : "";
if (recordingUrl) {
  await downloadRecording(recordingUrl, dir);
} else {
  console.log("recording: no recording_url");
}

if (env.CLINIC_AGENT_ID) {
  await printTargetExecution(execution, dir);
}

function printTurns(text: string, side: "persona" | "target"): void {
  const turns = parseTurns(text);
  let persona = 0;
  let target = 0;
  let run = 0;
  let maxRun = 0;
  let previous = "";
  turns.forEach((turn, index) => {
    const label = labelFor(turn.speaker, side);
    if (label === "UNCLE") persona += 1;
    else target += 1;
    if (turn.speaker === previous) run += 1;
    else run = 1;
    previous = turn.speaker;
    maxRun = Math.max(maxRun, run);
    console.log(`[${String(index).padStart(2, "0")}] ${label.padEnd(6)}: ${turn.text}`);
  });
  console.log(`turns uncle/clinic: ${persona}/${target}`);
  console.log(`longest same-speaker run: ${maxRun}`);
}

function labelFor(speaker: string, side: "persona" | "target"): string {
  const assistantIsUncle = side === "persona";
  if (speaker === "assistant") return assistantIsUncle ? "UNCLE" : "CLINIC";
  return assistantIsUncle ? "CLINIC" : "UNCLE";
}

function parseTurns(text: string): { speaker: string; text: string }[] {
  const turns: { speaker: string; text: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^(assistant|user):\s?(.*)$/i.exec(line);
    if (match?.[1] && match[2] !== undefined) {
      turns.push({ speaker: match[1].toLowerCase(), text: match[2] });
    } else if (turns.length > 0) {
      const current = turns[turns.length - 1];
      if (current) current.text = `${current.text}\n${line}`;
    }
  }
  return turns;
}

async function downloadRecording(url: string, destDir: string): Promise<void> {
  const authed = await fetch(url, { headers: { Authorization: `Bearer ${env.BOLNA_API_KEY}` } });
  const response = authed.ok ? authed : await fetch(url);
  const mode = authed.ok ? "bearer" : response.ok ? "no auth" : "";
  if (!response.ok) {
    console.log(`recording download failed: bearer ${authed.status}, open ${response.status}`);
    return;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const ext = extensionFor(response.headers.get("content-type"), url);
  const file = join(destDir, `recording.${ext}`);
  await writeFile(file, bytes);
  console.log(`recording: ${file} (${mode})`);
  await probe(file);
}

function extensionFor(contentType: string | null, url: string): string {
  if (contentType?.includes("mpeg")) return "mp3";
  if (contentType?.includes("wav")) return "wav";
  if (contentType?.includes("ogg")) return "ogg";
  const match = /\.(mp3|wav|ogg|m4a)(?:\?|$)/i.exec(url);
  return match?.[1]?.toLowerCase() ?? "audio";
}

async function probe(file: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=channels,sample_rate",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1",
      file,
    ]);
    console.log(stdout.trim());
  } catch {
    console.log("ffprobe: not installed, skipped channel/sample-rate check");
  }
}

async function printTargetExecution(persona: Record<string, unknown>, destDir: string): Promise<void> {
  const path = `/v2/agent/${env.CLINIC_AGENT_ID}/executions`;
  const response = await fetch(`${env.BOLNA_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${env.BOLNA_API_KEY}`, "Content-Type": "application/json" },
  });
  const text = await response.text();
  if (!response.ok) {
    console.log(`target executions ${path} → ${response.status} (endpoint unverified)`);
    console.log(text.slice(0, 500));
    return;
  }
  const payload = JSON.parse(text) as unknown;
  const list = Array.isArray(payload)
    ? payload.map(asRecord)
    : itemsOf(payload).map(asRecord);
  const personaStart = timeOf(persona);
  const match = list.find((item) => {
    const start = timeOf(item);
    return personaStart !== null && start !== null && Math.abs(start - personaStart) <= 2 * 60 * 1000;
  });
  if (!match) {
    console.log("target execution: none within 2 minutes");
    return;
  }
  await writeFile(join(destDir, "target-execution.json"), JSON.stringify(match, null, 2));
  const targetTranscript = typeof match.transcript === "string" ? match.transcript : "";
  console.log("\ntarget transcript (what the clinic heard):");
  printTurns(targetTranscript, "target");
}

function itemsOf(payload: unknown): unknown[] {
  const record = asRecord(payload);
  for (const key of ["items", "data", "executions", "results"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function timeOf(record: Record<string, unknown>): number | null {
  for (const key of ["created_at", "started_at", "start_time", "updated_at"]) {
    const value = record[key];
    if (typeof value === "string") {
      const time = Date.parse(value);
      if (!Number.isNaN(time)) return time;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
