# Feature 008: Expandable Chat View for Agent Performance QA

**Status:** 📋 **PLANNED**

## Requirements

### Original User Requirements
- Create a dedicated page to view chats in a table format with expansion capability
- When a chat row is clicked, it expands inline to show the full message conversation
- Focus on agent performance evaluation and quality assurance
- Display response times prominently to assess agent speed
- Customer messages should appear on the right side
- Agent messages should appear on the left side with response time inline
- Remove unnecessary metadata (contact details, tags, resolution notes)
- Keep the interface clean and focused on message review
- Route: `/dashboard/chats/view`
- Only one chat expanded at a time (clicking another collapses the current one)

### Acceptance Criteria
- [ ] Chat view page accessible at `/dashboard/chats/view` with navigation item in sidebar
- [ ] Table displays all chats with key fields: ID, Contact, Status, Agent, Response Time, Updated
- [ ] Click on any row expands it inline to show full conversation
- [ ] Only one row expanded at a time (auto-collapse previous)
- [ ] Customer messages appear on right side of conversation
- [ ] Agent messages appear on left side with response time displayed inline next to timestamp
- [ ] Response time calculation: time from customer message to next agent response
- [ ] Response time summary shows Avg/Fastest/Slowest for the expanded chat
- [ ] Filters available: Status, Agent, Response Time thresholds
- [ ] Pagination working with 25 chats per page
- [ ] Clean, minimal interface focused on messages only
- [ ] Proper loading states and empty states
- [ ] Responsive design for desktop/tablet (primary use case)

## Architecture Design

### How This Feature Fits Into Existing App Patterns

Following the **5-layer architecture** (Layer 1: Database → Layer 2: Sync Engine → Layer 3: API → Layer 4: Frontend → Layer 5: Infrastructure):

**Layer 1 - Database Schema**:
- No database changes required
- Existing Chat model has: id, b2chatId, status, agentId, contactId, lastModifiedAt
- Existing Message model has: chatId, content, type, timestamp, sender (customer/agent/bot)
- Existing Agent model has: id, name
- Existing Contact model has: id, fullName

**Layer 2 - B2Chat Client & Sync Engine**:
- No changes required
- Chat and message sync already working via existing transform engine

**Layer 3 - API Endpoints**:
- Create new `/api/chats/view` GET endpoint for:
  - Paginated chat list with summary data
  - Filters (status, agent, response time range)
  - Sorting (by response time, updated date)
  - Response time calculation per chat (first response time)
- Enhance `/api/chats/[chatId]/messages` endpoint (if needed) to return:
  - Full message thread ordered by timestamp
  - Response time between each customer → agent message pair

**Layer 4 - Frontend**:
- Create `/app/dashboard/chats/view/page.tsx` - Main chat view page
- Create `/components/chats/chat-view-table.tsx` - Expandable table component
- Create `/components/chats/chat-view-row.tsx` - Individual row with expansion logic
- Create `/components/chats/chat-conversation-view.tsx` - Message display for expanded row
- Create `/components/chats/chat-view-filters.tsx` - Filter bar
- Create `/lib/hooks/use-chat-view.ts` - React Query hook for data fetching
- Create `/lib/chat-response-time.ts` - Utility functions for response time calculations
- Update `/components/dashboard/sidebar.tsx` - Add "Chat View" navigation item

**Layer 5 - Infrastructure**:
- Caching: 5-minute TTL for chat view list (shorter than dashboard due to QA use case)
- Rate limiting: 30 requests/minute for chat view endpoint
- No feature flags needed (low-risk, additive feature)

### Components/Services Created/Modified

**New API Routes**:
- `src/app/api/chats/view/route.ts` - Main chat view endpoint with response time aggregation

**New Frontend Components**:
- `src/app/dashboard/chats/view/page.tsx` - Chat view page (Server Component wrapper)
- `src/components/chats/chat-view-table.tsx` - Expandable table using TanStack Table
- `src/components/chats/chat-view-row.tsx` - Row component with expansion state
- `src/components/chats/chat-conversation-view.tsx` - Message display for expanded row
- `src/components/chats/chat-view-filters.tsx` - Filter controls
- `src/lib/hooks/use-chat-view.ts` - React Query hook for chat view data
- `src/lib/chat-response-time.ts` - Response time calculation utilities

