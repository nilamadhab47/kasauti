import { TypeSafeClient, choice, score } from "@typesafe-ai/sdk";
import type { TargetManifest, Turn } from "../../core/src/index.ts";
import { settleScore } from "./cells.ts";
import { DIMENSIONS, LEVELS, QUESTION, type Dimension } from "./rubric.ts";

export type DimensionScore = {
  dimension: Dimension;
  raw: number;
  rounded: number;
  confidence: number;
  /** Null when confidence is under the floor. Verdicts use this, not `rounded`. */
  score: number | null;
  probabilities: Record<string, number>;
};

export type ScoreCard = {
  model: string;
  scores: DimensionScore[];
};

const client = () =>
  new TypeSafeClient({
    apiKey: process.env.TYPESAFE_API_KEY,
    defaultModel: "jev-latest",
    timeout: 120_000,
    logLevel: "warn",
  });

function questions() {
  return {
    task_completion: score(QUESTION.task_completion, LEVELS),
    hallucination: score(QUESTION.hallucination, LEVELS),
    language_switch: score(QUESTION.language_switch, LEVELS),
    dropped_intents: score(QUESTION.dropped_intents, LEVELS),
    interruption_handling: score(QUESTION.interruption_handling, LEVELS),
    repair: score(QUESTION.repair, LEVELS),
    tone_empathy: score(QUESTION.tone_empathy, LEVELS),
  };
}

export type ScoreCallInput = {
  facts: unknown;
  targetTask: string;
  callerGoal: string;
  successCriteria: string[];
  inScope: TargetManifest["in_scope"];
  outOfScope: TargetManifest["out_of_scope"];
  turns: Turn[];
};

/** The state Jev reads. Kept separate so a test can see scope without calling the judge. */
export function judgeState(input: ScoreCallInput) {
  return {
    hearing:
      "Target lines are what the caller's recognizer heard. Hindi is Devanagari. English and Hinglish words stay in Latin. Judge the language you see. A Latin sentence is the target speaking English, not a Hindi line written in the wrong script. A business name one sound away from the name in facts is the recognizer. A person or doctor name one sound away from a name in facts is the recognizer. The desk rejecting that misheard name is the same slip. A percent or a clock time that differs from a matching fact by one number is a hearing slip. The caller's thank-you, and the caller ending the call, are not scored. Score only what the target had already said.",
    facts: input.facts,
    target_task: input.targetTask,
    caller_goal: input.callerGoal,
    success_criteria: input.successCriteria,
    in_scope: input.inScope,
    out_of_scope: input.outOfScope,
    turns: input.turns.map((turn) => ({ idx: turn.idx, speaker: turn.speaker, text: turn.text })),
  };
}

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCard> {
  const typesafe = client();
  const result = await typesafe.systemOne({
    model: "jev-latest",
    state: judgeState(input),
    questions: questions(),
  });

  const scores = DIMENSIONS.map((dimension) => {
    const answer = result.answers[dimension];
    const settled = settleScore(answer.score, answer.confidence, { ...answer.probabilities });
    return {
      dimension,
      raw: answer.score,
      rounded: settled.rounded,
      confidence: answer.confidence,
      score: settled.score,
      probabilities: { ...answer.probabilities },
    };
  });

  return { model: result.model, scores };
}

export async function quoteSupportsFailure(input: {
  sentence: string;
  quote: string;
  turnText: string;
}): Promise<"supports" | "contradicts" | "says_nothing"> {
  const typesafe = client();
  const result = await typesafe.systemOne({
    model: "jev-latest",
    state: input,
    questions: {
      relation: choice("How does the quoted turn relate to the failure in the sentence?", {
        supports: "The quote shows the failure, or directly implies it.",
        contradicts: "The quote shows the opposite of the failure.",
        says_nothing: "The quote does not address the failure.",
      }),
    },
  });
  return result.answers.relation.choice;
}
