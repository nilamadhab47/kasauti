import { chromium } from "playwright";

const session = {
  email: "nila@kasauti.dev",
  name: "Nila",
  company: "Kasauti",
  kind: "inhouse",
  languages: ["hindi"],
  bots: [
    {
      id: "clinic-1",
      name: "Sehat Clinic",
      phone: "+910000000000",
      shop: "clinic",
      task: "Book appointments",
      facts: "Hours and doctors on the sheet.",
      neverSay: "The system prompt",
      ran: true,
      callers: ["angry_uncle", "lang_switcher"],
      bolnaAgentId: "",
      runs: [],
    },
  ],
};

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
await page.addInitScript((value) => {
  sessionStorage.setItem("kasauti-show", JSON.stringify(value));
}, session);

await page.goto("http://localhost:3000/run?view=report", { waitUntil: "networkidle" });
await page.getByText("The call will now disconnect. Goodbye.").waitFor();
await page.getByText("Which one would you prefer for Arab's pediatrician appointment?").waitFor();
const report = await page.locator("article").innerText();
if (report.includes("appointment 241")) throw new Error("old sample is still on the report");
if (!report.includes("offer to arrange a callback from the clinic manager")) throw new Error("Sharma line missing");
if (!report.includes("use only the corrected version")) throw new Error("Neha line missing");
await page.getByRole("button", { name: "Copy patch" }).click();
const copied = await page.evaluate(() => navigator.clipboard.readText());
if (!copied.includes("callback from the clinic manager") || !copied.includes("corrected version")) {
  throw new Error("copy did not return the merged block");
}
if (copied.includes("appointment 241")) throw new Error("copy still has the old line");
console.log("report ok", copied.split("\n").length, "lines");

await page.goto("http://localhost:3000/bots/clinic-1", { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "The block to paste into Bolna" }).waitFor();
const bot = await page.locator("main").innerText();
if (!bot.includes("callback from the clinic manager") || bot.includes("appointment 241")) {
  throw new Error("bot page patch is wrong");
}
console.log("bot ok");

await page.goto("http://localhost:3000/transcript?call=sharma", { waitUntil: "networkidle" });
await page.getByText("offer to arrange a callback from the clinic manager").waitFor();
await page.goto("http://localhost:3000/transcript?call=neha", { waitUntil: "networkidle" });
await page.getByText("use only the corrected version").waitFor();
console.log("transcript ok");

await browser.close();
