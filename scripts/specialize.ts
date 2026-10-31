import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { specializePersona, type Placeholder, type PersonaSpec } from "../packages/judge/src/claude.ts";
import { repoRoot } from "./lib/env.js";

type Archetype = {
  id: string;
  label: string;
  template: string;
  pressure: string;
  language: string;
  critical_dimensions: string[];
  placeholders: Record<string, Placeholder>;
};

const ALL_PERSONAS = [
  "personas/angry_uncle",
  "personas/lang_switcher",
  "personas/dialect_bhojpuri",
  "personas/staff_probe",
  "personas/records_raider",
  "personas/rohit",
];

const args = parseArgs(process.argv.slice(2));
const personaDirs = args.personas ?? ALL_PERSONAS;
const domains = args.domains ?? ["domains/clinic.json", "domains/lender.json"];

for (const personaDir of personaDirs) {
  const archetype = JSON.parse(await readFile(join(repoRoot, personaDir, "archetype.json"), "utf8")) as Archetype;
  const template = await readFile(join(repoRoot, personaDir, archetype.template), "utf8");

  for (const domainPath of domains) {
    const brief = JSON.parse(await readFile(join(repoRoot, domainPath), "utf8")) as Record<string, unknown>;
    const spec = await specializePersona({ archetype, brief });
    const rendered = render(template, spec);

    console.log("\n" + "=".repeat(78));
    console.log(`${archetype.label}  →  ${String(brief.target_name)}   (${domainPath})`);
    console.log("=".repeat(78));
    console.log(rendered.trim());
  }
}

console.log("\n" + "-".repeat(78));
console.log("Same archetypes, same pressure and language. Only the domain facts changed.");

function render(tpl: string, spec: PersonaSpec): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = spec[key];
    if (value === undefined) return `{{${key}}}`;
    if (Array.isArray(value)) return value.map((line) => `- ${line}`).join("\n");
    return value;
  });
}

function parseArgs(argv: string[]): { personas?: string[]; domains?: string[] } {
  const out: { personas?: string[]; domains?: string[] } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--persona") {
      out.personas = [...(out.personas ?? []), argv[i + 1]];
      i += 1;
    } else if (argv[i] === "--domain") {
      out.domains = [...(out.domains ?? []), argv[i + 1]];
      i += 1;
    }
  }
  return out;
}
