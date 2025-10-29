# Feature 015: Chat View Filters and Sorting Reorganization

## Requirements

### Original User Requirements
- Improve organization and usability of /chats/view filters and sorting
- Reduce visual clutter and cognitive load from 10 filters across 3 rows
- Make sorting more intuitive with clear visual indicators
- Enable URL-based filter sharing and persistence
- Support multi-select filtering for better user control
- Improve stats endpoint performance with caching

### Acceptance Criteria
- Primary filters remain always visible, secondary filters are collapsible
- Users can easily identify which column is currently sorted
- Filter state is synced to URL query parameters for sharing
- Users can select multiple values for Status, Priority, and Provider filters
- Stats endpoint response time improved with caching layer
- All existing filter and sort functionality continues to work
- Mobile responsive design maintained

## Architecture Design

### How This Feature Fits Into Existing App Patterns

This feature enhances the existing chat view system without introducing new architectural patterns. It follows established patterns:

1. **Component Structure**: Continues using the existing component hierarchy:
   - `app/dashboard/chats/view/page.tsx` (unchanged)
   - `components/chats/chat-view-table.tsx` (sort UI enhancements)
   - `components/chats/chat-view-filters.tsx` (filter reorganization)
   - `app/api/chats/view/route.ts` (multi-select support)
   - `app/api/chats/view/stats/route.ts` (caching)

2. **State Management**: Uses existing React hooks + TanStack Query pattern
   - URL sync via Next.js `useSearchParams` and `useRouter`
   - Filter state remains in component state but synced to URL
   - TanStack Query caching for API responses

3. **Caching Strategy**: Follows Aspect 10 patterns from planning-agent.md
   - Uses LRUCache with feature-specific configuration
   - Implements `withCache()` wrapper for stats endpoint
   - TTL: 10 minutes for stats, 5 minutes for chat data

### Components/Services Modified

**Frontend Components:**
- `src/components/chats/chat-view-filters.tsx` - Filter UI reorganization
- `src/components/chats/chat-view-table.tsx` - Sort indicator UI
- `src/lib/hooks/use-chat-view.ts` - URL parameter handling
- `src/types/chat-view.ts` - Type updates for multi-select

**Backend Services:**
- `src/app/api/chats/view/route.ts` - Multi-select array handling
- `src/app/api/chats/view/stats/route.ts` - Caching integration
- `src/lib/cache.ts` - Cache configuration for stats (already exists)

**UI Components (shadcn/ui):**
- `src/components/ui/multi-select.tsx` - NEW: Multi-select dropdown component

### Integration Points With Existing Systems

1. **TanStack Table v8**: Sort state management via `SortingState`
2. **TanStack Query**: Data fetching with cache invalidation
3. **Next.js App Router**: URL parameter handling with `useSearchParams`
4. **Existing Caching**: Leverages `lib/cache.ts` LRUCache infrastructure
5. **shadcn/ui**: Maintains consistent UI component patterns

### Database Changes Required

**None** - This is a UI/API enhancement only. No schema changes needed.

## Implementation Chunks

### Chunk 1: Reorganize Filters into Collapsible Sections

**Type:** Frontend
**Dependencies:** None
**Estimated Effort:** 0.5 days

**Files to create/modify:**
- `src/components/chats/chat-view-filters.tsx` (modify)
- `src/components/ui/collapsible.tsx` (verify exists, create if needed)

**Implementation Details:**
1. Split filters into two groups:
   - **Primary (always visible)**: Search, Status, Agent, Priority, Date Range (Created At)
   - **Advanced (collapsible)**: Department, SLA Status, Provider, Message Count, Updated At, Response Time
2. Add "Show Advanced Filters" toggle button with badge showing active advanced filter count
3. Use shadcn/ui Collapsible component for smooth expand/collapse animation
4. Persist collapsed state to localStorage (`chat-view-advanced-filters-collapsed`)
5. Maintain responsive design for mobile (stack filters vertically)

**Tests required:** Yes
- Unit test: Filter visibility based on collapsed state
- Unit test: localStorage persistence
- E2E test: User can expand/collapse advanced filters
- E2E test: Active advanced filter count badge displays correctly

