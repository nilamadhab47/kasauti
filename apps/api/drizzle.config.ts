import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { join } from "node:path";

config({ path: join(__dirname, "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing from .env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
