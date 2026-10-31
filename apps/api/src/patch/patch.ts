/**
 * Push a merged prompt block to a live Bolna agent.
 * The engine must never write to Bolna while the gate is off, even if the gate flips mid-run.
 * The first write replaces the live prompt. Later writes layer a dated section under the Kasauti footer.
 */

import { kasautiFooter, patchMode, sanitizePatchBlock } from "../../../../packages/judge/src/claude.ts";
import { withHindiClose } from "./live-agent.ts";

const FOOTER_LINE = /^-- maintained by Kasauti, last reviewed \d{4}-\d{2}-\d{2} --$/;

/** A prompt we have already rewritten carries this line. The first draft does not. */
export function hasKasautiFooter(prompt: string): boolean {
  return prompt.includes("-- maintained by Kasauti, last reviewed ");
}

export type PatchPlan =
  | { action: "off"; reason: string }
  | { action: "no-agent"; reason: string }
  | { action: "empty"; reason: string }
  | { action: "apply"; agentId: string; newPrompt: string };

export type PatchResult = {
  ok: boolean;
  applied: boolean;
  mode?: "replace" | "append";
  reason?: string;
  before?: { length: number };
  after?: { length: number };
};

export function stripKasautiFooter(text: string): string {
  const lines = text.trimEnd().split("\n");
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") lines.pop();
  const last = lines[lines.length - 1]?.trim();
  if (last && FOOTER_LINE.test(last)) lines.pop();
  return lines.join("\n").trimEnd();
}

/** Replace when the live prompt has no footer. Append a dated section when it does. Exactly one footer remains. */
export function composePrompt(input: { current: string; block: string; today: string; title?: string }): {
  mode: "replace" | "append";
  prompt: string;
} {
  const mode = patchMode(input.current);
  const footer = kasautiFooter(input.today);
  const body = stripKasautiFooter(input.block).trim();
  if (mode === "replace") return { mode, prompt: `${body}\n\n${footer}\n` };

  const kept = stripKasautiFooter(input.current).trimEnd();
  const title = input.title?.trim() || "follow-up";
  const section = body.startsWith(`### Patch ${input.today}`) ? body : `### Patch ${input.today}: ${title}\n\n${body}`;
  const sep = kept ? "\n\n" : "";
  return { mode, prompt: `${kept}${sep}${section}\n\n${footer}\n` };
}

/**
 * Paste every caller's fix onto the one desk prompt, then write it once.
 * The first fix replaces a draft that has no footer. The rest are dated sections under that same footer.
 */
export function stackPatches(input: {
  current: string;
  today: string;
  parts: { block: string; title?: string; hindi?: boolean }[];
}): { mode: "replace" | "append"; prompt: string; markers: string[] } {
  let current = input.current;
  let mode: "replace" | "append" = patchMode(input.current);
  const markers: string[] = [];
  for (const part of input.parts) {
    const cleaned = (part.hindi ? withHindiClose(sanitizePatchBlock(part.block)) : sanitizePatchBlock(part.block)).trim();
    if (!cleaned) continue;
    const composed = composePrompt({ current, block: cleaned, today: input.today, title: part.title });
    if (markers.length === 0) mode = composed.mode;
    current = composed.prompt;
    const marker = stripKasautiFooter(cleaned).trim().slice(0, 48);
    if (marker) markers.push(marker);
  }
  return { mode, prompt: current, markers };
}

/** A block belongs to one caller when its evidence lists only that call. A shared block is not used here. */
export function blockForCall(
  fixes: { dimension: string | null; suggestion: string | null; evidenceCallIds?: string[] | null }[],
  callId: string,
): string {
  const own = fixes.find(
    (row) => row.dimension === "block" && row.evidenceCallIds?.length === 1 && row.evidenceCallIds[0] === callId && Boolean(row.suggestion?.trim()),
  );
  return own?.suggestion?.trim() ?? "";
}

export function planPatch(input: { enabled: boolean; agentId: string | null; block: string }): PatchPlan {
  if (!input.enabled) return { action: "off", reason: "Patching is off. The agent prompt stays where it is." };
  if (!input.agentId) return { action: "no-agent", reason: "No Bolna agent is linked for this bot." };
  if (!input.block.trim()) return { action: "empty", reason: "No patch was produced for this run." };
  return { action: "apply", agentId: input.agentId, newPrompt: input.block.trim() };
}

type Deps = {
  enabled: boolean;
  agentId: string | null;
  block: string;
  today: string;
  /** A one-line fix must not replace the whole prompt. It layers on only after the full prompt is in place. */
  scope?: "full" | "line";
  title?: string;
  /** A Hindi call gets one Devanagari close. An English call keeps the English escalation lines. */
  hindi?: boolean;
  /** Several caller fixes for one desk. Each is cleaned, then they are written in one prompt. */
  parts?: { block: string; title?: string; hindi?: boolean }[];
  read: (agentId: string) => Promise<string>;
  write: (agentId: string, next: string) => Promise<void>;
};

/**
 * Reads the current prompt, composes the next one, writes it, then reads back.
 * While the gate is off, this function returns before any read or write.
 */
export async function executePatch(deps: Deps): Promise<PatchResult> {
  const parts = (deps.parts ?? []).filter((part) => part.block.trim());
  const plan = planPatch({
    enabled: deps.enabled,
    agentId: deps.agentId,
    block: parts.length > 0 ? parts.map((part) => part.block).join("\n") : deps.block,
  });
  if (plan.action !== "apply") return { ok: false, applied: false, reason: plan.reason };

  const before = await deps.read(plan.agentId);
  const stacked = parts.length > 0 ? stackPatches({ current: before, today: deps.today, parts }) : null;
  const cleaned = deps.hindi ? withHindiClose(sanitizePatchBlock(deps.block)) : sanitizePatchBlock(deps.block);
  if (stacked ? stacked.markers.length === 0 : !cleaned.trim()) {
    return { ok: false, applied: false, reason: "No patch was produced for this run." };
  }
  const composed = stacked ?? composePrompt({ current: before, block: cleaned, today: deps.today, title: deps.title });
  const markers = stacked?.markers ?? [stripKasautiFooter(cleaned).trim().slice(0, 48)].filter((marker) => marker.length > 0);
  if (deps.scope === "line" && composed.mode === "replace") {
    return {
      ok: false,
      applied: false,
      mode: "replace",
      reason: "A one-line fix waits until the full prompt is in place.",
      before: { length: before.length },
    };
  }
  if (composed.prompt === before) {
    return { ok: true, applied: false, mode: composed.mode, reason: "The patch is already on the agent.", before: { length: before.length }, after: { length: composed.prompt.length } };
  }

  await deps.write(plan.agentId, composed.prompt);
  const after = await deps.read(plan.agentId);
  const stuck = markers.length > 0 && markers.every((marker) => after.includes(marker));
  return {
    ok: stuck,
    applied: stuck,
    mode: composed.mode,
    reason: stuck ? undefined : "The patch did not stick on the agent.",
    before: { length: before.length },
    after: { length: after.length },
  };
}