**Acceptance criteria:**
- [ ] Primary filters (Search, Status, Agent, Priority, Created At) always visible in Row 1
- [ ] Advanced filters hidden by default with "Show Advanced Filters (3)" toggle button
- [ ] Clicking toggle expands Row 2 with remaining filters
- [ ] Badge shows count of active advanced filters (e.g., "Show Advanced Filters (2)")
- [ ] Collapsed state persists to localStorage
- [ ] Mobile layout remains functional with stacked filters
- [ ] Clear Filters button clears both primary and advanced filters

---

### Chunk 2: Improve Sorting UI with Visual Indicators

**Type:** Frontend
**Dependencies:** None
**Estimated Effort:** 0.5 days

**Files to create/modify:**
- `src/components/chats/chat-view-table.tsx` (modify column header rendering)

**Implementation Details:**
1. Add sort direction icons (ChevronUp/ChevronDown) to sortable column headers
2. Highlight currently sorted column with accent color and bold text
3. Show unsorted state with neutral ChevronUpDown icon
4. Update TanStack Table column definitions:
   - Add custom `header` render function for sortable columns
   - Read `column.getIsSorted()` state
   - Apply conditional styling based on sort direction
5. Ensure accessibility (aria-sort attributes)

**Tests required:** Yes
- Unit test: Column header renders correct icon based on sort state
- Unit test: Sorted column has highlighted styling
- E2E test: Clicking column header toggles sort direction and updates icon
- E2E test: Only one column shows as sorted at a time

**Acceptance criteria:**
- [ ] Sortable column headers show ChevronUpDown icon when not sorted
- [ ] Active sorted column shows ChevronUp (asc) or ChevronDown (desc) icon
- [ ] Sorted column header has accent color (primary) and bold font weight
- [ ] Clicking header toggles: unsorted → asc → desc → unsorted
- [ ] Icons are visually aligned and consistent across all columns
- [ ] Hover state shows cursor pointer for sortable columns
- [ ] Screen readers announce sort state via aria-sort

---

### Chunk 3: Sync Filters to URL Query Parameters

**Type:** Both (Frontend + API)
**Dependencies:** Chunks 1 and 2 should be completed first
**Estimated Effort:** 1 day

**Files to create/modify:**
- `src/lib/hooks/use-chat-view.ts` (modify to sync URL params)
- `src/components/chats/chat-view-filters.tsx` (read from URL on mount)
- `src/components/chats/chat-view-table.tsx` (read sort from URL)

**Implementation Details:**
1. **URL Parameter Schema:**
   - `search` - contact name search string
   - `status` - comma-separated ChatStatus values
   - `agentId` - agent ID or "unassigned"
   - `priority` - comma-separated priority values
   - `department` - department ID
   - `sla` - "all" | "within" | "breached"
   - `provider` - comma-separated provider values
   - `msgCount` - message count range
   - `createdStart` / `createdEnd` - ISO date strings
   - `updatedStart` / `updatedEnd` - ISO date strings
   - `respTimeMin` / `respTimeMax` - response time in minutes
   - `sortBy` - sort field name
   - `sortOrder` - "asc" | "desc"
   - `page` - pagination page number

2. **Implementation Steps:**
   - Use `useSearchParams()` hook to read initial URL state
   - Use `useRouter()` and `router.replace()` to update URL without navigation
   - Debounce URL updates (500ms) to avoid excessive history entries
   - Parse URL params to filter state on component mount
   - Update URL when filters/sort change
   - Handle invalid URL params gracefully (fall back to defaults)

3. **URL State Sync:**
   - Filter changes → update URL + fetch data
   - Sort changes → update URL + fetch data
   - Browser back/forward → read URL + update state + fetch data
   - Deep link → parse URL + apply filters + fetch data

**Tests required:** Yes
- Unit test: URL params correctly parsed to filter state
- Unit test: Filter state correctly serialized to URL params
- Unit test: Invalid URL params fall back to defaults
- E2E test: Applying filters updates URL
- E2E test: Copying URL and pasting in new tab applies same filters
- E2E test: Browser back button restores previous filter state

