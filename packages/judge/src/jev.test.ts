import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadTargetManifest } from "../../core/src/index.ts";
import { judgeState } from "./jev.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("judgeState", () => {
  it("tells the judge a Sehat refund is out of scope and a booking is in scope", async () => {
    const sehat = await loadTargetManifest(root, "sehat");
    const state = judgeState({
      facts: sehat.facts,
      targetTask: sehat.role,
      callerGoal: "Get the consultation fee back.",
      successCriteria: ["Offers a callback"],
      inScope: sehat.in_scope,
      outOfScope: sehat.out_of_scope,
      turns: [],
    });

    expect(state.in_scope.map((item) => item.topic)).toContain("book_appointment");
    expect(state.out_of_scope.map((item) => item.topic)).toContain("refund");
    expect(state.out_of_scope[0]?.desk).toBe("accounts team");
  });
});
