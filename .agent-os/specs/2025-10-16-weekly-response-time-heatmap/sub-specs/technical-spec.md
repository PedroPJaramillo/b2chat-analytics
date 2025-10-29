# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-16-weekly-response-time-heatmap/spec.md

## Component Architecture

### Existing Component Enhancement

**Component to Modify**: `src/components/analytics/response-time-heatmap.tsx`

The existing `ResponseTimeHeatmap` component currently displays a single-day 24-hour heatmap (2 rows of 12 hours each). We will enhance this component to support a "weekly mode" that displays 7 rows (one per day) with 24 columns each.

**Design Approach**: Add a `mode` prop: `'daily' | 'weekly'` (default: `'weekly'`)
- Daily mode: Existing behavior (2 rows × 12 cols = 24 cells)
- Weekly mode: New behavior (7 rows × 24 cols = 168 cells)

### New UI Controls

**Week Picker Control**:
- Use existing `react-day-picker` from shadcn/ui Calendar component
- Configure to select week start dates (Mondays)
- Display selected week range: "Oct 13 - Oct 19, 2025"
- Previous/Next week arrow buttons for quick navigation
- Placement: Top of heatmap card, above the grid

**Agent Selector Dropdown**:
- Use existing `Select` component from shadcn/ui
- Options: "All Agents" (default) + list of active agents
- Sort agents alphabetically by name
- Show agent's full name in dropdown
- Placement: Next to week picker (top-right of card header)
- State management: Local useState, passed to API via query params

### Grid Layout Structure

**Weekly Grid**:
```
         12A  1A  2A  ... 11P  (24 columns)
Sun      [cell][cell]...[cell]
Mon      [cell][cell]...[cell]
Tue      [cell][cell]...[cell]
Wed      [cell][cell]...[cell]
Thu      [cell][cell]...[cell]
Fri      [cell][cell]...[cell]
Sat      [cell][cell]...[cell]
(7 rows)
```

**Responsive Design**:
- Desktop (≥1280px): Full 7×24 grid with 40px cells
- Tablet (768-1279px): Full grid with 32px cells, horizontal scroll if needed
- Mobile (<768px): Out of scope (requires desktop/tablet)

### Data Structure

**Input Interface**:
```typescript
interface WeeklyHourlyData {
  dayOfWeek: number     // 0=Sunday, 1=Monday, ..., 6=Saturday (JS Date.getDay() standard)
  dayName: string       // "Sunday", "Monday", etc. (for tooltip display)
  hour: number          // 0-23 (24-hour format)
  avg: string           // Formatted time: "2.5m", "45s", "1.2h"
  avgMs: number         // Raw milliseconds for calculations
  count: number         // Number of chats in this time slot
}[]
```

**Expected Array Length**: 168 items (7 days × 24 hours)
- API must return all 168 slots, even if count=0 (fill missing with avg="0s", count=0)
- Frontend filters count=0 slots and displays as gray "No data" cells

### UI/UX Specifications

**Week Picker**:
- Label: "Week:"
- Format: "Oct 13 - Oct 19, 2025" (start date - end date)
- Previous week button: `<` icon (ChevronLeft from lucide-react)
- Next week button: `>` icon (ChevronRight from lucide-react)
- Date picker popup: Full calendar with week highlighting
- Default selection: Current week (most recent Monday-Sunday)

**Agent Dropdown**:
- Label: "Agent:"
- Default option: "All Agents" (aggregate view)
- Agent options: Formatted as "John Doe" (agent.name)
- Empty state: If no agents in system, show "No agents available"
- Loading state: Show "Loading agents..." while fetching

**Day Labels**:
- Position: Left side of grid (Y-axis)
- Labels: "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
- Font: text-sm font-medium text-muted-foreground
- Alignment: Right-aligned, vertically centered with row

**Hour Labels**:
- Position: Top of grid (X-axis)
- Labels: "12A", "1A", "2A", ..., "11A", "12P", "1P", ..., "11P"
- Font: text-xs text-muted-foreground
- Alignment: Center-aligned with column

**Heatmap Cells**:
- Size: 40px × 40px minimum (touch target size for accessibility)
- Border-radius: 4px (rounded corners)
- Gap between cells: 2px
- Cursor: pointer (shows clickable affordance)
- Transition: all 150ms ease-in-out (smooth hover effect)

**Color Scale** (matches existing implementation):
- **Green** (`bg-green-200 hover:bg-green-300`): Fast responses (normalized < 0.33)
- **Yellow** (`bg-yellow-200 hover:bg-yellow-300`): Average responses (normalized 0.33-0.66)
- **Red** (`bg-red-200 hover:bg-red-300`): Slow responses (normalized > 0.66)
- **Gray** (`bg-gray-100`): No data (count === 0)

**Color Normalization**:
```typescript
// Find min/max across all 168 cells (excluding empty cells)
const times = data.filter(d => d.count > 0).map(d => d.avgMs)
const maxTime = Math.max(...times)
const minTime = Math.min(...times)

// Normalize each cell
const normalized = (cell.avgMs - minTime) / (maxTime - minTime)

// Apply color thresholds
if (normalized < 0.33) return 'green'
if (normalized < 0.66) return 'yellow'
return 'red'
```

**Tooltip Content**:
- **With data**:
  ```
  Monday 3PM
  Avg: 2.5m
  Chats: 42
  ```
- **No data**:
  ```
  Tuesday 11AM
  No data available
  ```