**Reused Existing Components**:
- `src/components/chats/status-badge.tsx` - Display chat status
- `src/components/messages/message-bubble.tsx` - Individual message display (may need minor modifications for layout)

**Modified Components**:
- `src/components/dashboard/sidebar.tsx` - Add "Chat View" navigation item to "Chats" section
- `src/components/messages/message-bubble.tsx` - Add support for response time display (optional, may create new variant)

**New Types/Interfaces**:
- `src/types/chat-view.ts` - Chat view specific types (ChatViewItem, ResponseTimeMetrics, ChatViewFilters)

### Integration Points with Existing Systems

**1. Data Sync Engine**:
- No changes required
- Chat view page consumes data already synced by existing transform engine
- Soft delete support: Only display chats where `isDeleted = false`

**2. Dashboard Navigation**:
- Add "Chat View" link to sidebar under "Chats" subsection
- Use `MessageSquareText` or `ClipboardList` icon from Lucide React
- Position: Under existing "Chats" link, as a sub-item for QA/analysis

**3. Existing Chat Management**:
- Separate from `/dashboard/chats` (which has Contact/Active/Messages views)
- Chat View is specifically for QA and performance analysis
- Complementary views of the same chat data

**4. Agent Performance**:
- Response time metrics calculated here can inform agent performance dashboards
- Potential future integration: Link to agent detail page from agent name

**5. Authentication**:
- Protected by Clerk authentication (following Pattern 16)
- Multi-tenant: Filters chats by merchantId if tenant-scoped

### Database Changes Required

**No database migrations needed** - all required fields exist:
- Chat model: id, b2chatId, status, agentId, contactId, lastModifiedAt
- Message model: chatId, content, type, timestamp, sender
- Agent model: id, name
- Contact model: id, fullName

**Response Time Calculation Strategy**:
- Calculate at query time (not stored)
- For each chat: Find time delta between first customer message and first agent response
- For expanded view: Calculate delta for each customer → agent message pair
- Return in milliseconds, format in frontend (e.g., "1m 23s", "45s", "3m 12s")

## Implementation Chunks

### Chunk 1: Response Time Calculation Utilities
**Type**: Backend
**Dependencies**: None
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/lib/chat-response-time.ts` (new)

**Implementation Steps**:
1. Create utility functions for response time calculations:
   ```typescript
   interface ResponseTimeResult {
     firstResponseTimeMs: number | null
     avgResponseTimeMs: number | null
     fastestResponseTimeMs: number | null
     slowestResponseTimeMs: number | null
     totalAgentResponses: number
   }

   export function calculateChatResponseTimes(
     messages: Array<{ timestamp: Date; sender: 'customer' | 'agent' | 'bot' }>
   ): ResponseTimeResult

   export function calculateMessagePairResponseTime(
     customerMsg: { timestamp: Date },
     agentMsg: { timestamp: Date }
   ): number

   export function formatResponseTime(ms: number): string
   // Examples: "45s", "1m 23s", "3m 12s", "1h 5m"

   export function getResponseTimeIndicator(ms: number): 'fast' | 'good' | 'slow'
   // Fast: < 60s, Good: 60s-180s, Slow: > 180s
   ```

2. Implement `calculateChatResponseTimes`:
   - Iterate through messages chronologically
   - Track customer messages
   - When agent message found, calculate delta from last customer message
   - Accumulate: first response, all responses, min, max
   - Return aggregated metrics

3. Implement `calculateMessagePairResponseTime`:
   - Simple timestamp delta calculation
   - Return milliseconds

4. Implement `formatResponseTime`:
   - Convert milliseconds to human-readable format
   - Handle seconds, minutes, hours
   - Examples: 45000ms → "45s", 83000ms → "1m 23s"

5. Implement `getResponseTimeIndicator`:
   - Categorize response times for visual indicators
   - Thresholds: Fast < 60s, Good 60-180s, Slow > 180s

**Tests required**: Yes
- Unit tests in `lib/__tests__/chat-response-time.test.ts`
- Test calculateChatResponseTimes with various message sequences
- Test edge cases: no agent messages, no customer messages, bot messages
- Test formatResponseTime with various time ranges
- Test getResponseTimeIndicator thresholds

**Acceptance criteria**:
- [ ] All utility functions implemented and exported
- [ ] Response time calculations accurate
- [ ] Edge cases handled (empty messages, no responses, bot messages)
- [ ] Format function produces readable time strings
- [ ] Indicator function categorizes correctly
- [ ] Tests pass with >90% coverage

### Chunk 2: API Endpoint for Chat View
**Type**: Backend
**Dependencies**: Chunk 1 must be completed
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/app/api/chats/view/route.ts` (new)
- `src/types/chat-view.ts` (new)

