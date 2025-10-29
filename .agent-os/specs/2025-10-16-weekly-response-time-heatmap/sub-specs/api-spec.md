# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-16-weekly-response-time-heatmap/spec.md

## Endpoints

### GET /api/analytics/weekly-response-times

**Purpose**: Retrieve hourly response time data aggregated across a full week (7 days × 24 hours = 168 data points), with optional agent filtering and integration with existing analytics filters.

**Authentication**: Required (Clerk JWT token)

**Rate Limiting**: None (internal analytics endpoint)

---

#### Request

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `weekStart` | string (ISO date) | **Yes** | Monday date marking the start of the week (YYYY-MM-DD format) | `2025-10-13` |
| `agentId` | string | No | Specific agent ID to filter by, or "all" for aggregate view | `agent_123` or `all` |
| `direction` | string | No | Chat direction filter (same as existing analytics filter) | `incoming`, `outgoing`, `outgoing_broadcast`, `outgoing_all`, `converted`, `all` |
| `officeHoursFilter` | string | No | Office hours filter (same as existing analytics filter) | `office-hours`, `non-office-hours`, `all` |

**Example Requests**:

```bash
# Aggregate view for specific week
GET /api/analytics/weekly-response-times?weekStart=2025-10-13

# Specific agent for specific week
GET /api/analytics/weekly-response-times?weekStart=2025-10-13&agentId=agent_123

# With direction filter (incoming chats only)
GET /api/analytics/weekly-response-times?weekStart=2025-10-13&direction=incoming

# All filters combined
GET /api/analytics/weekly-response-times?weekStart=2025-10-13&agentId=agent_456&direction=incoming&officeHoursFilter=office-hours
```

---

#### Response

**Success Response** (`200 OK`):

```json
{
  "weekStart": "2025-10-13",
  "weekEnd": "2025-10-19",
  "agentId": "agent_123",
  "agentName": "John Doe",
  "filters": {
    "direction": "incoming",
    "officeHours": "all"
  },
  "data": [
    {
      "dayOfWeek": 0,
      "dayName": "Sunday",
      "hour": 0,
      "avg": "3.2m",
      "avgMs": 192000,
      "count": 15
    },
    {
      "dayOfWeek": 0,
      "dayName": "Sunday",
      "hour": 1,
      "avg": "2.8m",
      "avgMs": 168000,
      "count": 12
    },
    // ... 166 more items (one for each hour of each day)
    {
      "dayOfWeek": 6,
      "dayName": "Saturday",
      "hour": 23,
      "avg": "0s",
      "avgMs": 0,
      "count": 0
    }
  ],
  "summary": {
    "totalChats": 2456,
    "overallAvg": "2.8m",
    "overallAvgMs": 168000,
    "fastestHour": {
      "dayOfWeek": 2,
      "hour": 9,
      "avg": "1.2m"
    },
    "slowestHour": {
      "dayOfWeek": 4,
      "hour": 14,
      "avg": "5.7m"
    }
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `weekStart` | string | ISO date of the week's Monday (echoed from request) |
| `weekEnd` | string | ISO date of the week's Sunday (calculated as weekStart + 6 days) |
| `agentId` | string \| null | Agent ID if filtered, null if aggregate "all" view |
| `agentName` | string \| null | Agent's display name if filtered, null if aggregate |
| `filters.direction` | string | Applied direction filter |
| `filters.officeHours` | string | Applied office hours filter |
| `data` | array | Array of 168 objects (7 days × 24 hours) |
| `data[].dayOfWeek` | number | Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) |
| `data[].dayName` | string | Human-readable day name |
| `data[].hour` | number | Hour of day (0-23) |
| `data[].avg` | string | Formatted average response time (e.g., "2.5m", "45s") |
| `data[].avgMs` | number | Raw average response time in milliseconds |
| `data[].count` | number | Number of chats in this time slot (0 if no data) |
| `summary.totalChats` | number | Total chats across entire week |
| `summary.overallAvg` | string | Overall average response time (formatted) |
| `summary.overallAvgMs` | number | Overall average response time (milliseconds) |
| `summary.fastestHour` | object | Best performing hour of the week |
| `summary.slowestHour` | object | Worst performing hour of the week |

**Error Responses**:

| Status | Description | Example Response |
|--------|-------------|------------------|
| `400 Bad Request` | Missing or invalid weekStart parameter | `{"error": "Invalid weekStart parameter. Expected YYYY-MM-DD format."}` |
| `401 Unauthorized` | Missing or invalid authentication token | `{"error": "Unauthorized"}` |
| `404 Not Found` | Specified agent does not exist | `{"error": "Agent not found"}` |
| `500 Internal Server Error` | Database or server error | `{"error": "Failed to fetch weekly response times"}` |

---

## Database Query Strategy

### Query Structure

The endpoint executes a single optimized query that:
1. Filters chats by date range (weekStart to weekStart+7 days)
2. Applies agent filter if specified
3. Applies direction filter if specified
4. Applies office hours filter if specified (using helper function)
5. Groups by day of week and hour
6. Calculates average response time per group
7. Returns 168 rows (fills missing slots with count=0 on backend)

### SQL Query (Conceptual)

```sql
SELECT
  EXTRACT(DOW FROM created_at) AS day_of_week,  -- 0=Sunday, 6=Saturday
  EXTRACT(HOUR FROM created_at) AS hour,         -- 0-23
  AVG(EXTRACT(EPOCH FROM (response_at - opened_at)) * 1000) AS avg_ms,
  COUNT(*) AS count
