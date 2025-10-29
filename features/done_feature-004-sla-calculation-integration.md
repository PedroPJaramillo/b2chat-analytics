# Feature 004: SLA Calculation Integration into Sync Pipeline

## Requirements
- Integrate SLA metric calculation into the chat synchronization transform pipeline
- Automatically calculate SLA metrics for all new chats synced from B2Chat
- Recalculate SLA metrics when existing chats are updated during sync
- Backfill SLA metrics for all existing chats in the database (currently NULL)
- Enable SLA dashboard at `/dashboard/sla` to display real data
- Calculate both wall clock time and business hours SLA metrics
- Log all SLA calculations for audit and debugging purposes
- Ensure sync performance is not significantly impacted (< 10% increase)

### Problem Statement
The SLA Compliance dashboard was implemented in a prior feature but shows "no data" because:
1. The SLA calculator (`sla-calculator-full.ts`) exists but is not called during sync
2. The transform engine (`transform-engine.ts`) creates/updates chats without calculating SLA fields
3. All chats in the database have NULL values for SLA fields (`timeToPickup`, `firstResponseTime`, `pickupSLA`, `overallSLA`, etc.)
4. The API endpoints filter for `overallSLA !== null`, resulting in 0 chats returned

### Acceptance Criteria
- [x] **Integration Complete:** Transform engine calculates SLA during chat sync
- [x] **New Chats:** All newly synced chats have SLA metrics populated automatically
- [x] **Updated Chats:** SLA metrics recalculated when chat status/timestamps change
- [x] **Both Time Modes:** Wall clock and business hours metrics both calculated
- [x] **Error Handling:** SLA calculation errors logged but don't block sync
- [x] **Backfill Complete:** All existing chats have SLA metrics populated
- [x] **Dashboard Active:** `/dashboard/sla` displays metrics, breaches, and trends
- [x] **Performance:** Sync duration increase < 10%
- [x] **Tests Passing:** Unit and integration tests validate SLA calculation
- [x] **Audit Trail:** SLA calculations logged via `slaLogger.logCalculation()`

## Architecture Design

### How This Feature Fits into Existing App Patterns

Following **Pattern #8** (Event Triggers from INTEGRATION_GUIDE.md) and **Pattern #49** (Long-running jobs with incremental progress):

```
┌─────────────┐
│  B2Chat API │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Extract   │ Fetches raw chat data
│   Engine    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  RawChat    │ Staging table (JSON storage)
│  (staging)  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Transform Engine                   │
│  ┌───────────────────────────────┐  │
│  │ 1. Extract agent/contact/dept │  │
│  │ 2. Map fields & validate      │  │
│  │ 3. **NEW: Calculate SLA**     │◄─┼─── SLA Calculator
│  │ 4. Upsert Chat + Messages     │  │   + SLA Config
│  │ 5. Log calculations           │  │   + Office Hours Config
│  └───────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│    Chat     │ Normalized table with SLA fields
│  + Messages │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SLA Metrics │ API endpoints aggregate and serve
│     API     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SLA Dashboard│ Displays compliance, breaches, trends
└─────────────┘
```

### Components/Services to be Created/Modified

#### Modified:
- **`src/lib/sync/transform-engine.ts`** (Primary change)
  - Add SLA calculation during chat create/update
  - Import SLA calculator and config functions
  - Add error handling for calculation failures
  - Log all calculations via SLA logger

#### Unchanged:
- `src/lib/sla/sla-calculator-full.ts` - Calculator logic already correct
- `src/lib/config/sla-config.ts` - Configuration retrieval already works
- `src/app/api/sla/metrics/route.ts` - API endpoint already correct
- `src/app/api/sla/breaches/route.ts` - API endpoint already correct
- `src/app/api/sla/recalculate/route.ts` - Backfill endpoint already exists
- `src/app/dashboard/sla/page.tsx` - Dashboard UI already correct
- `prisma/schema.prisma` - Database schema already has SLA fields

#### Used (No Changes):
- **`calculateAllSLAMetricsWithBusinessHours()`** from `sla-calculator-full.ts`
- **`getSLAConfig()`** from `sla-config.ts`
- **`getOfficeHoursConfig()`** from `sla-config.ts`
- **`slaLogger.logCalculation()`** from `sla-logger.ts`
- **`POST /api/sla/recalculate`** for backfilling existing chats

