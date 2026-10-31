import { NextResponse } from "next/server";
import { readBolnaBrief } from "@/lib/bolna-brief";
import { cleanBolnaKey } from "@/lib/bolna-key";
import { guessCategory } from "@/lib/guess-category";

type Listed = { id?: string; agent_id?: string; agent_name?: string; name?: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function bolna(key: string, path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`https://api.bolna.ai${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

export async function POST(request: Request) {
  let payload: { key?: string; agentId?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const key = cleanBolnaKey(payload.key ?? "");
  if (!key) return NextResponse.json({ ok: false, error: "Add a Bolna API key to read the bot." }, { status: 400 });

  if (!payload.agentId) {
    const listed = await bolna(key, "/v2/agent/all");
    if (listed.status === 401 || listed.status === 403) return refused(listed.body);
    if (listed.status !== 200 || !Array.isArray(listed.body)) {
      return NextResponse.json({ ok: false, error: "Bolna did not return the agent list." }, { status: 502 });
    }
    const agents = (listed.body as Listed[])
      .map((item) => ({ id: item.id || item.agent_id || "", name: item.agent_name || item.name || "Untitled agent" }))
      .filter((item) => item.id);
    return NextResponse.json({ ok: true, agents });
  }

  const detail = await bolna(key, `/v2/agent/${encodeURIComponent(payload.agentId)}`);
  if (detail.status === 401 || detail.status === 403) return refused(detail.body);
  if (detail.status !== 200) {
    return NextResponse.json({ ok: false, error: "That agent could not be read." }, { status: 502 });
  }
  const brief = readBolnaBrief(detail.body, payload.agentId);
  const category = guessCategory(`${brief.name}\n${brief.welcome}\n${brief.prompt}`);
  return NextResponse.json({ ok: true, agent: brief, category });
}

function refused(body: unknown) {
  const detail = asRecord(body).detail;
  const reason = typeof detail === "string" && detail.length < 140 && !/bn-|bearer|sk-/i.test(detail) ? detail : "";
  const error = reason ? `Bolna refused this key: ${reason}.` : "That Bolna key was not accepted.";
  return NextResponse.json({ ok: false, error }, { status: 401 });
}
