import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker, type JobsOptions } from "bullmq";
import { DB, type Database } from "../db/db.module";
import { finalizeRun, ingestCall, judgeCall, noteExecution, placeQueuedCall, startRun, watchCall, type Enqueue } from "./pipeline";
import { logLine } from "../log";
import { replayFinishedJob } from "./replay";
import { newRedis } from "./redis";

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queueRedis = newRedis();
  private readonly workerRedis = newRedis();
  private readonly queue: Queue;
  private worker?: Worker;

  constructor(@Inject(DB) private readonly db: Database) {
    this.queue = new Queue("runs", { connection: this.queueRedis, prefix: "kasauti" });
  }

  async onModuleInit() {
    const enqueue = this.enqueue.bind(this);
    this.worker = new Worker(
      "runs",
      async (job) => {
        const data = job.data as { runId?: string; callId?: string; n?: number };
        if (job.name === "run.start" && data.runId) return startRun(this.db, enqueue, data.runId);
        if (job.name === "call.place" && data.callId) return placeQueuedCall(this.db, enqueue, data.callId);
        if (job.name === "call.watchdog" && data.callId) return watchCall(this.db, enqueue, data.callId, data.n ?? 1);
        if (job.name === "call.ingest" && data.callId) return ingestCall(this.db, enqueue, data.callId);
        if (job.name === "call.judge" && data.callId) return judgeCall(this.db, enqueue, data.callId);
        if (job.name === "run.finalize" && data.runId) return finalizeRun(this.db, data.runId);
        throw new Error(`Unknown job ${job.name}`);
      },
      { connection: this.workerRedis, prefix: "kasauti", concurrency: 2, lockDuration: 180_000 },
    );
    this.worker.on("failed", (job, error) => {
      const attempt = job?.attemptsMade ?? 0;
      const left = job ? Math.max(job.opts.attempts ?? 1, 1) - attempt : 0;
      logLine(`job ${job?.name ?? "unknown"} failed attempt ${attempt}, ${left} left: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue.close();
    this.queueRedis.disconnect();
    this.workerRedis.disconnect();
  }

  enqueue: Enqueue = async (name, data, opts) => {
    if (opts?.jobId) {
      const existing = await this.queue.getJob(opts.jobId);
      if (existing && replayFinishedJob(await existing.getState())) await existing.remove();
    }
    await this.queue.add(name, data, opts);
  };

  add(name: string, data: object, opts?: JobsOptions) {
    return this.queue.add(name, data, opts);
  }

  note(executionId: string, status: string | null) {
    return noteExecution(this.db, this.enqueue, executionId, status);
  }
}
