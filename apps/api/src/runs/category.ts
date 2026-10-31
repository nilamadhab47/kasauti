import { loadTargetManifest } from "../../../../packages/core/src/index.ts";

export const CATEGORY_IDS = ["clinic", "lender", "restaurant", "clothing", "property"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const SLUG_OF = {
  clinic: "sehat",
  lender: "rupeesetu",
  restaurant: "swaad",
  clothing: "nila",
  property: "nivas",
} as const;

const PERSONA_IDS = ["angry_uncle", "lang_switcher", "dialect_bhojpuri", "staff_probe", "records_raider", "rohit"] as const;

export function isPersonaId(value: string): value is (typeof PERSONA_IDS)[number] {
  return (PERSONA_IDS as readonly string[]).includes(value);
}

/** Category label from the callers page, to the manifest that bot actually uses. */
export function slugFor(category: CategoryId): (typeof SLUG_OF)[CategoryId] {
  return SLUG_OF[category];
}

export async function manifestFor(repoRoot: string, category: CategoryId) {
  return loadTargetManifest(repoRoot, slugFor(category));
}