### Integration Points with Existing Systems

**Following Aspect 2: Database and Migration Patterns (patterns 8-14):**

1. **Database Schema (Already Exists)**
   - SLA metric value fields: `timeToPickup`, `firstResponseTime`, `avgResponseTime`, `resolutionTime` (Int/Float in seconds)
   - SLA compliance flags: `pickupSLA`, `firstResponseSLA`, `avgResponseSLA`, `resolutionSLA`, `overallSLA` (Boolean)
   - Business hours variants: `*BH` suffix for all metrics
   - All fields use snake_case with @map() decorator (e.g., `timeToPickup` → `time_to_pickup`)

2. **Transform Engine Integration**
   - Transform engine already creates/updates chats during sync
   - Transform engine already has error handling and logging
   - **NEW:** Add SLA calculation step between field mapping and database upsert
   - **NEW:** Include SLA fields in `prisma.chat.create()` and `prisma.chat.update()` data

3. **SLA Configuration System**
   - SLA targets stored in `SystemSettings` table (category: 'sla')
   - Default fallbacks if settings not found
   - Business hours config in `SystemSettings` table (category: 'office_hours')
   - Config retrieved via async functions (await in transform engine)

4. **Message Data for Calculations**
   - Transform engine already processes messages from rawData
   - Messages have `timestamp` and `incoming` (boolean) fields
   - SLA calculator needs: `role` ('customer' | 'agent'), `createdAt` (Date)
   - **Mapping:** `incoming: true` → `role: 'customer'`, `incoming: false` → `role: 'agent'`

5. **SLA Logger Integration**
   - `slaLogger.logCalculation(chatId, metrics, trigger)` creates audit record
   - Trigger values: 'initial' (new chat), 'update' (chat updated), 'recalculate' (manual backfill)
   - Logger stores in database for debugging and compliance

6. **Error Handling Pattern**
   - Transform engine wraps each chat in try-catch
   - SLA calculation errors should be caught, logged, and allow sync to continue
   - Failed calculations leave SLA fields as NULL (can be recalculated later)

### Database Changes Required

**No schema changes needed.** All required fields already exist in Chat table:

```prisma
model Chat {
  // ... existing fields ...

  // SLA Metric Values (in seconds) - Wall Clock Time
  timeToPickup         Int?     @map("time_to_pickup")
  firstResponseTime    Int?     @map("first_response_time")
  avgResponseTime      Float?   @map("avg_response_time")
  resolutionTime       Int?     @map("resolution_time")

  // SLA Compliance Flags - Wall Clock Time
  pickupSLA            Boolean? @map("pickup_sla")
  firstResponseSLA     Boolean? @map("first_response_sla")
  avgResponseSLA       Boolean? @map("avg_response_sla")
  resolutionSLA        Boolean? @map("resolution_sla")
  overallSLA           Boolean? @map("overall_sla")

  // Business Hours variants with _bh suffix
  timeToPickupBH       Int?     @map("time_to_pickup_bh")
  // ... etc
}
```

**Data Backfill Required:**
- Query for chats with NULL SLA: `SELECT COUNT(*) FROM chats WHERE overall_sla IS NULL`
- Use existing `/api/sla/recalculate` endpoint
- Process in batches of 100 chats (BATCH_SIZE constant in endpoint)
- Can run multiple times with different date ranges if needed

### API Changes

**No API changes needed.** All endpoints already exist and work correctly:

- **GET `/api/sla/metrics`** - Aggregates SLA compliance rates and averages
- **GET `/api/sla/breaches`** - Lists chats with SLA violations
- **POST `/api/sla/recalculate`** - Backfills SLA for date range or specific chat
- **GET `/api/sla/config`** - Retrieves SLA configuration

These endpoints currently return empty results because database has no SLA data. Once integration is complete and backfill runs, they will return actual data.

## Implementation Chunks

