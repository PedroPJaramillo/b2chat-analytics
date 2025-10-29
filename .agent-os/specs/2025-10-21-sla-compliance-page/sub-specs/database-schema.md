# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-10-21-sla-compliance-page/spec.md

## Overview

The SLA Compliance Page requires pre-computed SLA metrics to be stored in the database for optimal performance. Rather than calculating SLA compliance on-the-fly for every page load, we calculate and store these metrics when chat data is imported from B2Chat.

## Schema Changes

### New Columns for `Chat` Model

Add the following columns to the existing `Chat` table to store pre-computed SLA metrics:

```prisma
model Chat {
  // ... existing fields ...

  // SLA Metric Values (in seconds)
  timeToPickup         Int?     // Time from opened_at to picked_up_at (seconds)
  firstResponseTime    Int?     // Time from opened_at to first human agent message (seconds)
  avgResponseTime      Float?   // Average agent response time throughout conversation (seconds)
  resolutionTime       Int?     // Time from opened_at to closed_at (seconds)

  // SLA Compliance Flags (boolean)
  pickupSLA            Boolean? // True if timeToPickup <= 120 seconds
  firstResponseSLA     Boolean? // True if firstResponseTime <= 300 seconds
  avgResponseSLA       Boolean? // True if avgResponseTime <= 300 seconds
  resolutionSLA        Boolean? // True if resolutionTime <= 7200 seconds
  overallSLA           Boolean? // True if ALL applicable SLAs are met

  // Business Hours Metric Values (in seconds)
  // These are the same metrics but calculated using only business hours
  timeToPickupBH       Int?     // Pickup time in business hours only
  firstResponseTimeBH  Int?     // First response time in business hours only
  avgResponseTimeBH    Float?   // Avg response time in business hours only
  resolutionTimeBH     Int?     // Resolution time in business hours only

  // Business Hours Compliance Flags
  pickupSLABH          Boolean? // Pickup SLA compliance (business hours)
  firstResponseSLABH   Boolean? // First response SLA compliance (business hours)
  avgResponseSLABH     Boolean? // Avg response SLA compliance (business hours)
  resolutionSLABH      Boolean? // Resolution SLA compliance (business hours)
  overallSLABH         Boolean? // Overall SLA compliance (business hours)

  // ... existing fields continue ...
}
```

### Migration SQL

```sql
-- Add SLA metric value columns
ALTER TABLE "Chat"
ADD COLUMN "timeToPickup" INTEGER,
ADD COLUMN "firstResponseTime" INTEGER,
ADD COLUMN "avgResponseTime" DOUBLE PRECISION,
ADD COLUMN "resolutionTime" INTEGER;

-- Add SLA compliance flag columns
ALTER TABLE "Chat"
ADD COLUMN "pickupSLA" BOOLEAN,
ADD COLUMN "firstResponseSLA" BOOLEAN,
ADD COLUMN "avgResponseSLA" BOOLEAN,
ADD COLUMN "resolutionSLA" BOOLEAN,
ADD COLUMN "overallSLA" BOOLEAN;

-- Add business hours metric value columns
ALTER TABLE "Chat"
ADD COLUMN "timeToPickupBH" INTEGER,
ADD COLUMN "firstResponseTimeBH" INTEGER,
ADD COLUMN "avgResponseTimeBH" DOUBLE PRECISION,
ADD COLUMN "resolutionTimeBH" INTEGER;

-- Add business hours compliance flag columns
ALTER TABLE "Chat"
ADD COLUMN "pickupSLABH" BOOLEAN,
ADD COLUMN "firstResponseSLABH" BOOLEAN,
ADD COLUMN "avgResponseSLABH" BOOLEAN,
ADD COLUMN "resolutionSLABH" BOOLEAN,
ADD COLUMN "overallSLABH" BOOLEAN;
```

### Database Indexes

Create indexes on frequently queried SLA fields for optimal performance:

```sql
-- Index on overall SLA compliance for quick filtering
CREATE INDEX "idx_chat_overallSLA" ON "Chat"("overallSLA");
CREATE INDEX "idx_chat_overallSLABH" ON "Chat"("overallSLABH");

-- Index on individual SLA metrics for filtering
CREATE INDEX "idx_chat_pickupSLA" ON "Chat"("pickupSLA");
CREATE INDEX "idx_chat_firstResponseSLA" ON "Chat"("firstResponseSLA");
CREATE INDEX "idx_chat_avgResponseSLA" ON "Chat"("avgResponseSLA");
CREATE INDEX "idx_chat_resolutionSLA" ON "Chat"("resolutionSLA");

-- Composite index for common queries (opened_at + SLA status)
CREATE INDEX "idx_chat_opened_overallSLA" ON "Chat"("opened_at", "overallSLA");

-- Index for agent-based SLA filtering
CREATE INDEX "idx_chat_agent_overallSLA" ON "Chat"("agent_id", "overallSLA");
```

## Data Population Strategy

### For Existing Data (Backfill)

Create a migration script to calculate and populate SLA metrics for existing chats:

```typescript
// prisma/migrations/[timestamp]_calculate_sla_metrics.ts

import { PrismaClient } from '@prisma/client';
import { calculateSLAMetrics } from '@/lib/sla-calculator';

const prisma = new PrismaClient();

async function backfillSLAMetrics() {
  console.log('Starting SLA metrics backfill...');

  // Process in batches to avoid memory issues
  const batchSize = 100;
  let skip = 0;
  let processedCount = 0;

  while (true) {
    const chats = await prisma.chat.findMany({
      skip,
      take: batchSize,
      include: {
        messages: {
          orderBy: { created_at: 'asc' }
        }
      },
      where: {
        // Only process chats that don't have SLA metrics yet
        timeToPickup: null
      }
    });

    if (chats.length === 0) break;

    for (const chat of chats) {
      const metrics = calculateSLAMetrics(chat);

      await prisma.chat.update({
        where: { id: chat.id },
        data: metrics
      });

      processedCount++;
    }

    skip += batchSize;
    console.log(`Processed ${processedCount} chats...`);
  }

  console.log(`Backfill complete. Processed ${processedCount} total chats.`);
}

backfillSLAMetrics()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
```

### For New Data (On Import)

Update the chat import service to calculate SLA metrics automatically:

```typescript
// services/chat-import.service.ts

import { calculateSLAMetrics } from '@/lib/sla-calculator';

async function importChat(b2chatData: B2ChatData) {
  // ... existing import logic ...

  // Calculate SLA metrics before saving
  const slaMetrics = calculateSLAMetrics({
    opened_at: b2chatData.opened_at,
    picked_up_at: b2chatData.picked_up_at,
    closed_at: b2chatData.closed_at,
    messages: b2chatData.messages
  });

  // Create chat with SLA metrics
  const chat = await prisma.chat.create({
    data: {
      // ... existing chat fields ...
      ...slaMetrics, // Spread SLA metrics
    }
  });

  return chat;
}
```

## SLA Calculation Logic

### Core Calculation Function

