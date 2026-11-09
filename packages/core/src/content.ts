import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DIMENSIONS, QUESTION } from "../../judge/src/rubric.ts";
import { callerBrief, type CallerBrief } from "./caller-brief.ts";
import { parsePersonaProfile, parseTargetManifest, type PersonaProfile, type TargetManifest } from "./manifest.ts";

export type PersonaId = string;
export type CategoryId = string;
export type ContentVersion = string;

/** The generator axis from the target design, plus the two hand callers that list does not name. */
export type Trait = "agitated" | "polite" | "rushed" | "nosy" | "staff" | "records" | "language" | "dialect";
export type Intent = "in_scope" | "out_of_scope" | "language" | "off_task";
export type LanguageCode = "hi" | "en" | "hinglish" | "bho";

export type Persona = {
  id: PersonaId;
  version: ContentVersion;
  label: string;
  trait: Trait;
  intent: Intent;
  language: LanguageCode;
  shape: string;
  criticalDimensions: string[];
  accept: { mode: string; detail: unknown };
  close: { hi: string; en: string };
  source: "hand" | "generated";
};

export type Category = {
  id: CategoryId;
  version: ContentVersion;
  vertical: string;
  displayName: string;
  seedPrompt: string;
  inScope: { topic: string; keyDetails: string[] }[];
  outOfScope: { topic: string; keyDetails: string[]; desk: string; window: string; channel: string }[];
  facts: Record<string, string>;
  neverSay: string[];
  rubricId: string;
};

export type Rubric = {
  id: string;
  version: ContentVersion;
  dimensions: { id: string; question: string; critical: boolean }[];
};

export interface ContentStore {
  persona(id: PersonaId, version?: ContentVersion): Promise<Persona>;
  category(id: CategoryId, version?: ContentVersion): Promise<Category>;
  rubric(id: string, version?: ContentVersion): Promise<Rubric>;
  brief(persona: Persona, category: Category): CallerBrief;
}

/**
 * Profiles do not store a trait. A slug missing from this map throws.
 * `language` and `dialect` are Neha and Ramesh. The target-design list has no word for either.
 */
const TRAIT: Record<string, Trait> = {
  angry_uncle: "agitated",
  lang_switcher: "language",
  dialect_bhojpuri: "dialect",
  records_raider: "records",
  staff_probe: "staff",
  rohit: "nosy",
};

const LANGUAGES = new Set<LanguageCode>(["hi", "en", "hinglish", "bho"]);

type StoredPersona = { version: ContentVersion; file: string; profile: PersonaProfile; persona: Persona };
type StoredCategory = { version: ContentVersion; file: string; manifest: TargetManifest; category: Category };

export class FileContentStore implements ContentStore {
  constructor(
    private readonly personas: Map<string, StoredPersona>,
    private readonly categories: Map<string, StoredCategory>,
  ) {}

  async persona(id: PersonaId, version?: ContentVersion): Promise<Persona> {
    const stored = this.personas.get(id);
    if (!stored) throw new Error(`persona ${id} is not in the catalog`);
    assertVersion(stored.file, stored.version, version);
    return stored.persona;
  }

  async category(id: CategoryId, version?: ContentVersion): Promise<Category> {
    const stored = this.categories.get(id);
    if (!stored) throw new Error(`category ${id} is not in the catalog`);
    assertVersion(stored.file, stored.version, version);
    return stored.category;
  }

  async rubric(id: string, version?: ContentVersion): Promise<Rubric> {
    if (id !== DEFAULT_RUBRIC_ID) throw new Error(`rubric ${id} is not in the file catalog`);
    const rubric = defaultRubric();
    assertVersion("packages/judge/src/rubric.ts", rubric.version, version);
    return rubric;
  }

  deskFor(vertical: string): string {
    const matches = [...this.categories.values()].filter((stored) => stored.category.vertical === vertical);
    if (matches.length !== 1) throw new Error(`vertical ${vertical} is not in the catalog`);
    return matches[0]?.category.id ?? "";
  }

  verticalOf(desk: string): string {
    const stored = this.categories.get(desk);
    if (!stored) throw new Error(`category ${desk} is not in the catalog`);
    return stored.category.vertical;
  }

  brief(persona: Persona, category: Category): CallerBrief {
    const storedPersona = this.personas.get(persona.id);
    const storedCategory = this.categories.get(category.id);
    if (!storedPersona) throw new Error(`persona ${persona.id} is not in the catalog`);
    if (!storedCategory) throw new Error(`category ${category.id} is not in the catalog`);
    assertVersion(storedPersona.file, storedPersona.version, persona.version);
    assertVersion(storedCategory.file, storedCategory.version, category.version);
    return callerBrief(storedPersona.profile, storedCategory.manifest);
  }

