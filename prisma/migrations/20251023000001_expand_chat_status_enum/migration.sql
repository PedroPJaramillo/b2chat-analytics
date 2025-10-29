-- ================================================
-- Migration: Expand ChatStatus Enum to 8 Values
-- Feature 001: B2Chat Full Status Support
-- Created: 2025-10-23
-- ================================================

BEGIN;

-- Step 1: Add new enum values to ChatStatus
-- Note: PostgreSQL doesn't allow renaming enum values, so we add new ones
-- Legacy values (open, closed, pending) remain for backward compatibility
ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'BOT_CHATTING';
ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'OPENED';
ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'RESPONDED_BY_AGENT';
ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'COMPLETING_POLL';
ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'COMPLETED_POLL';
ALTER TYPE "ChatStatus" ADD VALUE IF NOT EXISTS 'ABANDONED_POLL';

-- Step 2: Add survey-related columns to chats table
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "poll_started_at" TIMESTAMP;
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "poll_completed_at" TIMESTAMP;
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "poll_abandoned_at" TIMESTAMP;
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "poll_response" JSONB;

-- Step 3: Create indexes for new survey fields
CREATE INDEX IF NOT EXISTS "chats_poll_started_at_idx"
  ON "chats"("poll_started_at");

CREATE INDEX IF NOT EXISTS "chats_poll_completed_at_idx"
  ON "chats"("poll_completed_at");

CREATE INDEX IF NOT EXISTS "chats_poll_abandoned_at_idx"
  ON "chats"("poll_abandoned_at");

-- Composite index for survey queries
CREATE INDEX IF NOT EXISTS "chats_status_poll_idx"
  ON "chats"("status", "poll_started_at")
  WHERE "poll_started_at" IS NOT NULL;

-- Step 4: Add comment documentation
COMMENT ON COLUMN "chats"."poll_started_at" IS 'Timestamp when satisfaction survey was initiated (COMPLETING_POLL status)';
COMMENT ON COLUMN "chats"."poll_completed_at" IS 'Timestamp when customer completed survey (COMPLETED_POLL status)';
COMMENT ON COLUMN "chats"."poll_abandoned_at" IS 'Timestamp when survey timed out without completion (ABANDONED_POLL status)';
COMMENT ON COLUMN "chats"."poll_response" IS 'Customer survey response data (ratings, comments, etc.) stored as JSON';

COMMIT;

-- Verification queries (run manually after migration)
-- 1. Check all enum values exist
-- SELECT unnest(enum_range(NULL::"ChatStatus")) AS status ORDER BY status;

-- 2. Verify new columns
-- \d chats

-- 3. Verify indexes
-- \di chats_poll*
