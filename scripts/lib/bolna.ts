import { env } from "./env.js";

export async function bolna(method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.BOLNA_API_KEY}`,
    "Content-Type": "application/json",
  };
  const response = await fetch(`${env.BOLNA_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  } else {
    parsed = null;
  }
  if (!response.ok) {
    console.error(`Bolna ${method} ${path} → ${response.status}`);
    console.error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    process.exit(1);
  }
  return parsed;
}
