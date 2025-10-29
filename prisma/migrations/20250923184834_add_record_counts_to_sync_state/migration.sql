-- Ensure record tracking columns exist even if created outside Prisma
ALTER TABLE "sync_states"
  ADD COLUMN IF NOT EXISTS "failed_records" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "successful_records" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sync_duration" INTEGER,
  ADD COLUMN IF NOT EXISTS "total_records" INTEGER NOT NULL DEFAULT 0;

-- Backfill nullable values before enforcing constraints
UPDATE "sync_states" SET "failed_records" = 0 WHERE "failed_records" IS NULL;
UPDATE "sync_states" SET "successful_records" = 0 WHERE "successful_records" IS NULL;
UPDATE "sync_states" SET "total_records" = 0 WHERE "total_records" IS NULL;

-- Align defaults and nullability with Prisma schema
ALTER TABLE "sync_states"
  ALTER COLUMN "failed_records" SET DEFAULT 0,
  ALTER COLUMN "failed_records" SET NOT NULL,
  ALTER COLUMN "successful_records" SET DEFAULT 0,
  ALTER COLUMN "successful_records" SET NOT NULL,
  ALTER COLUMN "total_records" SET DEFAULT 0,
  ALTER COLUMN "total_records" SET NOT NULL;