**Implementation Steps**:
1. Create TypeScript interfaces in `types/chat-view.ts`:
   ```typescript
   export interface ChatViewItem {
     id: string
     b2chatId: string
     contactName: string
     contactId: string
     agentName: string | null
     agentId: string | null
     status: ChatStatus
     messageCount: number
     firstResponseTimeMs: number | null
     firstResponseTimeFormatted: string | null
     responseTimeIndicator: 'fast' | 'good' | 'slow' | null
     lastModifiedAt: string
     updatedAt: string
   }

   export interface ChatViewFilters {
     status?: ChatStatus[]
     agentId?: string
     responseTimeMin?: number  // milliseconds
     responseTimeMax?: number  // milliseconds
     search?: string  // contact name search
   }

   export interface ChatViewResponse {
     chats: ChatViewItem[]
     pagination: {
       page: number
       limit: number
       total: number
       totalPages: number
     }
   }
   ```

2. Create GET route with dynamic = 'force-dynamic' and revalidate = 60 (Pattern 15)

3. Implement Clerk authentication check (Pattern 16)

4. Parse and validate query parameters:
   - `page` (default: 1) and `limit` (default: 25)
   - `status` (comma-separated ChatStatus values)
   - `agentId` (string)
   - `responseTimeMin`, `responseTimeMax` (numbers, milliseconds)
   - `search` (string, searches contact name)
   - `sortBy` (responseTime | updatedAt, default: updatedAt)
   - `sortOrder` (asc | desc, default: desc)

5. Build Prisma query:
   - WHERE: isDeleted = false, status filter, agentId filter, contact name search
   - Include: messages (for response time calc), agent, contact
   - Order by: sortBy and sortOrder

6. For each chat, calculate response times:
   - Use `calculateChatResponseTimes` from Chunk 1
   - Extract firstResponseTimeMs
   - Format response time
   - Get response time indicator

7. Apply response time filtering (application-level):
   - Filter chats by responseTimeMin/Max after calculation
   - This is necessary because response time is computed, not stored

8. Apply pagination

9. Return ChatViewResponse with formatted data

10. Add error handling with secure error responses (Pattern 59)

11. Add caching with 5-minute TTL (Pattern 51-54)

12. Add rate limiting (Pattern 57)

**Tests required**: Yes
- Unit tests in `app/api/chats/view/__tests__/route.test.ts`
- Test authentication (401 for null userId)
- Test validation (400 for invalid params)
- Test status filtering
- Test agent filtering
- Test response time range filtering
- Test search functionality
- Test sorting (by response time, by updatedAt)
- Test pagination
- Test response time calculations integration
- Test empty results

**Acceptance criteria**:
- [ ] API returns paginated chats with response time metrics
- [ ] All filters work correctly (status, agent, response time, search)
- [ ] Sorting works (by response time, by updatedAt)
- [ ] Response times calculated accurately
- [ ] Pagination metadata accurate
- [ ] Authentication and validation enforced
- [ ] Caching and rate limiting configured
- [ ] Tests pass with >80% coverage

