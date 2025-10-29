# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-21-sla-compliance-page/spec.md

> Created: 2025-10-21
> Version: 1.0.0

## Technical Requirements

### Page Structure & Routing

- **Route:** `/sla-compliance`
- **Framework:** Next.js 15 App Router page component
- **File location:** `app/sla-compliance/page.tsx`
- **Layout:** Uses main app layout with sidebar navigation
- **Authentication:** Protected route requiring Clerk authentication

### Data Requirements & Calculations

#### Core SLA Metrics (Pre-computed on Import)

All SLA calculations should be pre-computed when chat data is imported and stored in the database for performance:

**1. Pickup Time SLA**
- Calculation: `picked_up_at - opened_at`
- Target: ≤ 120 seconds (2 minutes)
- Stored fields: `timeToPickup` (seconds), `pickupSLA` (boolean)
- Fail conditions: `picked_up_at === null` OR `timeToPickup > 120`

**2. First Response Time SLA**
- Calculation: `first_human_agent_message.created_at - opened_at`
- Target: ≤ 300 seconds (5 minutes)
- Stored fields: `firstResponseTime` (seconds), `firstResponseSLA` (boolean)
- Message classification logic:
  - Human agent message: `incoming === false` AND `broadcasted === false` AND `chat.picked_up_at !== null`
- Fail conditions: No human agent message exists OR `firstResponseTime > 300`

**3. Average Response Time SLA**
- Calculation: Average of all `(agent_message_time - previous_customer_message_time)`
- Target: ≤ 300 seconds (5 minutes)
- Stored fields: `avgResponseTime` (seconds), `avgResponseSLA` (boolean)
- Exclude response times > 3600 seconds (1 hour) from average calculation
- Fail conditions: No responses to calculate OR `avgResponseTime > 300`

**4. Resolution Time SLA**
- Calculation: `closed_at - opened_at`
- Target: ≤ 7200 seconds (2 hours)
- Stored fields: `resolutionTime` (seconds), `resolutionSLA` (boolean)
- Special case: If `closed_at === null` (chat still open), mark as N/A (not fail)
- Fail conditions: Chat is closed AND `resolutionTime > 7200`

**5. Overall Compliance**
- Calculation: `pickupSLA === true AND firstResponseSLA === true AND avgResponseSLA === true AND (resolutionSLA === true OR closed_at === null)`
- Stored field: `overallSLA` (boolean)
- A chat passes overall SLA only if it passes ALL applicable metrics

#### Business Hours Calculation

- **Toggle state:** Stored in local component state (default: ON)
- **Recalculation:** When toggled, metrics must be recalculated client-side
- **Office hours config:** Retrieved from settings/configuration (e.g., Mon-Fri 9am-5pm)
- **Algorithm:** For each time span calculation:
  - If business hours mode OFF: Use wall clock time (simple subtraction)
  - If business hours mode ON: Only count minutes falling within configured office hours
  - Example: Chat opened Friday 5pm, closed Monday 9am
    - Wall clock: ~64 hours
    - Business hours (9-5 M-F): ~2 hours

### UI Components & Libraries

#### shadcn/ui Components Required

- **Card** - Metric cards, section containers
- **Table** - SLA breaches table with sortable columns
- **Badge** - Status indicators (Pass/Fail), breach detail pills
- **Button** - Export CSV, filter actions
- **Toggle** - Business hours switch
- **Tooltip** - Metric explanations and help text
- **Skeleton** - Loading states for async data
- **Alert** - Error messages and notifications

#### Chart Components (Recharts)

- **BarChart** (horizontal orientation) - Agent performance comparison
- **LineChart** with Area fill - Daily compliance trend
- Configuration:
  - Responsive container (100% width)
  - Custom colors matching brand theme
  - Interactive tooltips
  - Legend with toggle capability
  - Accessibility labels

#### Icons (lucide-react)

