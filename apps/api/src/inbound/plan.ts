/** One purchased number can answer as one agent at a time. */

export type OwnedNumber = {
  id: string;
  phone: string;
  agentId: string | null;
};

export type SwitchPlan =
  | { action: "already"; phoneNumberId: string; slug: string }
  | { action: "move"; phoneNumberId: string; fromSlug: string | null; fromAgentId: string | null; toSlug: string; toAgentId: string }
  | { action: "refuse"; reason: string };

export type SwitchResult = {
  switched: boolean;
  enabled: boolean;
  already?: boolean;
  restored?: boolean;
  holder?: string | null;
  reason?: string;
};

const SLUGS = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;
export type DemoSlug = (typeof SLUGS)[number];

export function isDemoSlug(value: string): value is DemoSlug {
  return (SLUGS as readonly string[]).includes(value);
}

export function planSwitch(input: {
  numbers: OwnedNumber[];
  knownAgents: Record<string, string>;
  toSlug: string;
}): SwitchPlan {
  const toAgentId = input.knownAgents[input.toSlug];
  if (!toAgentId) return { action: "refuse", reason: "That agent is not on this account." };

  const knownIds = new Set(Object.values(input.knownAgents).filter(Boolean));
  const linked = input.numbers.filter((number) => number.agentId && knownIds.has(number.agentId));
  if (linked.length === 0) return { action: "refuse", reason: "No shared number is linked to a demo agent." };
  if (linked.length > 1) return { action: "refuse", reason: "More than one demo number is linked. Refusing to guess." };

  const line = linked[0];
  if (!line) return { action: "refuse", reason: "No shared number is linked to a demo agent." };
  const fromSlug = Object.entries(input.knownAgents).find(([, id]) => id === line.agentId)?.[0] ?? null;
  if (fromSlug === input.toSlug) return { action: "already", phoneNumberId: line.id, slug: input.toSlug };
  return {
    action: "move",
    phoneNumberId: line.id,
    fromSlug,
    fromAgentId: line.agentId,
    toSlug: input.toSlug,
    toAgentId,
  };
}

type Deps = {
  enabled: boolean;
  toSlug: string;
  knownAgents: Record<string, string>;
  list: () => Promise<OwnedNumber[]>;
  unlink: (phoneNumberId: string) => Promise<void>;
  setup: (phoneNumberId: string, agentId: string) => Promise<void>;
};

/**
 * Moves the shared number only when `enabled` is true.
 * While it is off, this returns before any list, unlink, or setup call.
 */
export async function executeSwitch(deps: Deps): Promise<SwitchResult> {
  if (!deps.enabled) {
    return { switched: false, enabled: false, reason: "Number switch is off. The line stays where it is." };
  }

  const plan = planSwitch({ numbers: await deps.list(), knownAgents: deps.knownAgents, toSlug: deps.toSlug });
  if (plan.action === "refuse") return { switched: false, enabled: true, reason: plan.reason };
  if (plan.action === "already") return { switched: false, enabled: true, already: true, holder: plan.slug };

  await deps.unlink(plan.phoneNumberId);
  try {
    await deps.setup(plan.phoneNumberId, plan.toAgentId);
  } catch (error) {
    const restored = await restore(deps, plan);
    const message = error instanceof Error ? error.message : "Linking the number failed.";
    return {
      switched: false,
      enabled: true,
      restored,
      holder: restored ? plan.fromSlug : null,
      reason: restored ? `${message} The number was put back.` : `${message} The number could not be put back.`,
    };
  }

  const after = planSwitch({ numbers: await deps.list(), knownAgents: deps.knownAgents, toSlug: deps.toSlug });
  if (after.action === "already") return { switched: true, enabled: true, holder: deps.toSlug };

  const restored = await restore(deps, plan);
  return {
    switched: false,
    enabled: true,
    restored,
    holder: restored ? plan.fromSlug : null,
    reason: restored ? "The number did not stick, so it was put back." : "The number did not stick, and it could not be put back.",
  };
}

async function restore(deps: Deps, plan: Extract<SwitchPlan, { action: "move" }>): Promise<boolean> {
  if (!plan.fromAgentId) return false;
  try {
    await deps.setup(plan.phoneNumberId, plan.fromAgentId);
    return true;
  } catch {
    return false;
  }
}

export function last4(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function holderOf(numbers: OwnedNumber[], knownAgents: Record<string, string>): { slug: string; phone: string } | null {
  const knownIds = new Set(Object.values(knownAgents).filter(Boolean));
  const linked = numbers.filter((number) => number.agentId && knownIds.has(number.agentId));
  if (linked.length !== 1) return null;
  const line = linked[0];
  if (!line?.agentId) return null;
  const slug = Object.entries(knownAgents).find(([, id]) => id === line.agentId)?.[0];
  if (!slug) return null;
  return { slug, phone: line.phone };
}
