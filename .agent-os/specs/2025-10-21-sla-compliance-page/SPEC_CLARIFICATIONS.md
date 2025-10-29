# Spec Clarifications

> Date: 2025-10-21
> These clarifications update the SLA Compliance Page spec based on stakeholder feedback

## 1. Configuration Management

### SLA Targets Configuration

**Decision:** SLA targets are configurable through the Settings/Config screens UI.

**Implementation:**
- Use existing `SystemSetting` model (no new tables needed)
- Store configuration with category `'sla'`
- Required settings:
  - `sla.pickup_target` (default: 120 seconds / 2 minutes)
  - `sla.first_response_target` (default: 300 seconds / 5 minutes)
  - `sla.avg_response_target` (default: 300 seconds / 5 minutes)
  - `sla.resolution_target` (default: 7200 seconds / 2 hours)
  - `sla.compliance_target` (default: 95%)

**Config Screen UI:**
- Route: `/settings/sla-targets`
- Input fields for each SLA target with unit labels (min/hrs)
- Compliance target percentage slider (0-100%)
- Save button to update SystemSettings
- Validation: All positive integers

### Office Hours Configuration

**Decision:** Office hours are configurable through the Settings/Config screens UI.

**Implementation:**
- Use existing `SystemSetting` model
- Store configuration with category `'office_hours'`
- Required settings:
  - `office_hours.start` (default: "09:00")
  - `office_hours.end` (default: "17:00")
  - `office_hours.working_days` (default: [1,2,3,4,5] = Mon-Fri)
  - `office_hours.timezone` (default: "America/New_York")

**Config Screen UI:**
- Route: `/settings/office-hours`
- Start/end time pickers (HH:mm format)
- Day of week checkboxes
- Timezone dropdown
- Save button to update SystemSettings
- Validation: Start < End

### Required SQL Migration

```sql
-- SLA Target configurations (in seconds)
INSERT INTO "system_settings" (id, key, value, category, description, is_system_setting, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'sla.pickup_target', '120', 'sla', 'SLA target for pickup time in seconds (default: 2 minutes)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.first_response_target', '300', 'sla', 'SLA target for first response time in seconds (default: 5 minutes)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.avg_response_target', '300', 'sla', 'SLA target for average response time in seconds (default: 5 minutes)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.resolution_target', '7200', 'sla', 'SLA target for resolution time in seconds (default: 2 hours)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.compliance_target', '95', 'sla', 'Overall SLA compliance target percentage (default: 95%)', true, NOW(), NOW());

-- Office hours configuration
INSERT INTO "system_settings" (id, key, value, category, description, is_system_setting, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'office_hours.start', '09:00', 'office_hours', 'Office hours start time (HH:mm format, 24-hour)', true, NOW(), NOW()),
  (gen_random_uuid(), 'office_hours.end', '17:00', 'office_hours', 'Office hours end time (HH:mm format, 24-hour)', true, NOW(), NOW()),
  (gen_random_uuid(), 'office_hours.working_days', '[1,2,3,4,5]', 'office_hours', 'Working days (1=Monday, 7=Sunday)', true, NOW(), NOW()),
  (gen_random_uuid(), 'office_hours.timezone', 'America/New_York', 'office_hours', 'Timezone for office hours', true, NOW(), NOW());
```

### Configuration Helper Functions

