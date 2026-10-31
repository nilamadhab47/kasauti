import { describe, expect, it } from "vitest";
import { executeSwitch, holderOf, planSwitch, type OwnedNumber } from "./plan";

const agents = {
  sehat: "agent-sehat",
  rupeesetu: "agent-rupee",
  swaad: "agent-swaad",
};

const line: OwnedNumber = { id: "num-1", phone: "+910000000000", agentId: "agent-rupee" };

describe("planSwitch", () => {
  it("moves the one linked demo number onto the chosen agent", () => {
    const plan = planSwitch({ numbers: [line], knownAgents: agents, toSlug: "sehat" });
    expect(plan).toMatchObject({ action: "move", fromSlug: "rupeesetu", toSlug: "sehat", phoneNumberId: "num-1" });
  });

  it("leaves the number alone when it already answers as that agent", () => {
    const plan = planSwitch({ numbers: [line], knownAgents: agents, toSlug: "rupeesetu" });
    expect(plan.action).toBe("already");
  });

  it("refuses to guess when two demo numbers are linked", () => {
    const plan = planSwitch({
      numbers: [line, { id: "num-2", phone: "+910000000001", agentId: "agent-sehat" }],
      knownAgents: agents,
      toSlug: "swaad",
    });
    expect(plan.action).toBe("refuse");
  });

  it("ignores numbers that are not on a demo agent", () => {
    const plan = planSwitch({
      numbers: [{ id: "other", phone: "+910000000002", agentId: "someone-else" }, line],
      knownAgents: agents,
      toSlug: "sehat",
    });
    expect(plan).toMatchObject({ action: "move", phoneNumberId: "num-1" });
  });
});

describe("executeSwitch", () => {
  it("does not list, unlink, or link while the switch is off", async () => {
    const calls: string[] = [];
    const result = await executeSwitch({
      enabled: false,
      toSlug: "sehat",
      knownAgents: agents,
      list: async () => {
        calls.push("list");
        return [line];
      },
      unlink: async () => {
        calls.push("unlink");
      },
      setup: async () => {
        calls.push("setup");
      },
    });
    expect(result).toMatchObject({ switched: false, enabled: false });
    expect(calls).toEqual([]);
  });

  it("unlinks then links, and confirms the number stuck", async () => {
    const calls: string[] = [];
    let holder = "agent-rupee";
    const result = await executeSwitch({
      enabled: true,
      toSlug: "sehat",
      knownAgents: agents,
      list: async () => [{ ...line, agentId: holder }],
      unlink: async () => {
        calls.push("unlink");
        holder = "";
      },
      setup: async (_id, agentId) => {
        calls.push(`setup:${agentId}`);
        holder = agentId;
      },
    });
    expect(calls).toEqual(["unlink", "setup:agent-sehat"]);
    expect(result).toMatchObject({ switched: true, holder: "sehat" });
  });

  it("puts the number back when the new link fails", async () => {
    const calls: string[] = [];
    const result = await executeSwitch({
      enabled: true,
      toSlug: "sehat",
      knownAgents: agents,
      list: async () => [line],
      unlink: async () => {
        calls.push("unlink");
      },
      setup: async (_id, agentId) => {
        calls.push(`setup:${agentId}`);
        if (agentId === "agent-sehat") throw new Error("setup refused");
      },
    });
    expect(calls).toEqual(["unlink", "setup:agent-sehat", "setup:agent-rupee"]);
    expect(result).toMatchObject({ switched: false, restored: true, holder: "rupeesetu" });
  });
});

describe("holderOf", () => {
  it("names the demo agent that currently holds the one linked number", () => {
    expect(holderOf([line], agents)).toEqual({ slug: "rupeesetu", phone: "+910000000000" });
    expect(holderOf([], agents)).toBeNull();
  });
});