### Chunk 1: Add SLA Calculation to Transform Engine
**Type:** Backend
**Dependencies:** None (all SLA infrastructure already exists)
**Estimated Time:** 1-2 hours
**Files to modify:**
- `src/lib/sync/transform-engine.ts` (lines ~456-625, chat transform section)

**Implementation Steps:**

1. **Add imports at top of file:**
```typescript
import { calculateAllSLAMetricsWithBusinessHours } from '@/lib/sla/sla-calculator-full'
import { getSLAConfig, getOfficeHoursConfig } from '@/lib/config/sla-config'
import { slaLogger } from '@/lib/sla/sla-logger'
import type { ChatData } from '@/lib/sla/sla-calculator'
```

2. **Add helper method to TransformEngine class:**
```typescript
/**
 * Calculate SLA metrics for a chat
 * Returns null if calculation fails (errors are logged)
 */
private async calculateSLAMetrics(
  chatId: string,
  openedAt: Date | null,
  pickedUpAt: Date | null,
  responseAt: Date | null,
  closedAt: Date | null,
  messages: Array<{ incoming: boolean; timestamp: Date }>
): Promise<any | null> {
  try {
    // Get SLA configuration
    const [slaConfig, officeHoursConfig] = await Promise.all([
      getSLAConfig(),
      getOfficeHoursConfig(),
    ])

    // Prepare chat data for calculator
    const chatData: ChatData = {
      openedAt: openedAt || new Date(),
      firstAgentAssignedAt: pickedUpAt, // Simplified: pickup = agent assignment
      closedAt: closedAt || undefined,
      messages: messages.map(msg => ({
        role: msg.incoming ? 'customer' : 'agent',
        createdAt: msg.timestamp,
      })),
    }

    // Calculate metrics
    const metrics = calculateAllSLAMetricsWithBusinessHours(
      chatData,
      slaConfig,
      officeHoursConfig
    )

    // Log calculation
    await slaLogger.logCalculation(chatId, metrics, 'initial')

    return metrics
  } catch (error) {
    logger.error('Failed to calculate SLA metrics', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
```

3. **Integrate into new chat creation (line ~588):**
```typescript
// Before prisma.chat.create(), add:
const slaMetrics = await this.calculateSLAMetrics(
  `chat_${rawData.chat_id}`,
  rawData.opened_at ? new Date(rawData.opened_at) : null,
  rawData.picked_up_at ? new Date(rawData.picked_up_at) : null,
  rawData.responded_at ? new Date(rawData.responded_at) : null,
  rawData.closed_at ? new Date(rawData.closed_at) : null,
  rawData.messages || []
)

// Then in prisma.chat.create({ data: { ... } }), add SLA fields:
const chat = await prisma.chat.create({
  data: {
    // ... existing fields ...

    // SLA metrics (wall clock)
    ...(slaMetrics && {
      timeToPickup: slaMetrics.timeToPickup,
      firstResponseTime: slaMetrics.firstResponseTime,
      avgResponseTime: slaMetrics.avgResponseTime,
      resolutionTime: slaMetrics.resolutionTime,
      pickupSLA: slaMetrics.pickupSLA,
      firstResponseSLA: slaMetrics.firstResponseSLA,
      avgResponseSLA: slaMetrics.avgResponseSLA,
      resolutionSLA: slaMetrics.resolutionSLA,
      overallSLA: slaMetrics.overallSLA,

      // SLA metrics (business hours)
      timeToPickupBH: slaMetrics.timeToPickupBH,
      firstResponseTimeBH: slaMetrics.firstResponseTimeBH,
      avgResponseTimeBH: slaMetrics.avgResponseTimeBH,
      resolutionTimeBH: slaMetrics.resolutionTimeBH,
      pickupSLABH: slaMetrics.pickupSLABH,
      firstResponseSLABH: slaMetrics.firstResponseSLABH,
      avgResponseSLABH: slaMetrics.avgResponseSLABH,
      resolutionSLABH: slaMetrics.resolutionSLABH,
      overallSLABH: slaMetrics.overallSLABH,
    }),
  },
})
```

