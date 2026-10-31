import type { Turn } from "../../core/src/index.ts";

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function checkQuote(turns: Turn[], turnIdx: number, quote: string): string | null {
  const turn = turns.find((item) => item.idx === turnIdx);
  if (!turn) return `turn ${turnIdx} does not exist`;
  if (turn.speaker !== "target") return `turn ${turnIdx} is the caller, not the bot`;
  if (!quote.trim()) return "the quote is empty";
  if (!normalizeText(turn.text).includes(normalizeText(quote))) return "the quote is not in that turn";
  return null;
}
