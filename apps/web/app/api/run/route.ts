import { NextResponse } from "next/server";
import { AGENT_BRIEFS, type TestAgent } from "@/lib/agent-briefs";
import { AGENT_CATEGORY, isCategoryId, type CategoryId } from "@/lib/caller-packs";
import { DEMO_FIXTURES, FIXTURE_PHONE, RUN_API_BASE } from "@/lib/run-api";

const DEMO_AGENTS = ["sehat", "rupeesetu", "swaad", "nila", "nivas"] as const;

type Body = {
  label?: string;
  name?: string;
  personaIds?: string[];
  mode?: "fixture" | "live";
  phone?: string;
  taskGoal?: string;
  factsText?: string;
  category?: string;
  agent?: string;
  consent?: boolean;
  session?: string;
};

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const personaIds = Array.isArray(body.personaIds) ? body.personaIds.filter((id) => typeof id === "string") : [];
  if (personaIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Pick at least one caller." }, { status: 400 });
  }

  const live = body.mode === "live";
  const agent = DEMO_AGENTS.includes(body.agent as (typeof DEMO_AGENTS)[number]) ? (body.agent as TestAgent) : null;
  const category: CategoryId | null = isCategoryId(body.category) ? body.category : agent ? AGENT_CATEGORY[agent] : null;
  const name = body.name?.trim() || (agent ? AGENT_BRIEFS[agent].name : "Sehat Clinic");
  const taskGoal = body.taskGoal?.trim() || (agent ? AGENT_BRIEFS[agent].prompt : "");

  if (!live) {
    const fixtures = personaIds.map((_, index) => DEMO_FIXTURES[index % DEMO_FIXTURES.length]);
    return forward({
      label: body.label?.trim() || "web-fixture",
      name,
      phone_e164: FIXTURE_PHONE,
      persona_ids: personaIds,
      fixtures,
      ...(category ? { category } : {}),
      ...(taskGoal ? { task_goal: taskGoal } : {}),
      ...(body.factsText ? { facts_text: body.factsText } : {}),
    });
  }

  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: "Confirm the call before running." }, { status: 400 });
  }

  const ownPhone = body.phone?.trim() ?? "";
  if (!ownPhone && !agent) {
    return NextResponse.json({ ok: false, error: "Pick an agent or a number before calling." }, { status: 400 });
  }
  return forward({
    label: body.label?.trim() || "web-live",
    name,
    persona_ids: personaIds,
    consent: true,
    ...(category ? { category } : {}),
    ...(agent ? { agent } : {}),
    ...(taskGoal ? { task_goal: taskGoal } : {}),
    ...(body.factsText ? { facts_text: body.factsText } : {}),
    ...(ownPhone ? { phone_e164: ownPhone } : { line: "shared" as const }),
    ...(typeof body.session === "string" && body.session.length >= 8 ? { session: body.session.slice(0, 80) } : {}),
  });
}

async function forward(payload: object) {
  let response: Response;
  try {
    response = await fetch(`${RUN_API_BASE}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "The test engine is not reachable." }, { status: 502 });
  }
  const text = await response.text();
  if (!response.ok) {
    const message = safeMessage(text) || "The run could not be started.";
    return NextResponse.json({ ok: false, error: message }, { status: response.status });
  }
  const created = JSON.parse(text) as { id?: string; status?: string };
  return NextResponse.json({ ok: true, runId: created.id, status: created.status });
}

function safeMessage(text: string) {
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message;
  } catch {
    return "";
  }
}
