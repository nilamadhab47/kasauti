import { describe, expect, it } from "vitest";
import { HINDI_CLOSE, bolnaLanguage, liveAgentOf, liveCardOf, liveSettingsOf, withHindiClose, withLongerSilence, withTranscriberLanguage, withoutModelHangup } from "./live-agent";

const sehat = {
  agent_prompts: {
    task_1: { system_prompt: "You are Riya, the friendly receptionist for Sehat Clinic." },
  },
  tasks: [{ tools_config: { transcriber: { provider: "deepgram", language: "en" } } }],
};

describe("liveSettingsOf", () => {
  it("reads the live silence instead of the 6 second first draft", () => {
    const settings = liveSettingsOf({
      tasks: [{ task_config: { hangup_after_silence: 20, number_of_words_for_interruption: 4, backchanneling: false, call_terminate: 180 } }],
    });
    expect(settings).toEqual([
      { label: "Hang up after silence", value: "20 seconds" },
      { label: "Interruption", value: "4 words" },
      { label: "Backchanneling", value: "Off" },
      { label: "Call ends at", value: "180 seconds" },
    ]);
  });
});

describe("liveCardOf", () => {
  it("reads the live name, welcome, and engine labels", () => {
    expect(
      liveCardOf({
        agent_name: "Riya",
        agent_welcome_message: "Hello, Sehat Clinic.",
        agent_prompts: sehat.agent_prompts,
        tasks: [
          {
            tools_config: {
              transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
              llm_agent: { llm_config: { provider: "openai", model: "gpt-4.1-mini" } },
              synthesizer: { provider: "elevenlabs", provider_config: { voice: "Angelica" } },
            },
          },
        ],
      }),
    ).toEqual({
      name: "Riya",
      welcome: "Hello, Sehat Clinic.",
      prompt: "You are Riya, the friendly receptionist for Sehat Clinic.",
      transcriber: "deepgram · nova-3 · en",
      model: "openai · gpt-4.1-mini",
      voice: "elevenlabs · Angelica",
    });
  });
});

describe("liveAgentOf", () => {
  it("reads the Sehat system prompt and the English transcriber", () => {
    expect(liveAgentOf(sehat)).toEqual({
      systemPrompt: "You are Riya, the friendly receptionist for Sehat Clinic.",
      transcriberLanguage: "en",
    });
  });

  it("reads tasks nested under agent_config", () => {
    const nested = {
      agent_prompts: sehat.agent_prompts,
      agent_config: { tasks: sehat.tasks },
    };
    expect(liveAgentOf(nested).transcriberLanguage).toBe("en");
  });

  it("returns an empty prompt and no language when the payload has neither", () => {
    expect(liveAgentOf({})).toEqual({ systemPrompt: "", transcriberLanguage: null });
  });
});

describe("withTranscriberLanguage", () => {
  const tasks = [{ tools_config: { transcriber: { provider: "deepgram", model: "nova-3", language: "en" } } }];

  it("flips English to multi when language scored under 3, and leaves the rest of the transcriber", () => {
    const next = withTranscriberLanguage(tasks, { languageSwitchBelow3: true, heardHindi: false, nextLanguage: "multi" });
    expect(next.flipped).toBe(true);
    expect(next).toMatchObject({ from: "en", to: "multi" });
    const transcriber = (next.tasks as { tools_config: { transcriber: Record<string, string> } }[])[0]?.tools_config.transcriber;
    expect(transcriber).toEqual({ provider: "deepgram", model: "nova-3", language: "multi" });
    expect((tasks[0]?.tools_config.transcriber as { language: string }).language).toBe("en");
  });

  it("leaves English in place when the language score held", () => {
    const next = withTranscriberLanguage(tasks, { languageSwitchBelow3: false, heardHindi: false, nextLanguage: "multi" });
    expect(next.flipped).toBe(false);
    expect(next.to).toBe("en");
    expect(next.tasks).toBe(tasks);
  });

  it("leaves a transcriber that is already multi", () => {
    const already = [{ tools_config: { transcriber: { provider: "deepgram", language: "multi" } } }];
    const next = withTranscriberLanguage(already, { languageSwitchBelow3: true, heardHindi: true, nextLanguage: "multi" });
    expect(next.flipped).toBe(false);
    expect(next.tasks).toBe(already);
  });

  it("flips English to multi when the caller spoke Hindi and the language score is missing", () => {
    const next = withTranscriberLanguage(tasks, { languageSwitchBelow3: false, heardHindi: true, nextLanguage: "multi" });
    expect(next.flipped).toBe(true);
    expect(next.to).toBe("multi");
  });
});

describe("bolnaLanguage", () => {
  const nova3 = [{ tools_config: { transcriber: { provider: "deepgram", model: "nova-3", language: "en" } } }];

  it("uses Hindi on nova-3 because that model rejects multi", () => {
    expect(bolnaLanguage("multi", nova3)).toBe("hi");
  });

  it("keeps multi on a model that accepts it", () => {
    const nova2 = [{ tools_config: { transcriber: { model: "nova-2", language: "en" } } }];
    expect(bolnaLanguage("multi", nova2)).toBe("multi");
  });
});

describe("withLongerSilence", () => {
  it("raises a 6 second silence hangup to 20", () => {
    const tasks = [{ task_config: { hangup_after_silence: 6, hangup_after_LLMCall: false } }];
    const next = withLongerSilence(tasks);
    expect(next.changed).toBe(true);
    expect(next.tasks).toMatchObject([{ task_config: { hangup_after_silence: 20, hangup_after_LLMCall: false } }]);
    expect((tasks[0]?.task_config as { hangup_after_silence: number }).hangup_after_silence).toBe(6);
  });

  it("leaves a silence hangup that is already 20", () => {
    const tasks = [{ task_config: { hangup_after_silence: 20 } }];
    expect(withLongerSilence(tasks).tasks).toBe(tasks);
  });
});

describe("withHindiClose", () => {
  it("replaces an English desk close with the one Devanagari sentence", () => {
    const block = [
      "Confirm the day they asked for.",
      "Say the order desk will call within 24 hours.",
      "Acknowledge the request in the caller's words, name the desk, and promise the time window.",
      "Do not create a ticket number or a reference code.",
    ].join("\n");
    const next = withHindiClose(block);
    expect(next).toContain(HINDI_CLOSE);
    expect(next).toContain("Confirm the day they asked for.");
    expect(next).toContain("Do not create a ticket number or a reference code.");
    expect(next).not.toContain("order desk");
    expect(next).not.toContain("name the desk");
    expect(next.split(HINDI_CLOSE).length).toBe(2);
  });
});

describe("withoutModelHangup", () => {
  it("turns off the model hangup and leaves the transcriber", () => {
    const tasks = [{ task_config: { hangup_after_LLMCall: true, hangup_after_silence: 20 }, tools_config: { transcriber: { language: "en" } } }];
    const next = withoutModelHangup(tasks);
    expect(next.changed).toBe(true);
    expect(next.tasks).toMatchObject([{ task_config: { hangup_after_LLMCall: false, hangup_after_silence: 20 } }]);
    expect((tasks[0]?.task_config as { hangup_after_LLMCall: boolean }).hangup_after_LLMCall).toBe(true);
  });

  it("leaves a task that already cannot hang up", () => {
    const tasks = [{ task_config: { hangup_after_LLMCall: false } }];
    const next = withoutModelHangup(tasks);
    expect(next.changed).toBe(false);
    expect(next.tasks).toBe(tasks);
  });
});
