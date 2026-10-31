export const DIMENSIONS = [
  "task_completion",
  "hallucination",
  "language_switch",
  "dropped_intents",
  "interruption_handling",
  "repair",
  "tone_empathy",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  task_completion: "Task",
  hallucination: "Facts",
  language_switch: "Language",
  dropped_intents: "Asks",
  interruption_handling: "Interruptions",
  repair: "Repair",
  tone_empathy: "Tone",
};

/** Index is the score. Jev returns a weighted value that can fall between these. */
export const LEVELS = [
  "0. Did not attempt, or the call broke before the target could help.",
  "1. Severe failure.",
  "2. The problem hurt the outcome or the caller's experience.",
  "3. Noticeable problem. The outcome is still acceptable.",
  "4. Small slip with no impact on the outcome.",
  "5. What a good human receptionist would do.",
] as const;

export const QUESTION: Record<Dimension, string> = {
  task_completion:
    "Did the target achieve the caller's goal, or when the goal is outside what the bot can do live (refund, cancellation, policy change), did it execute the right escalation — name the specific issue back, say the desk will raise a ticket, and promise a callback with a time window? That is a 4. Reading the caller's callback number back, and accepting a one-character correction, is a 5. Score 3 only when the issue, the desk, or the time window is missing. A missing read-back of the callback number or the key details stays a 4. If the caller hangs up before the target can read the number back, score the escalation the target already spoke. Do not withhold the score for a missing thank-you. A one-character mishear that the target then accepts is a small slip. Read `hearing` first. A doctor name one sound off a name in `facts`, including the desk saying that doctor is not on the list, is a hearing slip. Do not score 1 for that slip alone. If the day and the person were understood and the booking was not confirmed, score 2. Refusing the caller's number, or the target hanging up while the caller is still giving details, is 1 or below. Score only the target.",
  hallucination:
    "Using `facts` as the only ground truth, did the target invent a doctor, a fee, a policy, or a completed refund? Read `hearing` first. A hearing slip stays a 4 when the rest of that sentence matches `facts`. Rejecting a misheard doctor name is not stating a doctor. Do not drop below 3 for that slip alone. A name the caller did not say, a wrong amount, or a code built from an amount is a 3 when the target still named the issue, the desk, and the time window. Claiming the refund was completed, or stating a fee, a policy, or a doctor that is not in `facts`, is 1 or below. An amount spoken as rupees, matching the caller or `facts`, is a 5.",
  language_switch:
    "Did the target reply in the caller's current language within one turn? Hinglish answered with Hinglish is fine. Staying in English after the caller moved to Hindi is 2 or below. Read `hearing` before you score this. The caller's thank-you, and the caller ending the call, are not scored. If the caller hangs up on that line, score only the language matches the target already made. Do not withhold the score for a reply the target never got a turn to make.",
  dropped_intents:
    "Of the distinct things the caller asked, how many did the target answer or explicitly acknowledge? 5 means all of them. 3 means one was dropped. 2 or below means two or more were dropped. A thank-you from the caller is not a question. A question about a name that `hearing` marks as a slip is not a dropped ask. If the caller says thank you and ends the call, do not count that line, and do not count a request the target never got a turn to answer.",
  interruption_handling:
    "When the caller cut in, did the target stop and answer the newest question, instead of restarting its script?",
  repair:
    "When the target misheard, did it ask one specific question or read the detail back? Looping a generic apology or the same question is 2 or below.",
  tone_empathy:
    "Was the target polite and calm with an angry or elderly caller, and did it acknowledge the problem before pushing a script?",
};
