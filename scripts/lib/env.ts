import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: join(root, ".env") });

const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/, "expected E.164, like +9198XXXXXXXX");

const optionalId = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined));

const schema = z.object({
  BOLNA_API_KEY: z.string().min(1, "BOLNA_API_KEY is required"),
  BOLNA_BASE_URL: z.string().url().default("https://api.bolna.ai"),
  ALLOWED_NUMBERS: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(e164).min(1)),
  PERSONA_AGENT_ID: optionalId,
  CLINIC_AGENT_ID: optionalId,
  CLINIC_NUMBER: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined))
    .pipe(e164.optional()),
  MY_PHONE_NUMBER: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined))
    .pipe(e164.optional()),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
  process.exit(1);
}

if (!parsed.data.BOLNA_API_KEY.startsWith("bn-")) {
  console.warn("warning: BOLNA_API_KEY does not start with bn-. The prefix is unverified; continuing.");
}

export const env = parsed.data;
export const repoRoot = root;
