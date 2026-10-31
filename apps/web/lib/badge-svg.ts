import { gradeFor, reportBySlug, trustEligible, type ReportRun } from "./report-model";

export type BadgeType = "report" | "trust";
export type BadgeTheme = "light" | "dark";
export type BadgeForm = "stamp" | "pill";

const PASS_LIGHT = "#B8860B";
const PASS_DARK = "#E8B530";
const FAIL = "#B91C1C";
const GREY_LIGHT = "#737373";
const GREY_DARK = "#A3A3A3";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function monthYear(iso: string | null, upper: boolean): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const month = date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const label = `${month} ${date.getUTCFullYear()}`;
  return upper ? label.toUpperCase() : label;
}

export function badgeSvg(
  slug: string,
  type: BadgeType,
  theme: BadgeTheme,
  form: BadgeForm = "stamp",
  runNumber?: number,
): string | null {
  const report = reportBySlug(slug);
  if (!report) return null;
  const run = pickRun(report.runs, runNumber);
  if (!run) return null;
  const dark = theme === "dark";
  const trust = trustEligible(run);
  const mode: "pass" | "fail" | "expired" | "held" =
    trust.expired ? "expired" : trust.ok ? "pass" : type === "trust" ? "held" : "fail";

  if (form === "pill") return pillSvg({ run, dark, mode });
  return stampSvg({ slug, run, dark, mode });
}

function pickRun(runs: ReportRun[], runNumber?: number): ReportRun | null {
  if (runNumber != null && runNumber >= 1 && runNumber <= runs.length) return runs[runNumber - 1] ?? null;
  return runs[runs.length - 1] ?? null;
}

function inkFor(mode: "pass" | "fail" | "expired" | "held", dark: boolean): string {
  if (mode === "pass") return dark ? PASS_DARK : PASS_LIGHT;
  if (mode === "fail") return FAIL;
  return dark ? GREY_DARK : GREY_LIGHT;
}

function kasautiMark(x: number, y: number, ink: string, scale = 1): string {
  const bars = [5, 8, 12, 9, 5];
  const rects = bars
    .map((height, index) => {
      const bx = (-8 + index * 3.6) * scale;
      const bh = height * scale;
      return `<rect x="${(x + bx).toFixed(2)}" y="${(y - bh / 2).toFixed(2)}" width="${(1.7 * scale).toFixed(2)}" height="${bh.toFixed(2)}" fill="${ink}"/>`;
    })
    .join("");
  return `<ellipse cx="${x}" cy="${y}" rx="${13 * scale}" ry="${10 * scale}" fill="none" stroke="${ink}" stroke-width="${1.15 * scale}"/>${rects}`;
}

function stampSvg({
  slug,
  run,
  dark,
  mode,
}: {
  slug: string;
  run: ReportRun;
  dark: boolean;
  mode: "pass" | "fail" | "expired" | "held";
}): string {
  const ink = inkFor(mode, dark);
  const ring =
    mode === "fail"
      ? "TESTED BY KASAUTI · RETEST REQUIRED ·"
      : mode === "expired"
        ? "KASAUTI TEST EXPIRED ·"
        : mode === "pass"
          ? "STRESS-TESTED BY KASAUTI · कसौटी ·"
          : "TESTED BY KASAUTI · कसौटी ·";
  const score = `${run.score}/100`;
  const under =
    mode === "fail" ? "NOT PASSED" : mode === "expired" ? "EXPIRED" : monthYear(run.testedAt, true);
  const aria =
    mode === "expired"
      ? "Kasauti test expired"
      : mode === "fail"
        ? `Tested by Kasauti · ${score} · not passed`
        : mode === "pass"
          ? `Stress-tested by Kasauti · ${score}`
          : `Tested by Kasauti · ${score}`;
  const url = `kasauti.app/score/${slug}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="${escapeXml(aria)}">
  <defs>
    <filter id="ink" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.55" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <path id="ring" d="M120,120 m-96,0 a96,96 0 1,1 192,0 a96,96 0 1,1 -192,0"/>
    <path id="foot" d="M78,156 a42,42 0 0,0 84,0"/>
  </defs>
  <g transform="rotate(-6 120 120)" filter="url(#ink)" fill="none" stroke="${ink}">
    <circle cx="120" cy="120" r="108" stroke-width="1.15"/>
    <circle cx="120" cy="120" r="101" stroke-width="0.6"/>
    <text fill="${ink}" stroke="none" font-family="ui-sans-serif, system-ui, 'Noto Sans Devanagari', sans-serif" font-size="8.5" font-weight="650" letter-spacing="1.6">
      <textPath href="#ring" startOffset="50%" text-anchor="middle">${escapeXml(ring)}</textPath>
    </text>
    ${kasautiMark(120, 92, ink, 0.85)}
    <text x="120" y="124" text-anchor="middle" fill="${ink}" stroke="none" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26" font-weight="700">${score}</text>
    <line x1="86" y1="132" x2="154" y2="132" stroke="${ink}" stroke-width="0.6"/>
    <text x="120" y="146" text-anchor="middle" fill="${ink}" stroke="none" font-family="ui-sans-serif, system-ui, sans-serif" font-size="8" font-weight="650" letter-spacing="1.8">${escapeXml(under)}</text>
    <text fill="${ink}" stroke="none" font-family="ui-monospace, ui-sans-serif, monospace" font-size="6" letter-spacing="0.4">
      <textPath href="#foot" startOffset="50%" text-anchor="middle">${escapeXml(url)}</textPath>
    </text>
  </g>
</svg>`;
}

function pillSvg({
  run,
  dark,
  mode,
}: {
  run: ReportRun;
  dark: boolean;
  mode: "pass" | "fail" | "expired" | "held";
}): string {
  const ink = mode === "pass" ? inkFor("pass", dark) : inkFor(mode === "fail" ? "held" : mode, dark);
  const when = monthYear(run.testedAt, false);
  const title = mode === "expired" ? "Kasauti test expired" : mode === "pass" ? "Stress-tested by Kasauti" : "Kasauti";
  const detail = mode === "expired" ? "30 days after the last test" : mode === "pass" ? `${run.score}/100 · ${when}` : `${run.score}/100`;
  const aria = mode === "expired" ? "Kasauti test expired" : mode === "pass" ? `Stress-tested by Kasauti · ${run.score}/100` : `Kasauti · ${run.score}/100`;
  const width = 292;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40" role="img" aria-label="${escapeXml(aria)}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="39" rx="20" fill="none" stroke="${ink}" stroke-width="1"/>
  ${kasautiMark(22, 20, ink, 0.62)}
  <text x="40" y="16" fill="${ink}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="650">${escapeXml(title)}</text>
  <text x="40" y="30" fill="${ink}" font-family="ui-monospace, ui-sans-serif, monospace" font-size="10">${escapeXml(detail)}</text>
</svg>`;
}

export function badgeGrade(slug: string): string | null {
  const report = reportBySlug(slug);
  const run = report?.runs[report.runs.length - 1];
  return run ? gradeFor(run.score) : null;
}
