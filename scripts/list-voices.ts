import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bolna } from "./lib/bolna.js";
import { repoRoot } from "./lib/env.js";

type ModelRef = { providerId: string; providerName: string; modelId: string; modelName: string };

type VoiceRow = {
  voice_id: string;
  name: string;
  gender: string;
  model: string;
};

const providersPayload = await bolna("GET", "/api/v1/voice-config/tts?language=hi");
const models = sarvamModels(providersPayload).filter((model) => model.modelName === "bulbul:v4-flash");
if (models.length === 0) {
  console.error("No Sarvam bulbul:v4-flash model in GET /api/v1/voice-config/tts?language=hi");
  const dir = join(repoRoot, "runs/phase0");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "tts-providers.json"), JSON.stringify(providersPayload, null, 2));
  process.exit(1);
}

const voices: unknown[] = [];
for (const model of models) {
  for (let page = 1; page <= 10; page += 1) {
    const query = new URLSearchParams({
      provider_id: model.providerId,
      model_id: model.modelId,
      language: "hi",
      page: String(page),
      page_size: "100",
    });
    const payload = await bolna("GET", `/api/v1/voice-config/tts/voices?${query}`);
    const items = itemsOf(payload);
    for (const item of items) voices.push({ ...item, _model: model.modelName });
    if (items.length < 100) break;
  }
}

const dir = join(repoRoot, "runs/phase0");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "voices.json"), JSON.stringify(voices, null, 2));

const rows = voices
  .map(toRow)
  .filter((row): row is VoiceRow => row !== null && row.voice_id.includes("_enhi_"));

console.log("voice_id\tgender\tname\tmodel");
for (const row of rows) {
  const mark = row.gender === "male" || row.gender === "masculine" ? "  ← male code-mixed" : "";
  console.log(`${row.voice_id}\t${row.gender}\t${row.name}\t${row.model}${mark}`);
}
console.log(`\n${rows.length} Sarvam _enhi_ voices. Full list: runs/phase0/voices.json`);

function itemsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["items", "voices", "data", "results"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function toRow(value: unknown): VoiceRow | null {
  if (!isRecord(value) || typeof value.voice_id !== "string") return null;
  return {
    voice_id: value.voice_id,
    name: typeof value.name === "string" ? value.name : "",
    gender: typeof value.gender === "string" ? value.gender : "",
    model: typeof value._model === "string" ? value._model : "",
  };
}

function sarvamModels(payload: unknown): ModelRef[] {
  const providers = isRecord(payload) && Array.isArray(payload.providers) ? payload.providers : [];
  const found: ModelRef[] = [];
  for (const provider of providers) {
    if (!isRecord(provider) || provider.slug !== "sarvam" || typeof provider.id !== "string") continue;
    const models = Array.isArray(provider.models) ? provider.models : [];
    for (const model of models) {
      if (!isRecord(model) || typeof model.id !== "string" || typeof model.model_id !== "string") continue;
      found.push({
        providerId: provider.id,
        providerName: "sarvam",
        modelId: model.id,
        modelName: model.model_id,
      });
    }
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