### Chunk 3: React Query Hook for Chat View
**Type**: Frontend
**Dependencies**: Chunk 2 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/lib/hooks/use-chat-view.ts` (new)

**Implementation Steps**:
1. Create `useChatView` hook using TanStack Query (Pattern 17):
   ```typescript
   interface UseChatViewOptions {
     filters?: ChatViewFilters
     sortBy?: 'responseTime' | 'updatedAt'
     sortOrder?: 'asc' | 'desc'
     page?: number
     limit?: number
   }

   export function useChatView(options: UseChatViewOptions = {}) {
     const { filters, sortBy, sortOrder, page = 1, limit = 25 } = options

     return useQuery({
       queryKey: ['chat-view', filters, sortBy, sortOrder, page, limit],
       queryFn: async () => {
         const params = new URLSearchParams()
         params.append('page', page.toString())
         params.append('limit', limit.toString())
         if (sortBy) params.append('sortBy', sortBy)
         if (sortOrder) params.append('sortOrder', sortOrder)
         if (filters?.status) params.append('status', filters.status.join(','))
         if (filters?.agentId) params.append('agentId', filters.agentId)
         if (filters?.responseTimeMin) params.append('responseTimeMin', filters.responseTimeMin.toString())
         if (filters?.responseTimeMax) params.append('responseTimeMax', filters.responseTimeMax.toString())
         if (filters?.search) params.append('search', filters.search)

         const response = await fetch(`/api/chats/view?${params}`)
         if (!response.ok) throw new Error('Failed to fetch chat view')
         return response.json() as Promise<ChatViewResponse>
       },
       staleTime: 5 * 60 * 1000, // 5 minutes
       gcTime: 15 * 60 * 1000, // 15 minutes
     })
   }
   ```

2. Create `useChatMessages` hook for expanded view:
   ```typescript
   export function useChatMessages(chatId: string | null) {
     return useQuery({
       queryKey: ['chat-messages', chatId],
       queryFn: async () => {
         if (!chatId) return null
         const response = await fetch(`/api/chats/${chatId}/messages`)
         if (!response.ok) throw new Error('Failed to fetch chat messages')
         return response.json()
       },
       enabled: !!chatId, // Only fetch when chatId is provided
       staleTime: 10 * 60 * 1000, // 10 minutes (messages don't change often)
     })
   }
   ```

3. Add helper functions:
   - `buildChatViewQueryString(options)` - Build URL query string
   - `invalidateChatView()` - Invalidate cache (for future updates)

**Tests required**: Yes
- Unit tests in `hooks/__tests__/use-chat-view.test.ts`
- Test query key generation with different filter combinations
- Test API URL building
- Test caching behavior
- Test error handling
- Test useChatMessages enabled logic

**Acceptance criteria**:
- [ ] useChatView hook fetches chats with all parameters
- [ ] useChatMessages hook fetches messages when chatId provided
- [ ] Query keys unique for different filter combinations
- [ ] Caching works correctly
- [ ] Error states handled properly
- [ ] TypeScript types match API response
- [ ] Tests pass

### Chunk 4: Chat Conversation View Component
**Type**: Frontend
**Dependencies**: Chunk 3 must be completed
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/components/chats/chat-conversation-view.tsx` (new)

**Implementation Steps**:
1. Create conversation view component:
   ```typescript
   'use client'

   interface ChatConversationViewProps {
     chatId: string
   }

   export function ChatConversationView({ chatId }: ChatConversationViewProps) {
     const { data: messagesData, isLoading, error } = useChatMessages(chatId)

     // Loading state, error state, messages display
   }
   ```

2. Fetch messages using `useChatMessages` hook from Chunk 3

3. Calculate response times for each message pair:
   - Track customer messages
   - When agent message appears, calculate response time from last customer message
   - Store in message metadata for display

4. Implement message layout:
   - Customer messages: Right-aligned, light background
   - Agent messages: Left-aligned, different background, includes agent name
   - Bot messages: Centered or left-aligned, distinct styling

5. Display messages with response times:
   - Customer message:
     ```
     ┌────────────────────────────────────────────────┐
     │                  Hi, I need help with billing  │
     │                  10:23:14 AM    [Customer] 👤  │
     └────────────────────────────────────────────────┘
     ```
   - Agent message with response time:
     ```
     ┌────────────────────────────────────────────────┐
     │  👨‍💼 [Agent - John Doe]                          │
     │  Sure! Let me check your account               │
     │  10:24:37 AM (⏱️ 1m 23s)                        │
     └────────────────────────────────────────────────┘
     ```

6. Add response time summary section:
   ```
   Response Time Summary:  Avg: 1m 41s  |  Fastest: 48s  |  Slowest: 3m 12s
   ```

7. Support different message types:
   - Text messages: Display content
   - Image messages: Show image or placeholder
   - File messages: Show file icon and name

8. Implement "Show earlier messages" collapse:
   - Display last 10 messages by default
   - Collapsible section for older messages
   - "Show X earlier messages" button