4. **Integrate into chat update (line ~528):**
```typescript
// Before prisma.chat.update(), add similar SLA calculation
const slaMetrics = await this.calculateSLAMetrics(
  existingChat.id,
  rawData.opened_at ? new Date(rawData.opened_at) : existingChat.openedAt,
  rawData.picked_up_at ? new Date(rawData.picked_up_at) : existingChat.pickedUpAt,
  rawData.responded_at ? new Date(rawData.responded_at) : existingChat.responseAt,
  rawData.closed_at ? new Date(rawData.closed_at) : existingChat.closedAt,
  rawData.messages || []
)

// Add to update data
await prisma.chat.update({
  where: { b2chatId: rawData.chat_id },
  data: {
    // ... existing update fields ...

    // SLA metrics (same spread as create)
    ...(slaMetrics && {
      // ... all SLA fields
    }),
  },
})
```

**Tests required:** Yes
- **File:** `src/lib/sync/__tests__/transform-engine.test.ts` (add new test cases)
- **Test 1:** New chat has SLA metrics populated
- **Test 2:** Updated chat recalculates SLA metrics
- **Test 3:** SLA calculation error doesn't block sync (fields remain NULL)
- **Test 4:** SLA logger called with correct trigger ('initial' vs 'update')

**Acceptance criteria:**
- [ ] New chats synced have all SLA fields populated (not NULL)
- [ ] Updated chats recalculate SLA if timestamps changed
- [ ] Both wall clock and business hours metrics calculated
- [ ] Errors logged via `logger.error()` but sync continues
- [ ] SLA calculations logged via `slaLogger.logCalculation()`
- [ ] Unit tests pass

---

### Chunk 2: Backfill Existing Chats with SLA Metrics
**Type:** Backend Operations / Manual Task
**Dependencies:** Chunk 1 must be completed and deployed
**Estimated Time:** 30 minutes (mostly waiting for processing)
**Files involved:**
- `/api/sla/recalculate` (endpoint already exists, just needs to be called)

**Implementation Steps:**

1. **Verify integration deployed:**
```bash
# Check that Chunk 1 changes are in production
git log --oneline -5
# Look for commit with transform-engine.ts SLA integration
```

2. **Query database to check current state:**
```sql
-- How many chats total?
SELECT COUNT(*) FROM chats;

-- How many chats missing SLA?
SELECT COUNT(*) FROM chats WHERE overall_sla IS NULL;

-- Date range of chats needing backfill
SELECT
  MIN(opened_at) as oldest_chat,
  MAX(opened_at) as newest_chat,
  COUNT(*) as total_chats
FROM chats
WHERE overall_sla IS NULL;
```

3. **Call recalculate endpoint (via curl or API client):**
```bash
# Backfill last 90 days (adjust based on query results)
curl -X POST "http://localhost:3000/api/sla/recalculate?startDate=2024-07-24T00:00:00Z&endDate=2024-10-23T23:59:59Z&limit=10000"

# Or for ALL chats (remove date params):
curl -X POST "http://localhost:3000/api/sla/recalculate?limit=10000"

# Monitor response:
# {
#   "success": true,
#   "processed": 3542,
#   "failed": 0,
#   "total": 3542,
#   "duration": 45230
# }
```

4. **Verify backfill success:**
```sql
-- Should now be 0 or very few
SELECT COUNT(*) FROM chats WHERE overall_sla IS NULL;

-- Check sample of calculated SLAs
SELECT
  id,
  opened_at,
  closed_at,
  time_to_pickup,
  first_response_time,
  overall_sla,
  overall_sla_bh
FROM chats
WHERE opened_at >= NOW() - INTERVAL '7 days'
LIMIT 10;
```

5. **Check dashboard:**
- Navigate to `http://localhost:3000/dashboard/sla`
- Verify metrics cards show percentages (not "N/A")
- Verify breaches table has rows (if any SLA violations exist)
- Verify charts render with data points

**Tests required:** Manual verification
- Database queries before/after
- Dashboard visual inspection
- API endpoint response validation

**Acceptance criteria:**
- [ ] All chats have `overall_sla` NOT NULL
- [ ] SLA dashboard displays metrics instead of empty state
- [ ] Metrics cards show compliance percentages
- [ ] Breaches table shows SLA violations (if any exist)
- [ ] Charts render with historical trend data
- [ ] No errors in server logs during backfill

