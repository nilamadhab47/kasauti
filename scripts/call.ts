import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { callerBrief, loadPersonaProfile, loadTargetManifest } from "../packages/core/src/index.ts";
import { CATEGORY_IDS, CATEGORY_AGENT, type CategoryId } from "../apps/web/lib/caller-packs.ts";
import { bolna } from "./lib/bolna.js";
import { env, repoRoot } from "./lib/env.js";

const TERMINAL = new Set(["completed", "no-answer", "busy", "failed", "canceled", "cancelled", "stopped", "error", "balance-low"]);
const TIMEOUT_MS = 8 * 60 * 1000;

const args = parseArgs(process.argv.slice(2));
const to = args.to;
if (!to) {
  console.error("usage: pnpm call -- --to +91XXXXXXXXXX [--persona <folder>] [--category clinic|lender|restaurant|clothing|property] [--agent <id>] [--label <text>]");
  process.exit(1);
}
if (!env.ALLOWED_NUMBERS.includes(to)) {
  console.error("Refusing to dial a number that is not in ALLOWED_NUMBERS.");
  process.exit(1);
}

const persona = args.persona ?? "personas/angry_uncle";
const personaId = persona.split("/").filter(Boolean).pop() ?? "";
const category = args.category ?? "clinic";
if (!(CATEGORY_IDS as readonly string[]).includes(category)) {
  console.error(`Unknown category "${category}". Known: ${CATEGORY_IDS.join(", ")}`);
  process.exit(1);
}
const slug = CATEGORY_AGENT[category as CategoryId];
const profile = await loadPersonaProfile(repoRoot, personaId);
const manifest = await loadTargetManifest(repoRoot, slug);
const brief = callerBrief(profile, manifest);
const agentFile = await readFile(join(repoRoot, persona, ".agent_id"), "utf8").catch(() => "");
const agentId = args.agent ?? (agentFile.trim() || env.PERSONA_AGENT_ID);
if (!agentId) {
  console.error("No agent id. Pass --agent, add .agent_id, or set PERSONA_AGENT_ID.");
  process.exit(1);
}

const placed = await bolna("POST", "/call", {
  agent_id: agentId,
  recipient_phone_number: to,
  user_data: brief.user_data,
  bypass_call_guardrails: true,
});
const placedRecord = asRecord(placed);
const executionId = stringField(placedRecord, "execution_id");
if (!executionId) {
  console.error(JSON.stringify(placed, null, 2));
  process.exit(1);
}
console.log("execution_id:", executionId);
console.log(`category: ${category} · ${manifest.display_name}`);
console.log("CALLER = the persona. The other side is the agent under test.");

const started = Date.now();
let lastStatus = stringField(placedRecord, "status") ?? "queued";
let seenTranscript = "";
console.log(`${stamp()} ${lastStatus}`);
let finalStatus = lastStatus;

while (Date.now() - started < TIMEOUT_MS) {
  await sleep(5000);
  const execution = asRecord(await bolna("GET", `/executions/${executionId}`));
  const status = stringField(execution, "status") ?? "unknown";
  if (status !== lastStatus) {
    console.log(`${stamp()} ${status}`);
    lastStatus = status;
  }
  emitTranscript(stringField(execution, "transcript") ?? "");
  if (TERMINAL.has(status)) {
    finalStatus = status;
    break;
  }
}

if (!TERMINAL.has(finalStatus)) {
  console.error(`Timed out after 8 minutes. Last status: ${lastStatus}`);
  finalStatus = lastStatus;
}

const dir = join(repoRoot, "runs/phase0");
await mkdir(dir, { recursive: true });
const line = JSON.stringify({
  ts: new Date().toISOString(),
  label: args.label ?? "phase0",
  persona: defaults.id ?? persona,
  to,
  agent_id: agentId,
  execution_id: executionId,
  final_status: finalStatus,
});
await appendFile(join(dir, "calls.jsonl"), `${line}\n`);
console.log(line);

function parseArgs(argv: string[]): { to?: string; agent?: string; label?: string; persona?: string; category?: string } {
  const out: { to?: string; agent?: string; label?: string; persona?: string; category?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--to") out.to = value;
    if (key === "--agent") out.agent = value;
    if (key === "--label") out.label = value;
    if (key === "--persona") out.persona = value;
    if (key === "--category") out.category = value;
    if (key === "--to" || key === "--agent" || key === "--label" || key === "--persona" || key === "--category") i += 1;
  }
  return out;
}

function stamp(): string {
  return new Date().toISOString();
}

function emitTranscript(transcript: string): void {
  if (!transcript || transcript === seenTranscript) return;
  const fresh = transcript.startsWith(seenTranscript) ? transcript.slice(seenTranscript.length) : transcript;
  seenTranscript = transcript;
  const labeled = fresh
    .replace(/(^|\n)assistant:\s?/g, "$1CALLER: ")
    .replace(/(^|\n)user:\s?/g, "$1CLINIC: ");
  process.stdout.write(labeled.endsWith("\n") ? labeled : `${labeled}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}
