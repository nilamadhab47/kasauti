import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { languageOf, metricsOf, parseTranscript } from "./index.ts";

describe("parseTranscript", () => {
  it("returns nothing for an empty transcript", () => {
    expect(parseTranscript("")).toEqual([]);
    expect(parseTranscript(null)).toEqual([]);
  });

  it("joins a leading line onto the first turn and keeps Devanagari", () => {
    const turns = parseTranscript("before\nassistant: हेलो 😀\nuser: ok");
    expect(turns[0]).toMatchObject({ speaker: "persona", text: "before हेलो 😀", lang: "mixed" });
    expect(turns[1]).toMatchObject({ speaker: "target", lang: "en" });
  });

  it("parses the short clinic call into the recorded turn counts", () => {
    const execution = JSON.parse(readFileSync(new URL("../../../fixtures/test-b-32ea6d7d.json", import.meta.url), "utf8")) as {
      transcript: string;
    };
    const turns = parseTranscript(execution.transcript);
    const metrics = metricsOf(turns);
    expect(metrics.persona_turns).toBe(12);
    expect(metrics.target_turns).toBe(19);
    expect(turns[1].text).toContain("हाउ कैन आई हेल्प यू");
    expect(languageOf("Hello clinic")).toBe("en");
    expect(languageOf("Hello हाँ")).toBe("mixed");
  });
});
