import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { callVerdict, loadTargetManifest, metricsOf, parseTranscript, type Cell } from "../packages/core/src/index.ts";
import { writeBrief } from "../packages/judge/src/claude.ts";
import { quoteSupportsFailure, scoreCall, type DimensionScore } from "../packages/judge/src/jev.ts";
import { DIMENSION_LABEL, type Dimension } from "../packages/judge/src/rubric.ts";
import { bolna } from "./lib/bolna.js";
import { repoRoot } from "./lib/env.js";

const TARGET_TASK =
  "Help callers book doctor appointments. Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking. Always try to give an answer.";

const WORD: Record<Cell, string> = { green: "Pass", amber: "Mixed", red: "Fail", grey: "Review" };
const VERDICT_WORD = { green: "Passed", amber: "Mixed", red: "Failed" } as const;

const CALLS = [
  { persona: "personas/angry_uncle", executionId: "b2984e47-2962-4b32-a557-ab1e835d9417", who: "Sharma ji" },
  { persona: "personas/lang_switcher", executionId: "348c5c92-358f-48d0-b031-4106191b4318", who: "Neha" },
];

type PersonaFile = {
  name: string;
  user_data: { goal: string };
  success_criteria: string[];
  critical_dimensions: string[];
};

function cellOf(score: DimensionScore): Cell {
  if (score.score === null) return "grey";
  if (score.score >= 4) return "green";
  if (score.score === 3) return "amber";
  return "red";
}

/** Bolna's total_cost and cost_breakdown are cents. Return US dollars. */
function bolnaCostUsd(execution: Record<string, unknown>): number | null {
  if (typeof execution.total_cost === "number" && Number.isFinite(execution.total_cost)) {
    return Number((execution.total_cost / 100).toFixed(4));
  }
  const breakdown = execution.cost_breakdown;
  if (!breakdown || typeof breakdown !== "object") return null;
  const record = breakdown as Record<string, unknown>;
  const parts = ["llm", "network", "platform", "synthesizer", "transcriber", "transfer_cost"];
  const cents = parts.reduce((total, key) => total + (typeof record[key] === "number" ? record[key] : 0), 0);
  return Number((cents / 100).toFixed(4));
}

async function scoreOne(call: (typeof CALLS)[number], facts: unknown) {
  const persona = JSON.parse(await readFile(join(repoRoot, call.persona, "defaults.json"), "utf8")) as PersonaFile;
  const execution = (await bolna("GET", `/executions/${call.executionId}`)) as Record<string, unknown>;
  const transcript = typeof execution.transcript === "string" ? execution.transcript : "";
  const turns = parseTranscript(transcript);
  const metrics = metricsOf(turns);
  const status = typeof execution.status === "string" ? execution.status : "unknown";
  console.log(`\n${call.who}  ${turns.length} turns`);

  const card = await scoreCall({
    facts,
    targetTask: TARGET_TASK,
    callerGoal: persona.user_data.goal,
    successCriteria: persona.success_criteria,
    inScope: [],
    outOfScope: [],
    turns,
  });
  const verdict = callVerdict({
    scores: card.scores.map((item) => ({ dimension: item.dimension, score: item.score })),
    critical: persona.critical_dimensions,
    targetTurns: metrics.target_turns,
    status,
  });

  let draft = await writeBrief({ turns, scores: card.scores });
  let quoteKept = Boolean(draft.quote);
  if (draft.quote && draft.turn_idx !== null) {
    const turn = turns.find((item) => item.idx === draft.turn_idx);
    const relation = await quoteSupportsFailure({
      sentence: draft.sentence,
      quote: draft.quote,
      turnText: turn?.text ?? "",
    });
    if (relation !== "supports") {
      quoteKept = false;
      draft = { ...draft, quote: "", turn_idx: null };
    }
  }

  const cost = bolnaCostUsd(execution);
  const lines = [VERDICT_WORD[verdict], "", draft.sentence, ""];
  if (quoteKept && draft.quote) lines.push(`"${draft.quote}"`, `turn ${draft.turn_idx}`, "");
  lines.push("Change this line in the prompt", draft.prompt_line, "");
  for (const item of card.scores) {
    const label = DIMENSION_LABEL[item.dimension as Dimension].padEnd(14);
    lines.push(`${label}${WORD[cellOf(item)].padEnd(8)}${item.rounded}  ${(item.confidence * 100).toFixed(0)}%`);
  }
  lines.push("", `Jev ${card.model}`, cost === null ? "Cost unavailable" : `Bolna $${cost.toFixed(2)}`);
  console.log(lines.join("\n"));

  return {
    who: call.who,
    executionId: call.executionId,
    verdict,
    model: card.model,
    costUsd: cost,
    scores: card.scores,
    brief: draft,
    quoteKept,
  };
}

const facts = (await loadTargetManifest(repoRoot, "sehat")).facts;
const cards = [];
for (const call of CALLS) cards.push(await scoreOne(call, facts));

const passed = cards.filter((card) => card.verdict === "green").length;
const cost = cards.reduce((total, card) => total + (card.costUsd ?? 0), 0);
const summary = {
  run: "level-1",
  target: "Sehat Clinic",
  passed,
  callers: cards.length,
  costUsd: Number(cost.toFixed(3)),
  calls: cards.map((card) => ({
    who: card.who,
    executionId: card.executionId,
    verdict: card.verdict,
    worstLine: card.quoteKept ? card.brief.quote : "",
    turn: card.quoteKept ? card.brief.turn_idx : null,
    sentence: card.brief.sentence,
    promptLine: card.brief.prompt_line,
    costUsd: card.costUsd,
    model: card.model,
  })),
};

const dir = join(repoRoot, "runs/level1");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "summary.json"), JSON.stringify(summary, null, 2));

console.log("\nLevel 1");
console.log(`${passed} of ${cards.length} passed`);
console.log(`Cost $${cost.toFixed(2)}`);
for (const card of cards) {
  const line = card.quoteKept ? card.brief.quote : "(no line kept)";
  console.log(`${card.who}: ${VERDICT_WORD[card.verdict]} — ${line}`);
}
