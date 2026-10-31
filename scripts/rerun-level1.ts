import { spawn } from "node:child_process";
import { env, repoRoot } from "./lib/env.js";

if (!env.CLINIC_NUMBER) throw new Error("CLINIC_NUMBER is missing");

const calls = [
  ["personas/angry_uncle", "level1-rerun-sharma"],
  ["personas/lang_switcher", "level1-rerun-neha"],
] as const;

for (const [persona, label] of calls) {
  console.log(`\n${label}`);
  await dial(persona, label);
}

function dial(persona: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["exec", "tsx", "scripts/call.ts", "--to", env.CLINIC_NUMBER!, "--persona", persona, "--label", label],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    const scrub = (chunk: Buffer) => process.stdout.write(chunk.toString().replace(/\+\d{8,15}/g, "[number]"));
    child.stdout.on("data", scrub);
    child.stderr.on("data", scrub);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited ${code}`))));
  });
}
