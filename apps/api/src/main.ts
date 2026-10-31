import "./env";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { env } from "./env";

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
  console.log(`kasauti api listening on ${env.port}`);
}

void bootstrap();
