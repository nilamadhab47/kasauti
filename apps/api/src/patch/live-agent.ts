/**
 * The two fields a patch needs from a Bolna agent payload: the live system prompt
 * and the transcriber language. No network call lives here.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function tasksOf(agent: Record<string, unknown>): unknown[] {
  if (Array.isArray(agent.tasks)) return agent.tasks;
  const config = asRecord(agent.agent_config);
  return Array.isArray(config.tasks) ? config.tasks : [];
}

export type LiveAgent = {
  systemPrompt: string;
  transcriberLanguage: string | null;
};

/**
 * Flip `en` to the manifest language when language scored under 3, or when the caller
 * spoke Hindi and that score is missing. Every other transcriber field stays as it was.
 * A missing task list is returned untouched.
 */
export function withTranscriberLanguage(
  tasks: unknown,
  input: { languageSwitchBelow3: boolean; heardHindi: boolean; nextLanguage: string },
): { tasks: unknown; flipped: boolean; from: string | null; to: string | null } {
  if (!Array.isArray(tasks) || tasks.length === 0) return { tasks, flipped: false, from: null, to: null };
  const task = asRecord(tasks[0]);
  const transcriber = asRecord(asRecord(task.tools_config).transcriber);
  const from = typeof transcriber.language === "string" && transcriber.language.trim() ? transcriber.language.trim() : null;
  const next = input.nextLanguage.trim();
  const flipped = (input.languageSwitchBelow3 || input.heardHindi) && from === "en" && next.length > 0 && next !== "en";
  if (!flipped) return { tasks, flipped: false, from, to: from };
  const copy = structuredClone(tasks) as unknown[];
  const copiedTask = asRecord(copy[0]);
  const copiedTools = asRecord(copiedTask.tools_config);
  copiedTools.transcriber = { ...asRecord(copiedTools.transcriber), language: next };
  copiedTask.tools_config = copiedTools;
  copy[0] = copiedTask;
  return { tasks: copy, flipped: true, from, to: next };
}

/**
 * Bolna rejects `multi` on Deepgram nova-3. Hindi is the language that model will accept
 * for a caller who spoke Hindi into an English ear.
 */
export function bolnaLanguage(requested: string, tasks: unknown): string {
  const next = requested.trim();
  const task = asRecord(Array.isArray(tasks) ? tasks[0] : undefined);
  const model = asRecord(asRecord(task.tools_config).transcriber).model;
  if (next === "multi" && typeof model === "string" && model.includes("nova-3")) return "hi";
  return next;
}

function seconds(value: unknown) {
  return typeof value === "number" ? `${value} seconds` : "—";
}

function words(value: unknown) {
  return typeof value === "number" ? `${value} words` : "—";
}

function onOff(value: unknown) {
  if (value === true) return "On";
  if (value === false) return "Off";
  return "—";
}

/** The four engine numbers the agent card shows. Missing fields stay blank rather than inventing the first draft. */
export function liveSettingsOf(agent: unknown): { label: string; value: string }[] {
  const tasks = tasksOf(asRecord(agent));
  const config = asRecord(asRecord(tasks[0]).task_config);
  return [
    { label: "Hang up after silence", value: seconds(config.hangup_after_silence) },
    { label: "Interruption", value: words(config.number_of_words_for_interruption) },
    { label: "Backchanneling", value: onOff(config.backchanneling) },
    { label: "Call ends at", value: seconds(config.call_terminate) },
  ];
}

/** A 6 second silence cuts off a slow caller and plays the disconnect line. Give them 20. */
export function withLongerSilence(tasks: unknown, floor = 20): { tasks: unknown; changed: boolean } {
  if (!Array.isArray(tasks) || tasks.length === 0) return { tasks, changed: false };
  const config = asRecord(asRecord(tasks[0]).task_config);
  const current = typeof config.hangup_after_silence === "number" ? config.hangup_after_silence : 0;
  if (current >= floor) return { tasks, changed: false };
  const copy = structuredClone(tasks) as unknown[];
  const copied = asRecord(copy[0]);
  copied.task_config = { ...asRecord(copied.task_config), hangup_after_silence: floor };
  copy[0] = copied;
  return { tasks: copy, changed: true };
}

/** The close that survived the Nila ear. It is spoken as written, with no English in front of it. */
export const HINDI_CLOSE = "मैं यह यहाँ नहीं देख सकती। हमारी टीम चौबीस घंटे में कॉल करेगी।";

