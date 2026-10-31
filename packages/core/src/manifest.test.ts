import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPersonaProfile, loadTargetManifest, manifestSlugOf, parsePersonaProfile, parseTargetManifest } from "./manifest.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const TARGETS = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;
const PERSONAS = ["angry_uncle", "lang_switcher", "dialect_bhojpuri", "records_raider", "staff_probe", "rohit"] as const;

describe("manifest loaders", () => {
  it("loads the Sehat manifest and the other four that wait for a later round", async () => {
    const sehat = await loadTargetManifest(root, "sehat");
    expect(sehat.display_name).toBe("Sehat Clinic");
    expect(sehat.out_of_scope[0]?.topic).toBe("refund");
    for (const slug of TARGETS) {
      expect((await loadTargetManifest(root, slug)).slug).toBe(slug);
    }
  });

  it("loads every persona profile", async () => {
    for (const slug of PERSONAS) {
      expect((await loadPersonaProfile(root, slug)).slug).toBe(slug);
    }
  });

  it("names the missing field when a manifest is incomplete", () => {
    expect(() =>
      parseTargetManifest("sehat.manifest.json", {
        slug: "sehat",
        display_name: "Sehat Clinic",
        role: "Riya",
        languages: ["en"],
        in_scope: [{ topic: "book_appointment", key_details: ["name"] }],
        out_of_scope: [{ topic: "refund", key_details: ["amount"] }],
        facts: {},
        never_say: ["I have processed your refund"],
        callback_default_window: "within 24 hours",
        bolna: { default_transcriber_language: "multi" },
      }),
    ).toThrow(/out_of_scope\.0\.desk/);
  });

  it("maps the Sehat target name to the sehat manifest", () => {
    expect(manifestSlugOf("Sehat Clinic")).toBe("sehat");
    expect(manifestSlugOf("RupeeSetu Finance")).toBe("rupeesetu");
    expect(manifestSlugOf("unknown desk")).toBeNull();
  });

  it("rejects a persona shape that is not one of the six", () => {
    expect(() => parsePersonaProfile("angry_uncle/profile.json", { slug: "angry_uncle", shape: "receptionist" })).toThrow(/shape/);
  });
});