9. Add loading skeleton:
   - Show 5-6 skeleton message bubbles while loading

10. Add error state:
    - Error message with retry button

11. Add empty state:
    - "No messages in this chat" (edge case)

**Tests required**: Yes
- Component tests in `__tests__/chat-conversation-view.test.tsx`
- Test message rendering (customer right, agent left)
- Test response time display on agent messages
- Test response time summary calculation
- Test loading state
- Test error state
- Test empty state
- Test message type support (text, image, file)

**Acceptance criteria**:
- [ ] Customer messages appear on right
- [ ] Agent messages appear on left with response time inline
- [ ] Response time calculated and displayed correctly
- [ ] Response time summary shows avg/min/max
- [ ] Message types supported (text, image, file)
- [ ] Loading state shows skeleton
- [ ] Error state shows error message with retry
- [ ] Responsive layout works
- [ ] Tests pass

### Chunk 5: Expandable Chat View Table Component
**Type**: Frontend
**Dependencies**: Chunks 3 and 4 must be completed
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/components/chats/chat-view-table.tsx` (new)
- `src/components/chats/chat-view-filters.tsx` (new)

**Implementation Steps - Table Component**:
1. Create table component using TanStack Table:
   ```typescript
   'use client'

   export function ChatViewTable() {
     const [filters, setFilters] = useState<ChatViewFilters>({})
     const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }])
     const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })
     const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

     const { data, isLoading, error } = useChatView({
       filters,
       sortBy: sorting[0]?.id as 'responseTime' | 'updatedAt',
       sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
       page: pagination.pageIndex + 1,
       limit: pagination.pageSize
     })

     // TanStack Table setup...
   }
   ```

2. Define table columns:
   - **Expand Icon**: ▸ (collapsed) or ▾ (expanded) - non-sortable
   - **ID**: Chat ID (b2chatId) - sortable
   - **Contact**: Contact name - non-sortable
   - **Status**: Status badge - non-sortable
   - **Agent**: Agent name or "Unassigned" - non-sortable
   - **Response Time**: First response time with indicator (⚡/✓/⚠️) - sortable
   - **Updated**: Last modified date - sortable

3. Configure TanStack Table:
   - Enable sorting with `onSortingChange`
   - Enable pagination with `onPaginationChange`
   - Manual pagination (server-side)
   - Manual sorting (server-side)

4. Implement row rendering:
   - Standard row: Show all column data
   - Expanded row: Show columns + expanded content below

5. Implement expansion logic:
   - Click row (or expand icon) toggles expansion
   - Track `expandedRowId` in state
   - Only one row expanded at a time:
     ```typescript
     const handleRowClick = (rowId: string) => {
       setExpandedRowId(prev => prev === rowId ? null : rowId)
     }
     ```

6. Render expanded content:
   ```typescript
   {expandedRowId === row.id && (
     <tr>
       <td colSpan={7}>
         <div className="p-4 bg-muted/50">
           <ChatConversationView chatId={row.id} />
         </div>
       </td>
     </tr>
   )}
   ```

7. Add loading state:
   - Skeleton rows (10 rows) while loading
   - Use existing Skeleton component pattern

8. Add empty state:
   - "No chats found" message
   - Suggest clearing filters
   - Icon from Lucide React (MessageSquareOff)

9. Add error state:
   - Error message with retry button

10. Implement pagination controls:
    - Previous/Next buttons
    - Page number display: "Page 1 of 42"
    - Total count: "1,234 chats"
    - Rows per page selector: 10, 25, 50, 100

**Implementation Steps - Filter Component**:
1. Create filter bar component:
   ```typescript
   'use client'

   interface ChatViewFiltersProps {
     filters: ChatViewFilters
     onChange: (filters: ChatViewFilters) => void
   }

   export function ChatViewFilters({ filters, onChange }: ChatViewFiltersProps) {
     // Filter controls
   }
   ```

2. Implement Status Filter:
   - Multi-select dropdown (Radix UI)
   - Options: All statuses from ChatStatus enum
   - Selected statuses shown as badges

3. Implement Agent Filter:
   - Dropdown select
   - Fetch agent list from API or existing hook
   - "All Agents" option

4. Implement Response Time Filter:
   - Two number inputs: Min and Max
   - Placeholder: "Min: 0s" "Max: 5m"
   - Convert to milliseconds for API
   - Presets: Fast (<1m), Medium (1-3m), Slow (>3m)

5. Implement Contact Search:
   - Debounced input (300ms)
   - Placeholder: "Search by contact name..."
   - Search icon

6. Implement Clear Filters button:
   - Reset all filters to default
   - Show count of active filters

7. Add filter state management:
   - Emit changes via onChange prop
   - Accept current state via filters prop

**Tests required**: Yes
- Component tests in `__tests__/chat-view-table.test.tsx`
- E2E tests in `e2e/chat-view.spec.ts`
- Test table rendering with data
- Test row click expands conversation
- Test only one row expanded at a time
- Test clicking same row collapses it
- Test sorting (response time, updated)
- Test pagination
- Test filters update data
- Test loading/empty/error states
- E2E: Navigate, filter, sort, expand chat, verify messages

**Acceptance criteria**:
- [ ] Table renders with all columns
- [ ] Row click expands conversation inline
- [ ] Only one row expanded at a time
- [ ] Clicking same row collapses it
- [ ] Sorting works (response time, updated)
- [ ] Pagination controls functional
- [ ] Filters work (status, agent, response time, search)
- [ ] Loading/empty/error states display correctly
- [ ] Responsive layout
- [ ] Tests pass (unit and E2E)

### Chunk 6: Chat View Page Component
**Type**: Frontend
**Dependencies**: Chunk 5 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/app/dashboard/chats/view/page.tsx` (new)

