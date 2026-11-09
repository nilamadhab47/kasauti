import type { TargetManifest } from "../../../../packages/core/src/manifest.ts";

/** The first draft lives on the desk manifest. This only trims it. */
export function initialPromptFor(manifest: Pick<TargetManifest, "seed_prompt">): string {
  return manifest.seed_prompt.trim();
}
