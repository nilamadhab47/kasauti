import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTranscript } from "../../../../packages/core/src/transcript.ts";
import { bolnaPlaceBody } from "./bolna";
import { attemptStatus, conversationFromExecution, personaTurns, placeOnce, voiceChannel } from "./bolna-engine";
import { executionFields } from "./execution";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("Bolna caller engine", () => {
  it("keeps the place body the dial already sends", () => {
    const body = bolnaPlaceBody({ agentId: "agent", to: "+910000000000", userData: { goal: "a refund" } });
    expect(body).toEqual({
      agent_id: "agent",
      recipient_phone_number: "+910000000000",
      user_data: { goal: "a refund" },
      bypass_call_guardrails: true,
    });
  });

  it("reads a stored execution the same way the call row does", async () => {
    const raw = JSON.parse(await readFile(join(root, "fixtures/test-b-32ea6d7d.json"), "utf8")) as unknown;
    const direct = executionFields(raw);
    const viewed = conversationFromExecution(raw, "attempt-1");
    const through = executionFields(viewed.conversation.providerCost?.raw ?? null);

    expect(viewed.conversation.channel).toBe("voice");
    expect(viewed.conversation.targetTranscript).toBeNull();
    expect(viewed.conversation.durationS).toBe(direct.durationS);
    expect(viewed.conversation.providerCost?.amount).toBe(direct.costCents === null ? "0.0000" : (direct.costCents / 100).toFixed(4));
    expect(through).toEqual(direct);
    expect(personaTurns(viewed.conversation)).toEqual(parseTranscript(direct.transcript));
    expect(viewed.status).toBe(attemptStatus(direct.status));
  });

  it("does not dial again when the attempt already has a provider ref", async () => {
    let dials = 0;
    const first = await placeOnce({
      existingRef: null,
      markPlacing: async () => undefined,
      dial: async () => {
        dials += 1;
        return { providerRef: "exec-1", status: "queued" };
      },
      saveRef: async () => undefined,
    });
    const second = await placeOnce({
      existingRef: first.providerRef,
      markPlacing: async () => undefined,
      dial: async () => {
        dials += 1;
        return { providerRef: "exec-2", status: "queued" };
      },
      saveRef: async () => undefined,
    });
    expect(dials).toBe(1);
    expect(second).toMatchObject({ providerRef: "exec-1", dialed: false });
  });

  it("polls through the voice channel", async () => {
    const channel = voiceChannel(
      {
        id: "bolna",
        async ensure() {
          return { engine: "bolna", agentId: "agent" };
        },
        async place() {
          return { providerRef: "exec-1" };
        },
        async execution() {
          return conversationFromExecution({ status: "completed", transcript: "assistant: hello", conversation_duration: 10, total_cost: 2 }, "attempt-1");
        },
      },
      { engine: "bolna", agentId: "agent" },
    );
    expect(channel.kind).toBe("voice");
    const polled = await channel.poll("exec-1");
    expect(polled.status).toBe("completed");
    expect(polled.conversation?.targetTranscript).toBeNull();
    expect(polled.conversation?.turns[0]?.speaker).toBe("caller");
  });
});
