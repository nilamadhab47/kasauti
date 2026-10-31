import { Body, Controller, HttpCode, Inject, Post, Query, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { QueueService } from "../queue/queue.service";
import { WebhookService } from "./webhook.service";

@Controller("webhooks")
export class WebhookController {
  constructor(
    @Inject(WebhookService) private readonly webhooks: WebhookService,
    @Inject(QueueService) private readonly jobs: QueueService,
  ) {}

  @Post("bolna")
  @HttpCode(200)
  async bolna(@Query("s") secret: string | undefined, @Body() body: unknown) {
    if (!sameSecret(secret, env.webhookSecret)) {
      throw new UnauthorizedException();
    }
    const saved = await this.webhooks.record(body);
    if (saved.executionId) await this.jobs.note(saved.executionId, saved.status);
    return { ok: true, execution_id: saved.executionId, status: saved.status };
  }
}

function sameSecret(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