---

### Chunk 3: Add Integration Tests for SLA in Sync
**Type:** Backend Testing
**Dependencies:** Chunk 1 completed, Chunk 2 provides real data for verification
**Estimated Time:** 1 hour
**Files to modify:**
- `src/lib/sync/__tests__/transform-engine.test.ts` (add test cases)
- `src/lib/sla/__tests__/sla-integration.test.ts` (update existing)

**Implementation Steps:**

1. **Add test case to transform-engine.test.ts:**
```typescript
describe('SLA Calculation Integration', () => {
  beforeEach(() => {
    // Mock SLA config
    jest.mock('@/lib/config/sla-config', () => ({
      getSLAConfig: jest.fn().mockResolvedValue({
        pickupTarget: 120,
        firstResponseTarget: 300,
        avgResponseTarget: 300,
        resolutionTarget: 7200,
        complianceTarget: 95,
      }),
      getOfficeHoursConfig: jest.fn().mockResolvedValue({
        start: '09:00',
        end: '17:00',
        workingDays: [1, 2, 3, 4, 5],
        timezone: 'America/New_York',
      }),
    }))
  })

  test('should calculate SLA metrics for new chat', async () => {
    const rawChat = {
      chat_id: 'test-chat-123',
      opened_at: '2024-10-23 09:00:00',
      picked_up_at: '2024-10-23 09:01:00', // 60 seconds (within 120s target)
      responded_at: '2024-10-23 09:02:00', // 120 seconds (within 300s target)
      closed_at: '2024-10-23 10:00:00', // 3600 seconds (within 7200s target)
      status: 'closed',
      messages: [
        { incoming: true, timestamp: '2024-10-23 09:00:00' },
        { incoming: false, timestamp: '2024-10-23 09:02:00' },
      ],
    }

    const engine = new TransformEngine()
    const result = await engine.transformChats('extract-123')

    // Verify chat created with SLA fields
    const chat = await prisma.chat.findUnique({
      where: { b2chatId: 'test-chat-123' },
    })

    expect(chat).toBeDefined()
    expect(chat?.timeToPickup).toBe(60) // 1 minute in seconds
    expect(chat?.pickupSLA).toBe(true) // Within 120s target
    expect(chat?.firstResponseTime).toBe(120) // 2 minutes
    expect(chat?.firstResponseSLA).toBe(true) // Within 300s target
    expect(chat?.overallSLA).toBe(true) // All targets met
  })

  test('should handle SLA calculation errors gracefully', async () => {
    // Mock SLA calculator to throw error
    jest.spyOn(require('@/lib/sla/sla-calculator-full'), 'calculateAllSLAMetricsWithBusinessHours')
      .mockImplementation(() => {
        throw new Error('SLA calculation failed')
      })

    const rawChat = { /* ... valid chat data ... */ }

    const engine = new TransformEngine()
    await expect(engine.transformChats('extract-123')).resolves.not.toThrow()

    // Chat should still be created, but SLA fields are NULL
    const chat = await prisma.chat.findUnique({
      where: { b2chatId: 'test-chat-123' },
    })

    expect(chat).toBeDefined()
    expect(chat?.timeToPickup).toBeNull()
    expect(chat?.overallSLA).toBeNull()
  })
})
```

2. **Update sla-integration.test.ts with end-to-end test:**
```typescript
test('full sync pipeline populates SLA metrics', async () => {
  // 1. Extract (mock B2Chat API response)
  const extractEngine = new ExtractEngine()
  await extractEngine.extractChats(/* ... */)

  // 2. Transform (should calculate SLA)
  const transformEngine = new TransformEngine()
  await transformEngine.transformChats('extract-123')

  // 3. Verify SLA metrics in database
  const chats = await prisma.chat.findMany({
    where: { /* filter for test chats */ },
  })

  chats.forEach(chat => {
    expect(chat.overallSLA).not.toBeNull() // SLA calculated
    expect(chat.timeToPickup).toBeGreaterThanOrEqual(0)
  })
})
```

**Tests required:** Automated
- Unit tests for SLA calculation in transform
- Integration test for end-to-end sync with SLA
- Error handling tests

