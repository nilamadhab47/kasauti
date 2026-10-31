import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "No run id." }, { status: 400 });
  const incoming = (await request.json().catch(() => null)) as { session?: unknown } | null;
  const session = typeof incoming?.session === "string" ? incoming.session.slice(0, 80) : "";
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/runs/${encodeURIComponent(id)}/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session ? { session } : {}),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ ok: false, error: safeMessage(text) || "Could not start the rerun." }, { status: response.status });
  }
  const created = JSON.parse(text) as { id?: string; parent_run_id?: string };
  return NextResponse.json({ ok: true, runId: created.id, parentRunId: created.parent_run_id });
}

function safeMessage(text: string) {
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message;
  } catch {
    return "";
  }
}