- Use shadcn/ui Tooltip component (existing pattern)
- Trigger: onMouseEnter (hover)
- Delay: 200ms (TooltipProvider delayDuration={200})

**Legend**:
- Position: Bottom of heatmap card
- Items: Fast (green), Average (yellow), Slow (red), No data (gray)
- Format: Color box (16×16px) + label
- Alignment: Center-aligned horizontally

### State Management

**Component State**:
```typescript
const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(getMostRecentMonday())
const [selectedAgentId, setSelectedAgentId] = useState<string>('all')
```

**Data Fetching**:
```typescript
// Use existing useAnalyticsData pattern
const { data, loading, error } = useWeeklyResponseTimes({
  weekStart: format(selectedWeekStart, 'yyyy-MM-dd'),
  agentId: selectedAgentId,
  directionFilter,  // Passed from parent analytics page
  officeHoursFilter // Passed from parent analytics page
})
```

**React Query Configuration**:
- staleTime: 5 minutes (300000ms)
- cacheTime: 15 minutes (900000ms)
- refetchOnWindowFocus: true
- retry: 2

### Helper Functions

**Week Calculation**:
```typescript
function getMostRecentMonday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = (dayOfWeek + 6) % 7 // Days since last Monday
  const monday = subDays(today, daysFromMonday)
  return startOfDay(monday)
}

function getWeekEnd(weekStart: Date): Date {
  return addDays(weekStart, 6) // Sunday (6 days after Monday)
}
```

**Navigation Handlers**:
```typescript
function handlePreviousWeek() {
  setSelectedWeekStart(prev => subDays(prev, 7))
}

function handleNextWeek() {
  setSelectedWeekStart(prev => addDays(prev, 7))
}

function handleWeekSelect(date: Date) {
  const monday = getMondayOfWeek(date)
  setSelectedWeekStart(monday)
}
```

### Performance Considerations

**Rendering Optimization**:
- Use `React.memo()` for individual cell components to prevent unnecessary re-renders
- Memoize color calculations with `useMemo()` based on data array
- Debounce agent dropdown selection (150ms) to avoid rapid API calls
- No virtualization needed (only 168 cells, well within React's capability)

**Data Loading**:
- Show loading skeleton during initial fetch
- Show previous data while fetching new week (optimistic UI)
- Cache API responses per week/agent combination (React Query handles this)
- Prefetch adjacent weeks on hover of nav buttons (optional enhancement)

**Database Query Efficiency**:
- Single database query returns all 168 data points
- Query uses existing indexes on agentId, createdAt, responseAt
- Response payload size: ~15KB (168 objects × ~90 bytes each)
- API response time target: < 500ms

### Accessibility

**Keyboard Navigation**:
- Week picker: Tab to focus, Enter/Space to open calendar
- Agent dropdown: Tab to focus, Arrow keys to navigate, Enter to select
- Heatmap cells: Not keyboard-focusable (informational display only)

**Screen Reader Support**:
- Week picker: aria-label="Select week"
- Agent dropdown: aria-label="Filter by agent"
- Heatmap: aria-label="Weekly response time heatmap showing 7 days by 24 hours"
- Each cell: aria-label via tooltip content

**Color Blindness**:
- Use patterns in addition to colors (optional future enhancement)
- Ensure sufficient contrast ratios for all color combinations
- Tooltip provides exact values (not color-dependent)

### Integration Points

**Analytics Page Integration**:
```typescript
// In src/app/dashboard/analytics/page.tsx
// Response Times tab

<TabsContent value="response-times" className="space-y-4">
  {/* Replace existing ResponseTimeHeatmap */}
  <WeeklyResponseTimeHeatmap
    directionFilter={directionFilter}  // From page state
    officeHoursFilter={officeHoursFilter}  // From page state
  />

  {/* Keep other components */}
  <ResponseTimeCard ... />
  <ChannelBreakdownChart ... />
</TabsContent>
```

**Shared State from Parent**:
- `directionFilter`: ChatDirectionFilter ('all' | 'incoming' | 'outgoing' | etc.)
- `officeHoursFilter`: OfficeHoursFilter ('all' | 'office-hours' | 'non-office-hours')

Both filters automatically apply to the weekly heatmap API query.

### Error Handling

**API Error States**:
- Network error: Show Alert with "Unable to load weekly data. Please try again."
- No data available: Show empty heatmap with all gray cells
- Invalid week selection: Default to current week, show toast warning

**Loading States**:
- Initial load: Full skeleton (7 rows × 24 columns of skeleton cells)
- Week change: Dim current heatmap + spinner overlay
- Agent change: Dim current heatmap + spinner overlay

**Validation**:
- Prevent selecting weeks in the future (disable next button if at current week)
- Validate agent exists before making API call
- Handle timezone differences (use UTC for date calculations)

## External Dependencies

**None required** - All dependencies already exist in the project:
- ✅ `react-day-picker` - For week picker calendar (via shadcn/ui)
- ✅ `date-fns` - For date manipulation (addDays, subDays, format, startOfDay)
- ✅ `@radix-ui/react-select` - For agent dropdown (via shadcn/ui)
- ✅ `@radix-ui/react-tooltip` - For cell tooltips (via shadcn/ui)
- ✅ `@tanstack/react-query` - For data fetching and caching
- ✅ `lucide-react` - For icons (ChevronLeft, ChevronRight)
- ✅ Tailwind CSS - For styling
- ✅ TypeScript - For type safety

All components and utilities needed are already installed and configured in the project.
