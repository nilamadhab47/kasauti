import type { CallerBrief } from "./caller-brief.ts";
import type { CategoryId, ContentVersion, Persona } from "./content.ts";

/** A turn on the channel. The stored transcript still uses `persona` for the caller. */
export type ConversationTurn = {
  idx: number;
  speaker: "caller" | "target";
  text: string;
  lang: string | null;
};

export type AttemptStatus = "queued" | "live" | "completed" | "no_answer" | "busy" | "failed";

export type Conversation = {
  attemptId: string;
  channel: "voice" | "sim" | "chat";
  turns: ConversationTurn[];
  callerTranscript: string;
  targetTranscript: string | null;
  recordingUrl: string | null;
  durationS: number | null;
  providerCost: { currency: "USD"; amount: string; raw: unknown } | null;
};

export type CallerRef = { engine: "bolna" | "kasauti"; agentId: string };

export type Destination =
  | { kind: "e164"; number: string }
  | { kind: "provider_agent"; provider: string; agentId: string };

export type LivePrompt = {
  text: string;
  fields: { name: string; text: string }[];
  transcriberLanguage: string | null;
  fetchedAt: string;
};

export type TargetRef = {
  id: string;
  tenantId: string;
  provider: "bolna" | "vapi" | "retell" | "sarvam" | "phone";
  address: Destination;
  categoryId: CategoryId;
  categoryVersion: ContentVersion;
};

export interface Channel {
  readonly kind: "voice" | "sim" | "chat";
  start(input: { attemptId: string; brief: CallerBrief; target: TargetRef }): Promise<{ providerRef: string }>;
  poll(providerRef: string): Promise<{ status: AttemptStatus; conversation: Conversation | null }>;
  cancel(providerRef: string): Promise<void>;
}

export interface CallerEngine {
  readonly id: "bolna" | "kasauti";
  ensure(persona: Persona, brief: CallerBrief): Promise<CallerRef>;
  place(input: {
    caller: CallerRef;
    to: Destination;
    brief: CallerBrief;
    idempotencyKey: string;
  }): Promise<{ providerRef: string }>;
  execution(providerRef: string): Promise<{ status: AttemptStatus; conversation: Conversation }>;
}

export interface TargetAdapter {
  readonly provider: TargetRef["provider"];
  fetchPrompt(target: TargetRef): Promise<LivePrompt | null>;
  writePrompt(target: TargetRef, next: LivePrompt): Promise<void>;
  fetchTranscript(input: { target: TargetRef; attemptId: string; providerRef: string | null }): Promise<string | null>;
}
