import { config } from "dotenv";
import { join } from "node:path";

config({ path: join(__dirname, "../../../.env") });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing from .env`);
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  webhookSecret: required("WEBHOOK_SECRET"),
  redisUrl: process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379",
  port: Number(process.env.PORT ?? 3001),
  allowedNumbers: list("ALLOWED_NUMBERS"),
  bolnaApiKey: process.env.BOLNA_API_KEY?.trim() || "",
  bolnaBaseUrl: process.env.BOLNA_BASE_URL?.trim() || "https://api.bolna.ai",
  // The shared demo line lives on the agents account. The switch stays off until this is exactly "true".
  demoBolnaApiKey: process.env.DEMO_BOLNA_API_KEY?.trim() || "",
  // True only when NUMBER_SWITCH_ENABLED is exactly "true". A reload is required after .env changes.
  numberSwitchEnabled: process.env.NUMBER_SWITCH_ENABLED?.trim() === "true",
  // Pushing the merged patch to a live Bolna agent prompt stays off until this is exactly "true".
  patchEnabled: process.env.PATCH_ENABLED?.trim() === "true",
  demoAgents: {
    sehat: process.env.SEHAT_AGENT_ID?.trim() || "",
    rupeesetu: process.env.DEMO_AGENT_ID?.trim() || "",
    swaad: process.env.SWAAD_AGENT_ID?.trim() || "",
    nila: process.env.NILA_AGENT_ID?.trim() || "",
    nivas: process.env.NIVAS_AGENT_ID?.trim() || "",
  },
  personaAgentId: process.env.PERSONA_AGENT_ID?.trim() || "",
  maxConcurrentCalls: Number(process.env.MAX_CONCURRENT_CALLS ?? 3),
  dailyCallCap: Number(process.env.DAILY_CALL_CAP ?? 40),
};
