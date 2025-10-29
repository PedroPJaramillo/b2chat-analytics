-- ============================================================================
-- Message ID Collision Fix - Database Cleanup Script
-- ============================================================================
-- Purpose: Reset messages table and raw_chats to re-sync with fixed message IDs
-- Date: 2025-10-21
--
-- IMPORTANT:
-- 1. Backup your database before running this script!
-- 2. Run this script in a transaction to allow rollback if needed
-- 3. After running, trigger the transform process to re-sync messages
-- ============================================================================

BEGIN;

-- Step 1: Show current state before cleanup
SELECT
  'Before Cleanup' as status,
  (SELECT COUNT(*) FROM messages) as total_messages,
  (SELECT COUNT(DISTINCT chat_id) FROM messages) as chats_with_messages,
  (SELECT COUNT(*) FROM raw_chats WHERE processing_status = 'processed') as processed_raw_chats;

-- Step 2: Delete all existing messages (will be re-synced with correct IDs)
-- Note: This will cascade delete due to foreign key constraints
TRUNCATE TABLE messages;

-- Step 3: Reset raw_chats processing status to allow re-transform
-- Only reset chats that were already processed
UPDATE raw_chats
SET
  processing_status = 'pending',
  processed_at = NULL,
  processing_error = NULL
WHERE processing_status IN ('processed', 'failed');

-- Step 4: Show state after cleanup
SELECT
  'After Cleanup' as status,
  (SELECT COUNT(*) FROM messages) as total_messages,
  (SELECT COUNT(DISTINCT chat_id) FROM messages) as chats_with_messages,
  (SELECT COUNT(*) FROM raw_chats WHERE processing_status = 'pending') as pending_raw_chats;

-- Step 5: Show sample of raw_chats ready for re-processing
SELECT
  sync_id,
  COUNT(*) as chat_count,
  MIN(fetched_at) as earliest_fetch,
  MAX(fetched_at) as latest_fetch
FROM raw_chats
WHERE processing_status = 'pending'
GROUP BY sync_id
ORDER BY MAX(fetched_at) DESC
LIMIT 10;

-- IMPORTANT: Review the output above before committing!
-- If everything looks correct, run: COMMIT;
-- If you want to rollback, run: ROLLBACK;

-- Uncomment the line below to automatically commit (not recommended for first run)
-- COMMIT;
