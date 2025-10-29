# Configurable SLA Metrics

**Feature ID:** Feature-008
**Status:** ✅ Implemented
**Version:** 1.0.0
**Last Updated:** 2025-10-28

## Overview

The Configurable SLA Metrics feature allows administrators to selectively enable or disable individual SLA metrics that count toward overall SLA compliance. This provides flexibility to start with basic metrics and gradually add more advanced ones as the team matures.

## Business Value

### Problem Solved
Previously, all four SLA metrics (Pickup, First Response, Average Response, and Resolution) were always required for a chat to be considered SLA-compliant. This "all-or-nothing" approach made it difficult for new teams to achieve good SLA compliance rates when starting out.

### Benefits
- **Gradual Rollout**: Start with basic metrics (Pickup, First Response) and add more complex ones later
- **Team Maturity**: Adjust metrics as team capabilities improve
- **Focused Improvement**: Concentrate on specific metrics without penalty from others
- **Flexibility**: Different deployment stages can use different metric combinations
- **No Data Loss**: All metrics continue to be calculated; only the compliance evaluation changes

## Default Configuration

By default, only **Pickup Time** and **First Response Time** are enabled:

```json
{
  "pickup": true,
  "firstResponse": true,
  "avgResponse": false,
  "resolution": false
}
```

This allows new teams to focus on the most critical customer-facing metrics first.

## Features

### 1. Metric Selection UI

Location: **Settings → SLA Configuration**

![SLA Configuration Screen](./screenshots/sla-configuration.png)

The configuration page includes:
- **Toggle switches** for each of the four metrics
- **Visual indicators** showing Active/Inactive status
- **Descriptions** explaining what each metric measures
- **Validation** preventing all metrics from being disabled

### 2. Dashboard Display

The SLA dashboard displays badges next to each metric:
- **Active badge** (blue): Metric counts toward overall SLA
- **Inactive badge** (gray): Metric tracked but doesn't affect overall SLA
- **Tooltips** explaining the difference when hovering

### 3. Automatic Recalculation

When enabled metrics change, administrators can trigger a recalculation:

```bash
POST /api/sla/recalculate?startDate=2025-01-01
```

The API will:
1. Fetch the current enabled metrics configuration
2. Recalculate overall SLA for all chats based on only the enabled metrics
3. Update the database with new compliance flags
4. Log which metrics were used for audit purposes

## The Four SLA Metrics

### 1. Pickup Time ⏱️
**Measures:** Time from chat opened to first agent assignment
**Default Target:** 2 minutes (120 seconds)
**Use Case:** Measures how quickly customers are connected to an agent

### 2. First Response Time 💬
**Measures:** Time from chat opened to first agent message
**Default Target:** 5 minutes (300 seconds)
**Use Case:** Measures how quickly customers receive their first response

### 3. Average Response Time 🔄
**Measures:** Average time between customer messages and agent replies
**Default Target:** 5 minutes (300 seconds)
**Use Case:** Measures ongoing conversation responsiveness

### 4. Resolution Time ✅
**Measures:** Total time from chat opened to chat closed
**Default Target:** 2 hours (7,200 seconds)
**Use Case:** Measures end-to-end problem resolution speed

## How Overall SLA is Calculated

The `overallSLA` flag is determined by checking **only the enabled metrics**:

```typescript
// Example: Only pickup and firstResponse enabled
enabledMetrics = {
  pickup: true,
  firstResponse: true,
  avgResponse: false,
  resolution: false
}

// Chat metrics:
pickupSLA = true       // ✓ 60s < 120s target
firstResponseSLA = true // ✓ 180s < 300s target
avgResponseSLA = false  // ✗ 400s > 300s target (but disabled)
resolutionSLA = false   // ✗ 9000s > 7200s target (but disabled)

// Result: overallSLA = true
// (Both enabled metrics passed)
```

**Rules:**
- ✅ `overallSLA = true` if ALL enabled metrics are compliant
- ❌ `overallSLA = false` if ANY enabled metric is breached
- ⚠️ `overallSLA = null` if ANY enabled metric has no data yet
- 🚫 `overallSLA = null` if NO metrics are enabled

## Configuration Guide

### Accessing the Configuration

1. Navigate to **Settings → SLA Configuration** (Admin only)
2. Locate the **"Active SLA Metrics"** section at the top
3. Toggle metrics on/off as needed
4. Click **"Save SLA Settings"**

### Recommended Rollout Strategy