```typescript
// lib/sla-calculator.ts

interface SLAMetrics {
  // Wall clock time metrics
  timeToPickup: number | null;
  firstResponseTime: number | null;
  avgResponseTime: number | null;
  resolutionTime: number | null;
  pickupSLA: boolean | null;
  firstResponseSLA: boolean | null;
  avgResponseSLA: boolean | null;
  resolutionSLA: boolean | null;
  overallSLA: boolean | null;

  // Business hours metrics
  timeToPickupBH: number | null;
  firstResponseTimeBH: number | null;
  avgResponseTimeBH: number | null;
  resolutionTimeBH: number | null;
  pickupSLABH: boolean | null;
  firstResponseSLABH: boolean | null;
  avgResponseSLABH: boolean | null;
  resolutionSLABH: boolean | null;
  overallSLABH: boolean | null;
}

const SLA_TARGETS = {
  PICKUP: 120,        // 2 minutes in seconds
  FIRST_RESPONSE: 300, // 5 minutes in seconds
  AVG_RESPONSE: 300,   // 5 minutes in seconds
  RESOLUTION: 7200     // 2 hours in seconds
};

export function calculateSLAMetrics(chat: {
  opened_at: Date;
  picked_up_at: Date | null;
  closed_at: Date | null;
  messages: Array<{
    created_at: Date;
    incoming: boolean;
    broadcasted: boolean;
  }>;
}): SLAMetrics {

  // 1. Calculate Pickup Time
  const timeToPickup = chat.picked_up_at
    ? Math.floor((chat.picked_up_at.getTime() - chat.opened_at.getTime()) / 1000)
    : null;
  const pickupSLA = timeToPickup !== null ? timeToPickup <= SLA_TARGETS.PICKUP : false;

  // 2. Calculate First Response Time
  const firstHumanMessage = chat.messages.find(
    msg => !msg.incoming && !msg.broadcasted && chat.picked_up_at !== null
  );
  const firstResponseTime = firstHumanMessage
    ? Math.floor((firstHumanMessage.created_at.getTime() - chat.opened_at.getTime()) / 1000)
    : null;
  const firstResponseSLA = firstResponseTime !== null
    ? firstResponseTime <= SLA_TARGETS.FIRST_RESPONSE
    : false;

  // 3. Calculate Average Response Time
  const avgResponseTime = calculateAverageResponseTime(chat.messages, chat.picked_up_at);
  const avgResponseSLA = avgResponseTime !== null
    ? avgResponseTime <= SLA_TARGETS.AVG_RESPONSE
    : false;

  // 4. Calculate Resolution Time
  const resolutionTime = chat.closed_at
    ? Math.floor((chat.closed_at.getTime() - chat.opened_at.getTime()) / 1000)
    : null;
  const resolutionSLA = resolutionTime !== null
    ? resolutionTime <= SLA_TARGETS.RESOLUTION
    : null; // null if chat not closed (not counted as fail)

  // 5. Calculate Overall SLA
  const overallSLA = pickupSLA && firstResponseSLA && avgResponseSLA &&
    (resolutionSLA === null || resolutionSLA === true);

  // 6. Calculate Business Hours versions
  const timeToPickupBH = calculateBusinessHoursTime(chat.opened_at, chat.picked_up_at);
  const pickupSLABH = timeToPickupBH !== null ? timeToPickupBH <= SLA_TARGETS.PICKUP : false;

  const firstResponseTimeBH = firstHumanMessage
    ? calculateBusinessHoursTime(chat.opened_at, firstHumanMessage.created_at)
    : null;
  const firstResponseSLABH = firstResponseTimeBH !== null
    ? firstResponseTimeBH <= SLA_TARGETS.FIRST_RESPONSE
    : false;

  const avgResponseTimeBH = calculateAverageResponseTimeBusinessHours(chat.messages, chat.picked_up_at);
  const avgResponseSLABH = avgResponseTimeBH !== null
    ? avgResponseTimeBH <= SLA_TARGETS.AVG_RESPONSE
    : false;

  const resolutionTimeBH = chat.closed_at
    ? calculateBusinessHoursTime(chat.opened_at, chat.closed_at)
    : null;
  const resolutionSLABH = resolutionTimeBH !== null
    ? resolutionTimeBH <= SLA_TARGETS.RESOLUTION
    : null;

  const overallSLABH = pickupSLABH && firstResponseSLABH && avgResponseSLABH &&
    (resolutionSLABH === null || resolutionSLABH === true);

  return {
    timeToPickup,
    firstResponseTime,
    avgResponseTime,
    resolutionTime,
    pickupSLA,
    firstResponseSLA,
    avgResponseSLA,
    resolutionSLA,
    overallSLA,
    timeToPickupBH,
    firstResponseTimeBH,
    avgResponseTimeBH,
    resolutionTimeBH,
    pickupSLABH,
    firstResponseSLABH,
    avgResponseSLABH,
    resolutionSLABH,
    overallSLABH
  };
}

function calculateAverageResponseTime(
  messages: Array<{ created_at: Date; incoming: boolean; broadcasted: boolean }>,
  picked_up_at: Date | null
): number | null {
  if (!picked_up_at) return null;

  const responseTimes: number[] = [];
  let lastCustomerMessageTime: Date | null = null;

  for (const msg of messages) {
    if (msg.incoming) {
      // Customer message
      lastCustomerMessageTime = msg.created_at;
    } else if (!msg.broadcasted && lastCustomerMessageTime) {
      // Agent response to customer message
      const responseTime = Math.floor(
        (msg.created_at.getTime() - lastCustomerMessageTime.getTime()) / 1000
      );

      // Exclude response times > 1 hour (3600 seconds) - customer likely went away
      if (responseTime <= 3600) {
        responseTimes.push(responseTime);
      }

      lastCustomerMessageTime = null; // Reset for next pair
    }
  }

  if (responseTimes.length === 0) return null;

  const sum = responseTimes.reduce((acc, time) => acc + time, 0);
  return sum / responseTimes.length;
}

function calculateBusinessHoursTime(start: Date, end: Date | null): number | null {
  if (!end) return null;

  // TODO: Implement business hours calculation
  // This should:
  // 1. Get office hours config from settings (e.g., Mon-Fri 9am-5pm)
  // 2. Iterate through each day between start and end
  // 3. Only count minutes that fall within office hours
  // 4. Return total in seconds

  // Placeholder for now - returns wall clock time
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}

function calculateAverageResponseTimeBusinessHours(
  messages: Array<{ created_at: Date; incoming: boolean; broadcasted: boolean }>,
  picked_up_at: Date | null
): number | null {
  // Similar to calculateAverageResponseTime but uses business hours calculation
  // TODO: Implement
  return calculateAverageResponseTime(messages, picked_up_at);
}
```

