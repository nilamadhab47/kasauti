import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function GET(_request: Request, context: { params: Promise<{ persona: string }> }) {
  const { persona } = await context.params;
  if (persona !== "angry_uncle") return NextResponse.json({ ok: false, error: "Only Sharma ji can be updated from here." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/callers/${persona}`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) return NextResponse.json({ ok: false, error: "Could not read the caller." }, { status: 502 });
  return NextResponse.json(body);
}

export async function POST(_request: Request, context: { params: Promise<{ persona: string }> }) {
  const { persona } = await context.params;
  if (persona !== "angry_uncle") return NextResponse.json({ ok: false, error: "Only Sharma ji can be updated from here." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/callers/${persona}`, { method: "POST", cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Could not update the caller." }, { status: 502 });
  return NextResponse.json(body, { status: response.ok ? 200 : response.status });
}
