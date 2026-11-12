import type { CallerBrief } from "../../../../packages/core/src/caller-brief.ts";
import type { AttemptStatus, CallerEngine, CallerRef, Channel, Conversation, Destination, TargetRef } from "../../../../packages/core/src/seam.ts";
import { parseTranscript, type Turn } from "../../../../packages/core/src/transcript.ts";
import { getExecution, placeCall } from "./bolna";
import { executionFields } from "./execution";

const EMPTY_BRIEF: CallerBrief = { user_data: {}, success_criteria: [], critical_dimensions: [] };

/** Bolna's status string stays on the call row. This is only the channel status. */
export function attemptStatus(status: string): AttemptStatus {
  if (status === "completed") return "completed";
  if (status === "busy") return "busy";
  if (status === "no-answer" || status === "no_answer") return "no_answer";
  if (status === "queued" || status === "pending") return "queued";
  if (status === "initiated" || status === "ringing" || status === "in-progress" || status === "placing") return "live";
  return "failed";
}

/** The execution Bolna already returned, as a Conversation. The desk's own transcript is still null. */
export function conversationFromExecution(raw: unknown, attemptId: string): { status: AttemptStatus; conversation: Conversation } {
  const fields = executionFields(raw);
  const turns = parseTranscript(fields.transcript).map((turn) => ({
    idx: turn.idx,
    speaker: turn.speaker === "persona" ? ("caller" as const) : ("target" as const),
    text: turn.text,
    lang: turn.lang,
  }));
  return {
    status: attemptStatus(fields.status),
    conversation: {
      attemptId,
      channel: "voice",
      turns,
      callerTranscript: fields.transcript ?? "",
      targetTranscript: null,
      recordingUrl: null,
      durationS: fields.durationS,
      providerCost: {
        currency: "USD",
        amount: fields.costCents === null ? "0.0000" : (fields.costCents / 100).toFixed(4),
        raw,
      },
    },
  };
}

/** Stored turns keep `persona` for the caller. */
export function personaTurns(conversation: Conversation): Turn[] {
  return conversation.turns.map((turn) => ({
    idx: turn.idx,
    speaker: turn.speaker === "caller" ? "persona" : "target",
    text: turn.text,
    lang: turn.lang === "hi" || turn.lang === "en" || turn.lang === "mixed" ? turn.lang : "en",
  }));
}

/**
 * The row is the idempotency key. A second place for the same attempt returns the stored ref
 * and does not dial. Bolna is not sent an idempotency field.
 */
export async function placeOnce(input: {
  existingRef: string | null;
  markPlacing: () => Promise<void>;
  dial: () => Promise<{ providerRef: string; status: string }>;
  saveRef: (providerRef: string, status: string) => Promise<void>;
}): Promise<{ providerRef: string; status: string; dialed: boolean }> {
  if (input.existingRef) return { providerRef: input.existingRef, status: "queued", dialed: false };
  await input.markPlacing();
  const placed = await input.dial();
  await input.saveRef(placed.providerRef, placed.status);
  return { providerRef: placed.providerRef, status: placed.status, dialed: true };
}

export function bolnaCallerEngine() {
  const engine = {
    id: "bolna" as const,
    async ensure() {
      throw new Error("The caller agent is provisioned outside the engine. ensure does not push a prompt.");
    },
    async place(input: { caller: CallerRef; to: Destination; brief: CallerBrief; idempotencyKey: string }) {
      if (input.to.kind !== "e164") throw new Error("Bolna place dials a phone number");
      const placed = await placeCall({
        agentId: input.caller.agentId,
        to: input.to.number,
        userData: input.brief.user_data,
      });
      return { providerRef: placed.executionId, status: placed.status };
    },
    async execution(providerRef: string) {
      return conversationFromExecution(await getExecution(providerRef), providerRef);
    },
  };
  engine satisfies CallerEngine;
  return engine;
}

export function voiceChannel(engine: CallerEngine, caller: CallerRef): Channel {
  return {
    kind: "voice",
    async start(input) {
      return engine.place({
        caller,
        to: phoneOf(input.target),
        brief: input.brief.user_data ? input.brief : EMPTY_BRIEF,
        idempotencyKey: input.attemptId,
      });
    },
    async poll(providerRef) {
      return engine.execution(providerRef);
    },
    async cancel() {
      return;
    },
  };
}

function phoneOf(target: TargetRef): Destination {
  if (target.address.kind !== "e164") throw new Error("A voice channel dials a phone number");
  return target.address;
}
