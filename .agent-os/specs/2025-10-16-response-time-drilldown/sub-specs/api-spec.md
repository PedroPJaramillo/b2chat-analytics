# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-16-response-time-drilldown/spec.md

## Endpoints

### GET /api/analytics/response-time-drilldown

**Purpose:** Fetch detailed statistics and chat information for a specific time slot (day + hour combination) from the weekly response time heatmap.

**Route File:** `src/app/api/analytics/response-time-drilldown/route.ts`

**Authentication:** Required (Clerk authentication via middleware)

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `weekStart` | string | Yes | ISO date string representing the Monday of the week | `2025-10-13` |
| `dayOfWeek` | number | Yes | Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) | `2` (Tuesday) |
| `hour` | number | Yes | Hour of day in 24-hour format (0-23) | `14` (2 PM) |
| `agentId` | string | No | Specific agent ID to filter by (omit or "all" for all agents) | `agent_abc123` |
| `direction` | string | No | Chat direction filter: 'incoming' \| 'outgoing' \| 'outgoing_broadcast' \| 'all' | `incoming` |
| `officeHoursFilter` | string | No | Office hours filter: 'office' \| 'after' \| 'all' | `office` |

**Success Response (200 OK):**

```json
{
  "dayName": "Tuesday",
  "hourRange": "2:00 PM - 3:00 PM",
  "timeSlotStart": "2025-10-15T14:00:00.000Z",
  "timeSlotEnd": "2025-10-15T15:00:00.000Z",
  "summary": {
    "totalChats": 15,
    "avgResponseTime": "8.5m",
    "avgResponseTimeMs": 510000,
    "comparisonToWeekly": "+5.3m",
    "performanceIndicator": "destructive",
    "performanceLabel": "Worse"
  },
  "distribution": [
    {
      "status": "resolved",
      "count": 8
    },
    {
      "status": "pending",
      "count": 5
    },
    {
      "status": "active",
      "count": 2
    }
  ],
  "agentBreakdown": [
    {
      "agentId": "agent_carlos123",
      "agentName": "Carlos Rivera",
      "chatCount": 8,
      "avgResponseTime": "12.0m",
      "avgResponseTimeMs": 720000
    },
    {
      "agentId": "agent_maria456",
      "agentName": "Maria Santos",
      "chatCount": 7,
      "avgResponseTime": "4.5m",
      "avgResponseTimeMs": 270000
    }
  ],
  "slowestChats": [
    {
      "chatId": "chat_xyz789",
      "customerName": "Juan Pérez",
      "agentName": "Carlos Rivera",
      "channel": "whatsapp",
      "responseTime": "18.2m",
      "responseTimeMs": 1092000,
      "status": "resolved"
    },
    {
      "chatId": "chat_abc456",
      "customerName": "Ana García",
      "agentName": "Carlos Rivera",
      "channel": "webchat",
      "responseTime": "15.7m",
      "responseTimeMs": 942000,
      "status": "pending"
    }
    // ... up to 10 total
  ]
}
```

**Error Responses:**

**400 Bad Request** - Invalid or missing required parameters
```json
{
  "error": "Missing required parameter: weekStart"
}
```

```json
{
  "error": "Invalid dayOfWeek: must be 0-6"
}
```

```json
{
  "error": "Invalid hour: must be 0-23"
}
```

**401 Unauthorized** - User not authenticated
```json
{
  "error": "Unauthorized"
}
```

**500 Internal Server Error** - Server-side error
```json
{
  "error": "Failed to fetch drill-down data"
}
```

## Business Logic

### Time Slot Calculation

The time slot is calculated as follows:

1. **Start Time:** Combine `weekStart` + `dayOfWeek` + `hour` to get the exact start datetime
   - Example: `weekStart="2025-10-13"`, `dayOfWeek=2`, `hour=14`
   - Result: `2025-10-15T14:00:00.000Z` (Tuesday 2 PM)

2. **End Time:** Add 1 hour to start time
   - Result: `2025-10-15T15:00:00.000Z` (Tuesday 3 PM)

3. **Chat Filtering:** Select chats where `responseAt` (first agent response timestamp) falls within this time range

### Weekly Average Calculation

To compute the "comparison to weekly average":

