import { Body, Controller, Get, HttpCode, Inject, Post, Query } from "@nestjs/common";
import { InboundService } from "./inbound.service";

@Controller()
export class InboundController {
  constructor(@Inject(InboundService) private readonly inbound: InboundService) {}

  @Get("inbound")
  status(@Query("session") session?: string) {
    const id = typeof session === "string" ? session.slice(0, 80) : null;
    return this.inbound.status(id);
  }

  @Post("inbound/switch")
  @HttpCode(200)
  switchTo(@Body() body: unknown) {
    const agent = body !== null && typeof body === "object" && typeof (body as { agent?: unknown }).agent === "string" ? (body as { agent: string }).agent : "";
    return this.inbound.switchTo(agent);
  }
}