FROM chats
WHERE
  created_at >= $weekStart
  AND created_at < ($weekStart + INTERVAL '7 days')
  AND opened_at IS NOT NULL
  AND response_at IS NOT NULL
  AND is_deleted = false
  AND ($agentId IS NULL OR agent_id = $agentId)  -- Agent filter
  AND ($direction IS NULL OR direction = $direction)  -- Direction filter
  -- Office hours filter applied via application logic
GROUP BY
  EXTRACT(DOW FROM created_at),
  EXTRACT(HOUR FROM created_at)
ORDER BY
  day_of_week, hour
```

### Prisma Implementation

```typescript
// Pseudo-code for the actual implementation

// 1. Build base where clause
const baseWhere = {
  createdAt: {
    gte: new Date(weekStart),
    lt: addDays(new Date(weekStart), 7)
  },
  openedAt: { not: null },
  responseAt: { not: null },
  isDeleted: false
}

// 2. Add agent filter if specified
if (agentId && agentId !== 'all') {
  baseWhere.agentId = agentId
}

// 3. Add direction filter using existing directionWhere logic
if (directionFilter !== 'all') {
  Object.assign(baseWhere, directionWhere)
}

// 4. Fetch all matching chats
const chats = await prisma.chat.findMany({
  where: baseWhere,
  select: {
    createdAt: true,
    openedAt: true,
    responseAt: true,
    agentId: true
  }
})

// 5. Filter by office hours if needed (application-level)
const filteredChats = officeHoursFilter !== 'all'
  ? chats.filter(chat => isWithinOfficeHours(chat.createdAt, officeHoursConfig))
  : chats

// 6. Group by day of week and hour
const grouped = new Map<string, number[]>()  // key: "dayOfWeek-hour", value: response times

filteredChats.forEach(chat => {
  const dayOfWeek = chat.createdAt.getDay()
  const hour = chat.createdAt.getHours()
  const responseTime = new Date(chat.responseAt).getTime() - new Date(chat.openedAt).getTime()

  const key = `${dayOfWeek}-${hour}`
  if (!grouped.has(key)) {
    grouped.set(key, [])
  }
  grouped.get(key).push(responseTime)
})

// 7. Calculate averages and build 168-item array
const data = []
for (let day = 0; day < 7; day++) {
  for (let hour = 0; hour < 24; hour++) {
    const key = `${day}-${hour}`
    const times = grouped.get(key) || []
    const avgMs = times.length > 0
      ? times.reduce((sum, t) => sum + t, 0) / times.length
      : 0

    data.push({
      dayOfWeek: day,
      dayName: getDayName(day),
      hour: hour,
      avg: formatResponseTime(avgMs),
      avgMs: avgMs,
      count: times.length
    })
  }
}

