import "./env";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { env } from "./env";
import { logLine } from "./log";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const extraOrigins = (process.env.WEB_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", ...extraOrigins],
    credentials: true,
  });
  app.useBodyParser("json", { limit: "2mb" });
  await app.listen(env.port);
  logLine(`kasauti api listening on ${env.port}`);
  await logCallerAgents();
}

async function logCallerAgents() {
  const dir = join(__dirname, "../../..", "personas");
  const names = await readdir(dir).catch(() => [] as string[]);
  if (names.length === 0) {
    logLine("caller agents missing: personas directory was not deployed");
    return;
  }
  for (const name of names.sort()) {
    const id = await readFile(join(dir, name, ".agent_id"), "utf8").catch(() => "");
    logLine(id.trim() ? `caller ready ${name}` : `caller missing ${name}`);
  }
}

void bootstrap();