**Acceptance criteria:**
- [ ] All filter and sort state is reflected in URL query parameters
- [ ] Copying and sharing URL preserves exact filter/sort configuration
- [ ] Browser back/forward buttons work correctly with filter history
- [ ] URL updates are debounced to prevent history spam
- [ ] Invalid or malicious URL parameters are sanitized and ignored
- [ ] Page load with URL params automatically applies filters
- [ ] URL remains human-readable (no encoded JSON blobs)

---

### Chunk 4: Upgrade to Multi-Select Filters

**Type:** Both (Frontend + Backend)
**Dependencies:** Chunk 3 (URL sync) should be completed first
**Estimated Effort:** 1.5 days

**Files to create/modify:**
- `src/components/ui/multi-select.tsx` (create new component)
- `src/components/chats/chat-view-filters.tsx` (use multi-select for Status, Priority, Provider)
- `src/types/chat-view.ts` (update filter types)
- `src/app/api/chats/view/route.ts` (handle array params)
- `src/app/api/chats/view/stats/route.ts` (handle array params)

**Implementation Details:**

**Frontend:**
1. Create `multi-select.tsx` component extending shadcn/ui:
   - Dropdown with checkboxes for each option
   - "Select All" / "Clear All" quick actions
   - Selected count badge (e.g., "Status (3)")
   - Search/filter within options for long lists
   - Keyboard navigation support

2. Replace single-select dropdowns with multi-select:
   - Status: Allow multiple ChatStatus selections
   - Priority: Allow multiple ChatPriority selections
   - Provider: Allow multiple ChatProvider selections

3. Update active filter pills:
   - Show "Status: Opened, Closed (2)" instead of separate pills
   - Allow removing individual values from multi-select pills

**Backend:**
1. Update API route to handle array parameters:
   - Parse comma-separated strings to arrays
   - Update Prisma queries: `status: { in: statusArray }`
   - Validate array values against allowed enums

2. Update stats endpoint:
   - Handle array filters for counts
   - Return stats for each option showing filtered count

**URL Schema:**
- `status=OPENED,CLOSED,PICKED_UP`
- `priority=urgent,high`
- `provider=whatsapp,telegram`

**Tests required:** Yes
- Unit test: Multi-select component renders with options
- Unit test: Select All / Clear All functionality
- Unit test: API correctly parses comma-separated arrays
- Unit test: Prisma query uses `{ in: [...] }` for arrays
- E2E test: User can select multiple statuses and see filtered results
- E2E test: Stats update correctly with multi-select filters
- E2E test: URL params handle comma-separated values

**Acceptance criteria:**
- [ ] Status dropdown allows selecting multiple statuses with checkboxes
- [ ] Priority dropdown allows selecting multiple priorities
- [ ] Provider dropdown allows selecting multiple providers
- [ ] "Select All" and "Clear All" buttons work in multi-select dropdowns
- [ ] Selected count badge displays (e.g., "Priority (2)")
- [ ] Active filter pills show combined values: "Status: Opened, Closed (2)"
- [ ] Backend API correctly filters using `WHERE status IN (...)` logic
- [ ] Stats endpoint returns counts for each option considering multi-select filters
- [ ] URL encoding handles comma-separated values correctly
- [ ] Empty array (no selection) shows all results (no filter applied)

---

### Chunk 5: Optimize Stats Endpoint with Caching

**Type:** Backend
**Dependencies:** Chunk 4 (multi-select) should be completed first
**Estimated Effort:** 0.5 days

**Files to create/modify:**
- `src/app/api/chats/view/stats/route.ts` (add caching)
- `src/lib/cache.ts` (verify chat stats cache config exists)

**Implementation Details:**
1. Add stats-specific cache configuration to `CACHE_CONFIGS`:
   ```typescript
   chatViewStats: {
     maxSize: 100,
     ttl: 10 * 60 * 1000, // 10 minutes
   }
   ```

