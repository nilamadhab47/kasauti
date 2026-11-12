import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    platform: text("platform").notNull(),
    bolnaAgentId: text("bolna_agent_id"),
    taskGoal: text("task_goal").notNull(),
    facts: jsonb("facts").notNull().default({}),
    consentConfirmedAt: timestamp("consent_confirmed_at", { withTimezone: true }).notNull(),
    lineLockRunId: uuid("line_lock_run_id"),
    lineLockAt: timestamp("line_lock_at", { withTimezone: true }),
    lineLockSession: text("line_lock_session"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("targets_platform", sql`${table.platform} in ('bolna','vapi','retell','elevenlabs','other')`)],
);

export const personaAgents = pgTable("persona_agents", {
  personaId: text("persona_id").primaryKey(),
  bolnaAgentId: text("bolna_agent_id").notNull(),
  configHash: text("config_hash").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetId: uuid("target_id")
    .notNull()
    .references(() => targets.id),
  label: text("label").notNull(),
  parentRunId: uuid("parent_run_id").references((): AnyPgColumn => runs.id),
  /** null on a first run. "full" redials every caller. "caller" redials one caller after their own patch. */
  rerunScope: text("rerun_scope"),
  status: text("status").notNull().default("queued"),
  channel: text("channel").notNull().default("voice"),
  passRate: numeric("pass_rate"),
  shareToken: text("share_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  personaId: text("persona_id").notNull(),
  userData: jsonb("user_data").notNull(),
  bolnaExecutionId: text("bolna_execution_id").unique(),
  providerRef: text("provider_ref").unique(),
  channel: text("channel").notNull().default("voice"),
  status: text("status").notNull().default("pending"),
  attempt: integer("attempt").notNull().default(1),
  executionRaw: jsonb("execution_raw"),
  targetExecutionRaw: jsonb("target_execution_raw"),
  recordingKey: text("recording_key"),
  durationS: integer("duration_s"),
  cost: numeric("cost"),
  hangupBy: text("hangup_by"),
  hangupReason: text("hangup_reason"),
  ttfaMs: numeric("ttfa_ms"),
  verdict: text("verdict"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const turns = pgTable(
  "turns",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    speaker: text("speaker").notNull(),
    text: text("text").notNull(),
    lang: text("lang"),
  },
  (table) => [
    primaryKey({ columns: [table.callId, table.idx] }),
    check("turns_speaker", sql`${table.speaker} in ('persona','target')`),
  ],
);

export const callMetrics = pgTable("call_metrics", {
  callId: uuid("call_id")
    .primaryKey()
    .references(() => calls.id, { onDelete: "cascade" }),
  personaTurns: integer("persona_turns"),
  targetTurns: integer("target_turns"),
  maxSameSpeakerRun: integer("max_same_speaker_run"),
  personaRepeatCount: integer("persona_repeat_count"),
  targetHindiRatio: numeric("target_hindi_ratio"),
  latencyP50Ms: integer("latency_p50_ms"),
  latencyP95Ms: integer("latency_p95_ms"),
  maxDeadAirMs: integer("max_dead_air_ms"),
  raw: jsonb("raw"),
});

export const scores = pgTable(
  "scores",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    dimension: text("dimension").notNull(),
    score: integer("score"),
    verdict: text("verdict"),
    evidence: jsonb("evidence").notNull().default([]),
    fixHint: text("fix_hint"),
    judgeVersion: text("judge_version").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.callId, table.dimension, table.judgeVersion] }),
    check("scores_score_range", sql`${table.score} is null or (${table.score} >= 0 and ${table.score} <= 5)`),
  ],
);

export const fixSuggestions = pgTable(
  "fix_suggestions",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    dimension: text("dimension"),
    suggestion: text("suggestion"),
    evidenceCallIds: uuid("evidence_call_ids").array(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.idx] })],
);

export const webhookEvents = pgTable("webhook_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  executionId: text("execution_id"),
  status: text("status"),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