return data  // 168 items guaranteed
```

### Index Usage

**Existing Indexes Utilized**:
1. `chats_agent_id_status_created_at_idx` - For agent filtering
2. `chats_direction_status_created_at_idx` - For direction filtering
3. Individual indexes on `opened_at`, `response_at`, `created_at`
4. Index on `is_deleted` (implicit from WHERE clause)

**Query Performance**:
- Expected execution time: < 200ms for typical week (< 10K chats)
- Index-only scan possible for date range filtering
- Group-by operation efficient (only 168 buckets)

**Optimization Considerations**:
- If query slow (> 500ms), consider adding composite index:
  ```sql
  CREATE INDEX idx_weekly_heatmap_query
  ON chats(created_at, agent_id, direction, opened_at, response_at)
  WHERE is_deleted = false;
  ```
- Monitor query performance with database slow query logs
- Consider materialized view if dataset grows beyond 1M chats

---

## Data Processing

### Helper Functions

**Format Response Time**:
```typescript
function formatResponseTime(ms: number): string {
  if (ms === 0) return '0s'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}
```

**Get Day Name**:
```typescript
function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayOfWeek]
}
```

**Calculate Week End**:
```typescript
function getWeekEnd(weekStart: string): string {
  const start = new Date(weekStart)
  const end = addDays(start, 6)
  return format(end, 'yyyy-MM-dd')
}
```

### Edge Cases

**No Data Available**:
- If no chats match filters, return 168 items with count=0 and avg="0s"
- Frontend displays all cells as gray "No data"

**Partial Week Data**:
- If week extends into future, future days will have count=0
- If week is in distant past with no data, all cells have count=0

**Agent Without Chats**:
- If agent exists but has no chats in selected week, return 168 items with count=0
- Include agent name in response for UI display

**Invalid Week Start**:
- If weekStart is not a Monday, calculate nearest Monday (round down)
- Or return 400 error if strict validation preferred

**Timezone Handling**:
- All dates stored and calculated in UTC
- Client responsible for timezone display adjustments (if needed)
- createdAt, openedAt, responseAt all in UTC

---

## Integration with Existing Filters

### Direction Filter Integration

Uses identical logic from existing `/api/analytics` route:

```typescript
const directionWhere: any = {}
if (directionFilter === 'incoming') {
  directionWhere.direction = 'incoming'
} else if (directionFilter === 'outgoing') {
  directionWhere.direction = 'outgoing'
} else if (directionFilter === 'outgoing_broadcast') {
  directionWhere.direction = 'outgoing_broadcast'
} else if (directionFilter === 'outgoing_all') {
  directionWhere.direction = { in: ['outgoing', 'outgoing_broadcast'] }
} else if (directionFilter === 'converted') {
  directionWhere.direction = 'incoming'
  directionWhere.originalDirection = { not: 'incoming' }
}
// 'all' = no filter
```

### Office Hours Filter Integration

Uses existing `isWithinOfficeHours()` helper and `loadOfficeHoursConfig()`:

```typescript
const officeHoursConfig = officeHoursFilter !== 'all'
  ? await loadOfficeHoursConfig()
  : null

const filteredChats = officeHoursFilter !== 'all'
  ? chats.filter(chat => {
      const isOfficeHours = isWithinOfficeHours(chat.createdAt, officeHoursConfig)
      return officeHoursFilter === 'office-hours' ? isOfficeHours : !isOfficeHours
    })
  : chats
```

---

## Caching Strategy

**React Query Client-Side Caching**:
- Cache key: `['weekly-response-times', weekStart, agentId, directionFilter, officeHoursFilter]`
- Stale time: 5 minutes (300000ms)
- Cache time: 15 minutes (900000ms)
- Automatically invalidated when filters change

**No Server-Side Caching**:
- Data changes frequently enough that server-side cache not beneficial
- React Query client-side cache sufficient for typical usage patterns
- If needed in future, consider Redis cache with 5-minute TTL

---

## API Response Size

**Typical Response Payload**:
- 168 data objects × ~90 bytes each = ~15KB
- Plus metadata ~1KB
- **Total: ~16KB per response**

**Compression**:
- Vercel automatically applies gzip compression
- Compressed size: ~3-4KB
- Network transfer time: < 100ms on typical broadband

---

## Testing Considerations

**Test Cases**:
1. ✅ Valid week with data returns 168 items
2. ✅ Week with no data returns 168 items with count=0
3. ✅ Agent filter returns only that agent's data
4. ✅ Direction filter correctly filters chats
5. ✅ Office hours filter correctly excludes non-office-hour chats
6. ✅ Combined filters work together
7. ✅ Invalid weekStart returns 400 error
8. ✅ Non-existent agent returns 404 error
9. ✅ Unauthorized request returns 401 error

**Performance Benchmarks**:
- Query execution time: < 200ms (target)
- API response time: < 500ms (target)
- Acceptable under load: < 1 second (P95)
