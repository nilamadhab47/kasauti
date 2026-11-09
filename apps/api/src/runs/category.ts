import { loadFileContentStore, loadTargetManifest } from "../../../../packages/core/src/index.ts";

export const CATEGORY_IDS = ["clinic", "lender", "restaurant", "clothing", "property"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

const stores = new Map<string, ReturnType<typeof loadFileContentStore>>();

function catalog(root: string) {
  const pending = stores.get(root) ?? loadFileContentStore(root);
  stores.set(root, pending);
  return pending;
}

/** The desk slug for a vertical. The pairing lives on the manifest, not in this file. */
export async function slugFor(root: string, category: CategoryId): Promise<string> {
  return (await catalog(root)).deskFor(category);
}

export async function manifestFor(root: string, category: CategoryId) {
  return loadTargetManifest(root, await slugFor(root, category));
}
