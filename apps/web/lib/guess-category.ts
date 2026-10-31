import { CATEGORY_IDS, type CategoryId } from "./caller-packs";

const HINTS: Record<CategoryId, string[]> = {
  clinic: ["clinic", "doctor", "patient", "appointment", "hospital", "receptionist", "paediatric", "physician"],
  lender: ["loan", "emi", "nbfc", "borrower", "repayment", "auto-debit", "lender"],
  restaurant: ["restaurant", "table for", "reservation", "kitchen", "menu", "dine", "biryani", "thali"],
  clothing: ["shopify", "kurta", "saree", "clothing", "apparel", "whatsapp shop", "exchange", "delivery address"],
  property: ["site visit", "bhk", "flat", "property", "builder", "apartment", "possession", "token amount"],
};

export function guessCategory(text: string): CategoryId | null {
  const haystack = text.toLowerCase();
  const scores = CATEGORY_IDS.map((id) => ({
    id,
    score: HINTS[id].reduce((sum, hint) => sum + (haystack.includes(hint) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  if (!best || best.score < 2 || best.score <= (second?.score ?? 0)) return null;
  return best.id;
}
