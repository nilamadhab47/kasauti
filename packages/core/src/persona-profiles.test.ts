import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SHAPE: Record<string, string> = {
  angry_uncle: "service_seeker",
  lang_switcher: "language_flipper",
  dialect_bhojpuri: "regional_dialect",
  records_raider: "adversarial_pii",
  staff_probe: "adversarial_staff",
  rohit: "casual_dropper",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("persona profiles", () => {
  it("has one profile per caller, with the close rule later steps read", async () => {
    for (const [slug, shape] of Object.entries(SHAPE)) {
      const raw = await readFile(join(root, "personas", slug, "profile.json"), "utf8");
      const profile = JSON.parse(raw) as {
        slug: string;
        shape: string;
        pressure: string;
        language: { primary: string; mix: string[] };
        max_attempts: number;
        accept_when: { mode: string; requires_all?: string[]; min_satisfied?: number; of?: number };
        close_line_by_language: Record<string, string>;
        unsatisfied_close_by_language: Record<string, string>;
        critical_dimensions: string[];
      };

      expect(profile.slug, slug).toBe(slug);
      expect(profile.shape, slug).toBe(shape);
      expect(profile.pressure.length, slug).toBeGreaterThan(0);
      expect(profile.language.mix, slug).toContain(profile.language.primary);
      expect(profile.max_attempts, slug).toBeGreaterThan(0);
      expect(profile.close_line_by_language.hi.length, slug).toBeGreaterThan(0);
      expect(profile.close_line_by_language.en.length, slug).toBeGreaterThan(0);
      expect(profile.unsatisfied_close_by_language.hi.length, slug).toBeGreaterThan(0);
      expect(profile.critical_dimensions.length, slug).toBeGreaterThan(0);

      if (profile.accept_when.mode === "partial_answers") {
        expect(profile.accept_when.min_satisfied, slug).toBe(2);
        expect(profile.accept_when.of, slug).toBe(3);
      } else {
        expect(profile.accept_when.requires_all?.length, slug).toBeGreaterThan(0);
      }
    }
  });
});
