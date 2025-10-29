# Feature 011: Enhanced Chat View Filters, Sorting, and Column Management

## Requirements

### Original User Requirements
- Add more comprehensive filtering options to dashboard/chats/view
- Enable sorting on all columns
- Allow users to show/hide columns with preference persistence
- Improve filter UI/UX following the pattern from raw-data-filters.tsx
- No tabs on the page (clean filter bar only)

### Acceptance Criteria
- [ ] Users can filter by date ranges (Created At and Updated At) with presets and custom ranges
- [ ] Users can filter by message count using presets (0, 1-5, 6-10, 11-20, 20+)
- [ ] Users can filter by department with stats displayed in dropdown
- [ ] Users can filter by single agent with stats displayed in dropdown
- [ ] Users can filter by priority with stats displayed in dropdown
- [ ] Users can filter by SLA status (All / Within SLA / Breached SLA) with stats
- [ ] Users can filter by provider/channel with stats displayed in dropdown
- [ ] Users can filter by custom response time range (min/max inputs)
- [ ] All table columns are sortable by clicking column headers
- [ ] Users can show/hide columns via a column selector dropdown
- [ ] Column visibility preferences persist in localStorage
- [ ] New columns added: Department, Priority, SLA Status, Created At
- [ ] Filter dropdowns display counts (e.g., "Opened (45), Closed (178)")
- [ ] Active filters display as dismissible pills
- [ ] Filter bar shows active filter count badge

## Architecture Design

### How This Feature Fits Into Existing App Patterns
- Extends existing chat-view feature (Feature 008: Expandable Chat View)
- Follows frontend filtering patterns established in raw-data-filters.tsx
- Uses TanStack Table's built-in sorting and column visibility features
- Integrates with existing `useChatView` hook for data fetching
- Follows localStorage pattern for user preferences
- Uses shadcn/ui components (Select, Badge, Popover, DateRangePicker)

### Components/Services to be Created/Modified
**New Components:**
- `src/components/ui/date-range-picker.tsx` - Reusable date range picker with presets
- `src/components/chats/column-selector.tsx` - Column visibility manager

**Modified Components:**
- `src/components/chats/chat-view-filters.tsx` - Enhanced filter bar
- `src/components/chats/chat-view-table.tsx` - Sortable columns + column management + new columns
- `src/types/chat-view.ts` - Extended filter types
- `src/lib/hooks/use-chat-view.ts` - Support new filters and fetch stats

**New Utilities:**
- `src/lib/storage/column-preferences.ts` - localStorage management for column visibility

### Integration Points with Existing Systems
- **Authentication:** All API calls use Clerk userId from session
- **Database:** Uses existing Chat table with Department, Agent relations
- **Caching:** Leverages existing chat cache (2min TTL, 500 entries)
- **API Routes:** Extends `/api/chats/view` with new query parameters and stats endpoint
- **TanStack Table:** Uses existing table setup with extended configuration

### Database Changes Required
No database migrations needed - all required fields already exist in Chat model:
- `departmentId` (relation to Department)
- `agentId` (relation to Agent)
- `provider` (ChatProvider enum)
- `priority` (ChatPriority enum)
- `status` (ChatStatus enum)
- `createdAt`, `updatedAt`, `openedAt`, `responseAt`, `closedAt`
- `firstResponseSLA`, `pickupSLA`, `resolutionSLA`, `overallSLA` (boolean flags)
- Message count via `messages` relation count

## Implementation Chunks

### Chunk 1: Type Definitions and Utilities
**Type:** Frontend
**Dependencies:** None
**Effort:** Small (0.5 days)
**Files to create/modify:**
- `src/types/chat-view.ts` - Add new filter fields
- `src/lib/storage/column-preferences.ts` - Create localStorage utility

**Implementation Details:**
- Extend `ChatViewFilters` interface with:
  - `departmentId?: string`
  - `priorityFilter?: ChatPriority[]`
  - `slaStatus?: 'all' | 'within' | 'breached'`
  - `providerFilter?: ChatProvider[]`
  - `messageCountRange?: string` (preset values)
  - `createdAtRange?: { start: Date; end: Date }`
  - `updatedAtRange?: { start: Date; end: Date }`
  - `responseTimeRange?: { min?: number; max?: number }` (milliseconds)
