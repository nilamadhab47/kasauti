/** A pasted env line, quotes, or a Bearer prefix should still leave the token. */
export function cleanBolnaKey(raw: string) {
  let key = raw.trim();
  const eq = key.lastIndexOf("=");
  if (eq !== -1) key = key.slice(eq + 1).trim();
  key = key.replace(/^bearer\s+/i, "").replace(/^['"]|['"]$/g, "");
  return key.replace(/\s+/g, "");
}