**Acceptance criteria:**
- [ ] All tests pass with `npm test`
- [ ] Test coverage includes SLA calculation path
- [ ] Error scenarios tested and handled
- [ ] CI/CD pipeline passes

---

### Chunk 4: Update Documentation
**Type:** Documentation
**Dependencies:** Chunks 1-3 completed
**Estimated Time:** 15 minutes
**Files to update:**
- `.agent-os/specs/2025-10-21-sla-compliance-page/INTEGRATION_GUIDE.md`

**Implementation Steps:**

1. **Mark integration as complete in INTEGRATION_GUIDE.md:**
```markdown
## Integration Status

✅ **COMPLETED** - SLA calculation is now integrated into the sync pipeline

### What Changed
- Transform engine (`src/lib/sync/transform-engine.ts`) now calculates SLA metrics
- All new chats synced from B2Chat automatically get SLA fields populated
- Existing chats backfilled with SLA metrics via `/api/sla/recalculate`
- Dashboard at `/dashboard/sla` now displays real compliance data

### Integration Date
- Completed: 2024-10-23
- Feature: 004-sla-calculation-integration
```

2. **Add troubleshooting section:**
```markdown
## Troubleshooting

### Dashboard shows "No Data"
**Symptom:** SLA dashboard displays empty state

**Diagnosis:**
```sql
-- Check if chats have SLA calculated
SELECT COUNT(*) FROM chats WHERE overall_sla IS NOT NULL;
```

**Solution:**
If count is 0, run backfill:
```bash
curl -X POST "/api/sla/recalculate?limit=10000"
```

### New Chats Missing SLA
**Symptom:** Recently synced chats have NULL SLA fields

**Diagnosis:**
- Check server logs for SLA calculation errors
- Verify SLA config exists in SystemSettings table

**Solution:**
```sql
-- Verify SLA configuration
SELECT * FROM system_settings WHERE category = 'sla';

-- If missing, use defaults (recalculate endpoint handles this)
```

### Performance Impact
**Symptom:** Sync takes longer after integration

**Expected:** < 10% increase in sync duration
**Monitor:** Check `TransformLog.changesSummary` for processing time
```

3. **Add operational notes:**
```markdown
## Operations Guide

### Recalculating SLA for Date Range
```bash
# Last 30 days
curl -X POST "/api/sla/recalculate?startDate=2024-09-23T00:00:00Z&endDate=2024-10-23T23:59:59Z"

# Specific chat
curl -X POST "/api/sla/recalculate?chatId=chat_abc123"
```

### Monitoring SLA Calculations
- SLA calculations logged in database via `slaLogger`
- Check logs: `SELECT * FROM sla_calculation_logs ORDER BY created_at DESC LIMIT 50`
- Monitor dashboard health: `/api/health` includes SLA calculation status
```

**Acceptance criteria:**
- [ ] Integration status updated to "COMPLETED"
- [ ] Troubleshooting guide added
- [ ] Operators know how to backfill if needed
- [ ] Monitoring guidance documented

---

## Testing Strategy

Following **Aspect 4: Testing Strategy and Timing (patterns 22-26):**

### Unit Tests (Chunk 1)
**When:** During implementation of transform engine changes
**What:** Test SLA calculation helper method in isolation
**File:** `src/lib/sync/__tests__/transform-engine.test.ts`
**Coverage:**
- SLA metrics calculated correctly for new chats
- SLA metrics recalculated for updated chats
- Calculation errors logged but don't block sync
- NULL values when calculation fails
- SLA logger called with correct trigger

**Run with:** `npm test -- transform-engine.test.ts`

### Integration Tests (Chunk 3)
**When:** After Chunk 1 deployed, before Chunk 2 backfill
**What:** End-to-end sync pipeline with SLA calculation
**File:** `src/lib/sla/__tests__/sla-integration.test.ts`
**Coverage:**
- Full extract → transform → load pipeline
- SLA metrics present in final database records
- Error handling throughout pipeline
- Business hours calculations correct

**Run with:** `npm test -- sla-integration.test.ts`