- Create `ChatViewStats` interface for dropdown counts
- Create `ColumnVisibility` type for column preferences
- Create `getColumnPreferences()`, `setColumnPreferences()` utility functions

**Tests required:** Yes
- Unit tests for localStorage utilities (get/set/defaults)
- Type validation tests

**Acceptance criteria:**
- [ ] All filter types properly defined with TypeScript interfaces
- [ ] localStorage utilities handle missing/corrupted data gracefully
- [ ] Default column visibility defined (ID, Contact, Status, Agent, Response Time, Updated, Department, Priority, SLA Status, Created At visible)

---

### Chunk 2: Date Range Picker Component
**Type:** Frontend
**Dependencies:** Chunk 1 must be completed
**Effort:** Small (1 day)
**Files to create/modify:**
- `src/components/ui/date-range-picker.tsx` - New component
- `src/components/ui/calendar.tsx` - Verify exists or install via shadcn

**Implementation Details:**
- Create date range picker with:
  - Preset buttons: Today, Last 7 days, Last 30 days, This month
  - Custom range selection with from/to calendar pickers
  - Clear button to reset range
  - Popover trigger showing selected range or placeholder
- Use shadcn Popover + Calendar components
- Format dates using date-fns library
- Support controlled value prop for integration

**Tests required:** Yes
- Component renders with presets
- Custom range selection works
- Clear functionality works
- Date formatting is correct

**Acceptance criteria:**
- [ ] Presets apply correct date ranges
- [ ] Custom range selection updates value
- [ ] Clear button resets to undefined
- [ ] Component is accessible (keyboard navigation)
- [ ] Displays selected range in readable format

---

### Chunk 3: Column Selector Component
**Type:** Frontend
**Dependencies:** Chunk 1 must be completed
**Effort:** Small (1 day)
**Files to create/modify:**
- `src/components/chats/column-selector.tsx` - New component

**Implementation Details:**
- Create column visibility manager with:
  - Popover trigger button with columns icon
  - Checkbox list of all available columns
  - "Show All" / "Hide All" quick actions
  - "Reset to Default" button
  - Automatically saves to localStorage on change
- Integrate with TanStack Table column visibility API
- Available columns:
  - Always visible: Expand toggle
  - Default visible: ID, Contact, Status, Agent, Response Time, Updated, Department, Priority, SLA Status, Created At
  - Optional: Provider, Tags, Topic, Unread Count, Message Count, Opened At, Picked Up At, Response At, Closed At, Pickup Time, Resolution Time, Avg Response Time, Direction

**Tests required:** Yes
- Column visibility toggles work
- Show/hide all buttons work
- Reset to default restores correct columns
- localStorage persistence works

**Acceptance criteria:**
- [ ] Checkboxes reflect current visibility state
- [ ] Toggling checkbox updates table immediately
- [ ] Preferences persist across page reloads
- [ ] Reset button restores default columns
- [ ] UI indicates number of hidden columns

---

### Chunk 4: Enhanced Filter Bar Component
**Type:** Frontend
**Dependencies:** Chunks 1, 2 must be completed
**Effort:** Medium (2 days)
**Files to create/modify:**
- `src/components/chats/chat-view-filters.tsx` - Major refactor

**Implementation Details:**
- Refactor filter bar following raw-data-filters.tsx pattern:
  - **Search:** Keep existing contact name search with debounce
  - **Date Filters:** Two date range pickers (Created At, Updated At) using Chunk 2 component
  - **Department:** Dropdown with stats (e.g., "Sales (34)")
  - **Agent:** Dropdown with stats (e.g., "John (23), Unassigned (12)")
  - **Status:** Enhanced with stats (e.g., "Opened (45)")
  - **Priority:** New dropdown with stats (e.g., "Urgent (5), High (23)")
  - **SLA Status:** New dropdown (All / Within SLA / Breached SLA) with counts
  - **Provider:** New dropdown with stats (e.g., "WhatsApp (189)")
  - **Message Count:** New dropdown with presets (0, 1-5, 6-10, 11-20, 20+)
  - **Response Time:** Replace presets with min/max number inputs
- Active filters display as pills with individual X buttons
- Active filter count badge
- "Clear All Filters" button
- Maintain 300ms debounce on search input

**Tests required:** Yes
- All filter controls update filter state
- Debounce works on search
- Filter pills display correctly
- Individual filter removal works
- Clear all clears all filters
- Stats display in dropdowns when available

