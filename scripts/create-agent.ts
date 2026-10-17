import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import readline from "node:readline";
import { bolna } from "./lib/bolna.js";
import { repoRoot } from "./lib/env.js";

const folderArg = process.argv[2];
if (!folderArg) {
  console.error("usage: pnpm agent:create personas/angry_uncle");
  process.exit(1);
}

const folder = resolve(repoRoot, folderArg);
const idFile = join(folder, ".agent_id");
if (existsSync(idFile)) {
  const existing = readFileSync(idFile, "utf8").trim();
  const proceed = await confirm(`An agent already exists (${existing}). Create another? [y/N] `);
  if (!proceed) process.exit(0);
}

const raw = await readFile(join(folder, "agent.json"), "utf8");
const body = JSON.parse(raw) as unknown;
await inlineFiles(body, folder);

const dir = join(repoRoot, "runs/phase0");
await mkdir(dir, { recursive: true });
const name = basename(folder);
const response = await bolna("POST", "/v2/agent", body);
const record = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
const agentId = typeof record.agent_id === "string" ? record.agent_id : "";
if (!agentId) {
  console.error("Bolna did not return agent_id:");
  console.error(JSON.stringify(response, null, 2));
  process.exit(1);
}

await writeFile(join(dir, `create-${name}.json`), JSON.stringify({ request: body, response }, null, 2));
writeFileSync(idFile, `${agentId}\n`);
console.log(agentId);
console.log(`state: ${typeof record.state === "string" ? record.state : "unknown"}`);
console.log(`Put this in .env as PERSONA_AGENT_ID`);

async function inlineFiles(node: unknown, dirPath: string): Promise<void> {
  if (Array.isArray(node)) {
    for (const item of node) await inlineFiles(item, dirPath);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.startsWith("@file:")) {
      const fileName = value.slice("@file:".length);
      const text = await readFile(join(dirPath, fileName), "utf8");
      record[key] = text.trim();
    } else {
      await inlineFiles(value, dirPath);
    }
  }
}

function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("Refusing to create a duplicate agent in a non-interactive shell. Delete .agent_id first if you mean to.");
    return Promise.resolve(false);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolveAnswer) => {
    rl.question(question, (answer) => {
      rl.close();
      resolveAnswer(/^y(es)?$/i.test(answer.trim()));
    });
  });
}
