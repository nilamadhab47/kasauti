import { describe, expect, it } from "vitest";
import { bolnaTargetAdapter, targetRefFor } from "./bolna-target";

describe("Bolna target adapter", () => {
  it("reads and writes the prompt through the adapter and leaves the desk transcript empty", async () => {
    const agent = {
      agent_name: "Riya",
      agent_type: "other",
      agent_welcome_message: "Hello",
      webhook_url: "https://example.test/hook",
      tasks: [{ tools_config: { transcriber: { language: "en", model: "nova-2" } }, task_config: { hangup_after_silence: 20 } }],
      ingest_source_config: null,
      calling_guardrails: null,
      call_summary_enabled: false,
      agent_prompts: { task_1: { system_prompt: "You are Riya." } },
    };
    const writes: unknown[] = [];
    let transcriber: { flipped: boolean } | null = null;
    const adapter = bolnaTargetAdapter(
      {
        readAgent: async () => agent,
        writeAgent: async (_id, body) => {
          writes.push(body);
        },
      },
      {
        requestedLanguage: "hi",
        languageSwitchBelow3: false,
        heardHindi: false,
        onTranscriber: (info) => {
          transcriber = info;
        },
      },
    );
    const target = targetRefFor("agent-1", "clinic");
    const prompt = await adapter.fetchPrompt(target);
    expect(prompt?.text).toBe("You are Riya.");
    await adapter.writePrompt(target, {
      text: "You are Riya. Keep the facts.",
      fields: [],
      transcriberLanguage: null,
      fetchedAt: "2026-11-10T00:00:00.000Z",
    });
    const body = writes[0] as { agent_prompts: { task_1: { system_prompt: string } }; agent_config: { tasks: unknown } };
    expect(body.agent_prompts.task_1.system_prompt).toBe("You are Riya. Keep the facts.");
    const task = (body.agent_config.tasks as { task_config: { hangup_after_LLMCall?: boolean } }[])[0];
    expect(task?.task_config.hangup_after_LLMCall).toBe(false);
    expect(transcriber).toMatchObject({ flipped: false });
    expect(await adapter.fetchTranscript({ target, attemptId: "attempt-1", providerRef: null })).toBeNull();
  });
});