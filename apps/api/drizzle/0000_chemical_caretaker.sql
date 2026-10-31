CREATE TABLE "call_metrics" (
	"call_id" uuid PRIMARY KEY NOT NULL,
	"persona_turns" integer,
	"target_turns" integer,
	"max_same_speaker_run" integer,
	"persona_repeat_count" integer,
	"target_hindi_ratio" numeric,
	"latency_p50_ms" integer,
	"latency_p95_ms" integer,
	"max_dead_air_ms" integer,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"persona_id" text NOT NULL,
	"user_data" jsonb NOT NULL,
	"bolna_execution_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"execution_raw" jsonb,
	"target_execution_raw" jsonb,
	"recording_key" text,
	"duration_s" integer,
	"cost" numeric,
	"hangup_by" text,
	"hangup_reason" text,
	"ttfa_ms" numeric,
	"verdict" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "calls_bolna_execution_id_unique" UNIQUE("bolna_execution_id")
);
--> statement-breakpoint
CREATE TABLE "fix_suggestions" (
	"run_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"dimension" text,
	"suggestion" text,
	"evidence_call_ids" uuid[],
	CONSTRAINT "fix_suggestions_run_id_idx_pk" PRIMARY KEY("run_id","idx")
);
--> statement-breakpoint
CREATE TABLE "persona_agents" (
	"persona_id" text PRIMARY KEY NOT NULL,
	"bolna_agent_id" text NOT NULL,
	"config_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"label" text NOT NULL,
	"parent_run_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"pass_rate" numeric,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "runs_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"call_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"score" integer,
	"verdict" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fix_hint" text,
	"judge_version" text NOT NULL,
	CONSTRAINT "scores_call_id_dimension_judge_version_pk" PRIMARY KEY("call_id","dimension","judge_version"),
	CONSTRAINT "scores_score_range" CHECK ("scores"."score" is null or ("scores"."score" >= 0 and "scores"."score" <= 5))
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_email" text NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"platform" text NOT NULL,
	"bolna_agent_id" text,
	"task_goal" text NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consent_confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "targets_platform" CHECK ("targets"."platform" in ('bolna','vapi','retell','elevenlabs','other'))
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"call_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"speaker" text NOT NULL,
	"text" text NOT NULL,
	"lang" text,
	CONSTRAINT "turns_call_id_idx_pk" PRIMARY KEY("call_id","idx"),
	CONSTRAINT "turns_speaker" CHECK ("turns"."speaker" in ('persona','target'))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"execution_id" text,
	"status" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_metrics" ADD CONSTRAINT "call_metrics_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_suggestions" ADD CONSTRAINT "fix_suggestions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_parent_run_id_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;