#### Phase 1: Foundation (Weeks 1-4)
Enable only:
- ✅ Pickup Time
- ✅ First Response Time

**Goal:** Establish basic responsiveness

#### Phase 2: Engagement (Weeks 5-8)
Add:
- ✅ Average Response Time

**Goal:** Maintain conversation quality

#### Phase 3: Complete Service (Week 9+)
Add:
- ✅ Resolution Time

**Goal:** Full end-to-end service measurement

### Validation Rules

The system enforces these rules:
- **At least one metric must be enabled** (client and server validation)
- Changes are saved to database immediately
- Dashboard updates in real-time
- Recalculation respects the new configuration

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────┐
│ UI: SLA Settings Section                        │
│ - Toggle switches for each metric               │
│ - Validation (min 1 enabled)                    │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ API: POST /api/settings/sla                     │
│ - Validates at least one enabled                │
│ - Saves to SystemSetting table                  │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Database: SystemSetting                         │
│ key: "sla.enabledMetrics"                       │
│ value: JSON string of enabled flags             │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Calculator: calculateAllSLAMetrics()            │
│ - Receives enabledMetrics parameter             │
│ - Filters overall SLA by enabled only           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Database: Chat table                            │
│ - Individual metric SLA flags (always set)      │
│ - overallSLA (only enabled metrics)             │
│ - overallSLABH (business hours, enabled only)   │
└─────────────────────────────────────────────────┘
```

### Database Schema

**SystemSetting Table:**
```sql
key: "sla.enabledMetrics"
value: '{"pickup":true,"firstResponse":true,"avgResponse":false,"resolution":false}'
category: "sla"
```

**Chat Table (SLA Fields):**
```typescript
// All metrics calculated regardless of enabled state
timeToPickup: number | null
firstResponseTime: number | null
avgResponseTime: number | null
resolutionTime: number | null

// Individual compliance flags (always set)
pickupSLA: boolean | null
firstResponseSLA: boolean | null
avgResponseSLA: boolean | null
resolutionSLA: boolean | null

