import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

export async function GET() {
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/agents`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ ok: false, desks: [], error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    return NextResponse.json({ ok: false, desks: [], error: "Could not read the desks." }, { status: 502 });
  }
  return NextResponse.json(body);
}