**Acceptance criteria:**
- [ ] All 10 filters functional and update data
- [ ] Filter pills show active filters with remove buttons
- [ ] Stats appear in dropdown options (when data available)
- [ ] Active filter count badge shows correct number
- [ ] Clear all button resets all filters
- [ ] Layout is responsive and doesn't overflow on mobile

---

### Chunk 5: API Route Enhancements for Stats
**Type:** Backend
**Dependencies:** Chunk 1 must be completed
**Effort:** Medium (2 days)
**Files to create/modify:**
- `src/app/api/chats/view/route.ts` - Extend existing endpoint
- `src/app/api/chats/view/stats/route.ts` - New endpoint for filter stats

**Implementation Details:**
- **Extend `/api/chats/view` GET handler:**
  - Accept new query parameters: `departmentId`, `priority`, `slaStatus`, `provider`, `messageCountRange`, `createdAtStart`, `createdAtEnd`, `updatedAtStart`, `updatedAtEnd`, `responseTimeMin`, `responseTimeMax`
  - Build Prisma where clause dynamically based on filters
  - Apply date filters: `createdAt: { gte: start, lte: end }`
  - Apply SLA filter: `overallSLA: true/false` based on status
  - Apply message count filter: calculate from messages relation count
  - Apply response time filter: `firstResponseTime: { gte: min, lte: max }`
  - Maintain existing pagination and sorting logic

- **Create `/api/chats/view/stats` GET endpoint:**
  - Returns aggregated counts for all filter options
  - Response structure:
    ```typescript
    {
      byStatus: { OPENED: 45, PICKED_UP: 23, CLOSED: 178, ... },
      byDepartment: { [deptId]: { name: string, count: number } },
      byAgent: { [agentId]: { name: string, count: number }, unassigned: number },
      byPriority: { urgent: 5, high: 23, normal: 156, low: 12 },
      bySLA: { within: 245, breached: 18 },
      byProvider: { whatsapp: 189, telegram: 34, facebook: 45, ... },
      byMessageCount: { '0': 12, '1-5': 89, '6-10': 134, '11-20': 56, '20+': 23 }
    }
    ```
  - Use Prisma groupBy and count aggregations
  - Cache results with 2min TTL (same as chat cache)
  - Apply user's current filters to stats (stats reflect filtered dataset)

**Tests required:** Yes
- Unit tests for each filter parameter
- Stats endpoint returns correct counts
- Filtering combinations work correctly
- Pagination still works with new filters
- Invalid parameters return 400 with clear errors

**Acceptance criteria:**
- [ ] All new filter parameters accepted and applied
- [ ] Stats endpoint returns accurate counts
- [ ] Stats reflect current filter context
- [ ] Performance is acceptable (<500ms for stats query)
- [ ] Caching reduces redundant database queries

---

### Chunk 6: Updated useChatView Hook
**Type:** Frontend
**Dependencies:** Chunk 5 must be completed
**Effort:** Small (1 day)
**Files to create/modify:**
- `src/lib/hooks/use-chat-view.ts` - Extend hook

**Implementation Details:**
- Add new filter parameters to hook interface
- Create `useChatViewStats()` hook for fetching filter stats
- Use TanStack Query for both data and stats:
  - `useQuery(['chat-view', filters, sorting, pagination])` for chat data
  - `useQuery(['chat-view-stats', filters])` for stats (separate cache)
- Format query parameters for API calls
- Handle date serialization (Date → ISO string)
- Handle response time conversion (display minutes → API milliseconds)
- Invalidate stats cache when filters change

**Tests required:** Yes
- Hook correctly formats filter parameters
- Stats hook fetches and caches data
- Cache invalidation works correctly
- Error states handled properly

**Acceptance criteria:**
- [ ] Hook accepts all new filter parameters
- [ ] Stats are fetched separately and cached
- [ ] Query keys properly include all filter state
- [ ] Automatic refetch on filter changes works
- [ ] Loading and error states properly exposed

---

### Chunk 7: Enhanced Table with New Columns and Sorting
**Type:** Frontend
**Dependencies:** Chunks 1, 3, 6 must be completed
**Effort:** Medium (2 days)
**Files to create/modify:**
- `src/components/chats/chat-view-table.tsx` - Major updates

