import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { bolna } from "./lib/bolna.js";
import { repoRoot } from "./lib/env.js";

const ALL_PERSONAS = ["angry_uncle", "lang_switcher", "dialect_bhojpuri", "staff_probe", "records_raider", "rohit"];

const args = parseArgs(process.argv.slice(2));
if (!args.domain) {
  console.error("usage: pnpm exec tsx scripts/create-suite-agents.ts --domain <domainId> [--persona <name> ...] [--force]");
  process.exit(1);
}
const domainId = basename(args.domain).replace(/\.json$/, "");
const names = args.personas ?? ALL_PERSONAS;
const suiteDir = join(repoRoot, "suites", domainId);

const logDir = join(repoRoot, "runs/phase0");
await mkdir(logDir, { recursive: true });

console.log(`Creating Bolna agents for suite "${domainId}" (agent creation is free; no calls are placed).\n`);

for (const name of names) {
  const suitePersona = join(suiteDir, name);
  const personaDir = join(repoRoot, "personas", name);
  if (!existsSync(join(suitePersona, "prompt.md"))) {
    console.error(`  ${name.padEnd(16)} skipped: suites/${domainId}/${name}/prompt.md not found (run build-suite first)`);
    continue;
  }

  const idFile = join(suitePersona, ".agent_id");
  if (existsSync(idFile) && !args.force) {
    console.log(`  ${name.padEnd(16)} skipped: agent already exists (${readFileSync(idFile, "utf8").trim()}). Pass --force to recreate.`);
    continue;
  }

  const body = JSON.parse(await readFile(join(personaDir, "agent.json"), "utf8")) as {
    agent_config: Record<string, unknown> & { tasks?: unknown };
    agent_prompts: { task_1?: { system_prompt?: string } };
  };
  // Pull in any remaining @file: refs from the persona folder (e.g. nested config), then override the two that are domain-specific.
  await inlineFiles(body, personaDir);

  const renderedPrompt = (await readFile(join(suitePersona, "prompt.md"), "utf8")).trim();
  const welcome = (await readFile(join(suitePersona, "welcome.txt"), "utf8")).trim();
  body.agent_config.agent_name = `kasauti-${domainId}-${name.replace(/_/g, "-")}`;
  body.agent_config.agent_welcome_message = welcome;
  body.agent_prompts.task_1 = { ...(body.agent_prompts.task_1 ?? {}), system_prompt: renderedPrompt };

  const response = await bolna("POST", "/v2/agent", body);
  const record = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  const agentId = typeof record.agent_id === "string" ? record.agent_id : "";
  if (!agentId) {
    console.error(`  ${name.padEnd(16)} FAILED: Bolna did not return agent_id`);
    console.error(JSON.stringify(response, null, 2));
    continue;
  }

  await writeFile(idFile, `${agentId}\n`);
  await writeFile(join(logDir, `create-${domainId}-${name}.json`), JSON.stringify({ request: body, response }, null, 2));
  console.log(`  ${name.padEnd(16)} ${agentId}  (${body.agent_config.agent_name})`);
}

console.log(`\nDone. Agent ids written into suites/${domainId}/<persona>/.agent_id.`);
console.log(`To dial (budget-gated, your go): pnpm exec tsx scripts/call.ts --to <number> --persona suites/${domainId}/<persona>`);

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

function parseArgs(argv: string[]): { domain?: string; personas?: string[]; force?: boolean } {
  const out: { domain?: string; personas?: string[]; force?: boolean } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--domain") {
      out.domain = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--persona") {
      out.personas = [...(out.personas ?? []), argv[i + 1]];
      i += 1;
    } else if (argv[i] === "--force") {
      out.force = true;
    }
  }
  return out;
}
