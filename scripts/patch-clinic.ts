import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bolna } from "./lib/bolna.js";
import { repoRoot } from "./lib/env.js";

const CLINIC_AGENT_ID = "8051e99b-8822-4bf5-b6df-d6ff597bf2da";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const summary = JSON.parse(await readFile(join(repoRoot, "runs/level1/summary.json"), "utf8")) as {
  patch?: { block?: string };
};
const block = summary.patch?.block?.trim();
if (!block) throw new Error("runs/level1/summary.json has no patch block");

const agent = asRecord(await bolna("GET", `/v2/agent/${CLINIC_AGENT_ID}`));
const prompts = asRecord(agent.agent_prompts);
const task1 = asRecord(prompts.task_1);
const current = typeof task1.system_prompt === "string" ? task1.system_prompt : "";
if (!current.includes("You are Riya")) throw new Error("Clinic prompt is not Riya's. Refusing to patch.");

const already = current.includes("callback from the clinic manager") && current.includes("use only the corrected version");
const marker = "\n# Conversation Starter";
const next = already
  ? current
  : current.includes(marker)
    ? current.replace(marker, `\n\n${block}\n${marker}`)
    : `${current.trim()}\n\n${block}\n`;

if (!already) {
  const tasks = agent.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error("Clinic agent has no tasks");
  await bolna("PUT", `/v2/agent/${CLINIC_AGENT_ID}`, {
    agent_config: {
      agent_name: agent.agent_name,
      agent_type: agent.agent_type,
      agent_welcome_message: agent.agent_welcome_message,
      webhook_url: agent.webhook_url,
      tasks,
      ingest_source_config: agent.ingest_source_config,
      calling_guardrails: agent.calling_guardrails,
      call_summary_enabled: agent.call_summary_enabled,
    },
    agent_prompts: { task_1: { system_prompt: next } },
    composition_by_language: { en: [{ type: "text", text: next }] },
  });
}

const checked = asRecord(await bolna("GET", `/v2/agent/${CLINIC_AGENT_ID}`));
const checkedPrompt = asRecord(asRecord(checked.agent_prompts).task_1).system_prompt;
const prompt = typeof checkedPrompt === "string" ? checkedPrompt : "";
const task = asRecord((checked.tasks as unknown[])?.[0]);
const tools = asRecord(task.tools_config);
const transcriber = asRecord(tools.transcriber).provider;
const synthesizer = asRecord(tools.synthesizer).provider;
const hangup = asRecord(task.task_config).hangup_after_silence;
if (!prompt.includes("callback from the clinic manager") || !prompt.includes("use only the corrected version")) {
  throw new Error("Patch did not stick on the clinic prompt");
}
if (transcriber !== "deepgram" || synthesizer !== "elevenlabs" || hangup !== 6) {
  throw new Error(`Clinic settings moved: transcriber ${String(transcriber)}, voice ${String(synthesizer)}, hangup ${String(hangup)}`);
}

await writeFile(join(repoRoot, "runs/level1/clinic-prompt.txt"), prompt);
console.log(already ? "patch already on Riya" : "patched Riya");
console.log(`prompt chars ${prompt.length}; transcriber ${transcriber}; voice ${synthesizer}; hangup ${hangup}`);
