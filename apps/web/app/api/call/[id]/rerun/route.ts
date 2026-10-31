import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "No call id." }, { status: 400 });
  const incoming = (await request.json().catch(() => null)) as { session?: unknown } | null;
  const session = typeof incoming?.session === "string" ? incoming.session.slice(0, 80) : "";
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/calls/${encodeURIComponent(id)}/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session ? { session } : {}),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Could not start the rerun." }, { status: 502 });
  if (!response.ok) return NextResponse.json({ ok: false, error: (body as { message?: string }).message || "Could not start the rerun." }, { status: response.status });
  const created = body as { id?: string; parent_run_id?: string };
  return NextResponse.json({ ok: true, runId: created.id, parentRunId: created.parent_run_id });
}