```typescript
// lib/config/sla-config.ts
import { prisma } from '@/lib/prisma';

export interface SLAConfig {
  pickupTarget: number;        // seconds
  firstResponseTarget: number; // seconds
  avgResponseTarget: number;   // seconds
  resolutionTarget: number;    // seconds
  complianceTarget: number;    // percentage (0-100)
}

export interface OfficeHoursConfig {
  start: string;              // "09:00" (HH:mm format)
  end: string;                // "17:00" (HH:mm format)
  workingDays: number[];      // [1,2,3,4,5] (1=Mon, 7=Sun)
  timezone: string;           // "America/New_York"
}

export async function getSLAConfig(): Promise<SLAConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: { category: 'sla' }
  });

  const config = settings.reduce((acc, setting) => {
    const key = setting.key.replace('sla.', '').replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[key] = parseInt(setting.value);
    return acc;
  }, {} as Record<string, number>);

  return {
    pickupTarget: config.pickupTarget || 120,
    firstResponseTarget: config.firstResponseTarget || 300,
    avgResponseTarget: config.avgResponseTarget || 300,
    resolutionTarget: config.resolutionTarget || 7200,
    complianceTarget: config.complianceTarget || 95
  };
}

export async function getOfficeHoursConfig(): Promise<OfficeHoursConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: { category: 'office_hours' }
  });

  const configMap = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, string>);

  return {
    start: configMap['office_hours.start'] || '09:00',
    end: configMap['office_hours.end'] || '17:00',
    workingDays: JSON.parse(configMap['office_hours.working_days'] || '[1,2,3,4,5]'),
    timezone: configMap['office_hours.timezone'] || 'America/New_York'
  };
}
```

---

## 2. Multi-Tenancy

**Decision:** No multi-tenancy is required for this application.

**Implications:**
- All SLA configurations are global (single set of targets for entire system)
- All office hours configurations are global
- No need for organization_id or tenant_id fields
- Simplified data model and queries

---

## 3. Logging Strategy

**Decision:** Add comprehensive logging for SLA calculations and operations.

### Logging Categories

#### 1. SLA Calculation Logging

Log all SLA metric calculations when chats are imported or updated:

```typescript
// lib/logging/sla-logger.ts
import { logger } from '@/lib/logger'; // Pino logger

export function logSLACalculation(chatId: string, metrics: SLAMetrics, context: {
  hasPickup: boolean;
  hasHumanResponse: boolean;
  messageCount: number;
  isClosed: boolean;
}) {
  logger.info({
    event: 'sla_calculation',
    chatId,
    metrics: {
      timeToPickup: metrics.timeToPickup,
      firstResponseTime: metrics.firstResponseTime,
      avgResponseTime: metrics.avgResponseTime,
      resolutionTime: metrics.resolutionTime,
      overallSLA: metrics.overallSLA
    },
    context,
    timestamp: new Date().toISOString()
  }, 'SLA metrics calculated for chat');
}

export function logSLACalculationError(chatId: string, error: Error, context: any) {
  logger.error({
    event: 'sla_calculation_error',
    chatId,
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  }, 'Failed to calculate SLA metrics');
}
```

#### 2. SLA Breach Logging

Log when chats breach SLA targets:

```typescript
export function logSLABreach(chatId: string, breachedMetrics: string[], metrics: SLAMetrics) {
  logger.warn({
    event: 'sla_breach',
    chatId,
    breachedMetrics,
    metrics: {
      timeToPickup: metrics.timeToPickup,
      firstResponseTime: metrics.firstResponseTime,
      avgResponseTime: metrics.avgResponseTime,
      resolutionTime: metrics.resolutionTime
    },
    timestamp: new Date().toISOString()
  }, `SLA breach detected: ${breachedMetrics.join(', ')}`);
}
```

#### 3. Config Change Logging

Log when SLA or office hours configurations are updated:

```typescript
export function logConfigChange(userId: string, category: 'sla' | 'office_hours', changes: Record<string, any>) {
  logger.info({
    event: 'config_changed',
    category,
    userId,
    changes,
    timestamp: new Date().toISOString()
  }, `Configuration updated: ${category}`);
}
```

#### 4. Business Hours Calculation Logging

Log business hours calculations for debugging:

```typescript
export function logBusinessHoursCalculation(
  chatId: string,
  startTime: Date,
  endTime: Date,
  wallClockSeconds: number,
  businessHoursSeconds: number,
  config: OfficeHoursConfig
) {
  logger.debug({
    event: 'business_hours_calculation',
    chatId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    wallClockSeconds,
    businessHoursSeconds,
    difference: wallClockSeconds - businessHoursSeconds,
    config,
    timestamp: new Date().toISOString()
  }, 'Business hours calculation completed');
}
```

#### 5. API Request Logging

Log API requests to SLA endpoints:

```typescript
// Middleware for API routes
export function logAPIRequest(req: Request, userId: string, duration: number, status: number) {
  logger.info({
    event: 'api_request',
    method: req.method,
    path: req.url,
    userId,
    duration,
    status,
    timestamp: new Date().toISOString()
  }, `API request: ${req.method} ${req.url}`);
}
```

### Log Levels

- **DEBUG:** Business hours calculations, detailed metric breakdowns
- **INFO:** Successful SLA calculations, config changes, API requests
- **WARN:** SLA breaches, validation warnings
- **ERROR:** Calculation failures, API errors, database errors

### Log Storage

- Use existing Pino logger (already in tech stack)
- Store logs in structured JSON format
- Integrate with Sentry for error tracking (already in tech stack)
- Consider log aggregation service (e.g., Datadog, LogRocket) for production

### Log Retention

- Application logs: 30 days
- Error logs: 90 days
- Audit logs: 1 year (for config changes)

---

## 4. SLA Pre-Calculation Timing

**Decision:** SLA metrics are calculated at two points:

### When SLAs Are Calculated

#### 1. On Chat Import (Primary)

When new chats are imported from B2Chat API:

```typescript
// services/chat-import.service.ts
async function importChat(b2chatData: B2ChatData) {
  // ... existing import logic ...

  // Get current SLA configuration
  const slaConfig = await getSLAConfig();
  const officeHoursConfig = await getOfficeHoursConfig();

  // Calculate SLA metrics
  const slaMetrics = calculateSLAMetrics({
    opened_at: b2chatData.opened_at,
    picked_up_at: b2chatData.picked_up_at,
    closed_at: b2chatData.closed_at,
    messages: b2chatData.messages
  }, slaConfig, officeHoursConfig);

  // Log calculation
  logSLACalculation(b2chatData.id, slaMetrics, {
    hasPickup: b2chatData.picked_up_at !== null,
    hasHumanResponse: slaMetrics.firstResponseTime !== null,
    messageCount: b2chatData.messages.length,
    isClosed: b2chatData.closed_at !== null
  });

  // Log breaches if any
  if (!slaMetrics.overallSLA) {
    const breached = [];
    if (!slaMetrics.pickupSLA) breached.push('Pickup');
    if (!slaMetrics.firstResponseSLA) breached.push('First Response');
    if (!slaMetrics.avgResponseSLA) breached.push('Avg Response');
    if (!slaMetrics.resolutionSLA) breached.push('Resolution');
    logSLABreach(b2chatData.id, breached, slaMetrics);
  }

  // Create chat with SLA metrics
  const chat = await prisma.chat.create({
    data: {
      // ... existing chat fields ...
      ...slaMetrics, // Spread all SLA metrics
    }
  });

  return chat;
}
```

**Timing:** Runs during the Transform phase of the two-stage sync process

#### 2. On Chat Update (Secondary)

When existing chats are updated (status changes, new messages):

```typescript
// services/chat-update.service.ts
async function updateChat(chatId: string, updates: ChatUpdates) {
  // If status changed to CLOSED or new messages added, recalculate SLAs
  const shouldRecalculateSLA =
    updates.status === 'CLOSED' ||
    updates.newMessages?.length > 0 ||
    updates.pickedUpAt !== undefined;

  if (shouldRecalculateSLA) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: true }
    });

    const slaConfig = await getSLAConfig();
    const officeHoursConfig = await getOfficeHoursConfig();

    const slaMetrics = calculateSLAMetrics(chat, slaConfig, officeHoursConfig);

    logSLACalculation(chatId, slaMetrics, {
      hasPickup: chat.picked_up_at !== null,
      hasHumanResponse: slaMetrics.firstResponseTime !== null,
      messageCount: chat.messages.length,
      isClosed: chat.closed_at !== null
    });

    await prisma.chat.update({
      where: { id: chatId },
      data: {
        ...updates,
        ...slaMetrics
      }
    });
  }
}
```

**Timing:** Runs when chat data changes (real-time or on next sync)

#### 3. On Config Change (Batch Recalculation)

When SLA targets or office hours are changed in config:

