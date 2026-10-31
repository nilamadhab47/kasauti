export type Cell = "green" | "amber" | "red" | "grey";
export type CallVerdict = "green" | "amber" | "red";

export function dimensionCell(score: number | null): Cell {
  if (score === null) return "grey";
  if (score >= 3) return "green";
  if (score === 2) return "amber";
  return "red";
}

export function callVerdict(input: {
  scores: { dimension: string; score: number | null }[];
  critical: string[];
  targetTurns: number;
  status: string;
}): CallVerdict {
  if (input.targetTurns < 2 || input.status !== "completed") return "red";

  const byDimension = new Map(input.scores.map((score) => [score.dimension, score.score]));
  for (const dimension of input.critical) {
    const score = byDimension.get(dimension);
    if (score !== undefined && score !== null && score <= 1) return "red";
  }

  const criticalOk = input.critical.every((dimension) => {
    const score = byDimension.get(dimension);
    return score !== undefined && score !== null && score >= 3;
  });
  if (criticalOk) return "green";
  return "amber";
}
