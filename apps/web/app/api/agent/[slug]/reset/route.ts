import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

const SLUGS = new Set(["sehat", "rupeesetu", "swaad", "nila", "nivas"]);

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!SLUGS.has(slug)) return NextResponse.json({ ok: false, error: "Unknown desk." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/agents/${slug}`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) return NextResponse.json({ ok: false, error: "Could not read the desk." }, { status: 502 });
  return NextResponse.json(body);
}

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!SLUGS.has(slug)) return NextResponse.json({ ok: false, error: "Unknown desk." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/agents/${slug}/reset`, { method: "POST", cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Could not reset the desk." }, { status: 502 });
  return NextResponse.json(body, { status: response.ok ? 200 : response.status });
}
