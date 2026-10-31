export type ExecutionFields = {
  id: string;
  status: string;
  transcript: string | null;
  durationS: number | null;
  costCents: number | null;
  hangupBy: string | null;
  hangupReason: string | null;
  ttfaMs: number | null;
  raw: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function executionFields(raw: unknown): ExecutionFields {
  const body = asRecord(raw);
  const telephony = asRecord(body.telephony_data);
  const latency = asRecord(body.latency_data);
  return {
    id: text(body.id) ?? "",
    status: text(body.status) ?? "unknown",
    transcript: typeof body.transcript === "string" ? body.transcript : null,
    durationS: num(body.conversation_duration) ?? num(telephony.duration),
    costCents: num(body.total_cost),
    hangupBy: text(telephony.hangup_by),
    hangupReason: text(telephony.hangup_reason),
    ttfaMs: num(latency.time_to_first_audio),
    raw,
  };
}