```typescript
// services/sla-recalculation.service.ts
async function recalculateAllSLAs(userId: string, reason: 'sla_config_change' | 'office_hours_change') {
  logger.info({
    event: 'sla_bulk_recalculation_started',
    userId,
    reason,
    timestamp: new Date().toISOString()
  }, 'Starting bulk SLA recalculation');

  const slaConfig = await getSLAConfig();
  const officeHoursConfig = await getOfficeHoursConfig();

  // Process in batches to avoid memory issues
  const batchSize = 100;
  let processed = 0;
  let failures = 0;

  while (true) {
    const chats = await prisma.chat.findMany({
      skip: processed,
      take: batchSize,
      include: { messages: true }
    });

    if (chats.length === 0) break;

    for (const chat of chats) {
      try {
        const slaMetrics = calculateSLAMetrics(chat, slaConfig, officeHoursConfig);

        await prisma.chat.update({
          where: { id: chat.id },
          data: slaMetrics
        });

        processed++;
      } catch (error) {
        failures++;
        logSLACalculationError(chat.id, error as Error, { reason });
      }
    }

    logger.info({
      event: 'sla_bulk_recalculation_progress',
      processed,
      failures,
      timestamp: new Date().toISOString()
    }, `Recalculated ${processed} chats`);
  }

  logger.info({
    event: 'sla_bulk_recalculation_completed',
    totalProcessed: processed,
    totalFailures: failures,
    timestamp: new Date().toISOString()
  }, 'Bulk SLA recalculation completed');

  return { processed, failures };
}
```

**Timing:** Triggered manually by admin when config changes, or run as background job

**UI Flow:**
1. Admin changes SLA target in config screen
2. System shows warning: "This will recalculate SLA metrics for all chats. Continue?"
3. If confirmed, trigger background job
4. Show progress notification
5. Send completion notification when done

### Summary

| Trigger | When | Performance | Notes |
|---------|------|-------------|-------|
| **On Import** | New chats synced from B2Chat | Real-time | Primary calculation point |
| **On Update** | Chat status/messages change | Real-time | Only if relevant fields changed |
| **On Config Change** | SLA/office hours updated | Background job | Optional, admin-triggered |

**Important:** Config changes do NOT automatically trigger recalculation. Admins must manually trigger bulk recalculation if they want historical data updated with new targets.

---

## Impact on Existing Specs

### Database Schema Changes
- ✅ No changes to Chat table schema (already includes SLA columns)
- ✅ Add SystemSetting records for SLA and office hours config
- ✅ Update SLA calculation functions to read from SystemSettings

### Technical Spec Changes
- ✅ Add config helper functions (`getSLAConfig`, `getOfficeHoursConfig`)
- ✅ Update SLA calculation to use dynamic config instead of hardcoded targets
- ✅ Add logging throughout SLA calculation pipeline
- ✅ Add bulk recalculation service for config changes

### API Spec Changes
- ✅ No changes to existing endpoints
- ➕ Add new endpoints for config management:
  - `GET /api/settings/sla` - Get current SLA config
  - `PUT /api/settings/sla` - Update SLA config
  - `GET /api/settings/office-hours` - Get office hours config
  - `PUT /api/settings/office-hours` - Update office hours config
  - `POST /api/sla-compliance/recalculate` - Trigger bulk recalculation

### New Requirements

#### Config Screens (Out of scope for SLA Compliance Page spec)
- `/settings/sla-targets` - SLA configuration UI
- `/settings/office-hours` - Office hours configuration UI

**Note:** These config screens are separate features and should have their own specs. The SLA Compliance Page will READ configuration but not EDIT it.

---

## Updated Implementation Checklist

- [ ] Add SystemSetting records migration
- [ ] Create `lib/config/sla-config.ts` with helper functions
- [ ] Update SLA calculation to use dynamic config
- [ ] Add logging throughout SLA pipeline
- [ ] Create bulk recalculation service
- [ ] Add SLA calculation on chat import
- [ ] Add SLA recalculation on chat update
- [ ] Implement config management API endpoints
- [ ] Create SLA targets config screen (separate spec)
- [ ] Create office hours config screen (separate spec)
- [ ] Add admin UI for triggering bulk recalculation

---

**These clarifications supersede any conflicting information in the original spec documents.**
