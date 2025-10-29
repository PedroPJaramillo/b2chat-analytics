# Database Schema

This is the database schema assessment for the spec detailed in @.agent-os/specs/2025-10-16-weekly-response-time-heatmap/spec.md

## Schema Changes Required

**None** - No new tables, columns, or schema modifications are needed for this feature.

## Existing Schema Sufficiency

The weekly response time heatmap feature can be fully implemented using the existing `Chat` model schema without any modifications.

### Chat Model (Existing)

**Relevant Fields**:

| Field | Type | Description | Used For |
|-------|------|-------------|----------|
| `id` | String | Primary key | Record identification |
| `b2chatId` | String | B2Chat external ID | N/A for this feature |
| `agentId` | String? | Foreign key to Agent | Agent filtering |
| `contactId` | String? | Foreign key to Contact | N/A for this feature |
| `departmentId` | String? | Foreign key to Department | N/A for this feature |
| `provider` | ChatProvider | Channel type | N/A for this feature |
| `status` | ChatStatus | Chat state | N/A for this feature |
| `direction` | ChatDirection | Incoming/outgoing | Direction filtering |
| `originalDirection` | ChatDirection? | Original direction | Conversion tracking |
| `createdAt` | DateTime | Chat creation timestamp | Week filtering, day/hour grouping |
| `openedAt` | DateTime? | When chat opened (OPENED state) | Response time calculation (start) |
| `responseAt` | DateTime? | When agent sent first message | Response time calculation (end) |
| `closedAt` | DateTime? | When chat closed | N/A for this feature |
| `isDeleted` | Boolean | Soft delete flag | Exclusion filter |
| `lastModifiedAt` | DateTime? | Last modification timestamp | N/A for this feature |

**Sufficient Fields**:
- ✅ `createdAt` - Used for week range filtering and extracting day of week / hour
- ✅ `openedAt` - Start time for response time calculation
- ✅ `responseAt` - End time for response time calculation (first agent message)
- ✅ `agentId` - Used for agent-specific filtering
- ✅ `direction` - Used for direction filter integration
- ✅ `originalDirection` - Used for "converted" direction filter
- ✅ `isDeleted` - Used to exclude soft-deleted chats

**Calculation**:
```typescript
// Response time (in milliseconds)
const responseTime = responseAt - openedAt

// Day of week (0-6)
const dayOfWeek = createdAt.getDay()

// Hour of day (0-23)
const hour = createdAt.getHours()
```

### Existing Indexes

**Currently Available Indexes** (from schema):

```prisma
@@index([b2chatId])
@@index([agentId, createdAt])
@@index([contactId, createdAt])
@@index([departmentId, createdAt])
@@index([provider, createdAt])
@@index([status, createdAt])
@@index([createdAt])
@@index([openedAt])
@@index([responseAt])
@@index([topic])
@@index([unreadCount])
@@index([status, priority, lastModifiedAt])
@@index([agentId, status, createdAt])
@@index([direction])
@@index([direction, status, createdAt])
```

**Indexes Used by This Feature**:

1. **`@@index([agentId, status, createdAt])`**
   - Used when filtering by specific agent
   - Optimizes: `WHERE agent_id = $1 AND created_at BETWEEN $2 AND $3`

2. **`@@index([direction, status, createdAt])`**
   - Used when filtering by direction (incoming/outgoing)
   - Optimizes: `WHERE direction = $1 AND created_at BETWEEN $2 AND $3`

3. **`@@index([createdAt])`**
   - Used for week range filtering
   - Optimizes: `WHERE created_at >= $1 AND created_at < $2`

4. **`@@index([openedAt])` and `@@index([responseAt])`**
   - Used for NOT NULL checks
   - Optimizes: `WHERE opened_at IS NOT NULL AND response_at IS NOT NULL`

**Index Coverage**: ✅ Existing indexes provide sufficient coverage for all query patterns used by this feature.

## Performance Assessment

### Query Pattern Analysis

**Primary Query**:
```sql
SELECT *
FROM chats
WHERE
  created_at >= '2025-10-13' AND created_at < '2025-10-20'
  AND agent_id = 'agent_123'  -- Optional
  AND direction = 'incoming'   -- Optional
  AND opened_at IS NOT NULL
  AND response_at IS NOT NULL
  AND is_deleted = false
```

**Index Selection**:
- If both `agentId` and `direction` filters: Uses `agentId_status_createdAt` index
- If only `direction` filter: Uses `direction_status_createdAt` index
- If only `agentId` filter: Uses `agentId_status_createdAt` index
- If no filters (aggregate): Uses `createdAt` index

**Estimated Performance**:
- **Typical week dataset**: 1,000-10,000 chats
- **Query execution time**: 50-200ms
- **Index scan cost**: Low (highly selective date range)
- **Rows scanned**: Only chats within 7-day window
- **Bottleneck**: None identified

### Optimization Recommendations

#### Recommended: Monitor Query Performance

**Action**: Add database query monitoring to track actual performance.

**Implementation**:
```typescript
// In API route
console.time('weekly-heatmap-query')
const chats = await prisma.chat.findMany({ ... })
console.timeEnd('weekly-heatmap-query')
```

**Thresholds**:
- ✅ Good: < 100ms
- ⚠️ Acceptable: 100-500ms
- ❌ Needs optimization: > 500ms

#### Optional: Composite Index (Only If Needed)

**Trigger**: If query performance exceeds 500ms consistently.

