import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module";
import { HealthController } from "./health.controller";
import { QueueModule } from "./queue/queue.module";
import { InboundController } from "./inbound/inbound.controller";
import { InboundService } from "./inbound/inbound.service";
import { RunsController } from "./runs/runs.controller";
import { RunsService } from "./runs/runs.service";
import { WebhookController } from "./webhook/webhook.controller";
import { WebhookService } from "./webhook/webhook.service";

@Module({
  imports: [DbModule, QueueModule],
  controllers: [HealthController, WebhookController, RunsController, InboundController],
  providers: [WebhookService, RunsService, InboundService],
})
export class AppModule {}
