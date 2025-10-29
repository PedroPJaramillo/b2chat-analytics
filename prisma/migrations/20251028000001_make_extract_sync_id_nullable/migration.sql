-- Step 1: Make extract_sync_id nullable in transform_logs
ALTER TABLE "transform_logs"
  ALTER COLUMN "extract_sync_id" DROP NOT NULL;