**Implementation Details:**
- **Add new columns:**
  - **Department:** Display department name (via relation), show "N/A" if null
  - **Priority:** Badge with color coding (urgent=red, high=orange, normal=blue, low=gray)
  - **SLA Status:** Badge with icon (✓ Within / ✗ Breached), color-coded (green/red)
  - **Created At:** Formatted timestamp like Updated At
  - Make all new columns optional (can be hidden via column selector)

- **Make all columns sortable:**
  - Add `enableSorting: true` to all column definitions
  - Add sort indicator icons to column headers (↑↓)
  - Connect to TanStack Table sorting state
  - Pass sorting state to API via `useChatView` hook

- **Column visibility management:**
  - Integrate Column Selector component (Chunk 3)
  - Wire column visibility state to TanStack Table
  - Load initial visibility from localStorage
  - Save visibility changes to localStorage
  - Show column selector button in table header area

- **Additional columns to support (hidden by default):**
  - Provider, Tags, Topic, Unread Count, Message Count, Opened At, Picked Up At, Response At, Closed At, Pickup Time, Resolution Time, Avg Response Time, Direction

**Tests required:** Yes
- New columns render correctly with proper data
- All columns are sortable (click header toggles)
- Column visibility toggles work
- Preferences persist across page reloads
- Empty/null values display properly

**Acceptance criteria:**
- [ ] Department column shows department name or "N/A"
- [ ] Priority column displays color-coded badges
- [ ] SLA Status column shows Within (green ✓) or Breached (red ✗)
- [ ] Created At column formats timestamps correctly
- [ ] All columns have clickable sort headers
- [ ] Sort indicator shows current sort direction
- [ ] Column selector successfully shows/hides columns
- [ ] Hidden columns are removed from DOM
- [ ] Column preferences persist on page reload

---

### Chunk 8: Integration and UI Polish
**Type:** Frontend
**Dependencies:** Chunks 4, 7 must be completed
**Effort:** Small (1 day)
**Files to create/modify:**
- `src/components/chats/chat-view-filters.tsx` - Final touches
- `src/components/chats/chat-view-table.tsx` - Final touches
- `src/app/dashboard/chats/view/page.tsx` - Layout adjustments