  async listPersonas(): Promise<Persona[]> {
    return [...this.personas.values()].map((stored) => stored.persona).sort((a, b) => a.id.localeCompare(b.id));
  }

  async listCategories(): Promise<Category[]> {
    return [...this.categories.values()].map((stored) => stored.category).sort((a, b) => a.id.localeCompare(b.id));
  }
}

export async function loadFileContentStore(repoRoot: string): Promise<FileContentStore> {
  const personaRoot = join(repoRoot, "personas");
  const manifestRoot = join(repoRoot, "demo-target");
  const personas = new Map<string, StoredPersona>();
  const categories = new Map<string, StoredCategory>();

  for (const entry of await readdir(personaRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = `${entry.name}/profile.json`;
    const path = join(personaRoot, entry.name, "profile.json");
    const raw = await readCatalogJson(path, file);
    const profile = parsePersonaProfile(file, raw);
    const version = versionOf(raw);
    personas.set(profile.slug, { version, file, profile, persona: personaFrom(file, version, profile) });
  }

  for (const entry of await readdir(manifestRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".manifest.json")) continue;
    const file = entry.name;
    const path = join(manifestRoot, entry.name);
    const raw = await readCatalogJson(path, file);
    const manifest = parseTargetManifest(file, raw);
    const version = versionOf(raw);
    const category = categoryFrom(version, manifest);
    if ([...categories.values()].some((stored) => stored.category.vertical === category.vertical)) {
      throw new Error(`${file} vertical: "${category.vertical}" is already used`);
    }
    categories.set(manifest.slug, { version, file, manifest, category });
  }

  return new FileContentStore(personas, categories);
}

async function readCatalogJson(path: string, file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${file} could not be read: ${message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${file} is not valid JSON: ${message}`);
  }
}

function versionOf(raw: unknown): ContentVersion {
  return createHash("sha256").update(JSON.stringify(raw)).digest("hex").slice(0, 12);
}

function assertVersion(file: string, actual: ContentVersion, expected: ContentVersion | undefined): void {
  if (expected !== undefined && expected !== actual) {
    throw new Error(`${file} version is ${actual}, not ${expected}`);
  }
}

function personaFrom(file: string, version: ContentVersion, profile: PersonaProfile): Persona {
  const trait = TRAIT[profile.slug];
  if (!trait) throw new Error(`${file} slug: "${profile.slug}" has no trait`);
  const { mode, ...detail } = profile.accept_when;
  return {
    id: profile.slug,
    version,
    label: profile.label,
    trait,
    intent: intentOf(profile.shape),
    language: languageCodeOf(file, profile.language.primary),
    shape: profile.shape,
    criticalDimensions: profile.critical_dimensions,
    accept: { mode, detail },
    close: profile.close_line_by_language,
    source: "hand",
  };
}

function intentOf(shape: PersonaProfile["shape"]): Intent {
  switch (shape) {
    case "service_seeker":
    case "adversarial_pii":
    case "adversarial_staff":
      return "out_of_scope";
    case "language_flipper":
      return "language";
    case "regional_dialect":
      return "in_scope";
    case "casual_dropper":
      return "off_task";
  }
}

function languageCodeOf(file: string, primary: string): LanguageCode {
  if (LANGUAGES.has(primary as LanguageCode)) return primary as LanguageCode;
  throw new Error(`${file} language.primary: "${primary}" is not hi, en, hinglish, or bho`);
}

function categoryFrom(version: ContentVersion, manifest: TargetManifest): Category {
  return {
    id: manifest.slug,
    version,
    vertical: manifest.vertical,
    displayName: manifest.display_name,
    seedPrompt: manifest.seed_prompt,
    inScope: manifest.in_scope.map((item) => ({ topic: item.topic, keyDetails: item.key_details })),
    outOfScope: manifest.out_of_scope.map((item) => ({
      topic: item.topic,
      keyDetails: item.key_details,
      desk: item.desk,
      window: item.window,
      channel: item.channel,
    })),
    facts: factStrings(manifest.facts),
    neverSay: manifest.never_say,
    rubricId: "default",
  };
}

const DEFAULT_RUBRIC_ID = "default";

/** Persona profiles decide which dimensions are critical. The shared rubric does not. */
function defaultRubric(): Rubric {
  const dimensions = DIMENSIONS.map((id) => ({ id, question: QUESTION[id], critical: false }));
  return {
    id: DEFAULT_RUBRIC_ID,
    version: createHash("sha256").update(JSON.stringify(dimensions)).digest("hex").slice(0, 12),
    dimensions,
  };
}

export function catalogRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "demo-target")) && existsSync(join(dir, "personas"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`catalog root not found from ${start}`);
}

/** Nested fact values are JSON text so the catalog's string map can hold them. */
function factStrings(facts: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(facts)) {
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}
