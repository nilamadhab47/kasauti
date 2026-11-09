import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const dialectAsk = z.object({
  request: z.string().min(1),
  close: z.string().min(1),
});

const recordsAsk = z.object({
  request: z.string().min(1),
  intro: z.string().min(1),
  question: z.string().min(1),
  caught: z.string().min(1),
});

const scopeItem = z.object({
  topic: z.string().min(1),
  key_details: z.array(z.string().min(1)).min(1),
  dialect: dialectAsk.optional(),
  records: recordsAsk.optional(),
});

const outOfScopeItem = scopeItem.extend({
  desk: z.string().min(1),
  window: z.string().min(1),
  channel: z.string().min(1),
});

export const targetManifestSchema = z.object({
  slug: z.string().min(1),
  vertical: z.string().min(1),
  display_name: z.string().min(1),
  role: z.string().min(1),
  seed_prompt: z.string().min(1),
  languages: z.array(z.string().min(1)).min(1),
  in_scope: z.array(scopeItem).min(1),
  out_of_scope: z.array(outOfScopeItem).min(1),
  facts: z.record(z.string(), z.unknown()),
  never_say: z.array(z.string().min(1)).min(1),
  callback_default_window: z.string().min(1),
  bolna: z.object({
    default_transcriber_language: z.string().min(1),
  }),
});

export type TargetManifest = z.infer<typeof targetManifestSchema>;

const requiresAll = z.object({
  requires_all: z.array(z.string().min(1)).min(1),
});

export const personaProfileSchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  shape: z.enum([
    "service_seeker",
    "language_flipper",
    "regional_dialect",
    "adversarial_pii",
    "adversarial_staff",
    "casual_dropper",
  ]),
  pressure: z.string().min(1),
  language: z
    .object({
      primary: z.string().min(1),
      mix: z.array(z.string().min(1)).min(1),
    })
    .refine((language) => language.mix.includes(language.primary), {
      message: "mix must include primary",
      path: ["mix"],
    }),
  max_attempts: z.number().int().positive(),
  accept_when: z.discriminatedUnion("mode", [
    requiresAll.extend({ mode: z.literal("escalation") }),
    requiresAll.extend({ mode: z.literal("language_match") }),
    requiresAll.extend({ mode: z.literal("dialect_repair") }),
    requiresAll.extend({ mode: z.literal("refusal") }),
    z.object({
      mode: z.literal("partial_answers"),
      min_satisfied: z.number().int().positive(),
      of: z.number().int().positive(),
    }),
  ]),
  close_line_by_language: z.object({
    hi: z.string().min(1),
    en: z.string().min(1),
  }),
  unsatisfied_close_by_language: z.object({
    hi: z.string().min(1),
    en: z.string().min(1),
  }),
  critical_dimensions: z.array(z.string().min(1)).min(1),
});

export type PersonaProfile = z.infer<typeof personaProfileSchema>;

export function formatManifestError(file: string, error: z.ZodError): string {
  const detail = error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
  return `${file} is not valid: ${detail}`;
}

function parseOrThrow<T>(file: string, schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(formatManifestError(file, parsed.error));
  return parsed.data;
}

export function parseTargetManifest(file: string, value: unknown): TargetManifest {
  const manifest = parseOrThrow(file, targetManifestSchema, value);
  const slug = file.replace(/\.manifest\.json$/, "");
  if (slug !== file && manifest.slug !== slug) {
    throw new Error(`${file} slug is "${manifest.slug}", expected "${slug}"`);
  }
  return manifest;
}

export function parsePersonaProfile(file: string, value: unknown): PersonaProfile {
  const profile = parseOrThrow(file, personaProfileSchema, value);
  const folder = file.split("/").slice(0, -1).pop();
  if (folder && profile.slug !== folder) {
    throw new Error(`${file} slug is "${profile.slug}", expected "${folder}"`);
  }
  return profile;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

const MANIFEST_SLUGS: Record<string, string> = {
  "sehat clinic": "sehat",
  rupeesetu: "rupeesetu",
  "rupeesetu finance": "rupeesetu",
  "swaad kitchen": "swaad",
  nila: "nila",
  nivas: "nivas",
  "nivas homes": "nivas",
};

/** The name stored on a target row, mapped to a demo-target manifest slug. */
export function manifestSlugOf(name: string): string | null {
  return MANIFEST_SLUGS[name.trim().toLowerCase()] ?? null;
}

export async function loadTargetManifest(repoRoot: string, slug: string): Promise<TargetManifest> {
  const file = `${slug}.manifest.json`;
  return parseTargetManifest(file, await readJson(join(repoRoot, "demo-target", file)));
}

export async function loadPersonaProfile(repoRoot: string, slug: string): Promise<PersonaProfile> {
  const file = `${slug}/profile.json`;
  return parsePersonaProfile(file, await readJson(join(repoRoot, "personas", file)));
}
