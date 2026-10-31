import { z } from "zod";

const bodySchema = z
  .object({
    id: z.string().optional(),
    execution_id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type WebhookFields = {
  executionId: string | null;
  status: string | null;
  payload: unknown;
};

/** Bolna's execution object uses `id`. Some senders use `execution_id`. Both are stored. */
export function parseWebhook(body: unknown): WebhookFields {
  const parsed = bodySchema.parse(body);
  return {
    executionId: parsed.id ?? parsed.execution_id ?? null,
    status: parsed.status ?? null,
    payload: parsed,
  };
}
