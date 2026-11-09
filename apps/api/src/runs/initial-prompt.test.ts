import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadTargetManifest } from "../../../../packages/core/src/manifest.ts";
import { initialPromptFor } from "./initial-prompt";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("initialPromptFor", () => {
  it("uses the short Sehat first draft, not a facts prompt", async () => {
    const draft = initialPromptFor(await loadTargetManifest(root, "sehat"));
    expect(draft.startsWith("You are Riya, the friendly receptionist for Sehat Clinic")).toBe(true);
    expect(draft.includes("# ")).toBe(false);
    expect(draft.includes("Dr. Anjali")).toBe(false);
  });

  it("keeps the role sentence as the seed for a desk that was created from it", async () => {
    const manifest = await loadTargetManifest(root, "swaad");
    expect(initialPromptFor(manifest)).toBe(manifest.role);
  });
});
