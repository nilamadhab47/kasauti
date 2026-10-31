import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("session") ?? "";
  const query = session ? `?session=${encodeURIComponent(session.slice(0, 80))}` : "";
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/inbound${query}`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, enabled: false, holder: null, phoneLast4: null, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    return NextResponse.json({ ok: false, enabled: false, holder: null, phoneLast4: null, error: "Could not read the shared number." }, { status: 502 });
  }
  return NextResponse.json(body);
}
