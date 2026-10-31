ALTER TABLE "targets" ADD COLUMN IF NOT EXISTS "line_lock_run_id" uuid;
--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN IF NOT EXISTS "line_lock_at" timestamp with time zone;
