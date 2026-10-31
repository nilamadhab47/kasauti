import { Inject, Injectable } from "@nestjs/common";
import { DB, type Database } from "../db/db.module";
import { env } from "../env";
import { readLineOccupancy } from "../runs/line-lock";
import { executeSwitch, holderOf, isDemoSlug, last4, type OwnedNumber } from "./plan";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function demoBolna(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!env.demoBolnaApiKey) throw new Error("DEMO_BOLNA_API_KEY is missing from .env");
  const response = await fetch(`${env.bolnaBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.demoBolnaApiKey}`,
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
      parsed = null;
    }
  }
  if (!response.ok) throw new Error(`Bolna ${method} ${path} failed (${response.status})`);
  return parsed;
}

function parseNumbers(payload: unknown): OwnedNumber[] {
  const rows = Array.isArray(payload) ? payload : [];
  const numbers: OwnedNumber[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    const id = typeof record.id === "string" ? record.id : "";
    const phone = typeof record.phone_number === "string" ? record.phone_number : "";
    const agentId = typeof record.agent_id === "string" && record.agent_id ? record.agent_id : null;
    if (!id) continue;
    numbers.push({ id, phone, agentId });
  }
  return numbers;
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function knownAgents(): Record<string, string> {
  return Object.fromEntries(Object.entries(env.demoAgents).filter(([, id]) => id));
}

@Injectable()
export class InboundService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async status(session: string | null = null) {
    const enabled = env.numberSwitchEnabled;
    if (!env.demoBolnaApiKey) {
      return { ok: false, enabled, holder: null, phoneLast4: null, busy: false, yours: false, runId: null, error: "The demo account is not configured." };
    }
    try {
      const numbers = parseNumbers(await demoBolna("GET", "/phone-numbers/all"));
      const holder = holderOf(numbers, knownAgents());
      const phone = holder ? toE164(holder.phone) : null;
      const occupy = phone ? await readLineOccupancy(this.db, phone, session) : { busy: false, yours: false, runId: null };
      return {
        ok: true,
        enabled,
        holder: holder?.slug ?? null,
        phoneLast4: holder ? last4(holder.phone) : null,
        busy: occupy.busy,
        yours: occupy.yours,
        runId: occupy.runId,
      };
    } catch {
      return { ok: false, enabled, holder: null, phoneLast4: null, busy: false, yours: false, runId: null, error: "Could not read the shared number." };
    }
  }

  async sharedPhone(): Promise<string | null> {
    if (!env.demoBolnaApiKey) return null;
    const numbers = parseNumbers(await demoBolna("GET", "/phone-numbers/all"));
    const holder = holderOf(numbers, knownAgents());
    return holder ? toE164(holder.phone) : null;
  }

  async switchTo(agent: string) {
    if (!isDemoSlug(agent)) {
      return { ok: false, switched: false, enabled: env.numberSwitchEnabled, error: "That agent is not one of the demo agents." };
    }
    const result = await executeSwitch({
      enabled: env.numberSwitchEnabled,
      toSlug: agent,
      knownAgents: knownAgents(),
      list: async () => parseNumbers(await demoBolna("GET", "/phone-numbers/all")),
      unlink: async (phoneNumberId) => {
        await demoBolna("POST", "/inbound/unlink", { phone_number_id: phoneNumberId });
      },
      setup: async (phoneNumberId, agentId) => {
        await demoBolna("POST", "/inbound/setup", { agent_id: agentId, phone_number_id: phoneNumberId });
      },
    });
    return {
      ok: result.switched || result.already === true,
      switched: result.switched,
      enabled: result.enabled,
      already: result.already ?? false,
      restored: result.restored ?? false,
      holder: result.holder ?? null,
      error: result.reason,
    };
  }
}