## Configuration Table (Optional Enhancement)

Consider adding a configuration table for SLA targets to make them customizable in the future:

```prisma
model SLAConfig {
  id                    String   @id @default(cuid())
  organization_id       String   // If multi-tenant

  // SLA Targets (in seconds)
  pickupTarget          Int      @default(120)     // 2 minutes
  firstResponseTarget   Int      @default(300)     // 5 minutes
  avgResponseTarget     Int      @default(300)     // 5 minutes
  resolutionTarget      Int      @default(7200)    // 2 hours

  // Overall compliance target (percentage)
  complianceTarget      Int      @default(95)      // 95%

  // Office hours configuration
  officeHoursStart      String   @default("09:00") // 9:00 AM
  officeHoursEnd        String   @default("17:00") // 5:00 PM
  workingDays           Json     @default("[1,2,3,4,5]") // Mon-Fri
  timezone              String   @default("America/New_York")

  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
}
```

**Note:** This configuration table is NOT required for V1 of the SLA Compliance Page. It's included here as a future enhancement to make SLA targets configurable.

## Data Integrity Constraints

### Validation Rules

1. **Pickup Time:** Can only be calculated if `picked_up_at` is not null
2. **First Response Time:** Can only be calculated if at least one human agent message exists
3. **Average Response Time:** Can only be calculated if at least one customer-agent message pair exists
4. **Resolution Time:** Can only be calculated if `closed_at` is not null
5. **Overall SLA:** Is `false` if any individual SLA is `false`, `true` only if all are `true` or N/A

### Null Handling

All SLA metric fields are nullable because:
- Not all chats will have all metrics (e.g., open chats have no resolution time)
- Some chats may be missing data (e.g., never picked up)
- Business hours calculations may not be possible for older data

## Performance Considerations

