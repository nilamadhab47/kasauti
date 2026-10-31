import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "./lib/env.js";

const AGENT_ID = "64e25913-daf6-4920-82b8-6d620a44df68";
const PROMPT = `You are Priya, the friendly support agent for RupeeSetu Finance. Help borrowers with their loan and EMI questions.
Ask for the borrower's name and loan account number, then help them with payments, due dates, refunds, and account details.
Be warm and helpful and always try to give the caller an answer. Keep replies short.`;
const WELCOME = "Hello, RupeeSetu Finance, this is Priya. How can I help you?";

const key = process.env.DEMO_BOLNA_API_KEY;
if (!key) throw new Error("DEMO_BOLNA_API_KEY is missing from .env");

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function scrub(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\+\d{8,15}/g, "[number]");
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrub(v);
    return out;
  }
  return value;
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`https://api.bolna.ai${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    console.error(`Bolna ${method} ${path} → ${response.status}`);
    console.error(JSON.stringify(scrub(parsed), null, 2).slice(0, 800));
    process.exit(1);
  }
  return parsed;
}

const before = asRecord(await api("GET", `/v2/agent/${AGENT_ID}`));
const beforeName = String(before.agent_name ?? "");
const beforePrompt = String(asRecord(asRecord(before.agent_prompts).task_1).system_prompt ?? "");
if (!beforeName.includes("sehat") && !beforePrompt.includes("Sehat Clinic") && !beforePrompt.includes("RupeeSetu")) {
  throw new Error(`Refusing to retarget agent "${beforeName}". It is not the Sehat clinic demo target.`);
}

const dir = join(repoRoot, "runs/phase0");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "sehat-before-retarget.json"), JSON.stringify(scrub(before), null, 2));

const tasks = before.tasks as Record<string, unknown>[];
const task = asRecord(tasks[0]);
task.task_config = {
  ...asRecord(task.task_config),
  hangup_after_silence: 6,
  number_of_words_for_interruption: 4,
  call_terminate: 180,
  backchanneling: false,
};
const tools = asRecord(task.tools_config);
tools.transcriber = { ...asRecord(tools.transcriber), provider: "deepgram", model: "nova-3", language: "en" };
task.tools_config = tools;

await api("PUT", `/v2/agent/${AGENT_ID}`, {
  agent_config: {
    agent_name: "rupeesetu-v1",
    agent_type: before.agent_type,
    agent_welcome_message: WELCOME,
    webhook_url: before.webhook_url,
    tasks,
    ingest_source_config: before.ingest_source_config,
    calling_guardrails: before.calling_guardrails,
    call_summary_enabled: before.call_summary_enabled,
  },
  agent_prompts: { task_1: { system_prompt: PROMPT } },
  composition_by_language: { en: [{ type: "text", text: PROMPT }] },
});

const after = asRecord(await api("GET", `/v2/agent/${AGENT_ID}`));
const afterPrompt = String(asRecord(asRecord(after.agent_prompts).task_1).system_prompt ?? "");
const afterTask = asRecord((after.tasks as unknown[])[0]);
const afterTools = asRecord(afterTask.tools_config);
const transcriber = asRecord(afterTools.transcriber);
const synthesizer = asRecord(afterTools.synthesizer);
const hangup = asRecord(afterTask.task_config).hangup_after_silence;
const linked = Boolean(after.inbound_phone_number);
if (!afterPrompt.startsWith("You are Priya")) throw new Error("Prompt did not stick");
if (after.agent_welcome_message !== WELCOME) throw new Error("Welcome did not stick");
if (transcriber.provider !== "deepgram" || hangup !== 6) throw new Error("Fragile settings did not stick");

console.log(`retargeted ${AGENT_ID}`);
console.log(`name: ${String(before.agent_name)} → ${String(after.agent_name)}`);
console.log(`welcome: ${String(after.agent_welcome_message)}`);
console.log(`prompt: ${afterPrompt.split("\n")[0]}`);
console.log(`transcriber: ${String(transcriber.provider)} ${String(transcriber.model)} ${String(transcriber.language)}`);
console.log(`voice: ${String(synthesizer.provider)}`);
console.log(`hangup_after_silence: ${String(hangup)}`);
console.log(`inbound number still linked: ${linked ? "yes" : "no"}`);
console.log("no call was placed");
