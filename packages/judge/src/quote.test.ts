import { describe, expect, it } from "vitest";
import { parseTranscript } from "../../core/src/index.ts";
import { settleScore } from "./cells.ts";
import { checkQuote } from "./quote.ts";
import { callVerdict } from "../../core/src/verdict.ts";

const turns = parseTranscript("assistant: refund chahiye\nuser: I cancelled appointment 241");

describe("checkQuote", () => {
  it("accepts a verbatim slice of a target turn", () => {
    expect(checkQuote(turns, 1, "appointment 241")).toBeNull();
  });

  it("rejects a quote that is not in the turn", () => {
    expect(checkQuote(turns, 1, "refund processed")).toMatch(/not in that turn/);
  });

  it("rejects a quote taken from the caller", () => {
    expect(checkQuote(turns, 0, "refund chahiye")).toMatch(/caller/);
  });
});

describe("settleScore", () => {
  it("hides a low-confidence score from the verdict", () => {
    expect(settleScore(1.2, 0.2).score).toBeNull();
    expect(settleScore(1.2, 0.2).cell).toBe("grey");
    expect(settleScore(2.35, 0.4)).toMatchObject({ rounded: 2, score: 2, cell: "amber" });
    expect(settleScore(3.2, 0.4)).toMatchObject({ rounded: 3, score: 3, cell: "green" });
    expect(settleScore(4.6, 0.91)).toMatchObject({ rounded: 5, score: 5, cell: "green" });
    expect(settleScore(3.97, 0.33, { "3": 0.13, "4": 0.25, "5": 0.49 })).toMatchObject({ rounded: 4, score: 4, cell: "green" });
    expect(settleScore(1.85, 0.2, { "0": 0.02, "1": 0.53, "2": 0.21 })).toMatchObject({ score: null, cell: "grey" });
  });
});

describe("callVerdict", () => {
  it("is red when the bot invents a fact", () => {
    expect(
      callVerdict({
        scores: [
          { dimension: "hallucination", score: 1 },
          { dimension: "task_completion", score: 4 },
          { dimension: "tone_empathy", score: 4 },
        ],
        critical: ["hallucination", "task_completion", "tone_empathy"],
        targetTurns: 10,
        status: "completed",
      }),
    ).toBe("red");
  });

  it("is green when every critical score is acceptable", () => {
    expect(
      callVerdict({
        scores: [
          { dimension: "hallucination", score: 3 },
          { dimension: "task_completion", score: 3 },
          { dimension: "tone_empathy", score: 4 },
        ],
        critical: ["hallucination", "task_completion", "tone_empathy"],
        targetTurns: 10,
        status: "completed",
      }),
    ).toBe("green");
  });

  it("stays amber when a score outside the caller's critical list is 1", () => {
    expect(
      callVerdict({
        scores: [
          { dimension: "hallucination", score: 1 },
          { dimension: "task_completion", score: 2 },
          { dimension: "repair", score: 2 },
          { dimension: "dropped_intents", score: null },
        ],
        critical: ["task_completion", "dropped_intents", "repair"],
        targetTurns: 10,
        status: "completed",
      }),
    ).toBe("amber");
  });

  it("stays amber when a critical score is a 2", () => {
    expect(
      callVerdict({
        scores: [
          { dimension: "hallucination", score: 2 },
          { dimension: "task_completion", score: 4 },
          { dimension: "tone_empathy", score: 4 },
        ],
        critical: ["hallucination", "task_completion", "tone_empathy"],
        targetTurns: 10,
        status: "completed",
      }),
    ).toBe("amber");
  });
});
