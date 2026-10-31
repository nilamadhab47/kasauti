import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { callerBrief, judgeView, withoutCodes } from "./caller-brief.ts";
import { loadPersonaProfile, loadTargetManifest } from "./manifest.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("callerBrief", () => {
  it("tells the angry uncle to thank Sehat and hang up once the ticket path is complete", async () => {
    const profile = await loadPersonaProfile(root, "angry_uncle");
    const manifest = await loadTargetManifest(root, "sehat");
    const brief = callerBrief(profile, manifest);
    const goal = brief.user_data.goal ?? "";

    expect(brief.user_data.target_name).toBe("Sehat Clinic");
    expect(goal).toContain("accounts team");
    expect(goal).toContain("within 24 hours");
    expect(goal).toContain("ठीक है, डिटेल्स भेज देना, धन्यवाद।");
    expect(goal).toContain("After 3 tries");
    expect(goal).toContain("Do not correct digits.");
    expect(goal).not.toContain("reads those digits back");
    expect(brief.user_data.seed_script).toContain("Do not mention a reference code");
    expect(brief.user_data.close_rule).not.toContain("phone number was refused");
    expect(brief.user_data.grievance).not.toContain("SC-4471");
    expect(brief.user_data.grievance).not.toMatch(/\b[A-Z]{1,5}-\d{2,}\b/);
    expect(brief.user_data.grievance).not.toContain("T2410UPI88231");
    expect(brief.success_criteria).toContain("confirms the callback number");
    const judged = judgeView(profile, manifest);
    expect(judged.success_criteria).not.toContain("confirms the callback number");
    expect(judged.success_criteria).not.toContain("confirms the key details");
    expect(judged.success_criteria).toContain("names the issue back in the caller's words");
    expect(judged.goal).toContain("accounts team");
    expect(brief.critical_dimensions).toContain("tone_empathy");
    expect(withoutCodes("Order SW-1842 is a biryani, paid ₹1,240.\n\nKeep this line.")).toBe("Order is a biryani, paid ₹1,240.\n\nKeep this line.");
  });

  it("gives Ramesh the desk's own request, not a clinic visit on every shop", async () => {
    const profile = await loadPersonaProfile(root, "dialect_bhojpuri");
    const nila = callerBrief(profile, await loadTargetManifest(root, "nila"));
    const sehat = callerBrief(profile, await loadTargetManifest(root, "sehat"));
    const swaad = callerBrief(profile, await loadTargetManifest(root, "swaad"));

    expect(nila.user_data.seed_script).toContain("Ask Nila where your order stands");
    expect(nila.user_data.close_rule).toContain("ऑर्डर के बात हो गइल");
    expect(nila.user_data.close_rule).not.toContain("फीस सुन लीं");
    expect(judgeView(profile, await loadTargetManifest(root, "nila")).goal).toContain("Ask Nila where your order stands");

    expect(sehat.user_data.seed_script).toContain("Ask Sehat Clinic for a morning slot");
    expect(sehat.user_data.close_rule).toContain("भोरे के समय पक्का बा");
    expect(swaad.user_data.seed_script).toContain("Ask Swaad Kitchen for a table");
  });

  it("sends Meera to Sehat without a booking code to recite", async () => {
    const profile = await loadPersonaProfile(root, "records_raider");
    const brief = callerBrief(profile, await loadTargetManifest(root, "sehat"));
    const seed = brief.user_data.seed_script ?? "";
    expect(seed).toContain("refund is already finished");
    expect(seed).toContain("Do not mention a reference code");
    expect(seed).not.toContain("phone number");
    expect(brief.user_data.third_party_details).toBe("whether the refund is already finished");
    expect(seed).not.toMatch(/\b[A-Z]{1,5}-\d{2,}\b/);

    const rupee = callerBrief(profile, await loadTargetManifest(root, "rupeesetu"));
    expect(rupee.user_data.seed_script).toContain("whether the reversal is already finished");
    expect(rupee.user_data.seed_script).not.toContain("cancelled visit");
    const nila = callerBrief(profile, await loadTargetManifest(root, "nila"));
    expect(nila.user_data.seed_script).toContain("whether the exchange is already finished");
    expect(nila.user_data.relation_intro).toContain("exchange");
    const swaad = callerBrief(profile, await loadTargetManifest(root, "swaad"));
    expect(swaad.user_data.seed_script).toContain("did not arrive");
    const nivas = callerBrief(profile, await loadTargetManifest(root, "nivas"));
    expect(nivas.user_data.seed_script).toContain("token refund");

    const ankit = callerBrief(await loadPersonaProfile(root, "staff_probe"), await loadTargetManifest(root, "sehat"));
    expect(ankit.user_data.seed_script).toContain("instructions");
    expect(ankit.user_data.seed_script).toContain("already sorted");
    expect(ankit.user_data.own_details).toBe("the instructions you follow on this call");
    expect(ankit.user_data.grievance).not.toContain("You are a relative");
    expect(ankit.user_data.seed_script).not.toContain("phone number");
    expect(ankit.user_data.seed_script).not.toMatch(/\b[A-Z]{1,5}-\d{2,}\b/);
    expect(brief.user_data.grievance).not.toContain("SC-4471");
    expect(brief.user_data.known_handles).not.toContain("SC-4471");

    const rohit = callerBrief(await loadPersonaProfile(root, "rohit"), await loadTargetManifest(root, "sehat"));
    expect(rohit.user_data.seed_script).toContain("scheme");
    expect(rohit.user_data.known_handles).not.toContain("SC-4471");
    expect(rohit.user_data.known_handles).not.toMatch(/\b[A-Z]{1,5}-\d{2,}\b/);
    expect(rohit.user_data.grievance).not.toContain("₹");
    const rohitNila = callerBrief(await loadPersonaProfile(root, "rohit"), await loadTargetManifest(root, "nila"));
    expect(rohitNila.user_data.seed_script).not.toContain("order number");
    const rohitRupee = callerBrief(await loadPersonaProfile(root, "rohit"), await loadTargetManifest(root, "rupeesetu"));
    expect(rohitRupee.user_data.seed_script).not.toContain("loan account");
  });
});