2. Wrap stats query with `withCache()`:
   - Cache key: `userId:chat-view-stats:filterHash`
   - Filter hash: MD5 of serialized filter params for unique cache key
   - TTL: 10 minutes (stats don't need real-time updates)

3. Cache invalidation strategy:
   - Stats cache invalidated when chat data changes
   - Manual invalidation via `invalidateRelatedCache('chats')`
   - Called from sync engine after data updates

4. Add cache headers to response:
   - `Cache-Control: private, max-age=600` (10 min)
   - `X-Cache: HIT` or `X-Cache: MISS` for debugging

**Tests required:** Yes
- Unit test: Stats endpoint uses cache on repeated requests
- Unit test: Cache key includes filter parameters
- Unit test: Different filters produce different cache keys
- Unit test: Cache invalidation clears stats cache
- Load test: Stats endpoint performance with and without cache

**Acceptance criteria:**
- [ ] Stats endpoint response time < 200ms for cached requests
- [ ] Repeated stats requests with same filters return cached results
- [ ] Different filter combinations produce unique cache keys
- [ ] Cache TTL is 10 minutes
- [ ] Cache invalidates when chat data changes (post-sync)
- [ ] Response includes `X-Cache` header for debugging
- [ ] Cache respects multi-tenant isolation (userId in cache key)
- [ ] Load test shows >5x performance improvement with cache

---

## Testing Strategy

### Unit Tests
**Files to create:**
- `src/components/chats/__tests__/chat-view-filters.test.tsx`
  - Test filter collapse/expand
  - Test localStorage persistence
  - Test multi-select component
  - Test URL param parsing
  - Test filter validation

- `src/components/chats/__tests__/chat-view-table.test.tsx`
  - Test sort indicator rendering
  - Test column header interactions
  - Test sort state management

- `src/components/ui/__tests__/multi-select.test.tsx`
  - Test option selection
  - Test Select All / Clear All
  - Test keyboard navigation
  - Test search filtering

- `src/app/api/chats/view/__tests__/route.test.ts`
  - Test multi-select array parsing
  - Test Prisma query generation with `IN` clause
  - Test URL param validation
  - Test error handling

- `src/app/api/chats/view/stats/__tests__/route.test.ts`
  - Test caching behavior
  - Test cache key generation
  - Test cache invalidation
  - Test stats with multi-select filters

**When to write:** During implementation of each chunk (TDD approach)

### Integration Tests
- Test filter changes → API call → UI update flow
- Test sort changes → API call → UI update flow
- Test URL params → filter state → API call → results flow
- Test cache invalidation → fresh data flow

**When to write:** After Chunk 4 (when all pieces integrated)

### E2E Tests
**File to create:**
- `e2e/chat-view-filters-sorting.spec.ts`

**Test scenarios:**
1. User collapses/expands advanced filters
2. User applies primary filter → sees filtered results
3. User applies advanced filter → sees filtered results
4. User clicks column header → sees sorted results with indicator
5. User selects multiple statuses → sees combined results
6. User copies URL → pastes in new tab → sees same filters applied
7. User clicks browser back → returns to previous filter state
8. User clears all filters → sees full dataset

**When to write:** After Chunk 5 (all features complete)

### Load Tests
**File to create:**
- `k6/chat-view-stats-cache.js`

**Test scenarios:**
- Stats endpoint without cache: baseline performance
- Stats endpoint with cache: measure improvement
- Cache hit rate over time
- Performance with concurrent users

**When to write:** After Chunk 5 (caching implemented)

---

## Database Changes

**No database migrations required.**

This feature only modifies UI, API query logic, and caching. All necessary database columns and indexes already exist from Feature 011.

---

## API Changes

### Modified Endpoints

#### GET `/api/chats/view`
**Query Parameter Changes:**
- `status` - Changed from single value to comma-separated array: `status=OPENED,CLOSED`
- `priority` - Changed from single value to comma-separated array: `priority=urgent,high`
- `provider` - Changed from single value to comma-separated array: `provider=whatsapp,telegram`
- All other parameters remain unchanged

**Response Format:** No changes (maintains existing structure)

**Backward Compatibility:**
- Single values still work (e.g., `status=OPENED`)
- Existing clients unaffected
- New multi-select behavior is opt-in via comma-separated values

#### GET `/api/chats/view/stats`
**Query Parameter Changes:**
- Same multi-select support as above
- Stats calculated considering all selected values

**Response Format:** No changes

**Caching:**
- Adds `Cache-Control` header
- Adds `X-Cache` header (HIT/MISS)

**Performance:**
- Expected < 200ms response time (cached)
- Up to 5x improvement vs uncached

### New Endpoints

None - only modifications to existing endpoints

---

## Integration Points

### Services Affected

1. **Chat View Components** (`/chats/view`)
   - Filter UI reorganization
   - Sort indicator enhancements
   - URL state management
   - Multi-select filter controls

2. **TanStack Query Hooks** (`use-chat-view.ts`)
   - Query key generation includes new filter arrays
   - URL parameter sync added
   - Cache invalidation on filter changes

3. **Caching Service** (`lib/cache.ts`)
   - New cache config for chat view stats
   - Cache invalidation on chat data changes
   - Integration with existing sync engine invalidation

4. **shadcn/ui Components**
   - New multi-select component added
   - Collapsible component used for advanced filters
   - Maintains consistent design system

### External Systems

**None** - all changes are internal to the b2chat-analytics application

### Dependencies on Other Features

- **Feature 011** (Chat View Enhanced Filters) - This enhances that feature
- **Sync Engine** - Cache invalidation on sync completion
- **Authentication** (Clerk) - Maintains existing auth patterns
- **Audit Logging** - Maintains existing audit patterns for filter usage

---

## Rollback Plan

### How to Undo This Feature

1. **Revert Frontend Changes:**
   - Restore previous version of `chat-view-filters.tsx`
   - Restore previous version of `chat-view-table.tsx`
   - Remove `multi-select.tsx` component
   - Restore previous version of `use-chat-view.ts`

2. **Revert Backend Changes:**
   - Restore previous version of `/api/chats/view/route.ts`
   - Restore previous version of `/api/chats/view/stats/route.ts`
   - Remove stats cache configuration

3. **No Database Rollback Needed**
   - No schema changes were made
   - No data migrations required

### Rollback Testing

- Verify all filters work in single-select mode
- Verify sorting works without visual indicators
- Verify stats endpoint works without caching
- Verify no URL parameters affect functionality

### Feature Flag Considerations

**Optional:** Add feature flag `ENABLE_ENHANCED_CHAT_VIEW_FILTERS` to incrementally roll out:

```env
# .env
ENABLE_ENHANCED_CHAT_VIEW_FILTERS=false
```

**Rollback Steps with Feature Flag:**
1. Set `ENABLE_ENHANCED_CHAT_VIEW_FILTERS=false`
2. Redeploy application
3. Users see previous filter/sort UI
4. No code changes needed

**Feature Flag Implementation:**
- Wrap new filter UI in conditional check
- Fall back to legacy single-select dropdowns
- Disable URL sync when flag is off

---

## Documentation Updates

### Files to Create/Update

1. **Feature 011 Document** (`features/feature-011-chat-view-enhanced-filters-columns.md`)
   - Add "Related Features" section
   - Link to Feature 015 as enhancement/refinement

2. **User Guide** (create if doesn't exist: `docs/user-guide/chat-view-filters.md`)
   - Document advanced filter collapse/expand
   - Explain multi-select filter usage
   - Document URL sharing for filtered views
   - Include screenshots of sort indicators

3. **API Documentation** (update: `docs/api/chats.md`)
   - Document multi-select parameter format
   - Update examples to show array syntax
   - Document caching headers

4. **Development Guide** (`docs/development/FILTERS_AND_SORTING.md`)
   - Document URL parameter schema
   - Document cache key generation
   - Document multi-select component usage pattern

### Code Comments

Add comprehensive JSDoc comments to:
- `multi-select.tsx` component
- `useSearchParams` integration in `use-chat-view.ts`
- Cache key generation logic
- Filter parsing functions

---

## Success Criteria

### How to Know When Feature is Complete

1. **Functional Completeness:**
   - [ ] All 5 implementation chunks completed and tested
   - [ ] All unit tests passing (coverage > 80% for new code)
   - [ ] All E2E tests passing
   - [ ] Load tests show expected performance improvement

2. **User Experience:**
   - [ ] Primary filters visible without scrolling on desktop
   - [ ] Advanced filters collapsed by default to reduce clutter
   - [ ] Sort indicators clearly show current sort state
   - [ ] Multi-select filters allow selecting 2+ values
   - [ ] URL sharing works for all filter combinations

3. **Performance:**
   - [ ] Stats endpoint < 200ms for cached requests
   - [ ] Cache hit rate > 70% in production
   - [ ] No performance regression on main data endpoint
   - [ ] Mobile load time unchanged or improved

4. **Quality:**
   - [ ] No console errors or warnings
   - [ ] Accessibility audit passes (WCAG 2.1 AA)
   - [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
   - [ ] Mobile responsive testing (iOS Safari, Android Chrome)

### Metrics and Validation Criteria

**Performance Metrics:**
- Stats endpoint p95 response time < 300ms
- Cache hit rate > 70%
- Main endpoint p95 response time unchanged

**User Engagement Metrics:**
- Track usage of advanced filters (collapse/expand rate)
- Track multi-select filter usage vs single-select
- Track URL sharing frequency (referrer analysis)

**Quality Metrics:**
- Zero production errors related to filters/sorting
- User-reported filter bugs < 2 per month
- Support tickets about filters decreased by 30%

**Validation Steps:**
1. Deploy to staging environment
2. QA team performs full regression test
3. Product team validates UX improvements
4. Monitor performance metrics for 48 hours
5. Canary release to 10% of users
6. Monitor error rates and user feedback
7. Full release if metrics meet criteria

---

## Implementation Timeline

**Total Estimated Effort:** 4 days

- **Chunk 1:** 0.5 days (Collapsible filters)
- **Chunk 2:** 0.5 days (Sort indicators)
- **Chunk 3:** 1 day (URL sync)
- **Chunk 4:** 1.5 days (Multi-select filters)
- **Chunk 5:** 0.5 days (Stats caching)

**Suggested Order:**
1. Day 1 AM: Chunk 1 (Collapsible filters)
2. Day 1 PM: Chunk 2 (Sort indicators)
3. Day 2: Chunk 3 (URL sync)
4. Day 3-4: Chunk 4 (Multi-select filters)
5. Day 4 PM: Chunk 5 (Stats caching)

**Testing Timeline:**
- Unit tests: Written during each chunk (TDD)
- Integration tests: Day 4 after Chunk 4
- E2E tests: Day 4-5 after Chunk 5
- Load tests: Day 5

**Total with Testing:** 5 days

---

## Notes and Considerations

### Design Decisions

1. **Why collapse advanced filters instead of tabs?**
   - Tabs require more clicks to access filters
   - Collapsible maintains single-page view
   - Follows existing pattern from raw-data-filters.tsx

2. **Why multi-select instead of AND/OR builder?**
   - Multi-select is more intuitive for non-technical users
   - AND/OR builder adds significant complexity
   - Most use cases satisfied by multi-select OR logic

3. **Why 10-minute cache TTL for stats?**
   - Stats don't need real-time accuracy
   - Balances performance vs freshness
   - Aligns with existing analytics cache patterns

### Future Enhancements (Not in Scope)

- Saved filter presets (user-defined)
- Column presets (essential/detailed/SLA views)
- Advanced filter builder (complex AND/OR logic)
- Filter analytics (track most-used filters)
- Export filtered results to CSV/Excel

### Known Limitations

- URL length limit (~2000 chars) may restrict very complex filters
- Browser back button creates history entry for each filter change (debounced to minimize)
- Multi-select with 50+ options may have UX challenges (future enhancement: search within dropdown)

### Dependencies and Risks

**Dependencies:**
- TanStack Table v8 (already in use)
- TanStack Query v4 (already in use)
- Next.js 15 App Router (already in use)
- shadcn/ui components (already in use)

**Risks:**
- **Low Risk:** URL parameter parsing could fail with malicious input
  - Mitigation: Comprehensive input validation and sanitization
- **Low Risk:** Cache invalidation could miss some scenarios
  - Mitigation: Conservative TTL (10 min) and manual invalidation option
- **Medium Risk:** Multi-select arrays could cause performance issues with large datasets
  - Mitigation: Database indexes already exist, Prisma optimizes `IN` queries

**Blockers:**
- None identified - all dependencies already in place
