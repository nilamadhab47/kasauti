import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "No call id." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/calls/${encodeURIComponent(id)}/recording`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  if (response.status === 404) return NextResponse.json({ ok: false, error: "No recording for this call." }, { status: 404 });
  if (!response.ok) return NextResponse.json({ ok: false, error: "Could not read the recording." }, { status: 502 });
  const body = await response.arrayBuffer();
  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("Content-Type") || "audio/mpeg");
  headers.set("Cache-Control", "private, max-age=86400");
  return new Response(body, { status: 200, headers });
}
