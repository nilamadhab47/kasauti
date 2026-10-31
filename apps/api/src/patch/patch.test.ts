import { describe, expect, it } from "vitest";
import { kasautiFooter } from "../../../../packages/judge/src/claude.ts";
import { HINDI_CLOSE } from "./live-agent";
import { blockForCall, composePrompt, executePatch, hasKasautiFooter, planPatch, stackPatches } from "./patch";

const today = "2026-10-30";
const base = `You are Riya, the friendly receptionist for Sehat Clinic.
Ask for the patient's name, the doctor or problem, and a preferred date and time.`;
const full = `# Role

You are Riya, the desk at Sehat Clinic. A refund goes to the accounts team. Raise a ticket and promise a callback within 24 hours.`;

describe("composePrompt", () => {
  it("replaces the live prompt on the first touch and leaves one footer", () => {
    const next = composePrompt({ current: base, block: full, today });
    expect(next.mode).toBe("replace");
    expect(next.prompt).not.toContain("Ask for the patient's name");
    expect(next.prompt).toContain("accounts team");
    expect(next.prompt.trimEnd().endsWith(kasautiFooter(today))).toBe(true);
    expect(next.prompt.match(/maintained by Kasauti/g)?.length).toBe(1);
  });

  it("appends a dated section once the footer is already there", () => {
    const first = composePrompt({ current: base, block: full, today });
    const second = composePrompt({
      current: first.prompt,
      block: "Also confirm the callback number.",
      today,
      title: "callback number",
    });
    expect(second.mode).toBe("append");
    expect(second.prompt).toContain("accounts team");
    expect(second.prompt).toContain(`### Patch ${today}: callback number`);
    expect(second.prompt).toContain("Also confirm the callback number.");
    expect(second.prompt.match(/maintained by Kasauti/g)?.length).toBe(1);
  });
});

describe("stackPatches", () => {
  it("pastes every caller fix into one desk prompt and leaves one footer", () => {
    const next = stackPatches({
      current: base,
      today,
      parts: [
        { block: full, title: "Sharma ji" },
        { block: "Confirm the date before you close.", title: "Rohit" },
      ],
    });
    expect(next.mode).toBe("replace");
    expect(next.prompt).toContain("accounts team");
    expect(next.prompt).toContain(`### Patch ${today}: Rohit`);
    expect(next.prompt).toContain("Confirm the date before you close.");
    expect(next.prompt.match(/maintained by Kasauti/g)?.length).toBe(1);
    expect(next.markers).toHaveLength(2);
  });

  it("appends onto a desk that already has a footer", () => {
    const live = composePrompt({ current: base, block: full, today }).prompt;
    const next = stackPatches({
      current: live,
      today,
      parts: [
        { block: "Ask the question they dropped.", title: "Neha" },
        { block: "Confirm the date before you close.", title: "Rohit" },
      ],
    });
    expect(next.mode).toBe("append");
    expect(next.prompt).toContain("accounts team");
    expect(next.prompt).toContain(`### Patch ${today}: Neha`);
    expect(next.prompt).toContain(`### Patch ${today}: Rohit`);
    expect(next.prompt.match(/maintained by Kasauti/g)?.length).toBe(1);
  });
});

describe("hasKasautiFooter", () => {
  it("is true only after a Kasauti rewrite", () => {
    expect(hasKasautiFooter(`You are Riya.\n\n${kasautiFooter(today)}`)).toBe(true);
    expect(hasKasautiFooter("You are Riya.")).toBe(false);
  });
});

describe("blockForCall", () => {
  it("returns the block stored for that caller and ignores a shared block", () => {
    const fixes = [
      { dimension: "block", suggestion: "shared", evidenceCallIds: ["a", "b"] },
      { dimension: "block", suggestion: "for a", evidenceCallIds: ["a"] },
      { dimension: "prompt", suggestion: "line", evidenceCallIds: ["b"] },
    ];
    expect(blockForCall(fixes, "a")).toBe("for a");
    expect(blockForCall(fixes, "b")).toBe("");
  });
});

