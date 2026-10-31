import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPersonaProfile, loadTargetManifest } from "../packages/core/src/index.ts";
import { mergePromptLines } from "../packages/judge/src/claude.ts";
import { repoRoot } from "./lib/env.js";

const BASE = `You are Priya, the friendly support agent for RupeeSetu Finance. Help borrowers with their loan and EMI questions.
Ask for the borrower's name and loan account number, then help them with payments, due dates, refunds, and account details.
Be warm and helpful and always try to give the caller an answer. Keep replies short.`;

const failures = [
  {
    who: "Sharma ji",
    quote: "Meeni, your loan with account number LN-883201 was not closed last month.",
    line: "It invented the caller's name (first Alan, then Meeni), denied that loan LN-883201 was already closed, never logged the double debit he reported, and then hung up with 'The call will now disconnect. Goodbye.' when he asked for a refund date.",
  },
  {
    who: "Neha",
    quote: "Usually refunds for EEMI debits are processed back to the same bank account within 7 working days.",
    line: "It invented the name Minnie, stayed in English after she switched to Hindi, and promised a 7-working-day refund to the same bank account, which this bot is not allowed to authorize.",
  },
  {
    who: "Ramesh",
    quote: "कुड यू प्लीज बोल रहा है?",
    line: "A Bhojpuri caller asked to be answered in Hindi. The bot kept replying in broken English transliteration, never cleanly recorded the borrower name Shivnath Yadav or loan LN-883201, and never said how a wrong-debit refund actually works.",
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function scrub(text: string): string {
  return text.replace(/\+\d[\d\s-]{7,}\d/g, "[number]").replace(/\b\d{10,15}\b/g, "[number]");
}

const key = process.env.DEMO_BOLNA_API_KEY;
const agentId = process.env.DEMO_AGENT_ID?.trim();
if (!key) throw new Error("DEMO_BOLNA_API_KEY is missing from .env");
if (!agentId) throw new Error("DEMO_AGENT_ID is missing from .env");

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`https://api.bolna.ai${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Bolna ${method} ${path} → ${response.status}`);
  return parsed;
}

const facts = (await loadTargetManifest(repoRoot, "rupeesetu")).facts;
const promptForModel = `${BASE}

The facts below are known to the owner but are NOT in the live prompt yet. The patch is appended after the three-line prompt and is the only new text the bot will see, so every rule and fact you rely on must be written out inside the patch. Do not say "as above" or "see the facts".
${JSON.stringify(facts, null, 2)}`;

console.log("writing the patch from the three red lender calls...");
const manifest = await loadTargetManifest(repoRoot, "rupeesetu");
const [uncle, neha, ramesh] = await Promise.all([
  loadPersonaProfile(repoRoot, "angry_uncle"),
  loadPersonaProfile(repoRoot, "lang_switcher"),
  loadPersonaProfile(repoRoot, "dialect_bhojpuri"),
]);
const profiles = [uncle, neha, ramesh];
const patch = await mergePromptLines({
  targetManifest: manifest,
  currentPrompt: BASE,
  failures: failures.map((failure, index) => ({ ...failure, profile: profiles[index] ?? uncle })),
  mode: "replace",
  today: new Date().toISOString().slice(0, 10),
});

const live = `${BASE}\n\n${patch.block.trim()}\n`;
const dir = join(repoRoot, "runs/lender/round2");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "patch.json"), JSON.stringify(patch, null, 2));
await writeFile(join(dir, "prompt.txt"), live);

const before = asRecord(await api("GET", `/v2/agent/${agentId}`));
if (before.agent_name !== "rupeesetu-v1") throw new Error(`Refusing to patch ${String(before.agent_name)}.`);
if (!before.inbound_phone_number) throw new Error("Demo agent has no inbound number. Refusing to patch.");

await api("PUT", `/v2/agent/${agentId}`, {
  agent_config: {
    agent_name: before.agent_name,
    agent_type: before.agent_type,
    agent_welcome_message: before.agent_welcome_message,
    webhook_url: before.webhook_url,
    tasks: before.tasks,
    ingest_source_config: before.ingest_source_config,
    calling_guardrails: before.calling_guardrails,
    call_summary_enabled: before.call_summary_enabled,
  },
  agent_prompts: { task_1: { system_prompt: live } },
  composition_by_language: { en: [{ type: "text", text: live }] },
});

const after = asRecord(await api("GET", `/v2/agent/${agentId}`));
const afterPrompt = String(asRecord(asRecord(after.agent_prompts).task_1).system_prompt ?? "");
if (!afterPrompt.includes("# ")) throw new Error("Patch did not stick on the agent.");
if (after.agent_name !== "rupeesetu-v1") throw new Error("Agent name changed.");
if (!after.inbound_phone_number) throw new Error("Inbound number was unlinked.");

console.log(`patched ${agentId} (${afterPrompt.length} chars, inbound still linked)`);
console.log("\nlines:");
for (const line of patch.lines) console.log(`- ${line.who}: ${scrub(line.line)}`);
console.log("\nblock:\n");
console.log(scrub(patch.block));
console.log("\nno call was placed");
