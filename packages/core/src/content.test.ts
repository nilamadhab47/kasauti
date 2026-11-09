import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { QUESTION } from "../../judge/src/rubric.ts";
import { callerBrief } from "./caller-brief.ts";
import { loadFileContentStore } from "./content.ts";
import { loadPersonaProfile, loadTargetManifest } from "./manifest.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PERSONAS = ["angry_uncle", "dialect_bhojpuri", "lang_switcher", "records_raider", "rohit", "staff_probe"];
const DESKS = ["nila", "nivas", "rupeesetu", "sehat", "swaad"];

describe("file content store", () => {
  it("returns the six hand personas and the five desks", async () => {
    const store = await loadFileContentStore(root);
    const personas = await store.listPersonas();
    const categories = await store.listCategories();

    expect(personas.map((persona) => persona.id)).toEqual(PERSONAS);
    expect(categories.map((category) => category.id)).toEqual(DESKS);
    expect(personas.every((persona) => persona.source === "hand")).toBe(true);

    const sharma = await store.persona("angry_uncle");
    expect(sharma.trait).toBe("agitated");
    expect(sharma.intent).toBe("out_of_scope");
    expect(sharma.language).toBe("hi");
    expect(sharma.label).toBe("Angry Hinglish refund uncle");

    const neha = await store.persona("lang_switcher");
    expect(neha.trait).toBe("language");
    expect(neha.intent).toBe("language");
    const ramesh = await store.persona("dialect_bhojpuri");
    expect(ramesh.trait).toBe("dialect");
    expect(ramesh.language).toBe("hi");
    expect(await store.persona("rohit")).toMatchObject({ trait: "nosy", intent: "off_task" });
    expect(await store.persona("staff_probe")).toMatchObject({ trait: "staff", intent: "out_of_scope" });
    expect(await store.persona("records_raider")).toMatchObject({ trait: "records", intent: "out_of_scope" });

    expect(store.deskFor("clinic")).toBe("sehat");
    expect(store.deskFor("lender")).toBe("rupeesetu");
    expect(store.deskFor("restaurant")).toBe("swaad");
    expect(store.deskFor("clothing")).toBe("nila");
    expect(store.deskFor("property")).toBe("nivas");
    expect(store.verticalOf("sehat")).toBe("clinic");

    const sehat = await store.category("sehat");
    expect(sehat.vertical).toBe("clinic");
    expect(sehat.displayName).toBe("Sehat Clinic");
    expect(sehat.seedPrompt.startsWith("You are Riya, the friendly receptionist for Sehat Clinic")).toBe(true);
    expect(sehat.inScope[0]).toEqual({ topic: "book_appointment", keyDetails: ["patient name", "doctor or problem", "date", "time"] });
    expect(sehat.outOfScope[0]?.desk).toBe("accounts team");
    expect(sehat.rubricId).toBe("default");
    expect(sehat.facts.clinic).toBe("Sehat Family Clinic, Indiranagar, Bengaluru");
    expect(JSON.parse(sehat.facts.doctors ?? "")).toHaveProperty("Dr. Anjali Rao");

    const rubric = await store.rubric(sehat.rubricId);
    expect(rubric.dimensions.map((dimension) => dimension.id)).toEqual([
      "task_completion",
      "hallucination",
      "language_switch",
      "dropped_intents",
      "interruption_handling",
      "repair",
      "tone_empathy",
    ]);
    for (const dimension of rubric.dimensions) {
      expect(dimension.question).toBe(QUESTION[dimension.id as keyof typeof QUESTION]);
      expect(dimension.critical).toBe(false);
    }
  });

  it("builds the same brief the caller engine already uses", async () => {
    const store = await loadFileContentStore(root);
    for (const personaId of PERSONAS) {
      for (const desk of DESKS) {
        const persona = await store.persona(personaId);
        const category = await store.category(desk);
        const fromStore = store.brief(persona, category);
        const direct = callerBrief(await loadPersonaProfile(root, personaId), await loadTargetManifest(root, desk));
        expect(fromStore).toEqual(direct);
      }
    }
  });

  it("names the file and the field when a profile is incomplete", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kasauti-content-"));
    try {
      await mkdir(join(dir, "personas", "angry_uncle"), { recursive: true });
      await mkdir(join(dir, "demo-target"), { recursive: true });
      await writeFile(join(dir, "personas", "angry_uncle", "profile.json"), JSON.stringify({ slug: "angry_uncle", shape: "service_seeker" }));
      await writeFile(join(dir, "demo-target", "sehat.manifest.json"), "{}");
      await expect(loadFileContentStore(dir)).rejects.toThrow(/angry_uncle\/profile\.json/);
      await expect(loadFileContentStore(dir)).rejects.toThrow(/label/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("names the file when the JSON does not parse", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kasauti-content-"));
    try {
      await mkdir(join(dir, "personas", "angry_uncle"), { recursive: true });
      await mkdir(join(dir, "demo-target"), { recursive: true });
      await writeFile(join(dir, "personas", "angry_uncle", "profile.json"), "{");
      await expect(loadFileContentStore(dir)).rejects.toThrow(/angry_uncle\/profile\.json is not valid JSON/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses a version that is not the file's version", async () => {
    const store = await loadFileContentStore(root);
    await expect(store.persona("angry_uncle", "not-the-file")).rejects.toThrow(/angry_uncle\/profile\.json version is/);
  });
});
