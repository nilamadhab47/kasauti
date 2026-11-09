import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { callerBrief } from "./caller-brief.ts";
import { loadPersonaProfile, loadTargetManifest } from "./manifest.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PERSONAS = ["angry_uncle", "lang_switcher", "dialect_bhojpuri", "records_raider", "staff_probe", "rohit"] as const;
const DESKS = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;

describe("callerBrief snapshot", () => {
  it("stays the same for every caller on every desk", async () => {
    const briefs = [];
    for (const persona of PERSONAS) {
      for (const desk of DESKS) {
        briefs.push({
          persona,
          desk,
          brief: callerBrief(await loadPersonaProfile(root, persona), await loadTargetManifest(root, desk)),
        });
      }
    }
    expect(briefs).toMatchSnapshot();
  });
});