**Implementation Steps**:
1. Create page component following Pattern 27-29:
   ```typescript
   export default async function ChatViewPage() {
     // Server Component - authentication check happens in layout
     return <ChatViewPageClient />
   }
   ```

2. Create Client Component wrapper:
   ```typescript
   'use client'

   export function ChatViewPageClient() {
     return (
       <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
         {/* Page header */}
         <div className="flex items-center justify-between">
           <div>
             <h2 className="text-3xl font-bold tracking-tight">Chat View</h2>
             <p className="text-muted-foreground">
               Review chat conversations and analyze agent response times
             </p>
           </div>
         </div>

         {/* Chat view table with filters */}
         <ChatViewTable />
       </div>
     )
   }
   ```

3. Add page metadata (Pattern 27):
   ```typescript
   export const metadata = {
     title: 'Chat View | B2Chat Analytics',
     description: 'Review chat conversations and agent performance'
   }
   ```

4. Add stats summary cards (optional):
   - Total chats
   - Average response time (all chats)
   - Fast responses count (<1m)
   - Slow responses count (>3m)

5. Follow spacing patterns (Pattern 29):
   - Use `flex-1 space-y-4 p-4 pt-6 md:p-8`
   - Page header with h2 title + description
   - Consistent spacing

**Tests required**: Yes
- E2E test in `e2e/chat-view-page.spec.ts`
- Test page loads correctly
- Test authentication redirect (if not authenticated)
- Test page metadata
- Test integration with table component

**Acceptance criteria**:
- [ ] Page accessible at `/dashboard/chats/view`
- [ ] Page header displays correctly
- [ ] Table component integrated
- [ ] Responsive layout works
- [ ] Page metadata set correctly
- [ ] E2E test passes

### Chunk 7: Navigation Integration
**Type**: Frontend
**Dependencies**: Chunk 6 must be completed
**Estimated Effort**: Small (0.25 day)

**Files to create/modify**:
- `src/components/dashboard/sidebar.tsx` (modify)

**Implementation Steps**:
1. Import icon from Lucide React:
   ```typescript
   import { ClipboardList } from "lucide-react"
   ```

2. Add "Chat View" navigation item under "Chats" section:
   ```typescript
   {
     title: "Chats",
     items: [
       {
         title: "Overview",
         href: "/dashboard/chats",
         icon: MessageSquare,
       },
       {
         title: "Chat View",
         href: "/dashboard/chats/view",
         icon: ClipboardList,
         description: "QA & Performance Review"
       },
     ]
   }
   ```

3. Test navigation:
   - Verify link appears in sidebar
   - Verify active state when on chat view page
   - Verify tooltip shows in collapsed mode

**Tests required**: No (manual verification)

