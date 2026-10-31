import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AGENT_BRIEFS, type TestAgent } from "../apps/web/lib/agent-briefs.ts";
import { repoRoot } from "./lib/env.ts";

const key = process.env.DEMO_BOLNA_API_KEY;
const sourceId = process.env.DEMO_AGENT_ID?.trim();
if (!key) throw new Error("DEMO_BOLNA_API_KEY is missing from .env");
if (!sourceId) throw new Error("DEMO_AGENT_ID is missing from .env");

const TARGETS: { id: TestAgent; bolnaName: string }[] = [
  { id: "sehat", bolnaName: "sehat-v1" },
  { id: "swaad", bolnaName: "swaad-v1" },
  { id: "nila", bolnaName: "nila-v1" },
  { id: "nivas", bolnaName: "nivas-v1" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function scrub(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\+\d{8,15}/g, "[number]").replace(/bn-[A-Za-z0-9._-]+/g, "[key]");
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [name, item] of Object.entries(value as Record<string, unknown>)) out[name] = scrub(item);
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

const listed = (await api("GET", "/v2/agent/all")) as { id?: string; agent_name?: string }[];
const byName = new Map(listed.map((item) => [item.agent_name, item.id]));
const source = asRecord(await api("GET", `/v2/agent/${sourceId}`));
if (source.agent_name !== "rupeesetu-v1") {
  throw new Error(`Refusing to clone "${String(source.agent_name)}". Expected rupeesetu-v1.`);
}

const created: { id: TestAgent; bolnaName: string; agentId: string }[] = [];

for (const target of TARGETS) {
  const existing = byName.get(target.bolnaName);
  if (existing) {
    console.log(`${target.bolnaName} already on the account`);
    created.push({ ...target, agentId: existing });
    continue;
  }
  const brief = AGENT_BRIEFS[target.id];
  const tasks = JSON.parse(JSON.stringify(source.tasks)) as Record<string, unknown>[];
  const task = asRecord(tasks[0]);
  task.task_config = {
    ...asRecord(task.task_config),
    hangup_after_silence: 6,
    number_of_words_for_interruption: 4,
    call_terminate: 180,
    backchanneling: false,
  };
  const response = asRecord(
    await api("POST", "/v2/agent", {
      agent_config: {
        agent_name: target.bolnaName,
        agent_type: source.agent_type,
        agent_welcome_message: brief.welcome,
        webhook_url: source.webhook_url,
        tasks,
        ingest_source_config: source.ingest_source_config,
        calling_guardrails: source.calling_guardrails,
        call_summary_enabled: source.call_summary_enabled,
      },
      agent_prompts: { task_1: { system_prompt: brief.prompt } },
      composition_by_language: { en: [{ type: "text", text: brief.prompt }] },
    }),
  );
  const agentId = typeof response.agent_id === "string" ? response.agent_id : "";
  if (!agentId) throw new Error(`${target.bolnaName} was created without an agent id`);
  created.push({ ...target, agentId });
  console.log(`created ${target.bolnaName}`);
}

for (const item of created) {
  const brief = AGENT_BRIEFS[item.id];
  const agent = asRecord(await api("GET", `/v2/agent/${item.agentId}`));
  const prompt = String(asRecord(asRecord(agent.agent_prompts).task_1).system_prompt ?? "");
  const task = asRecord((agent.tasks as unknown[])[0]);
  const tools = asRecord(task.tools_config);
  const transcriber = asRecord(tools.transcriber);
  const voice = asRecord(asRecord(tools.synthesizer).provider_config);
  const silence = asRecord(task.task_config).hangup_after_silence;
  if (agent.agent_name !== item.bolnaName) throw new Error(`${item.bolnaName} name did not stick`);
  if (agent.agent_welcome_message !== brief.welcome) throw new Error(`${item.bolnaName} welcome did not stick`);
  if (!prompt.startsWith(brief.prompt.slice(0, 24))) throw new Error(`${item.bolnaName} prompt did not stick`);
  if (transcriber.provider !== "deepgram" || silence !== 6) throw new Error(`${item.bolnaName} call settings did not stick`);
  if (agent.inbound_phone_number) throw new Error(`${item.bolnaName} was linked to the inbound number`);
  console.log(`${item.bolnaName} ${item.agentId}`);
  console.log(`  welcome: ${String(agent.agent_welcome_message)}`);
  console.log(`  voice: ${String(tools.synthesizer && asRecord(tools.synthesizer).provider)} ${String(voice.voice ?? "")}`);
  console.log(`  inbound linked: no`);
}

const outPath = join(repoRoot, "runs/category-agents.json");
await writeFile(outPath, `${JSON.stringify({ account: "agents", created }, null, 2)}\n`);

const envPath = join(repoRoot, ".env");
const envText = await readFile(envPath, "utf8");
const lines = ["", "# Category agents on the agents account. No inbound number is attached."];
for (const item of created) {
  const envKey = `${item.id.toUpperCase()}_AGENT_ID`;
  if (!new RegExp(`^${envKey}=`, "m").test(envText)) lines.push(`${envKey}=${item.agentId}`);
}
if (lines.length > 2) await writeFile(envPath, `${envText.replace(/\n?$/, "\n")}${lines.join("\n")}\n`);

const rupee = asRecord(await api("GET", `/v2/agent/${sourceId}`));
const rupeePrompt = String(asRecord(asRecord(rupee.agent_prompts).task_1).system_prompt ?? "");
if (rupee.agent_name !== "rupeesetu-v1" || !rupeePrompt.startsWith("You are Priya")) {
  throw new Error("rupeesetu-v1 changed while Sehat was created");
}
if (!rupee.inbound_phone_number) throw new Error("The inbound number is no longer on rupeesetu-v1");

console.log("no call was placed");
console.log("rupeesetu-v1 unchanged, inbound number still linked");
