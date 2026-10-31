export type Speaker = "persona" | "target";
export type Lang = "hi" | "en" | "mixed";

export type Turn = {
  idx: number;
  speaker: Speaker;
  text: string;
  lang: Lang;
};

const speakerLine = /^(assistant|user)\s*:\s?(.*)$/i;

/** Share of letters in the Devanagari block. Above 0.5 is Hindi, below 0.1 is English. */
export function languageOf(text: string): Lang {
  const letters = [...text].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return "en";
  const devanagari = letters.filter((char) => char >= "\u0900" && char <= "\u097F").length;
  const share = devanagari / letters.length;
  if (share > 0.5) return "hi";
  if (share < 0.1) return "en";
  return "mixed";
}

/**
 * Bolna's persona-side transcript. `assistant` is the caller we sent.
 * `user` is what that caller heard the target say.
 * A line with no speaker prefix joins the previous turn.
 * Text before the first speaker joins the first turn.
 */
export function parseTranscript(transcript: string | null | undefined): Turn[] {
  if (!transcript?.trim()) return [];

  const raw: { speaker: Speaker; text: string }[] = [];
  let lead = "";

  for (const line of transcript.split(/\r?\n/)) {
    const match = line.match(speakerLine);
    if (!match) {
      const extra = line.trim();
      if (!extra) continue;
      if (raw.length === 0) lead = lead ? `${lead} ${extra}` : extra;
      else raw[raw.length - 1].text = `${raw[raw.length - 1].text} ${extra}`.trim();
      continue;
    }
    const speaker: Speaker = match[1].toLowerCase() === "assistant" ? "persona" : "target";
    let text = match[2].trim();
    if (raw.length === 0 && lead) {
      text = `${lead} ${text}`.trim();
      lead = "";
    }
    if (!text) continue;
    raw.push({ speaker, text });
  }

  return raw.map((turn, idx) => ({ idx, ...turn, lang: languageOf(turn.text) }));
}
