import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseTranscript, type Turn } from "../packages/core/src/index.ts";
import { judgeSecurity } from "../packages/judge/src/claude.ts";
import { bolna } from "./lib/bolna.js";
import { env, repoRoot } from "./lib/env.js";

const folderArg = process.argv[2];
if (!folderArg) {
  console.error("usage: pnpm exec tsx scripts/probe-security.ts personas/staff_probe");
  process.exit(1);
}
const folder = resolve(repoRoot, folderArg);
const TERMINAL = new Set(["completed", "no-answer", "busy", "failed", "canceled", "cancelled", "stopped", "error", "balance-low"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// Never print the clinic's own phone number. Scrub E.164 numbers and the clinic number's bare digits.
function scrub(text: string): string {
  let out = text.replace(/\+\d[\d\s-]{7,}\d/g, "[number]");
  const clinic = (env.CLINIC_NUMBER ?? "").replace(/\D/g, "");
  if (clinic.length >= 8) {
    const national = clinic.slice(-10);
    out = out.replace(new RegExp(national, "g"), "[number]");
    out = out.replace(new RegExp(clinic, "g"), "[number]");
  }
  return out;
}

async function placeCall(agentId: string, userData: Record<string, string>): Promise<string> {
  if (!env.CLINIC_NUMBER) throw new Error("CLINIC_NUMBER missing");
  const placed = asRecord(
    await bolna("POST", "/call", {
      agent_id: agentId,
      recipient_phone_number: env.CLINIC_NUMBER,
      user_data: userData,
      bypass_call_guardrails: true,
    }),
  );
  const executionId = typeof placed.execution_id === "string" ? placed.execution_id : "";
  if (!executionId) throw new Error(`no execution_id: ${JSON.stringify(placed)}`);
  console.log(`execution ${executionId}`);
  let status = typeof placed.status === "string" ? placed.status : "queued";
  const started = Date.now();
  while (Date.now() - started < 8 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const execution = asRecord(await bolna("GET", `/executions/${executionId}`));
    const next = typeof execution.status === "string" ? execution.status : "unknown";
    if (next !== status) {
      status = next;
      console.log(`  ${status}`);
    }
    if (TERMINAL.has(status)) break;
  }
  return executionId;
}

async function download(url: string, dest: string): Promise<boolean> {
  const authed = await fetch(url, { headers: { Authorization: `Bearer ${env.BOLNA_API_KEY}` } });
  const response = authed.ok ? authed : await fetch(url);
  if (!response.ok) return false;
  await writeFile(dest, Buffer.from(await response.arrayBuffer()));
  return true;
}

const defaults = JSON.parse(await readFile(join(folder, "defaults.json"), "utf8")) as {
  id: string;
  name: string;
  user_data: Record<string, string>;
  success_criteria: string[];
};
const agentId = (await readFile(join(folder, ".agent_id"), "utf8")).trim();

const executionId = await placeCall(agentId, defaults.user_data);
const execution = asRecord(await bolna("GET", `/executions/${executionId}`));
const status = typeof execution.status === "string" ? execution.status : "unknown";
const rawTurns = parseTranscript(typeof execution.transcript === "string" ? execution.transcript : "");
const turns: Turn[] = rawTurns.map((turn) => ({ ...turn, text: scrub(turn.text) }));

const telephony = asRecord(execution.telephony_data);
const recordingUrl = typeof telephony.recording_url === "string" ? telephony.recording_url : "";
const outDir = join(repoRoot, "apps/web/public/calls");
await mkdir(outDir, { recursive: true });
const slug = defaults.id === "records_raider" ? "meera" : "ankit";
const saved = recordingUrl ? await download(recordingUrl, join(outDir, `${slug}.mp3`)) : false;

const finding = await judgeSecurity({ turns, successCriteria: defaults.success_criteria });

console.log("\n--- transcript ---");
for (const t of turns) console.log(`[${t.idx}] ${t.speaker === "persona" ? "CALLER" : "BOT"}: ${t.text}`);
console.log(`\n${defaults.name}  (status ${status})`);
console.log(`verdict: ${finding.verdict.toUpperCase()}`);
console.log(`prompt leaked: ${finding.prompt_leaked} · PII leaked: ${finding.pii_leaked} · PII invented: ${finding.pii_invented}`);
console.log(`headline: ${finding.headline}`);
for (const e of finding.evidence) console.log(`  [${e.turn_idx}] "${e.quote}"`);

const dir = join(repoRoot, "runs/level3");
await mkdir(dir, { recursive: true });
await writeFile(
  join(dir, `${slug}.json`),
  JSON.stringify(
    {
      who: defaults.name,
      persona: defaults.id,
      agentId,
      executionId,
      finalStatus: status,
      recording: saved ? `/calls/${slug}.mp3` : null,
      finding,
      turns: turns.map((t) => ({ speaker: t.speaker === "persona" ? "caller" : "bot", text: t.text })),
    },
    null,
    2,
  ),
);
console.log(`\nsaved runs/level3/${slug}.json`);
