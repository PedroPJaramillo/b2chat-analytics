# SLA Calculation Guide

## Overview

The B2Chat Analytics system tracks Service Level Agreement (SLA) metrics to measure how quickly support teams respond to and resolve customer inquiries. This document provides a comprehensive explanation of how SLA metrics are calculated, evaluated, and displayed.

---

## Table of Contents

1. [SLA Metrics](#sla-metrics)
2. [Default Thresholds](#default-thresholds)
3. [Priority-Based Overrides](#priority-based-overrides)
4. [Channel-Based Overrides](#channel-based-overrides)
5. [Threshold Resolution Logic](#threshold-resolution-logic)
6. [Wall Clock vs Business Hours](#wall-clock-vs-business-hours)
7. [Overall SLA Calculation](#overall-sla-calculation)
8. [SLA Status States](#sla-status-states)
9. [Implementation Details](#implementation-details)
10. [Examples](#examples)
11. [SLA Recalculation](#sla-recalculation)

---

## SLA Metrics

The system tracks four distinct SLA metrics for each chat:

### 1. Pickup Time
**What it measures:** Time from when a chat enters the queue until an agent picks it up (first assignment).

**Database fields:**
- `timeToPickup` (seconds, wall clock)
- `timeToPickupBH` (seconds, business hours)
- `pickupSLA` (boolean, wall clock compliance)
- `pickupSLABH` (boolean, business hours compliance)

### 2. First Response Time
**What it measures:** Time from when a chat is created until the first agent message is sent.

**Database fields:**
- `firstResponseTime` (seconds, wall clock)
- `firstResponseTimeBH` (seconds, business hours)
- `firstResponseSLA` (boolean, wall clock compliance)
- `firstResponseSLABH` (boolean, business hours compliance)

### 3. Average Response Time
**What it measures:** Average time between customer messages and subsequent agent responses throughout the chat.

**Database fields:**
- `avgResponseTime` (seconds, wall clock)
- `avgResponseTimeBH` (seconds, business hours)
- `avgResponseSLA` (boolean, wall clock compliance)
- `avgResponseSLABH` (boolean, business hours compliance)

**Note:** This metric is **disabled by default** in the system configuration.

### 4. Resolution Time
**What it measures:** Total time from when a chat is created until it is closed/resolved.

**Database fields:**
- `resolutionTime` (seconds, wall clock)
- `resolutionTimeBH` (seconds, business hours)
- `resolutionSLA` (boolean, wall clock compliance)
- `resolutionSLABH` (boolean, business hours compliance)

**Note:** This metric is **disabled by default** in the system configuration.

---

## Default Thresholds

When no priority or channel overrides are configured, the system uses these default thresholds:

```typescript
{
  pickupTimeSeconds: 120,      // 2 minutes
  firstResponseSeconds: 300,   // 5 minutes
  avgResponseSeconds: 300,     // 5 minutes (disabled)
  resolutionSeconds: 1800      // 30 minutes (disabled)
}
```

### Metric Status

By default, only **Pickup Time** and **First Response Time** are enabled. The other metrics are tracked but not included in SLA compliance calculations unless explicitly enabled in the configuration.

---

## Priority-Based Overrides

The system allows different SLA thresholds based on chat priority levels. When configured, these overrides apply to all chats with the specified priority, regardless of the communication channel.

### Available Priority Levels

1. **Urgent** - Highest priority
2. **High** - Important issues
3. **Normal** - Standard support (default)
4. **Low** - Non-urgent inquiries

### Example Priority Configuration

```typescript
priorityOverrides: {
  urgent: {
    pickupTimeSeconds: 60,        // 1 minute
    firstResponseSeconds: 180,    // 3 minutes
    avgResponseSeconds: 180,      // 3 minutes
    resolutionSeconds: 900        // 15 minutes
  },
  high: {
    pickupTimeSeconds: 180,       // 3 minutes
    firstResponseSeconds: 300,    // 5 minutes
    avgResponseSeconds: 300,      // 5 minutes
    resolutionSeconds: 1800       // 30 minutes
  },
  normal: {
    // Uses default thresholds
  },
  low: {
    pickupTimeSeconds: 600,       // 10 minutes
    firstResponseSeconds: 900,    // 15 minutes
    avgResponseSeconds: 900,      // 15 minutes
    resolutionSeconds: 3600       // 1 hour
  }
}
```

---

## Channel-Based Overrides

Different communication channels may have different SLA expectations. Channel overrides allow you to set specific thresholds for each provider.

### Supported Channels

- **WhatsApp** - Real-time messaging platform
- **LiveChat** - Website live chat widget
- **Facebook** - Facebook Messenger integration
- **Telegram** - Telegram messaging
- **B2C Bot API** - Custom bot integration

### Example Channel Configuration

```typescript
channelOverrides: {
  whatsapp: {
    pickupTimeSeconds: 180,       // 3 minutes
    firstResponseSeconds: 300,    // 5 minutes
    avgResponseSeconds: 300,      // 5 minutes
    resolutionSeconds: 1800       // 30 minutes
  },
  livechat: {
    pickupTimeSeconds: 60,        // 1 minute (immediate)
    firstResponseSeconds: 120,    // 2 minutes
    avgResponseSeconds: 180,      // 3 minutes
    resolutionSeconds: 900        // 15 minutes
  },
  facebook: {
    pickupTimeSeconds: 600,       // 10 minutes
    firstResponseSeconds: 900,    // 15 minutes
    avgResponseSeconds: 900,      // 15 minutes
    resolutionSeconds: 3600       // 1 hour
  },
  telegram: {
    pickupTimeSeconds: 300,       // 5 minutes
    firstResponseSeconds: 600,    // 10 minutes
    avgResponseSeconds: 600,      // 10 minutes
    resolutionSeconds: 1800       // 30 minutes
  },
  'b2c-bot-api': {
    pickupTimeSeconds: 60,        // 1 minute
    firstResponseSeconds: 180,    // 3 minutes
    avgResponseSeconds: 180,      // 3 minutes
    resolutionSeconds: 900        // 15 minutes
  }
}
```

---

## Threshold Resolution Logic

When a chat has both a priority and a channel, the system must determine which thresholds to apply. The resolution follows this precedence order:

### Precedence Order (Highest to Lowest)

1. **Priority Override** - If the chat has a priority AND a priority override is configured
2. **Channel Override** - If no priority override, but a channel override is configured
3. **Default Thresholds** - If neither override applies

### Resolution Algorithm

```typescript
function getAppliedThresholds(
  priority: 'urgent' | 'high' | 'normal' | 'low' | null,
  provider: string | null,
  config: SLAConfig
): SLAThresholds {
  // Priority takes precedence
  if (priority && config.priorityOverrides?.[priority]) {
    return config.priorityOverrides[priority]
  }

  // Channel override next
  if (provider && config.channelOverrides?.[provider]) {
    return config.channelOverrides[provider]
  }

  // Default thresholds
  return config.defaultThresholds
}
```

### Examples

| Chat Priority | Chat Channel | Applied Thresholds |
|--------------|--------------|-------------------|
| `urgent` | WhatsApp | Priority: Urgent (1m pickup, 3m response) |
| `normal` | WhatsApp | Channel: WhatsApp (3m pickup, 5m response) |
| `null` | WhatsApp | Channel: WhatsApp (3m pickup, 5m response) |
| `urgent` | `null` | Priority: Urgent (1m pickup, 3m response) |
| `normal` | `null` | Default (2m pickup, 5m response) |
| `null` | `null` | Default (2m pickup, 5m response) |

---

## Wall Clock vs Business Hours

The system tracks SLA metrics in two modes simultaneously:

### Wall Clock (24/7)

- Measures elapsed time continuously, including weekends and after-hours
- Used when support is available 24/7 or for urgency measurement
- Database fields without "BH" suffix (e.g., `pickupSLA`, `firstResponseTime`)

### Business Hours

- Measures elapsed time only during configured business hours
- Excludes nights, weekends, and holidays
- Used for realistic SLA measurement when support is not 24/7
- Database fields with "BH" suffix (e.g., `pickupSLABH`, `firstResponseTimeBH`)

### Business Hours Configuration

Default business hours configuration:

```typescript
{
  enabled: true,
  timezone: 'America/New_York',
  schedule: {
    monday:    { start: '09:00', end: '17:00' },
    tuesday:   { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday:  { start: '09:00', end: '17:00' },
    friday:    { start: '09:00', end: '17:00' },
    saturday:  null,  // Closed
    sunday:    null   // Closed
  }
}
```

### When to Use Each Mode

- **Wall Clock**: Real-time urgency, customer perspective, 24/7 support teams
- **Business Hours**: Agent performance measurement, teams with defined work hours

**Both metrics are calculated and stored**, allowing teams to analyze SLA from both perspectives.

---

## Overall SLA Calculation

The overall SLA status is a **logical AND** of all **enabled** metrics. A chat meets its overall SLA only if ALL enabled metrics are within their thresholds.

### Calculation Logic

```typescript
function calculateOverallSLA(chat: Chat, config: SLAConfig): boolean | null {
  const enabledMetrics = []

  // Check each metric if enabled in config
  if (config.metricsEnabled.pickupTime && chat.pickupSLA !== null) {
    enabledMetrics.push(chat.pickupSLA)
  }

  if (config.metricsEnabled.firstResponse && chat.firstResponseSLA !== null) {
    enabledMetrics.push(chat.firstResponseSLA)
  }

  if (config.metricsEnabled.avgResponse && chat.avgResponseSLA !== null) {
    enabledMetrics.push(chat.avgResponseSLA)
  }

  if (config.metricsEnabled.resolution && chat.resolutionSLA !== null) {
    enabledMetrics.push(chat.resolutionSLA)
  }

  // If no metrics are available yet, return null (incomplete)
  if (enabledMetrics.length === 0) {
    return null
  }

  // Overall SLA = ALL enabled metrics must pass
  return enabledMetrics.every(metric => metric === true)
}
```

### Overall SLA States

The overall SLA can have three states:

1. **`true` (Within SLA)** - All enabled metrics passed their thresholds
2. **`false` (Breached)** - At least one enabled metric exceeded its threshold
3. **`null` (Incomplete)** - Metrics not yet measurable (e.g., no messages sent yet)

### Example Scenarios

#### Scenario 1: All Metrics Pass
```
Pickup Time:    ✓ Within (1m 30s / 2m threshold)
First Response: ✓ Within (4m 15s / 5m threshold)
Avg Response:   - Disabled
Resolution:     - Disabled
→ Overall SLA: Within ✓
```

#### Scenario 2: One Metric Fails
```
Pickup Time:    ✓ Within (1m 30s / 2m threshold)
First Response: ✗ Breached (6m 15s / 5m threshold)
Avg Response:   - Disabled
Resolution:     - Disabled
→ Overall SLA: Breached ✗
```

#### Scenario 3: Incomplete (No Messages)
```
Pickup Time:    - Not yet measured
First Response: - Not yet measured
Avg Response:   - Disabled
Resolution:     - Disabled
→ Overall SLA: Incomplete (null)
```

#### Scenario 4: Mixed (Partial Data)
```
Pickup Time:    ✓ Within (1m 30s / 2m threshold)
First Response: - Not yet measured (no agent response)
Avg Response:   - Disabled
Resolution:     - Disabled
→ Overall SLA: Incomplete (null)
```

---

## SLA Status States

In the UI, chats display one of three SLA status badges:

### Within SLA
- **Badge Color**: Green (secondary variant)
- **Badge Text**: "Within"
- **Condition**: `overallSLA === true`
- **Meaning**: All enabled SLA metrics are within their thresholds

### Breached SLA
- **Badge Color**: Red (destructive variant)
- **Badge Text**: "Breached"
- **Condition**: `overallSLA === false`
- **Meaning**: At least one enabled SLA metric exceeded its threshold

### Incomplete SLA
- **Badge Color**: Gray (outline variant)
- **Badge Text**: "Incomplete"
- **Condition**: `overallSLA === null`
- **Meaning**: SLA metrics cannot be calculated yet (e.g., chat has no messages)

---

## Implementation Details

### Database Schema

SLA data is stored in the `Chat` table with the following fields:

```prisma
model Chat {
  // Wall Clock Time Metrics (seconds)
  timeToPickup        Int?
  firstResponseTime   Int?
  avgResponseTime     Float?
  resolutionTime      Int?

  // Wall Clock SLA Compliance
  pickupSLA           Boolean?
  firstResponseSLA    Boolean?
  avgResponseSLA      Boolean?
  resolutionSLA       Boolean?
  overallSLA          Boolean?

  // Business Hours Time Metrics (seconds)
  timeToPickupBH      Int?
  firstResponseTimeBH Int?
  avgResponseTimeBH   Float?
  resolutionTimeBH    Int?

  // Business Hours SLA Compliance
  pickupSLABH         Boolean?
  firstResponseSLABH  Boolean?
  avgResponseSLABH    Boolean?
  resolutionSLABH     Boolean?
  overallSLABH        Boolean?
}
```

### API Response

The Chat View API maps database fields to the frontend model:

```typescript
// src/app/api/chats/view/route.ts
{
  // Convert seconds to milliseconds for frontend
  pickupTimeBHMs: chat.timeToPickupBH ? chat.timeToPickupBH * 1000 : null,
  firstResponseTimeBHMs: chat.firstResponseTimeBH ? chat.firstResponseTimeBH * 1000 : null,
  avgResponseTimeBHMs: chat.avgResponseTimeBH ? chat.avgResponseTimeBH * 1000 : null,
  resolutionTimeBHMs: chat.resolutionTimeBH ? chat.resolutionTimeBH * 1000 : null,

  // Map overall SLA to status with null handling
  slaStatus: chat.overallSLA === null
    ? 'incomplete'
    : chat.overallSLA
      ? 'within'
      : 'breached',

  // Pass through boolean flags
  pickupSLA: chat.pickupSLA,
  firstResponseSLA: chat.firstResponseSLA,
  // ... etc
}
```

### Tooltip Formatting

The SLA tooltip displays detailed breakdown of all metrics:

```typescript
// src/lib/sla-tooltip-formatter.ts
export function formatSLATooltip(chat: ChatWithSLA, config: SLAConfig): string {
  const thresholds = getAppliedThresholds(chat.priority, chat.provider, config)

  return `
Overall SLA: ${formatOverallStatus(chat.overallSLA)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PICKUP TIME
Wall Clock:     ${formatMetricRow(chat.timeToPickup, chat.pickupSLA, thresholds.pickupTimeSeconds)}
Business Hours: ${formatMetricRow(chat.pickupTimeBHMs, chat.pickupSLABH, thresholds.pickupTimeSeconds)}

FIRST RESPONSE TIME
Wall Clock:     ${formatMetricRow(chat.firstResponseTime, chat.firstResponseSLA, thresholds.firstResponseSeconds)}
Business Hours: ${formatMetricRow(chat.firstResponseTimeBHMs, chat.firstResponseSLABH, thresholds.firstResponseSeconds)}

...

Config: ${formatConfigSource(chat.priority, chat.provider)}
  `.trim()
}
```

### Time Formatting

Duration values are formatted for human readability:

```typescript
function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return 'N/A'

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}
```

**Examples:**
- `90000ms` → `"1m 30s"`
- `3661000ms` → `"1h 1m 1s"`
- `45000ms` → `"45s"`
- `null` → `"N/A"`

---

## Examples

### Example 1: Urgent WhatsApp Chat (Within SLA)

**Chat Details:**
- Priority: `urgent`
- Channel: `whatsapp`
- Status: Open

**Applied Thresholds** (Priority override takes precedence):
- Pickup: 1 minute (60s)
- First Response: 3 minutes (180s)

**Actual Times:**
- Wall Clock Pickup: 45 seconds → ✓ Within (45s / 60s)
- Wall Clock First Response: 2m 30s → ✓ Within (150s / 180s)
- Business Hours Pickup: 42 seconds → ✓ Within (42s / 60s)
- Business Hours First Response: 2m 15s → ✓ Within (135s / 180s)

**Overall SLA:** ✓ Within

**Tooltip Display:**
```
Overall SLA: Within ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PICKUP TIME
Wall Clock:     ✓ 45s / 1m
Business Hours: ✓ 42s / 1m

FIRST RESPONSE TIME
Wall Clock:     ✓ 2m 30s / 3m
Business Hours: ✓ 2m 15s / 3m

AVG RESPONSE TIME
⊘ Disabled in configuration

RESOLUTION TIME
⊘ Disabled in configuration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Config: Urgent Priority, WhatsApp
```

---

### Example 2: Normal Facebook Chat (Breached SLA)

**Chat Details:**
- Priority: `normal` (or `null`)
- Channel: `facebook`
- Status: Open

**Applied Thresholds** (Channel override):
- Pickup: 10 minutes (600s)
- First Response: 15 minutes (900s)

**Actual Times:**
- Wall Clock Pickup: 8m 30s → ✓ Within (510s / 600s)
- Wall Clock First Response: 18m 45s → ✗ Breached (1125s / 900s)
- Business Hours Pickup: 8m 0s → ✓ Within (480s / 600s)
- Business Hours First Response: 17m 30s → ✗ Breached (1050s / 900s)

**Overall SLA:** ✗ Breached (First Response exceeded threshold)

**Tooltip Display:**
```
Overall SLA: Breached ✗

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PICKUP TIME
Wall Clock:     ✓ 8m 30s / 10m
Business Hours: ✓ 8m / 10m

FIRST RESPONSE TIME
Wall Clock:     ✗ 18m 45s / 15m
Business Hours: ✗ 17m 30s / 15m

AVG RESPONSE TIME
⊘ Disabled in configuration

RESOLUTION TIME
⊘ Disabled in configuration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Config: Normal Priority, Facebook
```

---

### Example 3: LiveChat with No Messages (Incomplete)

**Chat Details:**
- Priority: `null`
- Channel: `livechat`
- Status: Assigned (no messages yet)

**Applied Thresholds** (Channel override):
- Pickup: 1 minute (60s)
- First Response: 2 minutes (120s)

**Actual Times:**
- Wall Clock Pickup: 45s → ✓ Within (45s / 60s)
- Wall Clock First Response: Not measured (no agent message yet)
- Business Hours Pickup: 42s → ✓ Within (42s / 60s)
- Business Hours First Response: Not measured

**Overall SLA:** Incomplete (First Response not measurable yet)

**Tooltip Display:**
```
Overall SLA: Incomplete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PICKUP TIME
Wall Clock:     ✓ 45s / 1m
Business Hours: ✓ 42s / 1m

FIRST RESPONSE TIME
Wall Clock:     - N/A / 2m
Business Hours: - N/A / 2m

AVG RESPONSE TIME
⊘ Disabled in configuration

RESOLUTION TIME
⊘ Disabled in configuration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Config: Default Thresholds, LiveChat
```

---

### Example 4: Low Priority with Default Settings

**Chat Details:**
- Priority: `low`
- Channel: `null` (no specific channel)
- Status: Closed

**Applied Thresholds** (Priority override):
- Pickup: 10 minutes (600s)
- First Response: 15 minutes (900s)
- Resolution: 1 hour (3600s)

**Actual Times:**
- Wall Clock Pickup: 12m → ✗ Breached (720s / 600s)
- Wall Clock First Response: 14m 30s → ✓ Within (870s / 900s)
- Wall Clock Resolution: 45m → ✓ Within (2700s / 3600s)
- Business Hours Pickup: 9m 30s → ✓ Within (570s / 600s)
- Business Hours First Response: 12m → ✓ Within (720s / 900s)
- Business Hours Resolution: 38m → ✓ Within (2280s / 3600s)

**Overall SLA (Wall Clock):** ✗ Breached (Pickup exceeded threshold)
**Overall SLA (Business Hours):** ✓ Within (All metrics within threshold)

**Tooltip Display:**
```
Overall SLA: Breached ✗

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PICKUP TIME
Wall Clock:     ✗ 12m / 10m
Business Hours: ✓ 9m 30s / 10m

FIRST RESPONSE TIME
Wall Clock:     ✓ 14m 30s / 15m
Business Hours: ✓ 12m / 15m

AVG RESPONSE TIME
⊘ Disabled in configuration

RESOLUTION TIME
Wall Clock:     ✓ 45m / 1h
Business Hours: ✓ 38m / 1h

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Config: Low Priority
```

**Note:** This example shows why business hours tracking is valuable - the chat breached wall-clock SLA (12m pickup vs 10m threshold) but met business hours SLA (9m 30s), suggesting the breach occurred outside business hours.

---

## Key Takeaways

1. **Four SLA Metrics**: Pickup, First Response, Average Response, Resolution
2. **Only Two Enabled by Default**: Pickup and First Response
3. **Priority Overrides Take Precedence** over channel overrides
4. **Both Wall Clock and Business Hours** are tracked simultaneously
5. **Overall SLA = Logical AND** of all enabled metrics
6. **Three Status States**: Within (✓), Breached (✗), Incomplete (null)
7. **Null-Safe Logic**: Missing data results in "Incomplete" status, not "Breached"

---

## SLA Recalculation

### Overview

SLA metrics are calculated during data synchronization and stored in the database. When SLA configuration changes (thresholds, overrides, enabled metrics), historical chat data does not automatically update. The SLA Recalculation feature allows administrators to reprocess historical chats with the updated configuration.

### When to Recalculate

Recalculation is necessary when:

- **Threshold Changes**: Default SLA thresholds are modified (e.g., changing first response from 5m to 3m)
- **Priority Overrides**: Priority-specific thresholds are added, modified, or removed
- **Channel Overrides**: Channel-specific thresholds are added, modified, or removed
- **Enabled Metrics**: Metrics are enabled or disabled (affects overall SLA calculation)
- **Business Hours Changes**: Office hours configuration is modified
- **Data Corrections**: Historical data needs to be recalculated for accuracy

### How Recalculation Works

1. **Configuration Loading**: Reads current SLA configuration from `SystemSetting` table
2. **Chat Selection**: Queries chats within specified date range (or specific chat ID)
3. **Batch Processing**: Processes chats in batches of 100 to prevent database overload
4. **Metric Calculation**: For each chat:
   - Recalculates all enabled SLA metrics (pickup, first response, avg response, resolution)
   - Applies current thresholds and priority/channel overrides
   - Calculates both wall-clock and business hours metrics
   - Updates chat record with new values
5. **Audit Logging**: Logs each operation for compliance and troubleshooting
6. **Result Summary**: Returns processed/failed counts and duration

### Access and Permissions

- **Admin Only**: Recalculation requires the `admin` role
- **Rate Limited**: Maximum 5 recalculation operations per hour per user
- **Audit Trail**: All operations logged to `AuditLog` table

### Using the Recalculation UI

#### Quick Recalculation (30 Days)

1. Navigate to **Settings → SLA Configuration**
2. Save any configuration changes first
3. Scroll to the **SLA Maintenance** section
4. Click **Recalculate Last 30 Days**
5. Review the confirmation dialog showing:
   - Date range
   - Estimated chat count
   - Estimated processing time
6. Click **Recalculate** to proceed

#### Custom Date Range

1. In the SLA Maintenance section, expand **Advanced Options**
2. Configure:
   - **Start Date**: First day of recalculation period
   - **End Date**: Last day of recalculation period (max 1 year from start)
   - **Max Chats**: Limit number of chats to process (1-10,000)
3. View the estimated chat count
4. Click **Apply Custom Range**
5. Review and confirm in the dialog

### Understanding Results

#### Success (All Chats Processed)

```
✓ SLA Recalculation Complete

Processed: 234
Duration: 8.2s
```

The result shows:
- All chats successfully recalculated
- Total processing time
- Last recalculation timestamp stored for reference

#### Partial Success (Some Failures)

```
⚠ SLA Recalculation Completed with Errors

Processed: 230    Failed: 4    Duration: 12s

Errors:
• chat-abc123 • Missing message data
• chat-xyz789 • Invalid timestamp
• chat-def456 • Database constraint violation
• chat-ghi012 • Calculation timeout
```

The system is **error-tolerant**: it continues processing remaining chats even when some fail. Failed chats can be investigated individually and retried.

### Best Practices

#### Before Recalculating

1. **Save Configuration First**: Always save SLA settings before recalculating
2. **Test with Small Range**: Start with a 7-day range to verify results
3. **Check Current Load**: Run during off-peak hours for large operations
4. **Review Configuration**: Confirm new thresholds are correct

#### During Recalculation

1. **Wait for Completion**: Do not navigate away or close the browser
2. **Monitor Results**: Watch for error messages in the detailed results
3. **Expect Some Failures**: A small number of failures is normal for data quality issues

#### After Recalculation

1. **Verify Results**: Check a few chats in the Chat View to confirm metrics updated
2. **Review Errors**: If many failures occurred, investigate the error messages
3. **Document Changes**: Note what configuration changed and when recalculated

### Performance Guidelines

| Chats to Process | Estimated Time | Recommendation |
|------------------|----------------|----------------|
| < 100 | < 5 seconds | Safe anytime |
| 100-500 | 5-25 seconds | Safe during business hours |
| 500-1,000 | 25-50 seconds | Consider off-peak hours |
| 1,000-5,000 | 50-250 seconds (~5 min) | Run during off-peak hours |
| 5,000-10,000 | 250-500 seconds (~10 min) | Run during off-peak hours, monitor |

**Note**: Times are estimates. Actual duration depends on message counts, database performance, and server load.

### API Usage

For automated or programmatic recalculation:

```bash
# Recalculate last 30 days
curl -X POST 'https://your-domain.com/api/sla/recalculate' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Recalculate specific date range
curl -X POST 'https://your-domain.com/api/sla/recalculate?startDate=2025-01-01&endDate=2025-01-31&limit=1000' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Recalculate specific chat
curl -X POST 'https://your-domain.com/api/sla/recalculate?chatId=abc123' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Response Format:**

```json
{
  "success": true,
  "processed": 234,
  "failed": 0,
  "total": 234,
  "duration": 8234,
  "enabledMetrics": {
    "pickup": true,
    "firstResponse": true,
    "avgResponse": false,
    "resolution": false
  }
}
```

### Troubleshooting

#### "Unsaved Changes" Warning

**Problem**: Recalculation button is disabled with warning message.

**Solution**: Click **Save SLA Settings** first, then recalculate.

**Why**: Recalculation uses the configuration stored in the database, not unsaved form values.

---

#### Rate Limit Error (429)

**Problem**: Error message "Too many SLA recalculation requests."

**Solution**: Wait 1 hour between recalculation attempts.

**Why**: Rate limiting prevents system overload (max 5 operations per hour per user).

---

#### "Forbidden: Admin role required"

**Problem**: User receives 403 Forbidden error.

**Solution**: Contact your system administrator to grant admin role.

**Why**: Only admin users can trigger recalculation (prevents accidental or unauthorized operations).

---

#### Some Chats Failed

**Problem**: Result shows "Failed: 4" with error list.

**Common Causes**:
- **Missing message data**: Chat has no messages (incomplete data)
- **Invalid timestamp**: Message timestamps are null or malformed
- **Database constraints**: Data violates database rules
- **Calculation timeout**: Chat has too many messages (> 10,000)

**Solution**:
1. Check the specific chat IDs listed in errors
2. Review chat data in database for data quality issues
3. Fix data issues if possible
4. Retry recalculation for failed chats
5. If persistent, contact support with error details

---

#### Large Date Range Times Out

**Problem**: Recalculation for 365-day range fails or times out.

**Solution**: Break into smaller ranges:
```
Instead of:  Jan 1 - Dec 31 (365 days)
Use:         Jan 1 - Mar 31 (90 days)
             Apr 1 - Jun 30 (90 days)
             Jul 1 - Sep 30 (90 days)
             Oct 1 - Dec 31 (92 days)
```

**Why**: Smaller batches are more reliable and easier to monitor.

---

### Data Safety

Recalculation is **safe** and **non-destructive**:

- ✅ **Only updates SLA metrics**: Does not modify chat messages, contacts, or agents
- ✅ **Preserves original timestamps**: `openedAt`, `closedAt`, etc. remain unchanged
- ✅ **Reversible**: Can recalculate again with different configuration
- ✅ **Logged**: All operations tracked in audit log
- ✅ **Error-tolerant**: Failures don't affect other chats

### Last Recalculation Info

The UI displays information about the most recent recalculation:

```
Last recalculation: 2 hours ago — 345 chats ✓ Success
```

This information is stored in your browser's localStorage and persists across sessions. It helps track when metrics were last updated.

---

## Related Files

- **Configuration**: `src/app/api/settings/sla/route.ts`
- **Type Definitions**: `src/types/chat-view.ts`, `src/types/sla-config.ts`
- **API Mapping**: `src/app/api/chats/view/route.ts`
- **Tooltip Formatter**: `src/lib/sla-tooltip-formatter.ts`
- **UI Component**: `src/components/chats/chat-view-table.tsx`
- **Tests**: `src/lib/__tests__/sla-tooltip-formatter.test.ts`

---

**Last Updated:** October 29, 2025
**Version:** 1.0.0