**Implementation Details:**
- Wire enhanced filters (Chunk 4) to table (Chunk 7) via shared state
- Connect stats hook to filter dropdowns for count display
- Ensure filter state updates trigger table data refetch
- Add loading skeletons for stats in dropdowns
- Handle edge cases:
  - No stats available (don't show counts)
  - All filters cleared (reset to defaults)
  - Invalid date ranges (show validation error)
  - Response time min > max (show validation error)
- Polish responsive layout for mobile/tablet
- Add helpful empty states when no data matches filters
- Ensure keyboard accessibility for all new controls

**Tests required:** Yes - E2E
- Complete user flow: apply multiple filters → data updates correctly
- Clear filters → data returns to unfiltered state
- Sort + filter combination works
- Column visibility + sort + filter all work together
- Mobile responsive layout works
- Keyboard navigation works

**Acceptance criteria:**
- [ ] All filters work together without conflicts
- [ ] Stats display correctly in all dropdowns
- [ ] Table updates immediately when filters change
- [ ] Sorting works independently of filtering
- [ ] Column visibility works with sorting and filtering
- [ ] Layout is responsive on all screen sizes
- [ ] Empty states display when no data matches filters
- [ ] Loading states display during data fetches
- [ ] All controls are keyboard accessible

---

## Testing Strategy

### Unit Tests
- **When:** During implementation of each chunk
- **What to test:**
  - Chunk 1: localStorage utilities, type guards
  - Chunk 2: Date range picker presets, date formatting
  - Chunk 3: Column visibility state management
  - Chunk 4: Filter state updates, debounce logic
  - Chunk 5: API route parameter parsing, Prisma query building, stats aggregation
  - Chunk 6: Hook parameter formatting, query key generation
  - Chunk 7: Column rendering, sort state management

### Integration Tests
- **When:** After Chunks 5, 6 complete
- **What to test:**
  - API route + hook integration
  - Filter state → API parameters → database query → response
  - Stats endpoint accuracy with various filter combinations
  - Cache invalidation on filter changes

### E2E Tests
- **When:** After Chunk 8 completes
- **What to test:**
  - User applies multiple filters and sees updated data
  - User sorts by different columns and sees reordered data
  - User shows/hides columns and preferences persist
  - User clears individual filters via pills
  - User clears all filters via button
  - User selects date ranges (presets and custom)
  - Page loads with persisted column preferences
  - Mobile responsive behavior

### Performance Tests
- **When:** After all chunks complete
- **What to test:**
  - Stats endpoint response time (<500ms)
  - Filter application with large datasets (10k+ chats)
  - localStorage read/write performance
  - Table rendering with all columns visible

## Database Changes

### Migrations Needed
None - all required fields already exist in the Chat model from previous features.

### Indexes to Verify (should already exist)
- `chats_department_id_idx` - for department filtering
- `chats_agent_id_idx` - for agent filtering
- `chats_status_idx` - for status filtering
- `chats_priority_idx` - for priority filtering
- `chats_provider_idx` - for provider filtering
- `chats_created_at_idx` - for created date filtering
- `chats_updated_at_idx` - for updated date filtering
- `chats_overall_sla_idx` - for SLA filtering

## API Changes

### Modified Endpoints

**GET `/api/chats/view`**
- **New query parameters:**
  - `departmentId?: string` - Filter by department ID
  - `priority?: string` - Filter by priority level (urgent|high|normal|low)
  - `slaStatus?: string` - Filter by SLA status (all|within|breached)
  - `provider?: string` - Filter by provider (whatsapp|telegram|facebook|livechat|b2cbotapi)
  - `messageCountRange?: string` - Filter by message count (0|1-5|6-10|11-20|20+)
  - `createdAtStart?: string` - ISO date string for created date range start
  - `createdAtEnd?: string` - ISO date string for created date range end
  - `updatedAtStart?: string` - ISO date string for updated date range start
  - `updatedAtEnd?: string` - ISO date string for updated date range end
  - `responseTimeMin?: number` - Min response time in milliseconds
  - `responseTimeMax?: number` - Max response time in milliseconds
- **Response:** Unchanged (ChatViewResponse)
- **Validation:**
  - Date strings must be valid ISO 8601 format
  - Response time values must be non-negative integers
  - Enum values (priority, provider, slaStatus) validated against allowed values
  - Message count range validated against preset values

### New Endpoints

**GET `/api/chats/view/stats`**
- **Purpose:** Fetch aggregated counts for filter dropdowns
- **Query parameters:** Same as `/api/chats/view` (to compute stats for filtered dataset)
- **Response:**
  ```typescript
  {
    byStatus: Record<ChatStatus, number>
    byDepartment: Record<string, { name: string; count: number }>
    byAgent: Record<string, { name: string; count: number }> & { unassigned: number }
    byPriority: Record<ChatPriority, number>
    bySLA: { within: number; breached: number }
    byProvider: Record<ChatProvider, number>
    byMessageCount: { '0': number; '1-5': number; '6-10': number; '11-20': number; '20+': number }
  }
  ```
- **Caching:** 2min TTL (same as chat data cache)
- **Authentication:** Required (Clerk userId)
- **Rate limit:** 30 requests/min (dashboard tier)

## Integration Points

### Services Affected
- **Chat Management Service:** Core feature being enhanced
- **Dashboard Analytics:** Filters may influence which chats appear in analytics
- **Agent Performance:** Filtered views may be used for agent performance review
- **Customer Analysis:** Department and priority filters help segment customer data

### External Systems
None - all changes are internal to the frontend and API layer

### Existing Features Integration
- **Feature 007 (Raw Data Viewer):** Shares filter pattern implementation
- **Feature 008 (Expandable Chat View):** Direct enhancement of this feature
- **Feature 004 (SLA Calculation):** Uses SLA boolean flags for filtering

## Rollback Plan

### How to Undo This Feature
1. **Code Rollback:**
   - Revert all modified files to previous commits
   - Remove new files: `date-range-picker.tsx`, `column-selector.tsx`, `column-preferences.ts`, `/api/chats/view/stats/route.ts`
   - Restore previous `chat-view-filters.tsx` and `chat-view-table.tsx` versions

2. **Database Rollback:**
   - No database changes, so no migrations to revert

3. **Cache Cleanup:**
   - Clear chat view cache: `cache.invalidateFeatureCache('chats')`
   - Clear user-specific localStorage: Users clear browser cache or localStorage manually

4. **API Compatibility:**
   - Old API parameters still supported (backward compatible)
   - New parameters simply ignored if not present
   - No breaking changes to existing API contracts

### Feature Flag Considerations
- Could add `ENABLE_ENHANCED_CHAT_VIEW` feature flag in `.env`
- Wrap enhanced filter bar in conditional: `if (process.env.NEXT_PUBLIC_ENABLE_ENHANCED_CHAT_VIEW)`
- Fall back to original filter bar if disabled
- Would require minor refactor to support both UIs simultaneously

## Documentation Updates

### Developer Documentation
- **File:** `docs/features/chat-view-enhanced-filters.md` (create new)
  - Explain all available filters and how they work
  - Document column visibility system and localStorage schema
  - API endpoint documentation with examples
  - Performance considerations for stats endpoint

### User Documentation
- **File:** `docs/user-guide/chat-view.md` (update)
  - How to use new filters
  - How to show/hide columns
  - How to save custom views
  - Tips for effective filtering strategies

### API Documentation
- **File:** `docs/api/chats.md` (update)
  - Document new query parameters for `/api/chats/view`
  - Document new `/api/chats/view/stats` endpoint
  - Provide request/response examples
  - Document validation rules and error responses

### Component Documentation
- Add JSDoc comments to all new components
- Document props and usage examples
- Add Storybook stories if Storybook is configured

## Success Criteria

### Functional Completeness
- [ ] All 10 filter types implemented and working
- [ ] All columns sortable (14 default + optional columns)
- [ ] Column visibility manager functional with localStorage persistence
- [ ] Stats displayed in all relevant filter dropdowns
- [ ] Filter pills show active filters with individual remove buttons
- [ ] All new columns (Department, Priority, SLA Status, Created At) displaying correctly

### Performance Benchmarks
- [ ] Stats endpoint responds in <500ms for datasets up to 10k chats
- [ ] Filter application updates table in <300ms (excluding network)
- [ ] Column visibility toggle is instant (<50ms)
- [ ] No memory leaks from localStorage or state management
- [ ] Page load time with column preferences <2s

### User Experience
- [ ] Filters are intuitive and easy to discover
- [ ] Active filters are clearly visible as pills
- [ ] Column selector is easy to find and use
- [ ] Mobile layout is responsive and usable
- [ ] All controls are keyboard accessible
- [ ] Loading states provide clear feedback
- [ ] Empty states guide users when no data matches filters

### Code Quality
- [ ] All components have TypeScript types
- [ ] Unit test coverage >80% for new code
- [ ] E2E tests cover primary user flows
- [ ] No console errors or warnings
- [ ] Code follows existing project patterns
- [ ] All functions have JSDoc comments

### Compatibility
- [ ] Works in Chrome, Firefox, Safari, Edge (latest versions)
- [ ] Works on mobile Safari and Chrome (iOS/Android)
- [ ] Backward compatible with existing API consumers
- [ ] No breaking changes to existing filter functionality
- [ ] Graceful degradation if localStorage is disabled

---

## Implementation Notes

### Effort Estimation
- **Total Effort:** ~10.5 days
  - Chunk 1: 0.5 days
  - Chunk 2: 1 day
  - Chunk 3: 1 day
  - Chunk 4: 2 days
  - Chunk 5: 2 days
  - Chunk 6: 1 day
  - Chunk 7: 2 days
  - Chunk 8: 1 day

### Parallel Development Opportunities
- Chunks 2 & 3 can be developed in parallel (both depend only on Chunk 1)
- Chunk 5 (backend) can be developed in parallel with Chunks 2, 3, 4 (frontend)
- Testing can begin as soon as individual chunks complete

### Risk Factors
- **Stats performance:** May need query optimization or additional indexes for large datasets
- **Filter complexity:** Combining many filters could create complex Prisma queries - may need query builder refactor
- **localStorage limits:** Browser localStorage size limits could be reached with many preferences - handle gracefully
- **Mobile UX:** Many filters may overwhelm mobile users - consider simplified mobile view
- **Column count:** Too many optional columns could confuse users - need good defaults and organization

### Dependencies on External Libraries
- `date-fns` - Date formatting and manipulation (likely already installed)
- `@tanstack/react-table` - Already in use, leveraging column visibility and sorting APIs
- `@radix-ui/react-popover` - shadcn Popover component (should be installed)
- `@radix-ui/react-calendar` - shadcn Calendar component (may need to install via `npx shadcn@latest add calendar`)
