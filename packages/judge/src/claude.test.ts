import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPersonaProfile, loadTargetManifest } from "../../core/src/index.ts";
import { MERGE_SYSTEM, kasautiFooter, mergeAsk, patchMode, promptQuotesATrap, sanitizePatchBlock, withRequiredEscalation } from "./claude.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("merge ask", () => {
  it("tells Claude to replace the Sehat prompt with a spokesperson escalation, not a one-line rule", async () => {
    const manifest = await loadTargetManifest(root, "sehat");
    const profile = await loadPersonaProfile(root, "angry_uncle");
    const today = "2026-10-30";
    const ask = mergeAsk({
      targetManifest: manifest,
      currentPrompt: "You are Riya. Help callers book doctor appointments.",
      failures: [{ who: "angry_uncle", quote: "May I have your name?", line: "It kept asking for the name.", profile }],
      mode: "replace",
      today,
      transcriberLanguage: "en",
    });

    expect(MERGE_SYSTEM).toContain("Do not assume a specific industry");
    expect(MERGE_SYSTEM).toContain("anything else I can help with.");
    expect(MERGE_SYSTEM).toContain("Do not create a ticket number");
    expect(MERGE_SYSTEM).toContain("Do not invent a name, a phone number, an amount, or a code.");
    expect(MERGE_SYSTEM).toContain("Do not repeat a reference code");
    expect(MERGE_SYSTEM).toContain("A model says a sentence it was shown.");
    expect(MERGE_SYSTEM).not.toContain("disconnect");
    expect(MERGE_SYSTEM).not.toContain("goodbye");
    expect(MERGE_SYSTEM).not.toContain("cannot provide a callback");
    expect(promptQuotesATrap("The call will now disconnect. Goodbye.")).toBe(true);
    expect(promptQuotesATrap("A supervisor will call within 24 hours.")).toBe(false);
    expect(ask).toContain("Do not repeat a reference code");
    expect(ask).not.toContain("Read those digits back.");
    expect(ask).toContain("Do not add a heading that lists sentences to avoid.");
    expect(ask).not.toContain("disconnect");
    expect(ask).not.toContain("I have reversed that debit");
    expect(ask).toContain("Mode: replace");
    expect(ask).toContain("Live transcriber language: en");
    expect(ask).toContain("accounts team");
    expect(ask).not.toContain("SC-4471");
    expect(ask).toContain("Speak money as rupees.");
    expect(ask).toContain("service_seeker");
    expect(ask).toContain(kasautiFooter(today));
    expect(ask).not.toContain("3 to 5 bullet cases");
  });

  it("asks for a dated section once the footer is already on the prompt", async () => {
    const today = "2026-10-30";
    const live = `You are Riya.\n\n${kasautiFooter("2026-10-29")}`;
    expect(patchMode(live)).toBe("append");
    expect(patchMode("You are Riya.")).toBe("replace");
    const manifest = await loadTargetManifest(root, "sehat");
    const profile = await loadPersonaProfile(root, "angry_uncle");
    const ask = mergeAsk({
      targetManifest: manifest,
      currentPrompt: live,
      failures: [{ who: "angry_uncle", quote: "May I have your name?", line: "It kept asking for the name.", profile }],
      mode: "append",
      today,
    });
    expect(ask).toContain(`### Patch ${today}:`);
  });

  it("adds the shared escalation lines and keeps a single footer", () => {
    const today = "2026-10-30";
    const footer = kasautiFooter(today);
    const next = withRequiredEscalation(`You are Priya.\n\n${footer}`, footer);
    expect(next).toContain("Do not create a ticket number or a reference code.");
    expect(next).toContain("Do not repeat a reference code, an order id, a flat number, or a phone number.");
    expect(next).toContain("Speak money as rupees.");
    expect(next).toContain("Do not invent a name, a phone number, an amount, or a code.");
    expect(next).toContain("If the caller will not repeat a number, raise the ticket from what they already said.");
    expect(next).not.toContain("one digit at a time");
    expect(next).toContain("Acknowledge the request in the caller's words, name the desk, and promise the time window.");
    expect(next.trimEnd().endsWith(footer)).toBe(true);
    expect(next.split(footer).length).toBe(2);
    expect(promptQuotesATrap(next)).toBe(false);
  });
});

describe("sanitizePatchBlock", () => {
  const footer = kasautiFooter("2026-10-31");

  it("drops a quoted sentence, a code, a rupee amount, and a phone number, and keeps the footer", () => {
    const block = [
      "### Patch 2026-10-31: Close the order",
      'Say "I\'ll raise a ticket for the order desk."',
      "The order is SW-1842.",
      "The fee is ₹2,400.",
      "Call 9876543210 if needed.",
      "Confirm the day they asked for.",
      footer,
    ].join("\n");
    const next = sanitizePatchBlock(block);
    expect(next).not.toContain("order desk");
    expect(next).not.toContain("SW-1842");
    expect(next).not.toContain("₹");
    expect(next).not.toContain("9876543210");
    expect(next).toContain("Confirm the day they asked for.");
    expect(next.trimEnd().endsWith(footer)).toBe(true);
  });
});
