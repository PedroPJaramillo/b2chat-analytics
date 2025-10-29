# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-16-response-time-drilldown/spec.md

## Technical Requirements

### 1. Heatmap Component Modifications

**File:** `src/components/analytics/weekly-response-time-heatmap.tsx`

**Changes:**
- Add `onClick` handler to heatmap cell div (currently line 258-260)
- Add `cursor-pointer` className to clickable cells (exclude cells with no data)
- Store click context: dayOfWeek, hour, current selectedAgentId, weekStartISO
- Trigger drill-down dialog open with context parameters

**Implementation Pattern:**
```tsx
const handleCellClick = (dayOfWeek: number, hour: number) => {
  if (hourData && hourData.count > 0) {
    setDrillDownContext({
      weekStart: weekStartISO,
      dayOfWeek,
      hour,
      agentId: selectedAgentId,
      directionFilter,
      officeHoursFilter
    })
    setDrillDownOpen(true)
  }
}
```

**State Management:**
- Add `drillDownOpen` boolean state for dialog control
- Add `drillDownContext` state to store click parameters
- Follow existing pattern from ContactHistoryPanel (props-based open/close control)

### 2. Drill-Down Dialog Component

**File:** `src/components/analytics/response-time-drill-down-dialog.tsx` (NEW)

**shadcn/ui Components Required:**
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog`
- `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`
- `Badge` from `@/components/ui/badge`
- `Button` from `@/components/ui/button`
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`
- `ScrollArea` from `@/components/ui/scroll-area`
- `Skeleton` from `@/components/ui/skeleton`

**Component Pattern (Follow ContactHistoryPanel.tsx exactly):**
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useResponseTimeDrilldown } from "@/hooks/use-response-time-drilldown"
import { useRouter } from "next/navigation"

interface ResponseTimeDrillDownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekStart: string
  dayOfWeek: number
  hour: number
  agentId: string
  directionFilter: ChatDirectionFilter
  officeHoursFilter: OfficeHoursFilter
}

