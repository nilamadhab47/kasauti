import { resolve, sep } from "node:path";

export const TERMINAL = new Set([
  "completed",
  "no-answer",
  "busy",
  "failed",
  "canceled",
  "cancelled",
  "stopped",
  "error",
  "balance-low",
]);

export function isTerminal(status: string | null | undefined): boolean {
  return Boolean(status && TERMINAL.has(status));
}

export function assertAllowed(phone: string, allowed: string[]): void {
  if (!allowed.includes(phone)) {
    throw new Error("Refusing to dial a number that is not in ALLOWED_NUMBERS.");
  }
}

/** Fixture replays stay inside the repo's fixtures directory. */
export function fixtureFile(repoRoot: string, relative: string): string {
  if (!relative.startsWith("fixtures/") || !relative.endsWith(".json") || relative.includes("..")) {
    throw new Error("Fixture must be a json file under fixtures/.");
  }
  const root = resolve(repoRoot, "fixtures") + sep;
  const full = resolve(repoRoot, relative);
  if (!full.startsWith(root)) throw new Error("Fixture must be a json file under fixtures/.");
  return full;
}