### Manual Verification (Chunk 2)
**When:** After backfill completes
**What:** Database queries and dashboard inspection
**Steps:**
1. Query database for SLA coverage: `SELECT COUNT(*) FROM chats WHERE overall_sla IS NOT NULL`
2. Navigate to `/dashboard/sla` and verify all components render
3. Check metrics cards show percentages (not N/A)
4. Verify breaches table populates (if violations exist)
5. Inspect charts for historical trend data
6. Review server logs for SLA calculation errors

### Performance Testing
**When:** After Chunk 1 deployed
**What:** Measure sync duration before/after integration
**Metrics:**
- Baseline sync time (pre-integration)
- New sync time (post-integration)
- Difference should be < 10%

**Monitor:** `TransformLog` table has `changesSummary.processingTimeMs`

## Database Changes

**Schema Changes:** None required (all fields already exist)

**Data Changes:**
- **Before Integration:** All chats have NULL SLA fields
- **After Chunk 1:** New chats have SLA fields populated
- **After Chunk 2:** All chats have SLA fields populated

**Indexes:** Already exist for SLA fields (see schema.prisma lines 222-229)

**Migration:** None needed

## API Changes

**No API changes required.** All endpoints already exist:

- `GET /api/sla/metrics` - Returns aggregated SLA compliance metrics
- `GET /api/sla/breaches` - Returns paginated list of SLA violations
- `POST /api/sla/recalculate` - Triggers backfill for date range or specific chat
- `GET /api/sla/config` - Returns SLA configuration from SystemSettings

**Response Changes:**
- Currently: Empty arrays / 0 counts (no data in database)
- After integration: Real data populated from calculated SLA metrics

## Rollback Plan

### If Integration Causes Issues

**Scenario 1: Sync Performance Unacceptable**
```bash
# 1. Revert transform-engine.ts changes
git revert <commit-hash-chunk-1>

# 2. Redeploy
npm run build
# Deploy to production

# Result: Chats sync without SLA (as before integration)
# Dashboard shows "no data" (as before integration)
```

**Scenario 2: SLA Calculation Errors Block Sync**
This should not happen (error handling prevents blocking), but if it does:
```bash
# Quick fix: Comment out SLA calculation call
# In transform-engine.ts, comment lines that call calculateSLAMetrics()

# Redeploy immediately

# Investigate error logs, fix calculator, redeploy
```

**Scenario 3: Incorrect SLA Values**
```sql
-- Reset all SLA fields to NULL
UPDATE chats SET
  time_to_pickup = NULL,
  first_response_time = NULL,
  avg_response_time = NULL,
  resolution_time = NULL,
  pickup_sla = NULL,
  first_response_sla = NULL,
  avg_response_sla = NULL,
  resolution_sla = NULL,
  overall_sla = NULL,
  time_to_pickup_bh = NULL,
  first_response_time_bh = NULL,
  avg_response_time_bh = NULL,
  resolution_time_bh = NULL,
  pickup_sla_bh = NULL,
  first_response_sla_bh = NULL,
  avg_response_sla_bh = NULL,
  resolution_sla_bh = NULL,
  overall_sla_bh = NULL;

-- Fix SLA calculator bug

-- Re-run recalculate endpoint
curl -X POST "/api/sla/recalculate?limit=10000"
```

### Data Backup Before Backfill

```sql
-- Backup current SLA values (if any exist)
CREATE TABLE chats_sla_backup AS
SELECT
  id,
  time_to_pickup,
  first_response_time,
  overall_sla
FROM chats;

-- Restore if needed
UPDATE chats c
SET
  time_to_pickup = b.time_to_pickup,
  first_response_time = b.first_response_time,
  overall_sla = b.overall_sla
FROM chats_sla_backup b
WHERE c.id = b.id;
```

### Feature Flag Considerations

