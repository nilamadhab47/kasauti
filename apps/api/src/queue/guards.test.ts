import { describe, expect, it } from "vitest";
import { assertAllowed, fixtureFile, isTerminal } from "./guards";

describe("queue guards", () => {
  it("treats completed as finished and call-disconnected as still open", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("call-disconnected")).toBe(false);
    expect(isTerminal(null)).toBe(false);
  });

  it("refuses a number that is not on the allowlist", () => {
    expect(() => assertAllowed("+911234567890", ["+917965480975"])).toThrow(/ALLOWED_NUMBERS/);
    expect(() => assertAllowed("+917965480975", ["+917965480975"])).not.toThrow();
  });

  it("rejects a fixture path that leaves the fixtures directory", () => {
    expect(() => fixtureFile("/repo", "../.env")).toThrow(/fixtures/);
    expect(fixtureFile("/repo", "fixtures/test-b-32ea6d7d.json")).toBe("/repo/fixtures/test-b-32ea6d7d.json");
  });
});
