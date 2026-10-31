import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { RunsService } from "./runs.service";

@Controller()
export class RunsController {
  constructor(@Inject(RunsService) private readonly runs: RunsService) {}

  @Post("runs")
  @HttpCode(201)
  create(@Body() body: unknown) {
    return this.runs.create(body);
  }

  @Get("sample")
  sample() {
    return this.runs.sample();
  }

  @Get("targets")
  targets() {
    return this.runs.listTargets();
  }

  @Get("calls/:id")
  call(@Param("id") id: string) {
    return this.runs.getCall(id);
  }

  @Get("calls/:id/recording")
  async recording(@Param("id") id: string, @Res() res: Response) {
    const file = await this.runs.getRecording(id);
    if (!file) throw new NotFoundException("No recording for this call.");
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(file.body));
  }

  @Get("runs/:id")
  get(@Param("id") id: string) {
    return this.runs.get(id);
  }

  @Get("runs/:id/merged")
  merged(@Param("id") id: string) {
    return this.runs.getMerged(id);
  }

  @Post("runs/:id/rerun")
  @HttpCode(201)
  rerun(@Param("id") id: string, @Body() body: unknown) {
    return this.runs.rerun(id, sessionOf(body));
  }

  @Post("runs/:id/apply-patch")
  @HttpCode(200)
  applyRunPatch(@Param("id") id: string) {
    return this.runs.applyRunPatch(id);
  }

  @Post("calls/:id/apply-patch")
  @HttpCode(200)
  applyCallPatch(@Param("id") id: string) {
    return this.runs.applyCallPatch(id);
  }

  @Get("agents")
  desks() {
    return this.runs.listDesks();
  }

  @Get("agents/:slug")
  desk(@Param("slug") slug: string) {
    return this.runs.deskDraft(slug);
  }

  @Get("agents/:slug/settings")
  settings(@Param("slug") slug: string) {
    return this.runs.deskSettings(slug);
  }

  @Post("agents/:slug/open")
  @HttpCode(200)
  open(@Param("slug") slug: string) {
    return this.runs.openDesk(slug);
  }

  @Post("agents/:slug/reset")
  @HttpCode(200)
  reset(@Param("slug") slug: string) {
    return this.runs.resetDesk(slug);
  }

  @Get("callers/:persona")
  caller(@Param("persona") persona: string) {
    return this.runs.callerDraft(persona);
  }

  @Post("callers/:persona")
  @HttpCode(200)
  pushCaller(@Param("persona") persona: string) {
    return this.runs.pushCallerPrompt(persona);
  }

  @Post("calls/:id/rerun")
  @HttpCode(201)
  rerunCall(@Param("id") id: string, @Body() body: unknown) {
    return this.runs.rerunCall(id, sessionOf(body));
  }
}

function sessionOf(body: unknown): string | null {
  const value = body !== null && typeof body === "object" ? (body as { session?: unknown }).session : "";
  return typeof value === "string" && value.length >= 8 ? value.slice(0, 80) : null;
}