export function ResponseTimeDrillDownDialog({
  open,
  onOpenChange,
  weekStart,
  dayOfWeek,
  hour,
  agentId,
  directionFilter,
  officeHoursFilter
}: ResponseTimeDrillDownDialogProps) {
  const router = useRouter()

  const { data, loading, error } = useResponseTimeDrilldown({
    weekStart,
    dayOfWeek,
    hour,
    agentId,
    directionFilter,
    officeHoursFilter
  })

  const handleViewAllChats = () => {
    // Navigate to Chats page with pre-applied filters
    const params = new URLSearchParams({
      startDate: data.timeSlotStart,
      endDate: data.timeSlotEnd,
      sortBy: 'responseTime',
      sortOrder: 'desc'
    })

    if (agentId && agentId !== 'all') {
      params.append('agent', agentId)
    }

    router.push(`/dashboard/chats?${params.toString()}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {data?.dayName} {data?.hourRange} - Response Time Details
          </DialogTitle>
          <DialogDescription>
            Detailed statistics for this time slot
          </DialogDescription>
        </DialogHeader>

        {loading && <Skeleton className="h-64 w-full" />}

        {error && <div className="text-destructive">Error loading data</div>}

        {data && (
          <ScrollArea className="max-h-[calc(90vh-8rem)]">
            {/* Summary Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Chats</div>
                    <div className="text-2xl font-bold">{data.summary.totalChats}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Response Time</div>
                    <div className="text-2xl font-bold">{data.summary.avgResponseTime}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Weekly Comparison</div>
                    <div className="text-2xl font-bold">
                      {data.summary.comparisonToWeekly}
                      <Badge variant={data.summary.performanceIndicator}>
                        {data.summary.performanceLabel}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chat Distribution Card */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Chat Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {data.distribution.map(item => (
                    <div key={item.status} className="flex items-center gap-2">
                      <Badge variant="outline">{item.status}</Badge>
                      <span>{item.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Agent Breakdown Table (conditional - only if not filtered by single agent) */}
            {agentId === 'all' && data.agentBreakdown.length > 1 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Agent Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Chats</TableHead>
                        <TableHead className="text-right">Avg Response Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.agentBreakdown.map(agent => (
                        <TableRow key={agent.agentId}>
                          <TableCell>{agent.agentName}</TableCell>
                          <TableCell className="text-right">{agent.chatCount}</TableCell>
                          <TableCell className="text-right">{agent.avgResponseTime}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Slowest Chats Table */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Slowest Chats</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Response Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slowestChats.map(chat => (
                      <TableRow key={chat.chatId}>
                        <TableCell>{chat.customerName}</TableCell>
                        <TableCell>{chat.agentName || 'Unassigned'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{chat.channel}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{chat.responseTime}</TableCell>
                        <TableCell>
                          <Badge>{chat.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Action Button */}
            <div className="flex justify-end mt-4">
              <Button onClick={handleViewAllChats}>
                View All Chats
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**Key Technical Details:**
- Dialog max width: `max-w-4xl` for adequate space
- ScrollArea for overflow handling
- Skeleton loading state following established pattern
- Error handling with destructive text color
- Badge variants for status indicators
- Table layout for agent breakdown and slowest chats
- Button at bottom for navigation action

### 3. Custom React Query Hook

**File:** `src/hooks/use-response-time-drilldown.ts` (NEW)

**Pattern:** Follow `use-weekly-response-times.ts` exactly

**TypeScript Interfaces:**
```typescript
export interface ResponseTimeDrilldownSummary {
  totalChats: number
  avgResponseTime: string // Formatted: "5.2m", "45s"
  avgResponseTimeMs: number // Raw milliseconds
  comparisonToWeekly: string // "+2.3m" or "-1.5m"
  performanceIndicator: 'default' | 'secondary' | 'destructive'
  performanceLabel: 'Better' | 'Average' | 'Worse'
}

export interface ChatDistribution {
  status: string // 'resolved', 'pending', 'active'
  count: number
}

export interface AgentBreakdown {
  agentId: string
  agentName: string
  chatCount: number
  avgResponseTime: string
  avgResponseTimeMs: number
}

export interface SlowestChat {
  chatId: string
  customerName: string
  agentName: string | null
  channel: string
  responseTime: string
  responseTimeMs: number
  status: string
}

export interface ResponseTimeDrilldownData {
  dayName: string // "Tuesday"
  hourRange: string // "2:00 PM - 3:00 PM"
  timeSlotStart: string // ISO datetime for navigation
  timeSlotEnd: string // ISO datetime for navigation
  summary: ResponseTimeDrilldownSummary
  distribution: ChatDistribution[]
  agentBreakdown: AgentBreakdown[]
  slowestChats: SlowestChat[] // Top 10
}

export interface UseResponseTimeDrilldownParams {
  weekStart: string // ISO date
  dayOfWeek: number // 0-6
  hour: number // 0-23
  agentId?: string
  directionFilter?: ChatDirectionFilter
  officeHoursFilter?: OfficeHoursFilter
}
```

**React Query Hook:**
```typescript
async function fetchResponseTimeDrilldown(
  params: UseResponseTimeDrilldownParams
): Promise<ResponseTimeDrilldownData> {
  const searchParams = new URLSearchParams()

  searchParams.append('weekStart', params.weekStart)
  searchParams.append('dayOfWeek', params.dayOfWeek.toString())
  searchParams.append('hour', params.hour.toString())

  if (params.agentId && params.agentId !== 'all') {
    searchParams.append('agentId', params.agentId)
  }

  if (params.directionFilter && params.directionFilter !== 'all') {
    searchParams.append('direction', params.directionFilter)
  }

  if (params.officeHoursFilter && params.officeHoursFilter !== 'all') {
    searchParams.append('officeHoursFilter', params.officeHoursFilter)
  }

  const response = await fetch(
    `/api/analytics/response-time-drilldown?${searchParams.toString()}`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch drill-down data')
  }

  return response.json()
}

export function useResponseTimeDrilldown(params: UseResponseTimeDrilldownParams) {
  const {
    weekStart,
    dayOfWeek,
    hour,
    agentId = 'all',
    directionFilter = 'all',
    officeHoursFilter = 'all'
  } = params

  const { data = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['response-time-drilldown', weekStart, dayOfWeek, hour, agentId, directionFilter, officeHoursFilter],
    queryFn: () => fetchResponseTimeDrilldown({
      weekStart,
      dayOfWeek,
      hour,
      agentId,
      directionFilter,
      officeHoursFilter
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    enabled: open // Only fetch when dialog is open
  })

  return {
    data,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  }
}
```

### 4. Navigation to Chat Management Page

**File:** `src/app/dashboard/chats/page.tsx` (MODIFICATION)

**Changes Required:**
- Add URL parameter reading for `startDate` and `endDate` (custom date range)
- Extend `ChatFilters` type to support custom date range (not just presets)
- Add support for `sortBy=responseTime` and `sortOrder=desc` URL parameters

**Implementation:**
```typescript
// In ChatsPage component, read URL search params on mount
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search)

  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const agent = searchParams.get('agent')
  const sortBy = searchParams.get('sortBy') as SortBy | null
  const sortOrder = searchParams.get('sortOrder') as SortOrder | null

  if (startDate && endDate) {
    setFilter('dateRange', 'custom')
    setFilter('customDateRange', { start: startDate, end: endDate })
  }

  if (agent) {
    setFilter('agent', agent)
  }

  if (sortBy) {
    setFilter('sortBy', sortBy)
  }

  if (sortOrder) {
    setFilter('sortOrder', sortOrder)
  }
}, [])
```

### 5. Type System Extensions

**File:** `src/types/filters.ts` (MODIFICATION)

**Changes:**
- Add `'responseTime'` to `SortBy` type union
- Add `customDateRange?: { start: string; end: string }` to `ChatFilters` interface

```typescript
export type SortBy = 'lastActivity' | 'priority' | 'messageCount' | 'responseTime'

export interface ChatFilters {
  // ... existing fields
  customDateRange?: {
    start: string // ISO datetime
    end: string // ISO datetime
  }
}
```

### 6. Performance Considerations

**Database Query Optimization:**
- Use indexed timestamp fields (`responseAt`, `createdAt`)
- Limit slowest chats to top 10 for performance
- Use Prisma's `select` to fetch only required fields
- Add `where` clause for time range to leverage indexes

**React Query Caching:**
- 5-minute stale time prevents excessive re-fetching
- 15-minute garbage collection time
- `enabled: open` ensures no fetch until dialog opens
- QueryKey includes all filter parameters for proper cache invalidation

**UI Performance:**
- ScrollArea component prevents layout shift
- Skeleton loading state prevents cumulative layout shift (CLS)
- Conditional rendering of agent breakdown (only when needed)

### 7. Error Handling

**API Error Scenarios:**
- Invalid date parameters → 400 Bad Request
- No data found → Return empty arrays with 200 OK
- Database connection errors → 500 Internal Server Error
- Missing required parameters → 400 Bad Request with descriptive message

**UI Error Display:**
- Use destructive text color for errors
- Provide "Retry" button triggering `refetch()`
- Show user-friendly error messages (not technical stack traces)

### 8. Accessibility Requirements

**Dialog Accessibility:**
- Proper ARIA labels on Dialog components
- Focus trap within dialog when open
- ESC key closes dialog
- Click outside closes dialog
- Keyboard navigation through interactive elements

**Table Accessibility:**
- Semantic table markup with TableHeader and TableBody
- Screen reader friendly column headers
- Row selection with keyboard navigation

## No External Dependencies

This feature uses only existing dependencies already in the tech stack:
- shadcn/ui components (already installed)
- TanStack Query v5 (already installed)
- Next.js routing (core framework)
- date-fns (already installed for date formatting)
- Prisma (already installed for database queries)

No new packages need to be installed.