const SPOKEN_DESK = /order desk|raise a ticket|will call within \d+|callback within \d+ hours/i;
const ENGLISH_CLOSE = new Set([
  "Acknowledge the request in the caller's words, name the desk, and promise the time window.",
  "Raise the ticket in the same turn the caller reports the issue.",
]);

/**
 * On a Hindi call, the escalation close is one Devanagari sentence.
 * English lines that name a desk or promise a callback are removed so the ear cannot turn them into a person.
 */
export function withHindiClose(block: string): string {
  const trimmed = block.trim();
  if (!trimmed) return HINDI_CLOSE;
  const lines = trimmed.split("\n");
  const last = lines[lines.length - 1]?.trim() ?? "";
  const footer = /^-- maintained by Kasauti, last reviewed \d{4}-\d{2}-\d{2} --$/.test(last) ? last : "";
  const body = footer ? lines.slice(0, -1) : lines;
  const kept = body.filter((line) => {
    const text = line.trim();
    if (!text) return false;
    if (ENGLISH_CLOSE.has(text)) return false;
    if (SPOKEN_DESK.test(text)) return false;
    return true;
  });
  if (!kept.some((line) => line.includes(HINDI_CLOSE))) {
    kept.push(`If you cannot do it on this call, say this and nothing in English before it: ${HINDI_CLOSE}`);
  }
  const next = kept.join("\n").trimEnd();
  return footer ? `${next}\n\n${footer}` : next;
}

/** The model must not hang up. The caller ends the call once the desk has done its part. */
export function withoutModelHangup(tasks: unknown): { tasks: unknown; changed: boolean } {
  if (!Array.isArray(tasks) || tasks.length === 0) return { tasks, changed: false };
  const config = asRecord(asRecord(tasks[0]).task_config);
  if (config.hangup_after_LLMCall === false) return { tasks, changed: false };
  const copy = structuredClone(tasks) as unknown[];
  const copied = asRecord(copy[0]);
  copied.task_config = { ...asRecord(copied.task_config), hangup_after_LLMCall: false };
  copy[0] = copied;
  return { tasks: copy, changed: true };
}

export type LiveCard = {
  name: string;
  welcome: string;
  prompt: string;
  transcriber: string;
  model: string;
  voice: string;
};

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function joined(parts: (string | null)[]): string {
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length > 0 ? kept.join(" · ") : "—";
}

/** Name, welcome, prompt, and the three engine labels, read from the live agent. Blank stays blank. */
export function liveCardOf(agent: unknown): LiveCard {
  const body = asRecord(agent);
  const config = asRecord(body.agent_config);
  const task = asRecord(tasksOf(body)[0]);
  const tools = asRecord(task.tools_config);
  const transcriber = asRecord(tools.transcriber);
  const llmAgent = asRecord(tools.llm_agent);
  const llmConfig = asRecord(llmAgent.llm_config);
  const synth = asRecord(tools.synthesizer);
  const synthConfig = asRecord(synth.provider_config);
  return {
    name: textOf(body.agent_name) ?? textOf(config.agent_name) ?? "",
    welcome: textOf(body.agent_welcome_message) ?? textOf(config.agent_welcome_message) ?? "",
    prompt: liveAgentOf(agent).systemPrompt,
    transcriber: joined([textOf(transcriber.provider), textOf(transcriber.model), textOf(transcriber.language)]),
    model: joined([textOf(llmConfig.provider) ?? textOf(llmAgent.provider), textOf(llmConfig.model) ?? textOf(llmAgent.model)]),
    voice: joined([textOf(synth.provider), textOf(synthConfig.voice) ?? textOf(synth.voice) ?? textOf(synthConfig.voice_id)]),
  };
}

export function liveAgentOf(body: unknown): LiveAgent {
  const agent = asRecord(body);
  const task1 = asRecord(asRecord(agent.agent_prompts).task_1);
  const systemPrompt = typeof task1.system_prompt === "string" ? task1.system_prompt : "";
  const task = asRecord(tasksOf(agent)[0]);
  const transcriber = asRecord(asRecord(task.tools_config).transcriber);
  const transcriberLanguage = typeof transcriber.language === "string" && transcriber.language.trim() ? transcriber.language.trim() : null;
  return { systemPrompt, transcriberLanguage };
}
