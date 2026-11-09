import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SLUGS = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function load(slug: string) {
  const raw = await readFile(join(root, "demo-target", `${slug}.manifest.json`), "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("target manifests", () => {
  it("has one file per demo bot, with the fields later steps read", async () => {
    for (const slug of SLUGS) {
      const manifest = await load(slug);
      expect(manifest.slug, slug).toBe(slug);
      expect(typeof manifest.vertical, slug).toBe("string");
      expect(typeof manifest.display_name, slug).toBe("string");
      expect(typeof manifest.role, slug).toBe("string");
      expect(typeof manifest.seed_prompt, slug).toBe("string");
      expect(manifest.languages, slug).toEqual(["en", "hi", "en-hi"]);

      const inScope = manifest.in_scope as { topic: string; key_details: string[] }[];
      const outOfScope = manifest.out_of_scope as {
        topic: string;
        desk: string;
        window: string;
        key_details: string[];
        channel: string;
      }[];
      expect(inScope.length, slug).toBeGreaterThan(0);
      expect(outOfScope.length, slug).toBeGreaterThan(0);
      for (const item of inScope) {
        expect(item.topic.length, slug).toBeGreaterThan(0);
        expect(item.key_details.length, slug).toBeGreaterThan(0);
      }
      for (const item of outOfScope) {
        expect(item.desk.length, slug).toBeGreaterThan(0);
        expect(item.window.length, slug).toBeGreaterThan(0);
        expect(item.key_details.length, slug).toBeGreaterThan(0);
        expect(item.channel.length, slug).toBeGreaterThan(0);
      }

      expect(typeof manifest.facts, slug).toBe("object");
      expect((manifest.never_say as string[]).length, slug).toBeGreaterThan(0);
      expect(manifest.callback_default_window, slug).toBe("within 24 hours");
      expect((manifest.bolna as { default_transcriber_language: string }).default_transcriber_language, slug).toBe("multi");
    }
  });
});