- `Clock` - Pickup SLA metric card
- `MessageSquare` - First Response SLA metric card
- `TrendingUp` - Avg Response SLA metric card
- `CheckCircle` - Resolution SLA metric card, success states
- `AlertCircle` - Breach indicators, warnings
- `ChevronRight` / `ChevronDown` - Table row expand/collapse
- `User` - Customer message bubbles
- `Users` - Agent message bubbles
- `Bot` - Bot message bubbles
- `Download` - CSV export button

### State Management

#### Global State (Zustand Store)

```typescript
interface SLAStore {
  // Imported chat data with pre-calculated SLA metrics
  chats: Chat[];

  // Active filters
  filters: {
    dateRange: { start: Date; end: Date };
    agentIds: string[];
    statuses: ChatStatus[];
  };

  // Configuration
  officeHours: OfficeHoursConfig;
  slaTargets: SLATargetsConfig;

  // Actions
  setFilters: (filters: Partial<Filters>) => void;
  clearFilters: () => void;
}
```

#### Local Component State

```typescript
interface SLAPageState {
  // Business hours toggle
  useBusinessHours: boolean;

  // Table state
  expandedRows: Set<string>; // Chat IDs
  sortColumn: SortableColumn;
  sortDirection: 'asc' | 'desc';
  currentPage: number;

  // Loading states
  isRecalculating: boolean;
  isExporting: boolean;
}
```

#### Derived/Computed Values (useMemo)

All metrics should be memoized to prevent unnecessary recalculation:

```typescript
const metrics = useMemo(() => ({
  pickupCompliance: calculateCompliance(filteredChats, 'pickupSLA'),
  firstResponseCompliance: calculateCompliance(filteredChats, 'firstResponseSLA'),
  avgResponseCompliance: calculateCompliance(filteredChats, 'avgResponseSLA'),
  resolutionCompliance: calculateCompliance(filteredChats, 'resolutionSLA'),
  overallCompliance: calculateCompliance(filteredChats, 'overallSLA'),
}), [filteredChats, useBusinessHours]);
```

### Page Layout & Sections

#### Section 1: SLA Metric Cards (Grid Layout)

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <MetricCard
    icon={Clock}
    title="Pickup SLA"
    percentage={87}
    target="< 2 minutes"
    withinSLA={143}
    breached={21}
    color="blue"
  />
  {/* Repeat for other 3 metrics */}
</div>
```

**MetricCard Component Requirements:**
- Display large percentage (48px font size)
- Color-coded icon (blue/green/purple/orange)
- Small gray target text below percentage
- Green text for "Within SLA" count with checkmark icon
- Red text for "Breached" count with X icon
- Hover effect: subtle shadow increase

#### Section 2: Overall Compliance Card

```tsx
<Card className={cn(
  "w-full p-6",
  overallCompliance >= 95 ? "bg-green-50 border-green-200" :
  overallCompliance >= 80 ? "bg-amber-50 border-amber-200" :
  "bg-red-50 border-red-200"
)}>
  <div className="text-center">
    <h2 className="text-7xl font-bold">{overallCompliance}%</h2>
    <div className="grid grid-cols-4 gap-4 mt-6">
      {/* Sub-metric cards */}
    </div>
  </div>
</Card>
```

**Color Coding Logic:**
- ≥95%: Green theme (`bg-green-50`, `border-green-200`, `text-green-900`)
- 80-94%: Amber theme (`bg-amber-50`, `border-amber-200`, `text-amber-900`)
- <80%: Red theme (`bg-red-50`, `border-red-200`, `text-red-900`)

#### Section 3: Agent Performance Chart

```tsx
<ResponsiveContainer width="100%" height={400}>
  <BarChart
    data={agentPerformanceData}
    layout="horizontal"
  >
    <XAxis type="number" domain={[0, 100]} />
    <YAxis type="category" dataKey="agentName" />
    <Tooltip />
    <Bar
      dataKey="compliancePercentage"
      fill={(entry) => entry.compliancePercentage >= 90 ? '#22c55e' :
                        entry.compliancePercentage >= 70 ? '#f59e0b' : '#ef4444'}
      onClick={handleAgentClick}
    />
  </BarChart>
