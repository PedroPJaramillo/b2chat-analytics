# SLA Compliance Page - Integration Guide

> Date: 2025-10-21
> Version: 1.0
> Status: Production Ready

## Overview

This guide covers the integration of the SLA Compliance Page into the B2Chat Analytics application, including event triggers, background jobs, and deployment considerations.

---

## Table of Contents

1. [Event Triggers](#event-triggers)
2. [Background Jobs](#background-jobs)
3. [Database Setup](#database-setup)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Performance Optimization](#performance-optimization)
7. [Monitoring & Logging](#monitoring--logging)
8. [Deployment Checklist](#deployment-checklist)

---

## Event Triggers

### When to Calculate SLA Metrics

Based on the specification (SPEC_CLARIFICATIONS.md), SLA metrics should be calculated at these trigger points:

#### 1. **On Import (Primary Trigger)**

When importing chats from external systems:

```typescript
// In your chat import service
import { calculateAllSLAMetricsWithBusinessHours } from '@/lib/sla/sla-calculator-full';
import { getSLAConfig, getOfficeHoursConfig } from '@/lib/config/sla-config';
import { slaLogger } from '@/lib/sla/sla-logger';

async function importChat(chatData: any) {
  // ... import chat data ...

  // Calculate SLA metrics
  const [slaConfig, officeHoursConfig] = await Promise.all([
    getSLAConfig(),
    getOfficeHoursConfig(),
  ]);

  const metrics = calculateAllSLAMetricsWithBusinessHours(
    {
      openedAt: chat.openedAt,
      firstAgentAssignedAt: chat.firstAgentAssignedAt,
      closedAt: chat.closedAt,
      messages: chat.messages,
    },
    slaConfig,
    officeHoursConfig
  );

  // Update chat with SLA metrics
  await prisma.chat.update({
    where: { id: chat.id },
    data: {
      // Wall clock metrics
      timeToPickup: metrics.timeToPickup,
      firstResponseTime: metrics.firstResponseTime,
      avgResponseTime: metrics.avgResponseTime,
      resolutionTime: metrics.resolutionTime,
      pickupSLA: metrics.pickupSLA,
      firstResponseSLA: metrics.firstResponseSLA,
      avgResponseSLA: metrics.avgResponseSLA,
      resolutionSLA: metrics.resolutionSLA,
      overallSLA: metrics.overallSLA,
      // Business hours metrics
      timeToPickupBH: metrics.timeToPickupBH,
      firstResponseTimeBH: metrics.firstResponseTimeBH,
      avgResponseTimeBH: metrics.avgResponseTimeBH,
      resolutionTimeBH: metrics.resolutionTimeBH,
      pickupSLABH: metrics.pickupSLABH,
      firstResponseSLABH: metrics.firstResponseSLABH,
      avgResponseSLABH: metrics.avgResponseSLABH,
      resolutionSLABH: metrics.resolutionSLABH,
      overallSLABH: metrics.overallSLABH,
    },
  });

  // Log calculation
  await slaLogger.logCalculation(chat.id, metrics, 'initial');

  // Log breach if applicable
  if (metrics.overallSLA === false) {
    const breachedMetrics = [];
    if (metrics.pickupSLA === false) breachedMetrics.push('pickup');
    if (metrics.firstResponseSLA === false) breachedMetrics.push('first_response');
    if (metrics.avgResponseSLA === false) breachedMetrics.push('avg_response');
    if (metrics.resolutionSLA === false) breachedMetrics.push('resolution');

    await slaLogger.logBreach(
      chat.id,
      chat.agentId,
      breachedMetrics as any,
      metrics
    );
  }
}
```

#### 2. **On Update (Secondary Trigger)**

When chat data is updated (new message, status change, etc.):

```typescript
// In your chat update service
async function updateChat(chatId: string, updates: any) {
  // Update chat
  await prisma.chat.update({
    where: { id: chatId },
    data: updates,
  });

  // Recalculate SLA metrics if relevant fields changed
  if (
    updates.closedAt ||
    updates.agentId ||
    updates.messages // if messages array changed
  ) {
    // Fetch full chat data
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          select: { role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) return;

    // Recalculate
    const [slaConfig, officeHoursConfig] = await Promise.all([
      getSLAConfig(),
      getOfficeHoursConfig(),
    ]);

    const metrics = calculateAllSLAMetricsWithBusinessHours(
      {
        openedAt: chat.openedAt,
        firstAgentAssignedAt: chat.agentId ? chat.openedAt : null,
        closedAt: chat.closedAt,
        messages: chat.messages,
      },
      slaConfig,
      officeHoursConfig
    );

    // Update metrics
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        // ... all SLA metrics ...
      },
    });

    await slaLogger.logCalculation(chatId, metrics, 'update');
  }
}
```

#### 3. **On Configuration Change (Batch Trigger)**

When SLA targets or office hours are changed:

```typescript
// After configuration update
async function handleConfigurationChange() {
  // Call recalculate endpoint
  const response = await fetch('/api/sla/recalculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date(),
      limit: 10000,
    }),
  });

  const result = await response.json();
  console.log(`Recalculated ${result.processed} chats`);
}
```

---

## Background Jobs

### Recommended Background Jobs

#### 1. **Nightly SLA Recalculation**

Recalculate SLA metrics for recent chats to ensure consistency:

```typescript
// Example using node-cron or similar
import cron from 'node-cron';

// Run every night at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Starting nightly SLA recalculation...');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const response = await fetch('http://localhost:3000/api/sla/recalculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: yesterday.toISOString(),
      endDate: today.toISOString(),
      limit: 10000,
    }),
  });

  const result = await response.json();
  console.log(`Recalculated ${result.processed} chats, ${result.failed} failed`);
});
```

#### 2. **Log Cleanup**

Clean up old SLA logs (if SLALog model is implemented):

```typescript
// Run weekly to remove logs older than 90 days
cron.schedule('0 3 * * 0', async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const deleted = await prisma.sLALog.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`Deleted ${deleted.count} old SLA logs`);
});
```

---

## Database Setup

### Migration Steps

1. **Apply the migration:**
```bash
cd b2chat-analytics
npx prisma migrate deploy
```

2. **Seed configuration:**
```bash
psql $DATABASE_URL -f prisma/migrations/20251021000001_add_sla_metrics/seed-sla-config.sql
```

3. **Verify schema:**
```sql
-- Check SLA columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'chats'
  AND column_name LIKE '%sla%'
  OR column_name LIKE '%response%'
  OR column_name LIKE '%pickup%';

-- Check configuration
SELECT key, value, category
FROM system_settings
WHERE category IN ('sla', 'office_hours');
```

### Database Indexes

The migration creates 8 indexes for optimal query performance:

```sql
CREATE INDEX "chats_overall_sla_idx" ON "chats"("overall_sla");
CREATE INDEX "chats_agent_id_overall_sla_idx" ON "chats"("agent_id", "overall_sla");
CREATE INDEX "chats_opened_at_overall_sla_idx" ON "chats"("opened_at", "overall_sla");
CREATE INDEX "chats_overall_sla_bh_idx" ON "chats"("overall_sla_bh");
CREATE INDEX "chats_pickup_sla_idx" ON "chats"("pickup_sla");
CREATE INDEX "chats_first_response_sla_idx" ON "chats"("first_response_sla");
CREATE INDEX "chats_resolution_sla_idx" ON "chats"("resolution_sla");
CREATE INDEX "chats_channel_overall_sla_idx" ON "chats"("channel", "overall_sla");
```

---

## API Endpoints

### Available Endpoints

1. **GET /api/sla/metrics** - Get aggregated metrics
2. **GET /api/sla/breaches** - Get paginated breaches
3. **GET /api/sla/config** - Get current configuration
4. **POST /api/sla/config** - Update configuration
5. **POST /api/sla/recalculate** - Batch recalculation

See [TASK_3_SUMMARY.md](TASK_3_SUMMARY.md) for detailed API documentation.

---

## Frontend Integration

### Add to Navigation

Add SLA page to your sidebar navigation:

```typescript
// In your sidebar component
import { AlertCircle } from 'lucide-react';

const navigationItems = [
  // ... existing items ...
  {
    title: 'SLA Compliance',
    href: '/sla',
    icon: AlertCircle,
  },
];
```

### Add Route Protection (if needed)

```typescript
// In your middleware or route guard
const protectedRoutes = [
  '/sla',
  // ... other protected routes
];
```

---

## Performance Optimization

### 1. **Query Optimization**

The API endpoints use:
- Database indexes for fast filtering
- SELECT statements to fetch only needed fields
- Pagination to limit result sets
- Caching headers (5 minutes for metrics)

### 2. **Frontend Optimization**

- React Query for data caching (recommended)
- Debounced filter inputs
- Virtual scrolling for large tables (optional)
- Lazy loading for chart libraries

### 3. **Caching Strategy**

```typescript
// Example using React Query
import { useQuery } from '@tanstack/react-query';

function useSLAMetrics(dateRange: DateRange) {
  return useQuery({
    queryKey: ['sla', 'metrics', dateRange],
    queryFn: () => fetchMetrics(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

---

## Monitoring & Logging

### 1. **SLA Logger Categories**

All SLA operations are logged with these categories:
- `calculation` - SLA calculations
- `breach` - SLA breaches
- `config_change` - Configuration changes
- `business_hours` - Business hours calculations
- `api` - API calls

### 2. **Query SLA Logs**

```typescript
import { slaLogger } from '@/lib/sla/sla-logger';

// Get breach logs
const breachLogs = await slaLogger.queryLogs({
  category: 'breach',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  limit: 100,
});

// Get breach statistics
const stats = await slaLogger.getBreachStats(
  new Date('2025-01-01'),
  new Date('2025-01-31')
);
```

### 3. **Monitoring Metrics**

Key metrics to monitor:
- Average SLA calculation time
- Number of breaches per day
- API response times
- Configuration change frequency
- Recalculation job success rate

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run all migrations
- [ ] Seed SLA configuration
- [ ] Verify database indexes created
- [ ] Test API endpoints
- [ ] Test frontend page loads
- [ ] Configure environment variables

### Environment Variables

```bash
# Add to .env.local or production environment
LOG_LEVEL=info
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://...
```

### Post-Deployment

- [ ] Verify SLA page accessible at /sla
- [ ] Test metrics calculation
- [ ] Test configuration updates
- [ ] Run initial recalculation for existing data
- [ ] Set up background jobs (if using cron)
- [ ] Configure monitoring alerts

### Initial Data Setup

```bash
# Recalculate SLA metrics for all existing chats
curl -X POST http://localhost:3000/api/sla/recalculate \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2024-01-01T00:00:00Z","endDate":"2025-12-31T23:59:59Z","limit":10000}'
```

---

## Configuration Management

### Default Configuration

The system comes with these default values:

**SLA Targets:**
- Pickup: 120 seconds (2 minutes)
- First Response: 300 seconds (5 minutes)
- Avg Response: 300 seconds (5 minutes)
- Resolution: 7200 seconds (2 hours)
- Compliance: 95%

**Office Hours:**
- Start: 09:00
- End: 17:00
- Working Days: [1,2,3,4,5] (Monday-Friday)
- Timezone: America/New_York

### Update Configuration

Via API:
```bash
curl -X POST http://localhost:3000/api/sla/config \
  -H "Content-Type: application/json" \
  -d '{
    "sla": {
      "pickupTarget": 180,
      "complianceTarget": 98
    },
    "officeHours": {
      "start": "08:00",
      "end": "18:00",
      "timezone": "America/Los_Angeles"
    }
  }'
```

Via UI:
- Navigate to Settings page
- Update SLA Settings section
- Changes apply immediately
- Run recalculation if needed

---

## Troubleshooting

### Issue: SLA metrics not calculating

**Solution:**
1. Check if migration was applied
2. Verify configuration exists in system_settings
3. Check logs for calculation errors
4. Ensure chat has required timestamps

### Issue: Breaches not showing

**Solution:**
1. Verify SLA compliance flags are set (not null)
2. Check date range filter
3. Ensure breach type filter not too restrictive
4. Check if chats exist in selected period

### Issue: Performance slow

**Solution:**
1. Verify database indexes exist
2. Check query execution plans
3. Reduce date range
4. Enable API caching
5. Use pagination

---

## Support & Documentation

- [Specification](spec.md) - Full feature specification
- [Technical Spec](sub-specs/technical-spec.md) - Technical details
- [API Spec](sub-specs/api-spec.md) - API documentation
- [Database Schema](sub-specs/database-schema.md) - Schema details
- [Task Summaries](TASK_*_SUMMARY.md) - Implementation details

---

**Integration Status: ✅ READY FOR PRODUCTION**

All components tested and documented for production deployment.
