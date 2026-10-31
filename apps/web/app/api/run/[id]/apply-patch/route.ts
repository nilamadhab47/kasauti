import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "No run id." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/runs/${encodeURIComponent(id)}/apply-patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Could not reach the agent." }, { status: 502 });
  return NextResponse.json(body, { status: response.ok ? 200 : response.status });
}
