import { bolna } from "./lib/bolna.js";

// Flip the live clinic agent between demo profiles.
//   v1    = the deliberately fragile target (no facts, English-only ear, 6s hangup).
//   fixed = the Level-1 converged config (Sarvam auto-detect ear, 20s hangup, real facts).
const CLINIC_AGENT_ID = "8051e99b-8822-4bf5-b6df-d6ff597bf2da";
const profile = (process.argv[2] ?? "v1").toLowerCase();

const V1_PROMPT = `You are Riya, the friendly receptionist for Sehat Clinic in Bengaluru. Help callers book doctor appointments.
Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking.
Be warm and helpful and always try to give the caller an answer. Keep replies short.`;

const PROFILES: Record<string, { prompt: string; settings: Record<string, unknown>; transcriber: Record<string, unknown> }> = {
  v1: {
    prompt: V1_PROMPT,
    settings: { hangup_after_silence: 6, number_of_words_for_interruption: 4 },
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
  },
};

const chosen = PROFILES[profile];
if (!chosen) {
  console.error(`unknown profile "${profile}". known: ${Object.keys(PROFILES).join(", ")}`);
  process.exit(1);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const agent = asRecord(await bolna("GET", `/v2/agent/${CLINIC_AGENT_ID}`));
const tasks = agent.tasks as Record<string, unknown>[];
const task = asRecord(tasks[0]);
task.task_config = { ...asRecord(task.task_config), ...chosen.settings };
const tools = asRecord(task.tools_config);
tools.transcriber = { ...asRecord(tools.transcriber), ...chosen.transcriber };
task.tools_config = tools;

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
  agent_prompts: { task_1: { system_prompt: chosen.prompt } },
  composition_by_language: { en: [{ type: "text", text: chosen.prompt }] },
});

const check = asRecord(await bolna("GET", `/v2/agent/${CLINIC_AGENT_ID}`));
const checkTask = asRecord((check.tasks as unknown[])[0]);
const silence = asRecord(checkTask.task_config).hangup_after_silence;
const stt = asRecord(asRecord(checkTask.tools_config).transcriber).provider;
console.log(`clinic set to "${profile}": hangup_after_silence ${silence}, transcriber ${stt}, prompt ${chosen.prompt.length} chars`);
