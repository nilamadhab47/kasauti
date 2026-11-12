import { liveAgentOf, type LiveAgent } from "../patch/live-agent";
import { env } from "../env";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function bolna(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!env.bolnaApiKey) throw new Error("BOLNA_API_KEY is missing from .env");
  const response = await fetch(`${env.bolnaBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.bolnaApiKey}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    const detail = text.replace(/\+\d{8,15}/g, "[number]").replace(/bn-[A-Za-z0-9._-]+/g, "[key]").slice(0, 240);
    throw new Error(`Bolna ${method} ${path} failed (${response.status}) ${detail}`);
  }
  return parsed;
}

/** The place body. A retry must not drop the guardrail bypass or the caller brief. */
export function bolnaPlaceBody(input: { agentId: string; to: string; userData: Record<string, string> }) {
  return {
    agent_id: input.agentId,
    recipient_phone_number: input.to,
    user_data: input.userData,
    bypass_call_guardrails: true,
  };
}

export async function placeCall(input: { agentId: string; to: string; userData: Record<string, string> }) {
  const placed = asRecord(await bolna("POST", "/call", bolnaPlaceBody(input)));
  const executionId = typeof placed.execution_id === "string" ? placed.execution_id : "";
  if (!executionId) throw new Error("Bolna did not return an execution id");
  const status = typeof placed.status === "string" ? placed.status : "queued";
  return { executionId, status };
}

export async function getExecution(executionId: string): Promise<unknown> {
  return bolna("GET", `/executions/${executionId}`);
}

/** The demo agents live on the agents account. Every other agent uses the main key. */
function keyForAgent(agentId: string): string {
  const demoIds = Object.values(env.demoAgents).filter(Boolean);
  const key = demoIds.includes(agentId) ? env.demoBolnaApiKey : env.bolnaApiKey;
  if (!key) throw new Error("No Bolna key is configured for this agent");
  return key;
}

/** Reads the live system prompt and transcriber language. The error carries the status, not the body. */
export async function readLiveAgent(agentId: string): Promise<LiveAgent> {
  const response = await fetch(`${env.bolnaBaseUrl}/v2/agent/${agentId}`, {
    headers: { Authorization: `Bearer ${keyForAgent(agentId)}`, "content-type": "application/json" },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Bolna GET /v2/agent failed (${response.status})`);
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  return liveAgentOf(parsed);
}
