import { describe, expect, it } from "vitest";
import { DIMENSIONS, QUESTION } from "./rubric.ts";

describe("task_completion question", () => {
  it("scores a ticket and a callback as success when the bot cannot do the thing live", () => {
    const question = QUESTION.task_completion;
    expect(question).toContain("raise a ticket");
    expect(question).toContain("callback with a time window");
    expect(question).toContain("That is a 4.");
    expect(question).toContain("Score 3 only when");
    expect(question).toContain("is a 5.");
    expect(question).toContain("missing thank-you");
    expect(question).toContain("small slip");
    expect(question).toContain("hanging up");
    expect(question).toContain("Score only the target.");
  });

  it("leaves the other six questions in place", () => {
    const others = DIMENSIONS.filter((dimension) => dimension !== "task_completion");
    expect(others).toHaveLength(6);
    for (const dimension of others) {
      expect(QUESTION[dimension].length).toBeGreaterThan(0);
      expect(QUESTION[dimension]).not.toContain("raise a ticket");
      if (dimension === "language_switch" || dimension === "dropped_intents") {
        expect(QUESTION[dimension]).toContain("thank-you");
      }
    }
  });
});