No feature flags needed for this integration because:
- SLA calculation is additive (doesn't break existing functionality)
- Failed calculations leave fields as NULL (same as before)
- Dashboard already handles NULL SLA gracefully (shows "no data")

If future rollback needs are anticipated, consider:
```typescript
// In transform-engine.ts
const ENABLE_SLA_CALCULATION = process.env.ENABLE_SLA_CALCULATION !== 'false'

if (ENABLE_SLA_CALCULATION) {
  const slaMetrics = await this.calculateSLAMetrics(/* ... */)
  // ... use metrics
}
```

## Documentation Updates

Files to update:
1. ✅ `.agent-os/specs/2025-10-21-sla-compliance-page/INTEGRATION_GUIDE.md` (Chunk 4)
2. This feature document serves as permanent reference

Additional documentation (optional):
- Update README.md with SLA dashboard section
- Add operator runbook for SLA backfill procedures
- Document SLA calculation logic for future maintainers

## Success Criteria

### Immediate Success Indicators
1. ✅ New chats synced have `overall_sla` NOT NULL
2. ✅ SLA dashboard at `/dashboard/sla` displays data (not empty state)
3. ✅ Metrics cards show compliance percentages
4. ✅ Breaches table displays SLA violations
5. ✅ Trend charts render with data points

### Technical Validation
```sql
-- All chats have SLA calculated
SELECT
  COUNT(*) as total_chats,
  COUNT(overall_sla) as chats_with_sla,
  ROUND(COUNT(overall_sla)::numeric / COUNT(*) * 100, 2) as sla_coverage_pct
FROM chats;
-- Expected: sla_coverage_pct = 100.00

-- Sample SLA values are reasonable
SELECT
  AVG(time_to_pickup) as avg_pickup_sec,
  AVG(first_response_time) as avg_response_sec,
  COUNT(*) FILTER (WHERE overall_sla = true) as compliant_chats,
  COUNT(*) FILTER (WHERE overall_sla = false) as breached_chats
FROM chats
WHERE overall_sla IS NOT NULL;
-- Expected: Averages in reasonable ranges (60-300 sec typical)
```

### Performance Validation
- [ ] Sync duration increase < 10% (measure via `TransformLog.processingTimeMs`)
- [ ] No timeout errors during backfill (max 10,000 chats per call)
- [ ] Dashboard loads in < 2 seconds (check Network tab in browser)

### User Acceptance
- [ ] Dashboard displays expected compliance rates
- [ ] Breach notifications align with business expectations
- [ ] SLA targets match configured values in SystemSettings

## Implementation Timeline

**Total Estimated Time:** 2-3 hours

**Day 1 (2 hours):**
- Chunk 1: Integrate SLA calculation into transform engine (1-2 hours)
- Deploy to production
- Monitor first syncs for SLA population

**Day 1-2 (30 minutes):**
- Chunk 2: Run backfill for existing chats (30 min including wait time)
- Verify dashboard displays data

**Day 2 (1 hour):**
- Chunk 3: Add integration tests (1 hour)
- Run test suite, verify coverage

**Day 2 (15 minutes):**
- Chunk 4: Update documentation (15 min)
- Mark integration complete

**Total:** 3-3.5 hours end-to-end

## Notes

### Why This Was Needed
The SLA Compliance feature was implemented in a prior sprint but the integration step was missed. The dashboard, API endpoints, calculator logic, and database schema all exist and work correctly. Only the "glue code" connecting the calculator to the sync pipeline was missing.

### Design Decisions Explained

**Why calculate during transform (not as post-processing)?**
- Ensures SLA is always in sync with chat state
- Avoids separate batch job that could fall behind
- Simpler architecture (one-pass processing)

**Why error handling doesn't block sync?**
- Chat data is more critical than SLA metrics
- SLA can be recalculated later via `/api/sla/recalculate`
- Prevents cascade failures from SLA calculator bugs

**Why both wall clock and business hours?**
- Business requirement: Compare 24/7 vs office hours performance
- Already supported by calculator and schema
- Minimal additional cost (calculated together)

**Why use existing recalculate endpoint for backfill?**
- Already has batching logic (100 chats per batch)
- Already has error handling and logging
- Already tested and documented
- No need to duplicate logic

### Future Enhancements (Not in Scope)
- SLA alerting (email/Slack when thresholds breached)
- Predictive SLA forecasting (ML model)
- Agent-specific SLA targets (override defaults)
- Channel-specific SLA targets (WhatsApp vs Email)
- Real-time SLA monitoring (WebSocket updates)

These can be separate features built on top of this foundation.