**Migration**:
```sql
-- Only create if performance testing shows need
CREATE INDEX idx_weekly_heatmap_optimized
ON chats(created_at, agent_id, direction, opened_at, response_at)
WHERE is_deleted = false AND opened_at IS NOT NULL AND response_at IS NOT NULL;
```

**Rationale**:
- Covers all columns used in WHERE clause
- Partial index (filtered) reduces index size
- Includes responseAt to avoid table lookup for response time calculation

**Trade-offs**:
- Increases index storage by ~50MB (for 1M chats)
- Slows down INSERT operations by ~5%
- Benefits: 50-70% faster queries for weekly heatmap

**Recommendation**: **Do not create initially** - existing indexes should be sufficient. Only add if performance testing reveals bottlenecks.

## Data Volume Considerations

### Current Scale Assumptions

**Expected Data Volume**:
- Average chats per day: 300-1,000
- Chats per week: 2,100-7,000
- Annual chat volume: 100K-400K
- Database size: 500MB-2GB

**Query Selectivity**:
- 7-day range: 0.5-2% of total dataset
- Agent filter: Reduces by 80-95% (10-20 agents typical)
- Direction filter: Reduces by 50-70% (more incoming than outgoing)
- Combined filters: Queries scan 0.01-0.5% of total dataset

**Performance Impact**: ✅ Minimal - highly selective queries

### Future Scale Considerations

**High-Volume Scenarios** (1M+ chats):

1. **If query time exceeds 500ms**:
   - Add recommended composite index
   - Consider database connection pooling optimization
   - Implement query result caching (Redis)

2. **If dataset exceeds 5M chats**:
   - Implement data partitioning by month/quarter
   - Move old data to archive tables
   - Use materialized views for aggregated metrics

3. **If concurrent users exceed 100**:
   - Scale database read replicas
   - Implement read-only replica routing for analytics queries
   - Add database connection pooling

**Current Status**: ✅ No action needed for expected scale (< 500K chats)

## Data Integrity

### Existing Constraints

**Field Constraints** (from schema):
- `openedAt` - Can be NULL (chats not yet opened)
- `responseAt` - Can be NULL (chats not yet responded to)
- `isDeleted` - Default FALSE

**Query Safety**:
```typescript
// Safe handling of NULL values
where: {
  openedAt: { not: null },  // Exclude chats without open time
  responseAt: { not: null },  // Exclude chats without response
  isDeleted: false  // Exclude soft-deleted chats
}
```

**Edge Cases Handled**:
- ✅ Chats created but never opened: Excluded (openedAt IS NULL)
- ✅ Chats opened but never responded: Excluded (responseAt IS NULL)
- ✅ Deleted chats: Excluded (isDeleted = TRUE)
- ✅ Future-dated chats: Excluded by date range filter

### Data Quality Assumptions

**Assumptions**:
1. `createdAt` always present (NOT NULL constraint in schema)
2. `openedAt <= responseAt` (response cannot happen before open)
3. `createdAt <= openedAt <= responseAt` (logical time progression)
4. Response time is positive (responseAt > openedAt)

**Validation** (recommended in data sync engine):
```typescript
// In sync engine, validate before saving
if (responseAt && openedAt && responseAt < openedAt) {
  logger.warn('Invalid chat times: responseAt before openedAt', { chatId })
  // Handle: Skip or set responseAt = null
}
```

**Current Implementation**: Existing sync engine should handle these validations.

## Migration Files

**No migration needed** - This feature requires no schema changes.

**If future optimization needed**, migration would be:

```sql
-- File: prisma/migrations/YYYYMMDD_add_weekly_heatmap_index/migration.sql
-- Only create if performance testing shows need (> 500ms query time)

-- Add optimized composite index
CREATE INDEX IF NOT EXISTS "idx_chats_weekly_heatmap"
ON "chats"(
  "created_at",
  "agent_id",
  "direction",
  "opened_at",
  "response_at"
)
WHERE
  "is_deleted" = false
  AND "opened_at" IS NOT NULL
  AND "response_at" IS NOT NULL;

-- Add comment
COMMENT ON INDEX "idx_chats_weekly_heatmap" IS
'Optimized index for weekly response time heatmap queries. Only needed if base query performance exceeds 500ms.';
```

## Testing Considerations

### Database Testing

**Test Cases**:

1. **Query Performance Test**:
   - Seed database with 10K chats across 4 weeks
   - Execute weekly heatmap query
   - Assert: Query completes in < 200ms
   - Measure: Actual query execution time

2. **Index Usage Verification**:
   - Run `EXPLAIN ANALYZE` on query
   - Assert: Uses expected indexes (agentId or direction or createdAt)
   - Verify: No full table scans

3. **Data Integrity Test**:
   - Include chats with NULL openedAt or responseAt
   - Assert: These chats excluded from results
   - Verify: Only valid chats with both timestamps included

4. **Edge Case Test**:
   - Query week with no chats
   - Assert: Returns 168 items with count=0
   - Verify: No database errors

### Load Testing

**Concurrent Query Test**:
- Simulate 50 concurrent users
- Each requesting different weeks/agents
- Assert: P95 response time < 1 second
- Verify: Database connections don't exhaust

**Recommendation**: Use k6 load testing (already in project).

## Summary

**Assessment**: ✅ **Existing database schema is fully sufficient** for the weekly response time heatmap feature.

**Required Changes**: **None**

**Optional Optimizations**:
- Monitor query performance
- Add composite index only if needed (> 500ms queries)
- Consider materialized views for very large datasets (> 5M chats)

**Risk Level**: **Low** - Feature uses well-indexed columns and common query patterns.

**Confidence Level**: **High** - Existing indexes provide excellent coverage for expected query patterns.
