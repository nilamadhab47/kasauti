import { badgeSvg, type BadgeForm, type BadgeTheme, type BadgeType } from "@/lib/badge-svg";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const type: BadgeType = url.searchParams.get("type") === "trust" ? "trust" : "report";
  const theme: BadgeTheme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  const form: BadgeForm = url.searchParams.get("form") === "pill" ? "pill" : "stamp";
  const run = Number(url.searchParams.get("run"));
  const svg = badgeSvg(slug, type, theme, form, Number.isInteger(run) ? run : undefined);
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
