import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { callerBrief, loadFileContentStore, loadPersonaProfile, loadTargetManifest } from "../packages/core/src/index.ts";
import { PERSONA_IDS, type PersonaId } from "../apps/web/lib/caller-packs.ts";
import { repoRoot } from "./lib/env.ts";

const only = process.argv[2];
if (!only || !PERSONA_IDS.includes(only as PersonaId)) {
  console.error("Name one caller. Example: angry_uncle");
  process.exit(1);
}
const persona = only as PersonaId;

const key = process.env.BOLNA_API_KEY;
if (!key) throw new Error("BOLNA_API_KEY is missing from .env");

const FOLDERS: Record<PersonaId, string> = {
  angry_uncle: "angry_uncle",
  lang_switcher: "lang_switcher",
  dialect_bhojpuri: "dialect_bhojpuri",
  staff_probe: "staff_probe",
  records_raider: "records_raider",
  rohit: "rohit",
};

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

async function promptFor(persona: PersonaId): Promise<string> {
  const prompt = `${(await readFile(join(repoRoot, "personas", FOLDERS[persona], "prompt.md"), "utf8")).trim()}\n`;
  const names = new Set([...prompt.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]));
  const profile = await loadPersonaProfile(repoRoot, persona);
  const desks = (await loadFileContentStore(repoRoot)).listCategories();
  for (const category of await desks) {
    const slug = category.id;
    const lines = callerBrief(profile, await loadTargetManifest(repoRoot, slug)).user_data;
    for (const name of names) {
      const value = lines[name as keyof typeof lines];
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${slug} ${persona} has no value for {{${name}}}`);
      }
    }
  }
  return prompt;
}

const folder = join(repoRoot, "personas", FOLDERS[persona]);
const prompt = await promptFor(persona);
const agentId = (await readFile(join(folder, ".agent_id"), "utf8").catch(() => "")).trim();
if (!agentId) {
  console.error("This caller has no agent. Nothing was changed.");
  process.exit(1);
}

const current = asRecord(await api("GET", `/v2/agent/${agentId}`));
await api("PUT", `/v2/agent/${agentId}`, {
  agent_config: {
    agent_name: current.agent_name,
    agent_type: current.agent_type,
    agent_welcome_message: current.agent_welcome_message,
    webhook_url: current.webhook_url,
    tasks: current.tasks,
    ingest_source_config: current.ingest_source_config,
    calling_guardrails: current.calling_guardrails,
    call_summary_enabled: current.call_summary_enabled,
  },
  agent_prompts: { task_1: { system_prompt: prompt } },
});

const saved = asRecord(await api("GET", `/v2/agent/${agentId}`));
const savedPrompt = String(asRecord(asRecord(saved.agent_prompts).task_1).system_prompt ?? "");
if (!savedPrompt.includes("{{welcome}}") || !savedPrompt.includes("{{target_name}}") || !savedPrompt.includes("{{close_rule}}")) {
  throw new Error(`${persona} prompt did not keep its placeholders`);
}
if (savedPrompt.includes("T2410UPI88231") || savedPrompt.includes("LN-883201")) {
  throw new Error(`${persona} prompt still has a baked handle`);
}
console.log(`updated ${persona}`);

console.log("no call was placed");
