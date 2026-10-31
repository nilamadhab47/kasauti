import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPersonaProfile, loadTargetManifest } from "../packages/core/src/index.ts";
import { mergePromptLines, patchMode } from "../packages/judge/src/claude.ts";
import { repoRoot } from "./lib/env.js";

const summaryPath = join(repoRoot, "runs/level1/summary.json");
const summary = JSON.parse(await readFile(summaryPath, "utf8")) as {
  calls: { who: string; worstLine: string; promptLine: string }[];
};
const source = await readFile(join(repoRoot, "demo-target/sehat_v1.md"), "utf8");
const fenced = source.match(/## Prompt \(paste exactly\)\n```\n([\s\S]*?)```/);
if (!fenced?.[1]) throw new Error("Sehat v1 prompt fence is missing");

const known = ["angry_uncle", "lang_switcher", "dialect_bhojpuri", "records_raider", "staff_probe", "rohit"];
const manifest = await loadTargetManifest(repoRoot, "sehat");
const currentPrompt = fenced[1].trim();
const patch = await mergePromptLines({
  targetManifest: manifest,
  currentPrompt,
  failures: await Promise.all(
    summary.calls.map(async (call) => ({
      who: call.who,
      quote: call.worstLine,
      line: call.promptLine,
      profile: await loadPersonaProfile(repoRoot, known.includes(call.who) ? call.who : "angry_uncle"),
    })),
  ),
  mode: patchMode(currentPrompt),
  today: new Date().toISOString().slice(0, 10),
});

await writeFile(summaryPath, JSON.stringify({ ...summary, patch }, null, 2));
await writeFile(
  join(repoRoot, "apps/web/lib/level1-patch.ts"),
  `export const LEVEL1_PATCH = ${JSON.stringify(patch, null, 2)} as const;\n`,
);

console.log(`\n${patch.lines.length} lines\n`);
for (const line of patch.lines) console.log(`${line.who}\n${line.line}\n`);
console.log("Paste block\n");
console.log(patch.block);