### Why Pre-compute?

Pre-computing SLA metrics provides significant performance benefits:

1. **Fast Page Loads:** No calculation needed on page load, just database queries
2. **Efficient Filtering:** Can use database indexes to filter by SLA status
3. **Quick Aggregations:** Counting compliant/non-compliant chats is a simple COUNT query
4. **Scalability:** Works efficiently with 10,000+ chats

### Database Query Examples

```sql
-- Get all chats that failed overall SLA
SELECT * FROM "Chat"
WHERE "overallSLA" = false
ORDER BY "opened_at" DESC;

-- Count chats by SLA status
SELECT
  COUNT(*) FILTER (WHERE "overallSLA" = true) as compliant,
  COUNT(*) FILTER (WHERE "overallSLA" = false) as non_compliant,
  COUNT(*) as total
FROM "Chat"
WHERE "opened_at" >= '2025-10-01' AND "opened_at" < '2025-11-01';

-- Agent performance comparison
SELECT
  agent_id,
  COUNT(*) as total_chats,
  COUNT(*) FILTER (WHERE "overallSLA" = true) as compliant_chats,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "overallSLA" = true) / COUNT(*), 2) as compliance_percentage
FROM "Chat"
WHERE agent_id IS NOT NULL
GROUP BY agent_id
ORDER BY compliance_percentage DESC;
```

## Rollback Plan

If migration fails or issues arise:

```sql
-- Remove all SLA columns
ALTER TABLE "Chat"
DROP COLUMN IF EXISTS "timeToPickup",
DROP COLUMN IF EXISTS "firstResponseTime",
DROP COLUMN IF EXISTS "avgResponseTime",
DROP COLUMN IF EXISTS "resolutionTime",
DROP COLUMN IF EXISTS "pickupSLA",
DROP COLUMN IF EXISTS "firstResponseSLA",
DROP COLUMN IF EXISTS "avgResponseSLA",
DROP COLUMN IF EXISTS "resolutionSLA",
DROP COLUMN IF EXISTS "overallSLA",
DROP COLUMN IF EXISTS "timeToPickupBH",
DROP COLUMN IF EXISTS "firstResponseTimeBH",
DROP COLUMN IF EXISTS "avgResponseTimeBH",
DROP COLUMN IF EXISTS "resolutionTimeBH",
DROP COLUMN IF EXISTS "pickupSLABH",
DROP COLUMN IF EXISTS "firstResponseSLABH",
DROP COLUMN IF EXISTS "avgResponseSLABH",
DROP COLUMN IF EXISTS "resolutionSLABH",
DROP COLUMN IF EXISTS "overallSLABH";

-- Remove indexes
DROP INDEX IF EXISTS "idx_chat_overallSLA";
DROP INDEX IF EXISTS "idx_chat_overallSLABH";
DROP INDEX IF EXISTS "idx_chat_pickupSLA";
DROP INDEX IF EXISTS "idx_chat_firstResponseSLA";
DROP INDEX IF EXISTS "idx_chat_avgResponseSLA";
DROP INDEX IF EXISTS "idx_chat_resolutionSLA";
DROP INDEX IF EXISTS "idx_chat_opened_overallSLA";
DROP INDEX IF EXISTS "idx_chat_agent_overallSLA";
```

## Testing Requirements

1. **Migration Testing:**
   - Test on copy of production database
   - Verify all existing chats get SLA metrics populated
   - Confirm no data loss or corruption

2. **Calculation Testing:**
   - Unit tests for all SLA calculation functions
   - Test edge cases (null values, bot-only chats, multi-day chats)
   - Verify business hours calculations are accurate

3. **Performance Testing:**
   - Measure query performance with indexes
   - Test with 10,000+ chat dataset
   - Verify page load times meet targets (<2 seconds)

4. **Data Integrity Testing:**
   - Verify SLA flags match calculated values
   - Test backfill script on subset of data
   - Confirm new imports calculate metrics correctly
