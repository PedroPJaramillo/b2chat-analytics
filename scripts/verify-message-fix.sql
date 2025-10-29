-- ============================================================================
-- Message Fix Verification Script
-- ============================================================================
-- Run this script after cleanup and re-sync to verify the fix worked
-- ============================================================================

-- Test 1: Check the specific problematic chat
SELECT
  '=== Test 1: Specific Chat Verification ===' as test_name;

SELECT
  c.id,
  c.b2chat_id,
  c.status,
  COUNT(m.id) as message_count_in_db,
  STRING_AGG(
    CONCAT(
      TO_CHAR(m.timestamp, 'HH24:MI:SS'),
      ' - ',
      CASE WHEN m.incoming THEN 'Customer' ELSE 'Agent' END,
      ': ',
      LEFT(m.text, 40)
    ),
    E'\n' ORDER BY m.timestamp
  ) as message_preview
FROM chats c
LEFT JOIN messages m ON m.chat_id = c.id
WHERE c.b2chat_id = '4ecbc6ab-37b0-413e-a33f-9b6ae96480f0'
GROUP BY c.id, c.b2chat_id, c.status;

-- Expected: 5 messages (was: 1)

-- Test 2: Overall message statistics
SELECT
  '=== Test 2: Overall Message Statistics ===' as test_name;

SELECT
  COUNT(*) as total_messages,
  COUNT(DISTINCT chat_id) as chats_with_messages,
  MIN(timestamp) as earliest_message,
  MAX(timestamp) as latest_message,
  ROUND(AVG(msg_per_chat), 2) as avg_messages_per_chat,
  MAX(msg_per_chat) as max_messages_in_chat
FROM (
  SELECT
    chat_id,
    COUNT(*) as msg_per_chat
  FROM messages
  GROUP BY chat_id
) as chat_msg_stats;

-- Expected: ~10,000+ messages, avg 1-2 per chat (was: 2,223 total, avg 0.23)

-- Test 3: Multi-turn conversation detection
SELECT
  '=== Test 3: Multi-Turn Conversations ===' as test_name;

SELECT
  CASE
    WHEN msg_count = 1 THEN '1 message'
    WHEN msg_count = 2 THEN '2 messages'
    WHEN msg_count BETWEEN 3 AND 5 THEN '3-5 messages'
    WHEN msg_count BETWEEN 6 AND 10 THEN '6-10 messages'
    ELSE '10+ messages'
  END as message_range,
  COUNT(*) as chat_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM (
  SELECT chat_id, COUNT(*) as msg_count
  FROM messages
  GROUP BY chat_id
) as chat_msg_counts
GROUP BY message_range, msg_count
ORDER BY MIN(msg_count);

-- Expected: Should see chats with 2+, 3-5, 6-10 messages (was: all 1 message)

-- Test 4: Customer vs Agent message distribution
SELECT
  '=== Test 4: Message Direction Distribution ===' as test_name;

SELECT
  incoming,
  CASE WHEN incoming THEN 'Customer' ELSE 'Agent' END as message_from,
  COUNT(*) as message_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM messages
GROUP BY incoming;

-- Test 5: Messages by time period
SELECT
  '=== Test 5: Messages by Time Period ===' as test_name;

SELECT
  CASE
    WHEN timestamp >= NOW() - INTERVAL '7 days' THEN 'Last 7 days'
    WHEN timestamp >= NOW() - INTERVAL '30 days' THEN '7-30 days ago'
    ELSE 'Older than 30 days'
  END as time_period,
  COUNT(*) as message_count,
  COUNT(DISTINCT chat_id) as chat_count,
  ROUND(AVG(msg_per_chat), 2) as avg_messages_per_chat
FROM (
  SELECT
    m.timestamp,
    m.chat_id,
    COUNT(*) OVER (PARTITION BY m.chat_id) as msg_per_chat
  FROM messages m
) as msg_stats
GROUP BY time_period
ORDER BY
  CASE time_period
    WHEN 'Last 7 days' THEN 1
    WHEN '7-30 days ago' THEN 2
    ELSE 3
  END;

-- Test 6: Sample multi-turn conversations
SELECT
  '=== Test 6: Sample Multi-Turn Conversations ===' as test_name;

SELECT
  c.id,
  c.b2chat_id,
  c.status,
  COUNT(m.id) as message_count,
  COUNT(CASE WHEN m.incoming = true THEN 1 END) as customer_messages,
  COUNT(CASE WHEN m.incoming = false THEN 1 END) as agent_messages
FROM chats c
JOIN messages m ON m.chat_id = c.id
GROUP BY c.id, c.b2chat_id, c.status
HAVING COUNT(m.id) >= 3
ORDER BY COUNT(m.id) DESC
LIMIT 10;

-- Expected: Should show several chats with 3+ messages and mix of customer/agent

-- Test 7: Transform log verification
SELECT
  '=== Test 7: Recent Transform Logs ===' as test_name;

SELECT
  sync_id,
  status,
  records_processed,
  changes_summary->'details'->'messages'->>'created' as messages_created,
  completed_at
FROM transform_logs
WHERE entity_type = 'chats'
  AND completed_at >= NOW() - INTERVAL '1 hour'
ORDER BY completed_at DESC
LIMIT 5;

-- Expected: Should show messages_created count much higher than before

-- Summary
SELECT
  '=== SUMMARY ===' as test_name;

WITH stats AS (
  SELECT
    COUNT(*) as total_messages,
    COUNT(DISTINCT chat_id) as chats_with_messages,
    COUNT(CASE WHEN msg_count >= 2 THEN 1 END) as multi_turn_chats
  FROM (
    SELECT chat_id, COUNT(*) as msg_count
    FROM messages
    GROUP BY chat_id
  ) as chat_msg_counts
)
SELECT
  total_messages,
  chats_with_messages,
  multi_turn_chats,
  ROUND(multi_turn_chats * 100.0 / NULLIF(chats_with_messages, 0), 2) as pct_multi_turn,
  CASE
    WHEN total_messages > 5000 AND multi_turn_chats > 100 THEN '✅ FIX SUCCESSFUL'
    WHEN total_messages > 2223 THEN '⚠️ PARTIAL SUCCESS - Re-run transform'
    ELSE '❌ FIX FAILED - Check logs'
  END as status
FROM stats;
