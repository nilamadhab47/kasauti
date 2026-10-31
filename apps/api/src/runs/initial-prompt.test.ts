import { describe, expect, it } from "vitest";
import { initialPromptFor } from "./initial-prompt";

describe("initialPromptFor", () => {
  it("uses the short Sehat first draft, not a facts prompt", () => {
    const draft = initialPromptFor("sehat", "Riya, the friendly receptionist");
    expect(draft.startsWith("You are Riya, the friendly receptionist for Sehat Clinic")).toBe(true);
    expect(draft.includes("# ")).toBe(false);
    expect(draft.includes("Dr. Anjali")).toBe(false);
  });

  it("falls back to the role for a desk with no v1 file", () => {
    expect(initialPromptFor("swaad", "Kavya, the friendly host.")).toBe("Kavya, the friendly host.");
  });
});
