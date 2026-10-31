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
const page = await browser.newPage();
await page.addInitScript((value) => {
  sessionStorage.setItem("kasauti-show", JSON.stringify(value));
}, session);

await page.goto("http://localhost:3000/bots/clinic-1/compare", { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Pass rate 0/2 → 0/2." }).waitFor();
const text = await page.locator("main").innerText();
if (text.includes("appointment 241")) throw new Error("old sample is still on the compare page");
for (const line of [
  "The call will now disconnect. Goodbye.",
  "Which one would you prefer for Arab's pediatrician appointment?",
  "The call will now disconnect; goodbye.",
  "Sharma ji: Facts, Repair",
  "Neha: Asks, Interruptions, Repair",
]) {
  if (!text.includes(line)) throw new Error(`missing: ${line}`);
}
const moved = await page.getByText("Moved", { exact: true }).count();
if (moved < 5) throw new Error(`expected flipped cells, saw ${moved}`);
const href = await page.getByRole("link", { name: "First call" }).first().getAttribute("href");
if (href !== "/transcript?call=sharma") throw new Error(`first call link is ${href}`);
await page.goto("http://localhost:3000/transcript?call=sharma", { waitUntil: "networkidle" });
await page.getByText("offer to arrange a callback from the clinic manager").waitFor();
console.log("compare ok", moved);
await browser.close();
