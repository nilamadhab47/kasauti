import { chromium } from "playwright";

const session = {
  email: "nila@kasauti.dev",
  name: "Nila",
  company: "Kasauti",
  kind: "inhouse",
  languages: ["hindi"],
  bots: [],
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.addInitScript((value) => {
  sessionStorage.setItem("kasauti-show", JSON.stringify(value));
}, session);

async function hear(label) {
  const audio = page.locator("audio");
  await audio.waitFor();
  const src = await audio.getAttribute("src");
  const response = await page.request.get(new URL(src, page.url()).toString());
  const body = await response.body();
  const played = await page.evaluate(async () => {
    const el = document.querySelector("audio");
    if (!el) return { error: "missing" };
    el.muted = true;
    try {
      await el.play();
    } catch (error) {
      return { error: String(error) };
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      currentTime: el.currentTime,
      duration: el.duration,
      code: el.error ? el.error.code : 0,
    };
  });
  console.log(JSON.stringify({ label, src, status: response.status(), bytes: body.length, played }));
}

await page.goto("http://localhost:3000/transcript", { waitUntil: "networkidle" });
await page.getByText("The call will now disconnect. Goodbye.").waitFor();
const sharma = await page.locator("main").innerText();
if (sharma.includes("appointment ID 241")) throw new Error("old sample is still on the page");
if (!sharma.includes("manager")) throw new Error("Sharma transcript missing the manager line");
await hear("sharma");

await page.getByRole("button", { name: "Neha" }).click();
await page.getByText("Which one would you prefer for Arab's pediatrician appointment?").waitFor();
const neha = await page.locator("main").innerText();
if (!neha.includes("Aarav")) throw new Error("Neha transcript missing the name correction");
if (neha.includes("The call will now disconnect")) throw new Error("Sharma line still showing on Neha");
await hear("neha");

await page.screenshot({ path: "proof/transcript-neha.png", fullPage: false });
await browser.close();
console.log("ok");
