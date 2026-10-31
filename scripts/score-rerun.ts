import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { callVerdict, loadTargetManifest, metricsOf, parseTranscript, type Cell, type Turn } from "../packages/core/src/index.ts";
import { writeBrief } from "../packages/judge/src/claude.ts";
import { quoteSupportsFailure, scoreCall, type DimensionScore } from "../packages/judge/src/jev.ts";
import { DIMENSION_LABEL, DIMENSIONS, type Dimension } from "../packages/judge/src/rubric.ts";
import { bolna } from "./lib/bolna.js";
import { env, repoRoot } from "./lib/env.js";

const TARGET_TASK =
  "Help callers book doctor appointments. Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking. Always try to give an answer.";

const WORD: Record<Cell, string> = { green: "Pass", amber: "Mixed", red: "Fail", grey: "Review" };

type CellOut = { label: string; word: string; rounded: number; confidence: number; critical: boolean; heldByFloor: boolean };
type TurnOut = { speaker: "caller" | "bot"; text: string };
type Side = {
  executionId: string;
  verdict: "green" | "amber" | "red";
  quote: string;
  sentence: string;
  costUsd: number | null;
  model: string;
  recording: string | null;
  turns: TurnOut[];
  heldByFloor: boolean;
  cells: CellOut[];
};

// Before = the fragile v1 bot. Cells stay as first measured; we only attach the real recording and transcript.
const BEFORE: {
  who: string;
  persona: string;
  executionId: string;
  verdict: "red";
  quote: string;
  sentence: string;
  costUsd: number;
  model: string;
  cells: { label: string; word: string; rounded: number; confidence: number }[];
}[] = [
  {
    who: "Sharma ji",
    persona: "personas/angry_uncle",
    executionId: "b2984e47-2962-4b32-a557-ab1e835d9417",
    verdict: "red",
    quote: "The call will now disconnect. Goodbye.",
    sentence:
      "The bot abruptly disconnected the call when the user requested to speak with a manager instead of attempting to transfer the call or provide alternative support options.",
    costUsd: 0.0799,
    model: "jev-1.13.0",
    cells: [
      { label: "Task", word: "Fail", rounded: 1, confidence: 0.68 },
      { label: "Facts", word: "Review", rounded: 2, confidence: 0 },
      { label: "Language", word: "Fail", rounded: 1, confidence: 0.65 },
      { label: "Asks", word: "Fail", rounded: 0, confidence: 0.72 },
      { label: "Interruptions", word: "Fail", rounded: 1, confidence: 0.61 },
      { label: "Repair", word: "Review", rounded: 1, confidence: 0.55 },
      { label: "Tone", word: "Fail", rounded: 1, confidence: 0.7 },
    ],
  },
  {
    who: "Neha",
    persona: "personas/lang_switcher",
    executionId: "348c5c92-358f-48d0-b031-4106191b4318",
    verdict: "red",
    quote: "Which one would you prefer for Arab's pediatrician appointment?",
    sentence:
      "The bot repeatedly misheard and misspelled the child's name as 'Adolf' and 'Arab' instead of 'Aarav' despite multiple corrections from the caller.",
    costUsd: 0.1375,
    model: "jev-1.13.0",
    cells: [
      { label: "Task", word: "Fail", rounded: 1, confidence: 0.84 },
      { label: "Facts", word: "Fail", rounded: 1, confidence: 0.79 },
      { label: "Language", word: "Fail", rounded: 2, confidence: 0.61 },
      { label: "Asks", word: "Review", rounded: 2, confidence: 0.49 },
      { label: "Interruptions", word: "Review", rounded: 2, confidence: 0.52 },
      { label: "Repair", word: "Review", rounded: 2, confidence: 0.59 },
      { label: "Tone", word: "Fail", rounded: 2, confidence: 0.66 },
    ],
  },
];

