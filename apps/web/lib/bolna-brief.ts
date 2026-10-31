export type BolnaBrief = {
  id: string;
  name: string;
  welcome: string;
  prompt: string;
  transcriber: string;
  transcriberNote: string;
  model: string;
  modelNote: string;
  voice: string;
  voiceNote: string;
  settings: { label: string; value: string }[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function providerLabel(value: string) {
  if (!value) return "";
  if (value.toLowerCase() === "elevenlabs") return "ElevenLabs";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function languageName(code: string) {
  const names: Record<string, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish" };
  return names[code.toLowerCase()] ?? code;
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

/** The fields the demo brief shows, taken from a Bolna agent payload. */
export function readBolnaBrief(body: unknown, id: string): BolnaBrief {
  const agent = asRecord(body);
  const task = asRecord(Array.isArray(agent.tasks) ? agent.tasks[0] : undefined);
  const tools = asRecord(task.tools_config);
  const config = asRecord(task.task_config);
  const transcriber = asRecord(tools.transcriber);
  const synthesizer = asRecord(tools.synthesizer);
  const voiceConfig = asRecord(synthesizer.provider_config);
  const llm = asRecord(asRecord(tools.llm_agent).llm_config);
  const sttProvider = text(transcriber.provider);
  const sttModel = text(transcriber.model);
  const sttLanguage = text(transcriber.language);
  const llmProvider = text(llm.provider);
  const llmModel = text(llm.model);
  const voiceProvider = text(synthesizer.provider);
  const voiceName = text(voiceConfig.voice) || text(voiceConfig.voice_id);
  const voiceLanguage = text(voiceConfig.language);
  const prompt = text(asRecord(asRecord(agent.agent_prompts).task_1).system_prompt);

  return {
    id,
    name: text(agent.agent_name) || "Untitled agent",
    welcome: text(agent.agent_welcome_message),
    prompt,
    transcriber: [providerLabel(sttProvider), sttModel].filter(Boolean).join(" ") || "—",
    transcriberNote: sttLanguage ? `Language set to ${languageName(sttLanguage)}.` : "Read from this agent.",
    model: llmModel || "—",
    modelNote: llmProvider && !llmModel.toLowerCase().includes(llmProvider.toLowerCase()) ? `Provider ${llmProvider}.` : "Read from this agent.",
    voice: [providerLabel(voiceProvider), voiceName].filter(Boolean).join(", ") || "—",
    voiceNote: voiceLanguage ? `Language set to ${languageName(voiceLanguage)}.` : "Read from this agent.",
    settings: [
      { label: "Hang up after silence", value: seconds(config.hangup_after_silence) },
      { label: "Interruption", value: words(config.number_of_words_for_interruption) },
      { label: "Backchanneling", value: onOff(config.backchanneling) },
      { label: "Call ends at", value: seconds(config.call_terminate) },
    ],
  };
}
