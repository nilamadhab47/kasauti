import { Inject, Injectable } from "@nestjs/common";
import { DB, type Database } from "../db/db.module";
import { webhookEvents } from "../db/schema";
import { parseWebhook } from "./parse-webhook";

@Injectable()
export class WebhookService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(body: unknown): Promise<{ executionId: string | null; status: string | null }> {
    const event = parseWebhook(body);
    await this.db.insert(webhookEvents).values({
      executionId: event.executionId,
      status: event.status,
      payload: event.payload,
    });
    return { executionId: event.executionId, status: event.status };
  }
}