// After = the real reruns once Kasauti's fixes were on the clinic agent.
const AFTER = [
  { who: "Sharma ji", persona: "personas/angry_uncle", executionId: "fbf2dd59-b7b2-48f8-821a-10640bb29b2c" },
  { who: "Neha", persona: "personas/lang_switcher", executionId: "424f591a-173f-4b25-8392-d0cf1b07427c" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
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
function toTurns(turns: Turn[]): TurnOut[] {
  return turns.map((turn) => ({ speaker: turn.speaker === "persona" ? "caller" : "bot", text: turn.text }));
}

const outDir = join(repoRoot, "apps/web/public/calls");
await mkdir(outDir, { recursive: true });

async function download(url: string, dest: string): Promise<boolean> {
  const authed = await fetch(url, { headers: { Authorization: `Bearer ${env.BOLNA_API_KEY}` } });
  const response = authed.ok ? authed : await fetch(url);
  if (!response.ok) return false;
  await writeFile(dest, Buffer.from(await response.arrayBuffer()));
  return true;
}
async function pullMedia(executionId: string, slug: string): Promise<{ turns: Turn[]; recording: string | null; execution: Record<string, unknown> }> {
  const execution = asRecord(await bolna("GET", `/executions/${executionId}`));
  const turns = parseTranscript(typeof execution.transcript === "string" ? execution.transcript : "");
  const telephony = asRecord(execution.telephony_data);
  const recordingUrl = typeof telephony.recording_url === "string" ? telephony.recording_url : "";
  const saved = recordingUrl ? await download(recordingUrl, join(outDir, `${slug}.mp3`)) : false;
  return { turns, recording: saved ? `/calls/${slug}.mp3` : null, execution };
}

async function scoreAfter(call: (typeof AFTER)[number], facts: unknown): Promise<Side> {
  const persona = JSON.parse(await readFile(join(repoRoot, call.persona, "defaults.json"), "utf8")) as {
    user_data: { goal: string };
    success_criteria: string[];
    critical_dimensions: string[];
  };
  const slug = call.who === "Neha" ? "neha-after" : "sharma-after";
  const { turns, recording, execution } = await pullMedia(call.executionId, slug);
  const metrics = metricsOf(turns);
  const status = typeof execution.status === "string" ? execution.status : "unknown";
  const card = await scoreCall({ facts, targetTask: TARGET_TASK, callerGoal: persona.user_data.goal, successCriteria: persona.success_criteria, inScope: [], outOfScope: [], turns });
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
    const relation = await quoteSupportsFailure({ sentence: draft.sentence, quote: draft.quote, turnText: turn?.text ?? "" });
    if (relation !== "supports") quoteKept = false;
  }
  const criticalLabels = new Set(persona.critical_dimensions.map((d) => DIMENSION_LABEL[d as Dimension]));
  const cells: CellOut[] = DIMENSIONS.map((dimension) => {
    const item = card.scores.find((s) => s.dimension === dimension)!;
    const label = DIMENSION_LABEL[dimension as Dimension];
    return {
      label,
      word: WORD[cellOf(item)],
      rounded: item.rounded,
      confidence: Number(item.confidence.toFixed(2)),
      critical: criticalLabels.has(label),
      heldByFloor: item.score === null && item.rounded >= 4,
    };
  });
  // The rerun is a true red->green on substance when every critical cell would pass but the confidence floor holds it.
  const heldByFloor = verdict !== "green" && cells.filter((c) => c.critical).every((c) => c.rounded >= 4);
  console.log(`\n${call.who} ${verdict}${heldByFloor ? " (held by confidence floor)" : ""}`);
  for (const cell of cells) console.log(`${cell.label.padEnd(14)}${cell.word.padEnd(8)}${cell.rounded}  ${(cell.confidence * 100).toFixed(0)}%${cell.critical ? "  *" : ""}`);
  return {
    executionId: call.executionId,
    verdict,
    quote: quoteKept ? draft.quote : "",
    sentence: draft.sentence,
    costUsd: bolnaCostUsd(execution),
    model: card.model,
    recording,
    turns: toTurns(turns),
    heldByFloor,
    cells,
  };
}

async function buildBefore(row: (typeof BEFORE)[number]): Promise<Side> {
  const persona = JSON.parse(await readFile(join(repoRoot, row.persona, "defaults.json"), "utf8")) as { critical_dimensions: string[] };
  const criticalLabels = new Set(persona.critical_dimensions.map((d) => DIMENSION_LABEL[d as Dimension]));
  const slug = row.who === "Neha" ? "neha-before" : "sharma-before";
  const { turns, recording } = await pullMedia(row.executionId, slug);
  const cells: CellOut[] = row.cells.map((c) => ({
    ...c,
    critical: criticalLabels.has(c.label),
    heldByFloor: c.word === "Review" && c.rounded >= 4,
  }));
  return {
    executionId: row.executionId,
    verdict: row.verdict,
    quote: row.quote,
    sentence: row.sentence,
    costUsd: row.costUsd,
    model: row.model,
    recording,
    turns: toTurns(turns),
    heldByFloor: false,
    cells,
  };
}

const facts = (await loadTargetManifest(repoRoot, "sehat")).facts;
const callers = [];
for (const row of BEFORE) {
  const afterCall = AFTER.find((item) => item.who === row.who)!;
  callers.push({
    who: row.who,
    id: row.who === "Neha" ? "neha" : "sharma",
    before: await buildBefore(row),
    after: await scoreAfter(afterCall, facts),
  });
}

const passed = (side: "before" | "after") => callers.filter((caller) => caller[side].verdict === "green").length;
const heldByFloor = (side: "before" | "after") => callers.filter((caller) => caller[side].heldByFloor).length;
const compare = {
  beforePassed: passed("before"),
  afterPassed: passed("after"),
  afterHeldByFloor: heldByFloor("after"),
  callers: callers.length,
  rows: callers,
};

await writeFile(join(repoRoot, "runs/level1/compare.json"), JSON.stringify(compare, null, 2));
await writeFile(join(repoRoot, "apps/web/lib/level1-compare.ts"), `export const LEVEL1_COMPARE = ${JSON.stringify(compare, null, 2)} as const;\n`);
console.log(`\nPass rate ${compare.beforePassed}/${compare.callers} → ${compare.afterPassed}/${compare.callers} (${compare.afterHeldByFloor} held by floor)`);
