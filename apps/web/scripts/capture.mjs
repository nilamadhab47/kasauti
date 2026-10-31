import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const out = "/tmp/kasauti-proof";
mkdirSync(out, { recursive: true });

function digest(path) {
  return createHash("sha1").update(readFileSync(path)).digest("hex").slice(0, 10);
}

const browser = await chromium.launch();

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: `${out}/video-hero`, size: { width: 1440, height: 900 } },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
  await page.addInitScript(() => {
    sessionStorage.removeItem("kasauti-intro");
    window.__KASAUTI_PROOF = true;
  });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForSelector(".intro-mark", { timeout: 4000 });
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${out}/hero-0ms.jpg`, quality: 72, type: "jpeg" });
  await page.waitForTimeout(920);
  await page.screenshot({ path: `${out}/hero-1000ms.jpg`, quality: 72, type: "jpeg" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/hero-3000ms.jpg`, quality: 72, type: "jpeg" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/hero-6000ms.jpg`, quality: 72, type: "jpeg" });
  await page.waitForTimeout(600);
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: `${out}/video-pin`, size: { width: 1440, height: 900 } },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    sessionStorage.setItem("kasauti-intro", "1");
    window.__KASAUTI_PROOF = true;
  });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator("#story-title").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.getElementById("story");
    if (!el) return;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 72);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/pin-0.jpg`, quality: 72, type: "jpeg" });

  await page.waitForFunction(() => document.querySelector(".stage-card .stamp"));
  for (let i = 0; i < 18 && !(await page.locator(".stage-card .stamp").textContent())?.includes("Rerunning"); i++) {
    await page.mouse.wheel(0, 180);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/pin-50.jpg`, quality: 72, type: "jpeg" });

  for (let i = 0; i < 24 && !(await page.locator(".stage-card .stamp").textContent())?.includes("Passed"); i++) {
    await page.mouse.wheel(0, 180);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/pin-100.jpg`, quality: 72, type: "jpeg" });
  await context.close();
}

const files = [
  "hero-0ms.jpg",
  "hero-1000ms.jpg",
  "hero-3000ms.jpg",
  "hero-6000ms.jpg",
  "pin-0.jpg",
  "pin-50.jpg",
  "pin-100.jpg",
];
const hashes = Object.fromEntries(files.map((f) => [f, digest(`${out}/${f}`)]));
writeFileSync(`${out}/hashes.json`, JSON.stringify(hashes, null, 2));
console.log(hashes);
console.log("unique frames", new Set(Object.values(hashes)).size, "/", files.length);

function firstWebm(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".webm"))
      .map((f) => `${dir}/${f}`)[0];
  } catch {
    return undefined;
  }
}

const heroVid = firstWebm(`${out}/video-hero`);
const pinVid = firstWebm(`${out}/video-pin`);
if (heroVid) copyFileSync(heroVid, `${out}/hero-intro.webm`);
if (pinVid) copyFileSync(pinVid, `${out}/pin-story.webm`);

const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
if (ffmpeg.status === 0 && heroVid && pinVid) {
  spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      heroVid,
      "-i",
      pinVid,
      "-filter_complex",
      "[0:v]trim=0:8,setpts=PTS-STARTPTS[h];[1:v]trim=0:6,setpts=PTS-STARTPTS[p];[h][p]concat=n=2:v=1:a=0[v]",
      "-map",
      "[v]",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      `${out}/kasauti-motion.mp4`,
    ],
    { stdio: "inherit" },
  );
  spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      `${out}/kasauti-motion.mp4`,
      "-vf",
      "fps=12,scale=960:-1:flags=lanczos",
      `${out}/kasauti-motion.gif`,
    ],
    { stdio: "inherit" },
  );
}

await browser.close();
console.log("wrote", out);
