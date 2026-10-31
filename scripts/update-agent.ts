import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { bolna } from "./lib/bolna.js";
import { repoRoot } from "./lib/env.js";

const folderArg = process.argv[2];
if (!folderArg) {
  console.error("usage: pnpm exec tsx scripts/update-agent.ts personas/staff_probe");
  process.exit(1);
}
const folder = resolve(repoRoot, folderArg);

async function inlineFiles(node: unknown, dirPath: string): Promise<void> {
  if (Array.isArray(node)) {
    for (const item of node) await inlineFiles(item, dirPath);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.startsWith("@file:")) {
      record[key] = (await readFile(join(dirPath, value.slice("@file:".length)), "utf8")).trim();
    } else {
      await inlineFiles(value, dirPath);
    }
  }
}

const agentId = (await readFile(join(folder, ".agent_id"), "utf8")).trim();
const body = JSON.parse(await readFile(join(folder, "agent.json"), "utf8")) as {
  agent_config: Record<string, unknown>;
  agent_prompts: Record<string, unknown>;
};
await inlineFiles(body, folder);

await bolna("PUT", `/v2/agent/${agentId}`, body);
const check = (await bolna("GET", `/v2/agent/${agentId}`)) as Record<string, unknown>;
const prompts = (check.agent_prompts ?? {}) as Record<string, { system_prompt?: string }>;
const live = prompts.task_1?.system_prompt ?? "";
console.log(`updated ${agentId}`);
console.log(`live prompt: ${live.length} chars`);
console.log(`first line: ${live.split("\n")[0]}`);
