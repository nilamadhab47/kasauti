import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callVerdict, judgeView, loadPersonaProfile, loadTargetManifest, metricsOf, parseTranscript, type Cell } from "../packages/core/src/index.ts";
import { writeBrief } from "../packages/judge/src/claude.ts";
import { quoteSupportsFailure, scoreCall, type DimensionScore } from "../packages/judge/src/jev.ts";
import { DIMENSION_LABEL, type Dimension } from "../packages/judge/src/rubric.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(root, ".env") });

const TARGET_TASK =
  "Help callers book doctor appointments. Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking. Always try to give an answer.";

const WORD: Record<Cell, string> = { green: "Pass", amber: "Mixed", red: "Fail", grey: "Review" };
const VERDICT_WORD = { green: "Passed", amber: "Mixed", red: "Failed" } as const;

type Execution = {
  id: string;
  status: string;
  transcript: string | null;
  telephony_data?: { duration?: number | null };
};

function cellOf(score: DimensionScore): Cell {
  if (score.score === null) return "grey";
  if (score.score >= 4) return "green";
  if (score.score === 3) return "amber";
  return "red";
}

async function scoreFile(path: string, facts: unknown, persona: { goal: string; success_criteria: string[]; critical_dimensions: string[] }) {
  const execution = JSON.parse(await readFile(path, "utf8")) as Execution;
  const turns = parseTranscript(execution.transcript);
  const metrics = metricsOf(turns);
  console.log(`\n${execution.id}  ${turns.length} turns`);

  const card = await scoreCall({
    facts,
    targetTask: TARGET_TASK,
    callerGoal: persona.goal,
    successCriteria: persona.success_criteria,
    inScope: [],
    outOfScope: [],
    turns,
  });
  const verdict = callVerdict({
    scores: card.scores.map((item) => ({ dimension: item.dimension, score: item.score })),
    critical: persona.critical_dimensions,
    targetTurns: metrics.target_turns,
    status: execution.status,
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

  const lines = [
    `Sehat Clinic · Sharma ji`,
    VERDICT_WORD[verdict],
    "",
    draft.sentence,
    "",
  ];
  if (quoteKept && draft.quote) {
    lines.push(`"${draft.quote}"`, `turn ${draft.turn_idx}`, "");
  }
  lines.push("Change this line in the prompt", draft.prompt_line, "");
  for (const item of card.scores) {
    const label = DIMENSION_LABEL[item.dimension as Dimension].padEnd(14);
    lines.push(`${label}${WORD[cellOf(item)].padEnd(8)}${item.rounded}  ${(item.confidence * 100).toFixed(0)}%`);
  }
  lines.push("", `Jev ${card.model}`);
  console.log(lines.join("\n"));

  const outDir = join(root, "runs/phase0/briefs");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, `${execution.id}.json`),
    JSON.stringify({ id: execution.id, verdict, model: card.model, scores: card.scores, brief: draft, quote_kept: quoteKept }, null, 2),
  );
  return verdict;
}

const manifest = await loadTargetManifest(root, "sehat");
const profile = await loadPersonaProfile(root, "angry_uncle");
const viewed = judgeView(profile, manifest);
const facts = manifest.facts;
const persona = {
  user_data: { goal: viewed.goal },
  success_criteria: viewed.success_criteria,
  critical_dimensions: profile.critical_dimensions,
};

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const files = args.length === 0 || args.includes("--all")
  ? ["fixtures/test-b-9581a1ff.json", "fixtures/test-b-32ea6d7d.json", "fixtures/test-b-3ee2277b.json"]
  : args;

const verdicts: Array<"green" | "amber" | "red"> = [];
for (const file of files) {
  verdicts.push(
    await scoreFile(resolve(root, file), facts, {
      goal: persona.user_data.goal,
      success_criteria: persona.success_criteria,
      critical_dimensions: persona.critical_dimensions,
    }),
  );
}

const passed = verdicts.filter((item) => item === "green").length;
console.log(`\n${passed} of ${verdicts.length} callers passed`);
