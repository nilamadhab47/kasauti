ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "rerun_scope" text;

-- Existing child runs: one call means an individual rerun, more than one means the whole set.
UPDATE "runs" AS r
SET "rerun_scope" = CASE
  WHEN (SELECT count(*) FROM "calls" AS c WHERE c.run_id = r.id) <= 1 THEN 'caller'
  ELSE 'full'
END
WHERE r.parent_run_id IS NOT NULL
  AND r.rerun_scope IS NULL;