</ResponsiveContainer>
```

**Interactivity:**
- Click bar: Filter page to selected agent
- Hover: Show tooltip with exact percentage and counts
- Agent names clickable: Navigate to agent detail page

#### Section 4: Daily Trend Chart

```tsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={dailyTrendData}>
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line
      type="monotone"
      dataKey="compliantChats"
      stroke="#22c55e"
      strokeWidth={2}
      fill="#22c55e"
      fillOpacity={0.2}
    />
    <Line
      type="monotone"
      dataKey="totalChats"
      stroke="#6b7280"
      strokeWidth={2}
      strokeDasharray="5 5"
    />
  </LineChart>
</ResponsiveContainer>
```

**Data Aggregation:**
- Group chats by day using `opened_at` date
- For date ranges > 90 days: Aggregate by week instead
- Calculate compliant vs. total for each bucket

#### Section 5: SLA Breaches Table

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead onClick={() => handleSort('chatId')}>Chat ID</TableHead>
      <TableHead onClick={() => handleSort('agent')}>Agent</TableHead>
      <TableHead onClick={() => handleSort('contact')}>Contact</TableHead>
      <TableHead>Pickup</TableHead>
      <TableHead>First Response</TableHead>
      <TableHead>Avg Response</TableHead>
      <TableHead>Resolution</TableHead>
      <TableHead>Breach Details</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {breachedChats.map(chat => (
      <ExpandableRow key={chat.id} chat={chat} />
    ))}
  </TableBody>
</Table>
```

**ExpandableRow Component:**
- Clickable row with chevron icon
- Expand to show:
  - Contact info (name, phone, email)
  - Performance metrics (all 4 SLA times with actual values)
  - Message stats (customer/agent/bot counts)
  - Full conversation with chat bubbles
- Collapse on second click

**Chat Bubble Display:**

```tsx
<div className={cn(
  "flex",
  message.incoming ? "justify-start" : "justify-end"
)}>
  <div className={cn(
    "max-w-[70%] rounded-lg p-3",
    message.incoming
      ? "bg-gray-100 text-gray-900"
      : isBot
        ? "bg-purple-100 text-purple-900"
        : "bg-blue-500 text-white"
  )}>
    <div className="flex items-center gap-2 mb-1">
      {message.incoming ? <User size={16} /> : isBot ? <Bot size={16} /> : <Users size={16} />}
      <span className="font-semibold text-sm">{senderName}</span>
      <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
    </div>
    <p>{message.text}</p>
  </div>
</div>
```

**Message Type Classification:**
- Customer: `incoming === true`
- Human Agent: `incoming === false` AND `broadcasted === false` AND `picked_up_at !== null`
- Bot: `incoming === false` AND (`picked_up_at === null` OR `broadcasted === true`)

### Filtering & Interactions

#### Business Hours Toggle

```tsx
<div className="flex items-center gap-2">
  <Switch
    checked={useBusinessHours}
    onCheckedChange={handleBusinessHoursToggle}
    disabled={isRecalculating}
  />
  <Label>Business Hours Only</Label>
  <Tooltip>
    <TooltipTrigger><InfoIcon size={16} /></TooltipTrigger>
    <TooltipContent>
      When enabled, SLA calculations only count time during office hours
    </TooltipContent>
  </Tooltip>
</div>
```

**Behavior:**
- Toggle triggers recalculation of all metrics
- Show loading state during recalculation
- Disable toggle while recalculating
- Update all sections simultaneously

#### Table Sorting

- Click column header: Toggle sort direction
- Visual indicator: Arrow icon (up/down)
- Sortable columns: Chat ID, Agent, Contact, all SLA pass/fail columns
- Default sort: Most recent first (by `opened_at`)

#### Table Pagination

- 20 rows per page
- Standard pagination controls (First, Previous, Next, Last)
- Show "Showing X-Y of Z breaches"
- Preserve expanded rows when changing pages