**Acceptance criteria**:
- [ ] "Chat View" link appears in sidebar under "Chats" section
- [ ] Link has ClipboardList icon
- [ ] Active state shows when on chat view page
- [ ] Collapsed mode shows tooltip
- [ ] Navigation works correctly

## Testing Strategy

### Unit Tests
**When**: During implementation of each chunk
**What to test**:
- Response time utilities (Chunk 1): All calculation functions, edge cases, formatting
- API route (Chunk 2): Authentication, validation, filtering, sorting, pagination, response time calculations
- React Query hooks (Chunk 3): Query key generation, URL building, caching, enabled logic
- Conversation view (Chunk 4): Message rendering, response time display, loading/error states
- Table component (Chunk 5): Rendering, expansion logic, sorting, pagination, filters

**Tools**: Jest, React Testing Library, MSW for API mocking

### Integration Tests
**When**: After Chunk 5 (table component) is complete
**What to test**:
- Filter changes trigger API calls with correct parameters
- Sorting updates and fetches new data
- Pagination updates and fetches new data
- Row click expands conversation and fetches messages
- Only one row expanded at a time
- Response times calculated correctly across components

**Tools**: Jest, React Testing Library

### E2E Tests
**When**: After Chunk 6 (page component) is complete
**What to test**:
- User navigates to `/dashboard/chats/view`
- Page loads with chat table
- User applies status filter - table updates
- User applies agent filter - table updates
- User applies response time filter - table updates
- User sorts by response time - table updates
- User clicks chat row - conversation expands inline
- Verify messages displayed (customer right, agent left)
- Verify response times shown on agent messages
- User clicks another row - first collapses, second expands
- User clicks same row - conversation collapses
- User changes page - table updates, expansion resets

**Tools**: Playwright

### Performance Tests
**When**: After all chunks complete
**What to test**:
- Page load time
- API response time with 1000+ chats
- Response time calculation performance
- Table rendering performance with large datasets
- Expansion/collapse animation smoothness

**Tools**: Lighthouse, Chrome DevTools Performance

**Target Metrics**:
- Page load < 2 seconds
- API response < 800ms (includes message fetching and response time calculation)
- Table render < 300ms
- Expand animation < 200ms

## Database Changes

**No database migrations required.**

Existing models sufficient:
- Chat: id, b2chatId, status, agentId, contactId, lastModifiedAt, isDeleted
- Message: chatId, content, type, timestamp, sender
- Agent: id, name
- Contact: id, fullName

Response times calculated at query time, not stored.

## API Changes

### New Endpoints

**GET /api/chats/view**
- **Purpose**: Fetch paginated, filtered, sorted list of chats with response time metrics
- **Authentication**: Required (Clerk)
- **Rate Limit**: 30 requests/minute (Pattern 57)
- **Cache**: 5-minute TTL (Pattern 51)

**Query Parameters**:
```typescript
{
  // Pagination
  page?: number          // Default: 1
  limit?: number         // Default: 25

  // Filters
  status?: string        // Comma-separated ChatStatus values
  agentId?: string       // Filter by specific agent
  responseTimeMin?: number  // Milliseconds
  responseTimeMax?: number  // Milliseconds
  search?: string        // Contact name search

  // Sorting
  sortBy?: string        // 'responseTime' | 'updatedAt'
  sortOrder?: string     // 'asc' | 'desc'
}
```

