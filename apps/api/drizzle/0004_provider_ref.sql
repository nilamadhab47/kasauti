ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "provider_ref" text;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'voice';
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'voice';

UPDATE "calls" SET "channel" = 'voice' WHERE "channel" IS NULL;
UPDATE "runs" SET "channel" = 'voice' WHERE "channel" IS NULL;
UPDATE "calls" SET "provider_ref" = "bolna_execution_id" WHERE "provider_ref" IS NULL AND "bolna_execution_id" IS NOT NULL;

ALTER TABLE "calls" ALTER COLUMN "channel" SET NOT NULL;
ALTER TABLE "runs" ALTER COLUMN "channel" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "calls_provider_ref_unique" ON "calls" ("provider_ref");
