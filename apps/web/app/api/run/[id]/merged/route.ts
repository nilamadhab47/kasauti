import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "No run id." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/runs/${encodeURIComponent(id)}/merged`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  if (response.status === 404) return NextResponse.json({ ok: false, error: "Run not found." }, { status: 404 });
  if (!response.ok) return NextResponse.json({ ok: false, error: "Could not read the run." }, { status: 502 });
  const run = await response.json();
  return NextResponse.json({ ok: true, run });
}