1. Calculate overall weekly average response time for the same filters (agent, direction, office hours)
2. Subtract weekly average from time slot average
3. Format the difference: `+5.3m` (worse) or `-2.1m` (better)
4. Set performance indicator:
   - `'default'` if within ±20% of weekly average → Label: "Average"
   - `'secondary'` if better than weekly average by >20% → Label: "Better"
   - `'destructive'` if worse than weekly average by >20% → Label: "Worse"

### Agent Breakdown Logic

- If `agentId` parameter is provided and not "all", return single-item array with just that agent's stats
- If `agentId` is "all" or omitted, return breakdown for all agents who handled chats in this time slot
- Order by `chatCount` descending (busiest agents first)
- Include only agents with at least 1 chat in the time slot

### Slowest Chats Selection

- Order chats by `responseTimeMs` descending (slowest first)
- Limit to top 10 slowest chats
- Include chat ID, customer name, agent name (null if unassigned), channel, response time (formatted and raw ms), and status
- Use Prisma `select` to fetch only required fields for performance

## Database Query Pattern

### Prisma Query Structure

```typescript
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'
import { addDays, addHours } from 'date-fns'

export async function GET(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart')
  const dayOfWeekStr = searchParams.get('dayOfWeek')
  const hourStr = searchParams.get('hour')
  const agentId = searchParams.get('agentId')
  const direction = searchParams.get('direction')
  const officeHoursFilter = searchParams.get('officeHoursFilter')

  // Validate required parameters
  if (!weekStart || !dayOfWeekStr || !hourStr) {
    return Response.json(
      { error: 'Missing required parameters: weekStart, dayOfWeek, hour' },
      { status: 400 }
    )
  }

  const dayOfWeek = parseInt(dayOfWeekStr)
  const hour = parseInt(hourStr)

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return Response.json(
      { error: 'Invalid dayOfWeek: must be 0-6' },
      { status: 400 }
    )
  }

  if (hour < 0 || hour > 23) {
    return Response.json(
      { error: 'Invalid hour: must be 0-23' },
      { status: 400 }
    )
  }

  // Calculate time slot boundaries
  const timeSlotStart = new Date(weekStart)
  timeSlotStart.setDate(timeSlotStart.getDate() + dayOfWeek)
  timeSlotStart.setHours(hour, 0, 0, 0)

  const timeSlotEnd = addHours(timeSlotStart, 1)

  // Build where clause
  const where = {
    responseAt: {
      gte: timeSlotStart,
      lt: timeSlotEnd
    },
    isDeleted: false
  }

  // Add optional filters
  if (agentId && agentId !== 'all') {
    where.agentId = agentId
  }

  if (direction && direction !== 'all') {
    where.direction = direction
  }

  if (officeHoursFilter && officeHoursFilter !== 'all') {
    // Apply office hours filtering logic (similar to weekly-response-times endpoint)
  }

  // Fetch chats for this time slot
  const chats = await prisma.chat.findMany({
    where,
    select: {
      id: true,
      customer: true,
      agentId: true,
      agent: true,
      provider: true,
      status: true,
      responseAt: true,
      createdAt: true
    },
    orderBy: {
      responseAt: 'desc'
    }
  })

  // Calculate response times
  const chatsWithResponseTime = chats
    .filter(chat => chat.responseAt && chat.createdAt)
    .map(chat => ({
      ...chat,
      responseTimeMs: chat.responseAt!.getTime() - chat.createdAt.getTime()
    }))
    .sort((a, b) => b.responseTimeMs - a.responseTimeMs)

  // Calculate summary statistics
  const totalChats = chatsWithResponseTime.length
  const avgResponseTimeMs = totalChats > 0
    ? chatsWithResponseTime.reduce((sum, chat) => sum + chat.responseTimeMs, 0) / totalChats
    : 0

  // Fetch weekly average for comparison
  const weekEnd = addDays(new Date(weekStart), 7)
  const weeklyChats = await prisma.chat.findMany({
    where: {
      responseAt: {
        gte: new Date(weekStart),
        lt: weekEnd
      },
      isDeleted: false,
      // Apply same filters as time slot
    },
    select: {
      responseAt: true,
      createdAt: true
    }
  })

  const weeklyAvgMs = weeklyChats.length > 0
    ? weeklyChats.reduce((sum, chat) => {
        return sum + (chat.responseAt!.getTime() - chat.createdAt.getTime())
      }, 0) / weeklyChats.length
    : 0

  // Calculate comparison
  const diffMs = avgResponseTimeMs - weeklyAvgMs
  const comparisonToWeekly = formatTimeDiff(diffMs)

  // Determine performance indicator
  const threshold = weeklyAvgMs * 0.2
  let performanceIndicator = 'default'
  let performanceLabel = 'Average'

  if (diffMs < -threshold) {
    performanceIndicator = 'secondary'
    performanceLabel = 'Better'
  } else if (diffMs > threshold) {
    performanceIndicator = 'destructive'
    performanceLabel = 'Worse'
  }

  // Calculate distribution by status
  const distribution = {}
  chatsWithResponseTime.forEach(chat => {
    distribution[chat.status] = (distribution[chat.status] || 0) + 1
  })

  // Calculate agent breakdown
  const agentStats = {}
  chatsWithResponseTime.forEach(chat => {
    if (!agentStats[chat.agentId]) {
      agentStats[chat.agentId] = {
        agentId: chat.agentId,
        agentName: chat.agent,
        chatCount: 0,
        totalResponseTimeMs: 0
      }
    }
    agentStats[chat.agentId].chatCount++
    agentStats[chat.agentId].totalResponseTimeMs += chat.responseTimeMs
  })

  const agentBreakdown = Object.values(agentStats)
    .map(agent => ({
      ...agent,
      avgResponseTime: formatTime(agent.totalResponseTimeMs / agent.chatCount),
      avgResponseTimeMs: agent.totalResponseTimeMs / agent.chatCount
    }))
    .sort((a, b) => b.chatCount - a.chatCount)

  // Get top 10 slowest chats
  const slowestChats = chatsWithResponseTime.slice(0, 10).map(chat => ({
    chatId: chat.id,
    customerName: chat.customer,
    agentName: chat.agent,
    channel: chat.provider,
    responseTime: formatTime(chat.responseTimeMs),
    responseTimeMs: chat.responseTimeMs,
    status: chat.status
  }))

  // Format response
  const response = {
    dayName: getDayName(dayOfWeek),
    hourRange: getHourRange(hour),
    timeSlotStart: timeSlotStart.toISOString(),
    timeSlotEnd: timeSlotEnd.toISOString(),
    summary: {
      totalChats,
      avgResponseTime: formatTime(avgResponseTimeMs),
      avgResponseTimeMs,
      comparisonToWeekly,
      performanceIndicator,
      performanceLabel
    },
    distribution: Object.entries(distribution).map(([status, count]) => ({
      status,
      count
    })),
    agentBreakdown,
    slowestChats
  }

  return Response.json(response)
}

// Helper functions
function formatTime(ms: number): string {
  // Implementation from weekly-response-times endpoint
  // Returns "5.2m", "45s", "1.2h", etc.
}

function formatTimeDiff(ms: number): string {
  const formatted = formatTime(Math.abs(ms))
  return ms >= 0 ? `+${formatted}` : `-${formatted}`
}

function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayOfWeek]
}

function getHourRange(hour: number): string {
  const start = formatHour(hour)
  const end = formatHour((hour + 1) % 24)
  return `${start} - ${end}`
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
}
```

## Performance Optimizations

1. **Database Indexes:** Ensure `responseAt` and `createdAt` are indexed (already indexed in current schema)

2. **Field Selection:** Use Prisma `select` to fetch only required fields, avoiding unnecessary data transfer

3. **Query Limit:** Limit slowest chats to 10 to prevent large payloads

4. **Parallel Queries:** If possible, run time slot query and weekly average query in parallel using `Promise.all()`

5. **Caching:** React Query will cache results on client side for 5 minutes

## Testing Considerations

**Unit Tests:**
- Test parameter validation (missing/invalid parameters)
- Test time slot calculation (edge cases: midnight, end of week)
- Test response time calculation
- Test weekly average comparison logic
- Test performance indicator assignment

**Integration Tests:**
- Test with real database queries
- Test with various filter combinations
- Test with empty results (no chats in time slot)
- Test with single agent vs. multiple agents

**Edge Cases:**
- Time slot with zero chats → Return empty arrays, zero totals
- Week with no data → Weekly average should be 0, comparison should handle division by zero
- Single chat in time slot → Agent breakdown should have single entry
- Unassigned chats → Agent name should be null, handle gracefully in UI