// Overall compliance (respects enabled metrics)
overallSLA: boolean | null
```

### Key Files

**Backend:**
- `src/types/sla.ts` - Type definitions with EnabledMetrics interface
- `src/app/api/settings/sla/route.ts` - API for saving/loading configuration
- `src/lib/sla/sla-calculator.ts` - Wall-clock calculation logic
- `src/lib/sla/sla-calculator-full.ts` - Business hours calculation logic
- `src/app/api/sla/recalculate/route.ts` - Batch recalculation API

**Frontend:**
- `src/components/settings/sla-settings-section.tsx` - Configuration UI
- `src/components/sla/sla-metrics-overview.tsx` - Dashboard display

**Tests:**
- `src/lib/sla/__tests__/sla-calculator.test.ts` - 34 tests including enabled metrics

## API Reference

### Get SLA Configuration

```http
GET /api/settings/sla
```

**Response:**
```json
{
  "pickupThreshold": 2,
  "firstResponseThreshold": 5,
  "avgResponseThreshold": 5,
  "resolutionThreshold": 120,
  "pickupTarget": 98,
  "firstResponseTarget": 95,
  "avgResponseTarget": 90,
  "resolutionTarget": 90,
  "enabledMetrics": {
    "pickup": true,
    "firstResponse": true,
    "avgResponse": false,
    "resolution": false
  }
}
```

### Update SLA Configuration

```http
PUT /api/settings/sla
Content-Type: application/json
```

**Request Body:**
```json
{
  "pickupThreshold": 2,
  "firstResponseThreshold": 5,
  "avgResponseThreshold": 5,
  "resolutionThreshold": 120,
  "pickupTarget": 98,
  "firstResponseTarget": 95,
  "avgResponseTarget": 90,
  "resolutionTarget": 90,
  "enabledMetrics": {
    "pickup": true,
    "firstResponse": true,
    "avgResponse": true,
    "resolution": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "SLA configuration updated successfully",
  "config": { ... }
}
```

**Error (all disabled):**
```json
{
  "error": "At least one SLA metric must be enabled"
}
```

### Recalculate SLA Metrics

```http
POST /api/sla/recalculate?startDate=2025-01-01&endDate=2025-01-31&limit=5000
```

**Response:**
```json
{
  "success": true,
  "processed": 4532,
  "failed": 0,
  "total": 4532,
  "duration": 12453,
  "enabledMetrics": {
    "pickup": true,
    "firstResponse": true,
    "avgResponse": false,
    "resolution": false
  }
}
```

## Troubleshooting

### Issue: Overall SLA shows null for all chats

**Cause:** No metrics are enabled
**Solution:** Enable at least one metric in Settings → SLA Configuration

### Issue: Overall SLA changed after configuration update

**Cause:** Expected behavior - enabled metrics changed
**Solution:** Run recalculation API to update historical data

### Issue: Can't disable all metrics

**Cause:** Validation prevents invalid configuration
**Solution:** Keep at least one metric enabled

### Issue: Dashboard shows "Inactive" but metric still calculated

**Cause:** Expected behavior - all metrics are always calculated
**Solution:** This is intentional; inactive metrics are tracked but don't affect compliance

## Migration Notes

### For Existing Installations

When upgrading to this version:

1. **Automatic Default Applied**
   - If no `enabledMetrics` configuration exists, defaults to pickup + firstResponse enabled
   - Existing SLA calculations remain unchanged until recalculation

2. **Recommended Steps After Upgrade**
   ```bash
   # 1. Review default configuration
   # Navigate to Settings → SLA Configuration

   # 2. Adjust enabled metrics if needed

   # 3. Trigger recalculation for accuracy
   curl -X POST "https://your-domain/api/sla/recalculate?startDate=2025-01-01"
   ```

3. **Data Impact**
   - All individual metric values and flags remain unchanged
   - Only `overallSLA` and `overallSLABH` flags are recalculated
   - No data loss occurs

### Backward Compatibility

- ✅ All existing SLA calculations continue to work
- ✅ Individual metric flags always calculated regardless of enabled state
- ✅ APIs accept optional `enabledMetrics` parameter (defaults to all enabled)
- ✅ Old calculation calls without `enabledMetrics` still work

## Testing

The feature includes comprehensive test coverage:

### Unit Tests
- 34 tests in `sla-calculator.test.ts`
- 7 tests specifically for enabled metrics feature
- Tests cover all edge cases:
  - All metrics enabled
  - Only one metric enabled
  - No metrics enabled
  - Mixed enabled/disabled combinations
  - Null handling for incomplete chats

### Test Scenarios

```typescript
// Scenario 1: Only pickup enabled, it fails
enabledMetrics = { pickup: true, others: false }
pickupSLA = false  // Breach
→ overallSLA = false

// Scenario 2: Only firstResponse enabled, it passes
enabledMetrics = { firstResponse: true, others: false }
firstResponseSLA = true  // Pass
→ overallSLA = true

// Scenario 3: Disabled metric fails (doesn't affect overall)
enabledMetrics = { pickup: true, firstResponse: false, others: false }
pickupSLA = true   // Pass
firstResponseSLA = false  // Breach but disabled
→ overallSLA = true  // Still passes!
```

### Running Tests

```bash
# Run all SLA tests
npm test -- src/lib/sla/__tests__/

# Run specific test file
npm test -- src/lib/sla/__tests__/sla-calculator.test.ts

# Run with coverage
npm test -- --coverage src/lib/sla/
```

## Best Practices

### 1. Start Simple
Begin with just Pickup and First Response. These are the easiest to achieve and most visible to customers.

### 2. Monitor Before Adding
Before enabling a new metric, monitor it in "Inactive" mode for a week to understand your current performance.

### 3. Communicate Changes
When changing enabled metrics, inform your team about the new expectations and updated compliance criteria.

### 4. Use Recalculation Wisely
After changing enabled metrics, trigger a recalculation to get accurate historical data:

```bash
# Recalculate last 90 days
POST /api/sla/recalculate?startDate=2025-01-01&limit=10000
```

### 5. Review Regularly
Revisit your enabled metrics quarterly to ensure they align with your current service goals.

## Future Enhancements

Potential future improvements:
- **Time-based Rules**: Auto-enable metrics based on time of day or day of week
- **Channel-specific**: Different enabled metrics per channel (WhatsApp, LiveChat, etc.)
- **Agent-level**: Different metrics for different agent skill levels
- **Gradual Rollout**: Automatically enable metrics when team hits certain performance thresholds

## Support

For questions or issues:
- **Documentation**: See this file and the feature plan in `features/feature-008-configurable-sla-metrics.md`
- **API Reference**: Check the API documentation above
- **Code Reference**: See implementation files listed in "Key Files" section
- **Tests**: Review test cases for usage examples

---

**Related Documentation:**
- [SLA Overview](./sla-overview.md)
- [Office Hours Configuration](./office-hours.md)
- [Analytics Dashboard Guide](./analytics-dashboard.md)
