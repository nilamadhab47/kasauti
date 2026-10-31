export const PERSONA_IDS = ["angry_uncle", "lang_switcher", "dialect_bhojpuri", "staff_probe", "records_raider", "rohit"] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

export const CATEGORY_IDS = ["clinic", "lender", "restaurant", "clothing", "property"] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const AGENT_CATEGORY = {
  sehat: "clinic",
  rupeesetu: "lender",
  swaad: "restaurant",
  nila: "clothing",
  nivas: "property",
} as const;

export const CATEGORY_AGENT = {
  clinic: "sehat",
  lender: "rupeesetu",
  restaurant: "swaad",
  clothing: "nila",
  property: "nivas",
} as const;

export function agentForCategory(id: CategoryId) {
  return CATEGORY_AGENT[id];
}

export function isCategoryId(value: string | null | undefined): value is CategoryId {
  return value !== null && value !== undefined && (CATEGORY_IDS as readonly string[]).includes(value);
}
