import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
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
if (!args.domain) {
  console.error("usage: pnpm exec tsx scripts/build-suite.ts --domain domains/<brief>.json [--persona personas/<p> ...]");
  process.exit(1);
}

const personaDirs = args.personas ?? ALL_PERSONAS;
const brief = JSON.parse(await readFile(join(repoRoot, args.domain), "utf8")) as Record<string, unknown>;
const domainId = basename(args.domain).replace(/\.json$/, "");
const suiteDir = join(repoRoot, "suites", domainId);

console.log(`Building suite for "${String(brief.target_name)}" (${domainId}) → suites/${domainId}/\n`);

for (const personaDir of personaDirs) {
  const archetype = JSON.parse(await readFile(join(repoRoot, personaDir, "archetype.json"), "utf8")) as Archetype;
  const template = await readFile(join(repoRoot, personaDir, archetype.template), "utf8");
  const spec = await specializePersona({ archetype, brief });
  const rendered = render(template, spec);

  const outDir = join(suiteDir, archetype.id);
  await mkdir(outDir, { recursive: true });

  const defaults = {
    id: archetype.id,
    name: archetype.label,
    domain: domainId,
    target_name: String(brief.target_name),
    user_data: {
      target_name: asLine(spec.target_name),
      goal: asLine(spec.goal),
      seed_script: asLine(spec.seed_script),
    },
    success_criteria: asList(spec.success_criteria),
    critical_dimensions: archetype.critical_dimensions,
  };

  const welcome = asLine(spec.welcome).trim();
  await writeFile(join(outDir, "prompt.md"), rendered.trimStart());
  await writeFile(join(outDir, "welcome.txt"), welcome + "\n");
  await writeFile(join(outDir, "defaults.json"), JSON.stringify(defaults, null, 2) + "\n");
  console.log(`  ${archetype.id.padEnd(16)} prompt ${rendered.trim().length} chars, ${defaults.success_criteria.length} success criteria`);
}

console.log(`\nDone. Rendered prompts + scoring-ready defaults are in suites/${domainId}/.`);
console.log("These match the shape call.ts and the scorers already read.");
console.log("Next (budget-gated, needs your go): create one Bolna agent per persona from these prompts, then dial.");

function render(tpl: string, spec: PersonaSpec): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = spec[key];
    if (value === undefined) return `{{${key}}}`;
    if (Array.isArray(value)) return value.map((line) => `- ${line}`).join("\n");
    return value;
  });
}

function asLine(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(" ");
  return value ?? "";
}

function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function parseArgs(argv: string[]): { domain?: string; personas?: string[] } {
  const out: { domain?: string; personas?: string[] } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--domain") {
      out.domain = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--persona") {
      out.personas = [...(out.personas ?? []), argv[i + 1]];
      i += 1;
    }
  }
  return out;
}