describe("planPatch", () => {
  it("stays off when the gate is off", () => {
    expect(planPatch({ enabled: false, agentId: "a", block: "x" }).action).toBe("off");
  });
  it("refuses when no bolna agent is linked", () => {
    expect(planPatch({ enabled: true, agentId: null, block: "x" }).action).toBe("no-agent");
  });
  it("refuses when the merged block is empty", () => {
    expect(planPatch({ enabled: true, agentId: "a", block: "   " }).action).toBe("empty");
  });
  it("applies when the gate is on and the inputs are present", () => {
    expect(planPatch({ enabled: true, agentId: "a", block: "x" }).action).toBe("apply");
  });
});

describe("executePatch", () => {
  it("does not read or write while the gate is off", async () => {
    const calls: string[] = [];
    const result = await executePatch({
      enabled: false,
      agentId: "a",
      block: "fix",
      today,
      read: async () => {
        calls.push("read");
        return "";
      },
      write: async () => {
        calls.push("write");
      },
    });
    expect(calls).toEqual([]);
    expect(result).toMatchObject({ ok: false, applied: false });
  });

  it("replaces the stored prompt and confirms it stuck", async () => {
    let stored = base;
    const result = await executePatch({
      enabled: true,
      agentId: "a1",
      block: full,
      today,
      read: async () => stored,
      write: async (_id, next) => {
        stored = next;
      },
    });
    expect(stored).toContain("accounts team");
    expect(stored).not.toContain("Ask for the patient's name");
    expect(result).toMatchObject({ ok: true, applied: true, mode: "replace" });
  });

  it("does not let a one-line fix replace the whole prompt", async () => {
    const writes: string[] = [];
    const result = await executePatch({
      enabled: true,
      agentId: "a1",
      block: "Confirm the callback number.",
      today,
      scope: "line",
      read: async () => base,
      write: async (_id, next) => {
        writes.push(next);
      },
    });
    expect(writes).toEqual([]);
    expect(result).toMatchObject({ ok: false, applied: false, mode: "replace" });
    expect(result.reason).toMatch(/full prompt/);
  });

  it("writes the Hindi close and drops the quoted English desk line", async () => {
    let stored = base;
    const block = [
      "### Patch 2026-10-31: Close the order",
      'Say "I\'ll raise a ticket for the order desk."',
      "The order is SW-1842.",
      "Acknowledge the request in the caller's words, name the desk, and promise the time window.",
      "Confirm the day they asked for.",
    ].join("\n");
    await executePatch({
      enabled: true,
      agentId: "a1",
      block,
      today,
      hindi: true,
      read: async () => stored,
      write: async (_id, next) => {
        stored = next;
      },
    });
    expect(stored).toContain(HINDI_CLOSE);
    expect(stored).toContain("Confirm the day they asked for.");
    expect(stored).not.toContain("order desk");
    expect(stored).not.toContain("SW-1842");
    expect(stored).not.toContain("name the desk");
    expect(stored.match(/maintained by Kasauti/g)?.length).toBe(1);
  });

  it("keeps the English escalation lines when the call is not Hindi", async () => {
    let stored = `You are Ananya.\n\n${kasautiFooter("2026-10-30")}`;
    const block = [
      "### Patch 2026-10-31: Close the order",
      "Acknowledge the request in the caller's words, name the desk, and promise the time window.",
      "Confirm the day they asked for.",
    ].join("\n");
    await executePatch({
      enabled: true,
      agentId: "a1",
      block,
      today,
      read: async () => stored,
      write: async (_id, next) => {
        stored = next;
      },
    });
    expect(stored).toContain("name the desk");
    expect(stored).not.toContain("मैं यह यहाँ नहीं देख सकती");
  });

  it("flags a write that did not stick", async () => {
    const result = await executePatch({
      enabled: true,
      agentId: "a1",
      block: full,
      today,
      read: async () => base,
      write: async () => {
        /* pretend it worked but nothing changed */
      },
    });
    expect(result).toMatchObject({ ok: false, applied: false, mode: "replace" });
    expect(result.reason).toMatch(/did not stick/);
  });
});