### CSV Export Functionality

```typescript
const exportBreachesCSV = () => {
  const headers = [
    'Chat ID', 'Contact Name', 'Agent Name', 'Status',
    'Opened At', 'Closed At',
    'Pickup Time (s)', 'Pickup SLA',
    'First Response Time (s)', 'First Response SLA',
    'Avg Response Time (s)', 'Avg Response SLA',
    'Resolution Time (s)', 'Resolution SLA',
    'Overall SLA', 'Breached SLAs'
  ];

  const rows = filteredBreaches.map(chat => [
    chat.id,
    chat.contact.name,
    chat.agent?.name || 'Unassigned',
    chat.status,
    formatDateTime(chat.opened_at),
    chat.closed_at ? formatDateTime(chat.closed_at) : 'N/A',
    chat.timeToPickup || 'N/A',
    chat.pickupSLA ? 'Pass' : 'Fail',
    chat.firstResponseTime || 'N/A',
    chat.firstResponseSLA ? 'Pass' : 'Fail',
    chat.avgResponseTime || 'N/A',
    chat.avgResponseSLA ? 'Pass' : 'Fail',
    chat.resolutionTime || 'N/A',
    chat.resolutionSLA ? 'Pass' : 'Fail',
    chat.overallSLA ? 'Pass' : 'Fail',
    getBreachedSLAsList(chat).join(', ')
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sla-breaches-${formatDate(new Date())}.csv`;
  link.click();
};
```

### Responsive Design Breakpoints

**Desktop (≥1024px):**
- Metric cards: 4 columns grid
- Charts: Full width
- Table: All columns visible
- Expanded rows: 4-column grid for details

**Tablet (768px - 1023px):**
- Metric cards: 2 columns grid (2 rows)
- Charts: Full width (scaled)
- Table: All columns with horizontal scroll if needed
- Expanded rows: 2-column grid (2 rows)

**Mobile (<768px):**
- Metric cards: 1 column (stacked)
- Charts: Full width with touch interactions
- Table: Condensed view (Chat ID, Agent, Breach Details only)
- Expanded rows: 1-column layout (fully stacked)
- Hide less critical columns

### Performance Optimizations

**Data Handling:**
- Pre-compute all SLA metrics on data import
- Store calculations in database, not computed on-demand
- Use database indexes on frequently filtered fields (`opened_at`, `agent_id`, `status`)
- Pagination: Load only 20 rows at a time

**React Optimizations:**
- `useMemo` for all derived metrics calculations
- `useCallback` for event handlers
- Virtualization for message lists with 50+ messages (react-window)
- Lazy load expanded row content (only render when opened)

**Loading States:**
- Skeleton components during initial load
- Spinner overlay during filter changes
- Progressive loading: Show metric cards first, then charts, then table

**Target Performance:**
- Metric cards load: <500ms
- Charts render: <1 second
- Table first 20 rows: <1 second
- Expand row: <200ms
- Business hours toggle recalculation: <2 seconds
- Handle 10,000 chats without performance degradation

### Accessibility Requirements

**Keyboard Navigation:**
- All interactive elements focusable via Tab
- Enter/Space: Expand/collapse table rows
- Escape: Close expanded rows
- Arrow keys: Navigate charts and table

**Screen Reader Support:**
- Proper ARIA labels on all icons
- Table uses semantic HTML (`<thead>`, `<tbody>`)
- Charts have text alternatives (data tables)
- Status icons announced: "Passed" / "Failed"

**Focus Management:**
- Clear focus indicators (2px blue outline)
- Focus visible on keyboard navigation
- Focus trapped in modals/expanded rows

**Color Contrast:**
- All text meets WCAG AA standards (4.5:1 ratio)
- Don't rely solely on color (use icons + color)
- Tested with color blindness simulators

### Error Handling

**Calculation Errors:**
```tsx
{isError && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Unable to calculate SLA metrics</AlertTitle>
    <AlertDescription>
      There was an error processing the data.
      <Button variant="link" onClick={retry}>Retry</Button>
    </AlertDescription>
  </Alert>
)}
```

**Invalid Data:**
- Skip corrupted chats
- Show warning: "X chats excluded due to invalid data"
- Log details to Sentry for investigation

**Empty States:**
```tsx
{breachedChats.length === 0 && (
  <div className="text-center py-12">
    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
    <h3 className="text-xl font-semibold mb-2">
      No SLA breaches found!
    </h3>
    <p className="text-gray-600">
      All chats in this period met SLA targets
    </p>
  </div>
)}
```

### Edge Cases Handling

**1. Chat Never Picked Up**
- `picked_up_at === null`
- Pickup SLA: Automatic fail
- First Response SLA: Automatic fail
- Display: "Never picked up" badge in breach details

**2. Bot-Only Chat**
- No human agent messages
- First Response SLA: Fail (no human response)
- Display: "Bot-only resolution" badge

**3. Chat Still Open**
- `closed_at === null`
- Resolution SLA: N/A (not counted as fail)
- Overall SLA: Calculate without resolution metric
- Display: "In Progress" badge

**4. Multi-Day Chat**
- Opened Friday 5pm, closed Monday 9am
- Wall clock: ~64 hours
- Business hours: ~2 hours (if Mon-Fri 9am-5pm)
- Display both if significantly different

**5. No Chats in Date Range**
- Show all metric cards as "N/A" or "0%"
- Display empty state message
- Disable export button
- Charts show "No data available"

### Testing Requirements

**Unit Tests:**
- SLA calculation functions
- Business hours time calculation
- Message type classification logic
- CSV export generation

**Integration Tests:**
- Metric card calculations with sample data
- Filter application across all sections
- Table sorting and pagination
- Row expansion and data display

**E2E Tests (Playwright):**
- Complete page load and rendering
- Business hours toggle interaction
- Agent bar click filtering
- Table row expansion
- CSV export download

**Performance Tests:**
- Load page with 10,000 chats
- Measure metric calculation time
- Test business hours toggle with large dataset
- Verify no memory leaks on repeated interactions

## Approach

The implementation approach focuses on pre-computation of SLA metrics at data import time to ensure optimal page performance. This architectural decision means that all SLA calculations (pickup time, first response time, average response time, resolution time, and overall compliance) are computed once during the data ingestion phase and stored as database fields.

The page will be built as a Next.js 15 App Router page component at `app/sla-compliance/page.tsx`, leveraging the existing authentication system (Clerk) to protect the route. The component will use Zustand for global state management (filters, date ranges, office hours configuration) and local React state for UI-specific concerns (expanded rows, sorting, pagination).

The business hours toggle functionality will trigger client-side recalculation using the pre-stored timestamps, applying the configured office hours window to recalculate all time-based metrics. This approach provides the flexibility of toggling between wall-clock and business-hours calculations without requiring additional API calls.

The UI will be composed entirely of existing shadcn/ui components and Recharts visualizations, maintaining design consistency with the rest of the application. The layout follows a responsive grid system that adapts gracefully from desktop (4-column metric cards) to tablet (2-column) to mobile (single column).

Performance optimization strategies include memoization of all derived calculations, virtualization of long message lists, pagination of the breaches table, and progressive loading patterns (metric cards → charts → table). The target performance benchmarks ensure the page remains responsive even with datasets containing 10,000+ chats.

## External Dependencies

No new external dependencies are required beyond the existing tech stack:

- **shadcn/ui components:** Already in project
- **Recharts:** Already in project for charting
- **lucide-react:** Already in project for icons
- **Zustand:** Already in project for state management
- **TanStack Query:** Already in project for data fetching (if needed for API calls)
- **Tailwind CSS:** Already in project for styling
- **TypeScript:** Already in project
- **Next.js 15:** Already in project

All required libraries are part of the established tech stack documented in @.agent-os/product/tech-stack.md.