**Response**:
```typescript
{
  chats: Array<{
    id: string
    b2chatId: string
    contactName: string
    contactId: string
    agentName: string | null
    agentId: string | null
    status: ChatStatus
    messageCount: number
    firstResponseTimeMs: number | null
    firstResponseTimeFormatted: string | null  // e.g., "1m 23s"
    responseTimeIndicator: 'fast' | 'good' | 'slow' | null
    lastModifiedAt: string
    updatedAt: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### Modified Endpoints

**GET /api/chats/[chatId]/messages** (potential enhancement)
- No breaking changes
- Optionally add response time metadata to each message in response
- Backward compatible: existing consumers unaffected

## Integration Points

### Services Affected

1. **Authentication Service (Clerk)**:
   - Chat view API requires authentication
   - Multi-tenant filtering by merchantId if applicable

2. **Caching Service**:
   - Add 'chat-view' cache namespace
   - 5-minute TTL (Pattern 51)
   - Separate from general chats cache due to response time calculations

3. **Rate Limiting Service**:
   - Add chat view endpoint to rate limit config
   - 30 requests/minute (Pattern 57)

4. **Logging/Monitoring**:
   - Track chat view API usage
   - Monitor response time calculation performance
   - Alert on slow queries (>1 second)
   - Track expansion events (analytics: which chats are being reviewed)

### External Systems
None - chat view is internal only

## Rollback Plan

### How to Undo This Feature

This feature is additive and low-risk. To rollback:

1. **Remove navigation link** from sidebar:
   - Edit `src/components/dashboard/sidebar.tsx`
   - Remove "Chat View" item from "Chats" section

2. **Remove API endpoint** (optional):
   - Delete `src/app/api/chats/view/route.ts`
   - Note: Endpoint is stateless and read-only, no data cleanup needed

3. **Remove page and components** (optional):
   - Delete `src/app/dashboard/chats/view/`
   - Delete `src/components/chats/chat-view-table.tsx`
   - Delete `src/components/chats/chat-view-row.tsx`
   - Delete `src/components/chats/chat-conversation-view.tsx`
   - Delete `src/components/chats/chat-view-filters.tsx`
   - Delete `src/lib/hooks/use-chat-view.ts`
   - Delete `src/lib/chat-response-time.ts`
   - Delete `src/types/chat-view.ts`

4. **Database rollback**: Not applicable (no database changes)

5. **Cache cleanup**: Not required (cache expires automatically)

### Risks
- **Low risk**: Feature is read-only and doesn't modify data
- **Low risk**: No database migrations to revert
- **Low risk**: No impact on existing chat management functionality
- **Medium risk**: Response time calculation performance (mitigated by caching and pagination)

### Feature Flag Considerations
Not required - feature can be safely deployed without a flag due to:
- Read-only operations
- No database changes
- Additive only (doesn't modify existing pages)
- Can be hidden by removing nav link if issues arise

## Documentation Updates

### Files to Create/Update

1. **User documentation**:
   - Create `docs/features/chat-view-user-guide.md`
   - Content: How to use chat view, filter options, understanding response times, QA workflow

2. **API documentation**:
   - Update `docs/api/endpoints.md`
   - Add GET /api/chats/view endpoint specification

3. **Development documentation**:
   - Update `docs/development/COMPONENTS.md`
   - Add ChatViewTable, ChatConversationView, ChatViewFilters component documentation
   - Create `docs/development/response-time-calculation.md`
   - Document response time calculation logic and formulas

4. **Implementation status**:
   - Update `docs/implementation/IMPLEMENTATION_STATUS.md`
   - Add Feature 008 to completed features list

### README Updates
- Add "Chat View (QA & Performance)" to feature list
- Update screenshots if applicable

## Success Criteria

### Feature is Complete When:
- [ ] All 7 implementation chunks completed
- [ ] Unit tests passing with >80% coverage
- [ ] E2E tests passing
- [ ] Performance targets met (page load <2s, API <800ms)
- [ ] Code review approved
- [ ] Documentation created/updated
- [ ] Manual QA completed
- [ ] Deployed to production

### Metrics/Validation Criteria:

**Functional Success**:
- User can view all chats in paginated table
- User can click row to expand conversation inline
- Only one row expanded at a time
- Customer messages appear on right, agent messages on left
- Response times calculated and displayed correctly
- Response time summary shows avg/min/max
- All filters work (status, agent, response time, search)
- Sorting works (by response time, by updated date)
- 25 chats per page displayed

**Performance Success**:
- Page initial load < 2 seconds
- API response time < 800ms (including response time calculations)
- Table rendering < 300ms
- Expand/collapse animation < 200ms
- No memory leaks with repeated expansion/collapse

**Quality Success**:
- Zero console errors
- Lighthouse score >90
- Responsive design works on desktop and tablet
- Accessibility score >85 (WCAG AA compliant)
- All tests passing (unit, integration, E2E)

**User Experience Success**:
- Loading states clear and informative
- Empty state helpful
- Error messages actionable
- Filters intuitive to use
- Response times easy to understand
- Conversation view readable and scannable
- Expansion animation smooth
- No layout shift during expansion
