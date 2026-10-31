import { NextResponse } from "next/server";
import { RUN_API_BASE } from "@/lib/run-api";

const SLUGS = new Set(["sehat", "rupeesetu", "swaad", "nila", "nivas"]);

export async function POST(request: Request) {
  let agent = "";
  try {
    const body = (await request.json()) as { agent?: unknown };
    if (typeof body.agent === "string" && SLUGS.has(body.agent)) agent = body.agent;
  } catch {
    agent = "";
  }
  if (!agent) return NextResponse.json({ ok: false, switched: false, error: "That agent is not one of the demo agents." }, { status: 400 });

  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/inbound/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, switched: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, switched: false, error: "Could not move the number." }, { status: 502 });
  return NextResponse.json(body, { status: response.ok ? 200 : response.status });
}
