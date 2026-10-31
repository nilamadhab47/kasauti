import type { Turn } from "./transcript.js";

const repeatPattern = /दोबारा|फिर से|repeat|क्या\?|सुनाई नहीं|ज़ोर से/i;

export type CallMetrics = {
  persona_turns: number;
  target_turns: number;
  max_same_speaker_run: number;
  persona_repeat_count: number;
  target_hindi_ratio: number;
};

export function metricsOf(turns: Turn[]): CallMetrics {
  let personaTurns = 0;
  let targetTurns = 0;
  let maxRun = 0;
  let run = 0;
  let previous: Turn["speaker"] | null = null;
  let repeats = 0;
  let devanagari = 0;
  let letters = 0;

  for (const turn of turns) {
    if (turn.speaker === "persona") {
      personaTurns += 1;
      if (repeatPattern.test(turn.text)) repeats += 1;
    } else {
      targetTurns += 1;
      for (const char of turn.text) {
        if (!/\p{L}/u.test(char)) continue;
        letters += 1;
        if (char >= "\u0900" && char <= "\u097F") devanagari += 1;
      }
    }
    if (turn.speaker === previous) run += 1;
    else run = 1;
    previous = turn.speaker;
    if (run > maxRun) maxRun = run;
  }

  return {
    persona_turns: personaTurns,
    target_turns: targetTurns,
    max_same_speaker_run: maxRun,
    persona_repeat_count: repeats,
    target_hindi_ratio: letters === 0 ? 0 : devanagari / letters,
  };
}
