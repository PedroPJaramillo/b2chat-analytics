# Feature 009: Enhanced Contacts Table Filters

**Status:** 📋 **PLANNED**

## Requirements

### User Requirements
- Add more filter options to contacts table (tags, date ranges, chat count)
- Make filters more discoverable and easy to use
- Support advanced filtering combinations

### Acceptance Criteria
- [ ] Tag filter with multi-select dropdown showing all available tags
- [ ] Date range filters for Created and Updated dates
- [ ] Chat count range filter (0, 1-5, 6-10, 10+)
- [ ] All filters work together (AND logic)
- [ ] Filter state persists during session
- [ ] Active filters clearly displayed with badges
- [ ] Tests for all new filter functionality

## Architecture Design

### How This Feature Fits Into Existing App Patterns

Following the **5-layer architecture**:

**Layer 1 - Database Schema**:
- No database changes required
- Existing Contact model has all required fields
- Tags stored as JSONB in `tags` column

**Layer 2 - B2Chat Client & Sync Engine**:
- No changes required

**Layer 3 - API Endpoints**:
- **Modify** `/api/contacts` GET endpoint to:
  - Support tag filtering (already implemented but not exposed in UI)
  - Support date range filtering (already implemented but not exposed in UI)
  - Add chat count range filtering (new)
- **Create** `/api/contacts/tags` GET endpoint to fetch all unique tags

**Layer 4 - Frontend**:
- **Modify** `src/components/contacts/contact-filters.tsx`:
  - Add tag multi-select filter
  - Add date range pickers for created/updated dates
  - Add chat count range selector
  - Improve filter layout and UX
- **Create** `src/lib/hooks/use-contact-tags.ts`:
  - React Query hook to fetch available tags
- **Modify** `src/types/contact.ts`:
  - Add ChatCountRange type

**Layer 5 - Infrastructure**:
- Caching: 30-minute TTL for tags list (static data)
- No rate limiting changes needed

### Components/Services Created/Modified

**Modified API Routes**:
- `src/app/api/contacts/route.ts` - Add chat count range filtering

**New API Routes**:
- `src/app/api/contacts/tags/route.ts` - Fetch all unique tags from contacts

**Modified Frontend Components**:
- `src/components/contacts/contact-filters.tsx` - Add new filter controls

**New Hooks**:
- `src/lib/hooks/use-contact-tags.ts` - Fetch available tags

**Modified Types**:
- `src/types/contact.ts` - Add ChatCountRange and enhance ContactsFilters

### Integration Points with Existing Systems

**1. Existing Filter System**:
- Extends current `ContactsFilters` interface
- Maintains backward compatibility
- Uses same debounced search pattern

**2. API Compatibility**:
- Leverages existing API filter support for tags and dates
- Adds new chatCountMin/chatCountMax params

**3. UI Component Reuse**:
- Uses shadcn Select, Popover, Calendar components
- Follows existing filter badge pattern
- Maintains consistent styling

## Implementation Plan

### Chunk 1: API - Tags Endpoint & Chat Count Filter

**Files to Create**:
- `src/app/api/contacts/tags/route.ts`

**Files to Modify**:
- `src/app/api/contacts/route.ts` - Add chat count range filtering
- `src/types/contact.ts` - Add ChatCountRange type

**Implementation Details**:
```typescript
// New types
export type ChatCountRange = 'none' | 'first' | 'low' | 'medium' | 'high'

// Enhanced ContactsFilters
export interface ContactsFilters {
  search?: string
  tags?: string[]
  isVIP?: boolean
  contactType?: 'first-time' | 'repeat' | 'vip'
  merchantId?: string
  createdAfter?: Date
  createdBefore?: Date
  updatedAfter?: Date
  updatedBefore?: Date
  chatCountRange?: ChatCountRange // NEW
}

// Tags endpoint response
export interface ContactTagsResponse {
  tags: Array<{
    name: string
    count: number
  }>
}
```

**Tests to Write**:
- `src/app/api/contacts/tags/__tests__/route.test.ts` - 10 tests
  - Authentication required
  - Returns all unique tags with counts
  - Excludes deleted contacts
  - Sorts by count descending
  - Handles empty result
  - Handles database errors
- Modify `src/app/api/contacts/__tests__/route.test.ts` - Add 5 tests
  - Filter by chat count range (none, first, low, medium, high)
  - Combine chat count with other filters

### Chunk 2: Frontend - Tag Filter Component

**Files to Create**:
- `src/lib/hooks/use-contact-tags.ts`

**Files to Modify**:
- `src/components/contacts/contact-filters.tsx` - Add tag multi-select

**Implementation Details**:
- Multi-select dropdown with checkboxes
- Shows tag name and count (e.g., "VIP Customer (23)")
- Search within tags
- "Select All" / "Clear All" options
- Selected tags shown as badges

**Tests to Write**:
- `src/lib/hooks/__tests__/use-contact-tags.test.ts` - 5 tests
  - Fetches tags successfully
  - Handles loading state
  - Handles errors
  - Caches results
- Modify `src/components/contacts/__tests__/contact-filters.test.tsx` - Add 8 tests
  - Renders tag list with counts
  - Selects/deselects tags
  - Search within tags works
  - Shows selected tags as badges
  - Clear all tags
  - Integrates with main filter state

### Chunk 3: Frontend - Date Range Filters

**Files to Modify**:
- `src/components/contacts/contact-filters.tsx` - Add date range pickers

**Implementation Details**:
- Two date range pickers: "Created Date" and "Updated Date"
- Use shadcn Calendar + Popover components
- Preset ranges: Today, Last 7 days, Last 30 days, Last 90 days, Custom
- Display selected range as badge
- Clear individual date ranges

**Tests to Write**:
- Modify `src/components/contacts/__tests__/contact-filters.test.tsx` - Add 12 tests
  - Select created date range
  - Select updated date range
  - Use preset ranges
  - Clear date ranges
  - Display in badges
  - Combine with other filters

### Chunk 4: Frontend - Chat Count Range Filter

**Files to Modify**:
- `src/components/contacts/contact-filters.tsx` - Add chat count selector

**Implementation Details**:
- Select dropdown with options:
  - All (no filter)
  - No Chats (0)
  - First-Time (1)
  - Low Activity (2-5)
  - Medium Activity (6-10)
  - High Activity (10+)
- Maps to API chatCountRange parameter
- Display selection as badge

**Tests to Write**:
- Modify `src/components/contacts/__tests__/contact-filters.test.tsx` - Add 8 tests
  - Select each range option
  - Clear filter
  - Display in badge
  - Combine with other filters

### Chunk 5: Integration & Polish

**Files to Modify**:
- `src/components/contacts/contact-filters.tsx` - Improve layout, mobile responsiveness
- Update existing tests as needed

**Implementation Details**:
- Responsive filter layout (stack on mobile)
- Improved filter collapse/expand on mobile
- Filter summary (e.g., "5 filters active")
- Export filters state to URL params (optional)
- Performance optimization for large tag lists
- Accessibility improvements (ARIA labels, keyboard navigation)

**Tests to Write**:
- 8 integration tests
  - Multiple filters work together
  - URL params sync (if implemented)
  - Mobile responsive behavior
  - Performance with many filters
  - Accessibility compliance

## Technical Considerations

### Data Loading & Performance
- Tags endpoint uses aggregation query - ensure proper indexing
- Client-side tag search to avoid network calls
- Debounce filter changes (existing 300ms pattern)
- Memoize filter calculations

### User Experience
- Progressive disclosure - advanced filters in expandable section
- Clear visual feedback for active filters
- One-click filter clear for each filter type
- Preserve filter state during session (React state)
- Consider URL params for shareable filtered views

### Type Safety
- Extend existing ContactsFilters interface
- Add proper types for all new filter options
- Ensure API contract matches frontend types

### Testing Strategy
- Unit tests for each filter component
- Integration tests for filter combinations
- API tests for new endpoints
- E2E test for complete filter workflow

## Success Metrics
- Filter usage analytics (which filters used most)
- Page load time remains under 2s
- All tests pass (target: 48+ new tests)
- Zero TypeScript errors
- Filter application response under 500ms

## Risks & Mitigations

**Risk**: Tag aggregation query slow with many contacts
- **Mitigation**: Add database index on tags JSONB field, cache results for 30 minutes

**Risk**: Too many filters overwhelming for users
- **Mitigation**: Use progressive disclosure, hide advanced filters in collapsible section

**Risk**: Complex filter state management
- **Mitigation**: Use existing filter pattern, centralize filter logic in custom hook

## Future Enhancements (Out of Scope)
- Saved filter presets (user-defined)
- Filter templates shareable via URL
- Export filtered contacts to CSV
- Bulk operations on filtered contacts
- Advanced query builder UI
- Filter history / recent filters

## Dependencies
- Feature 006 (Contacts List Page) must be complete
- shadcn/ui components: Calendar, Popover, Checkbox
- date-fns for date handling
- Existing API filter support

## Estimated Effort
- Chunk 1 (API): 2-3 hours
- Chunk 2 (Tag Filter): 3-4 hours
- Chunk 3 (Date Ranges): 4-5 hours
- Chunk 4 (Chat Count): 2-3 hours
- Chunk 5 (Integration & Polish): 2-3 hours
- Testing (All chunks): 3-4 hours
- **Total**: 16-22 hours

## Timeline
- Chunk 1: Day 1
- Chunk 2: Day 1-2
- Chunk 3: Day 2-3
- Chunk 4: Day 3
- Chunk 5: Day 3-4
- **Total**: 3-4 days

---

## Implementation Log

### Chunk 1: API - Tags Endpoint & Chat Count Filter
- [ ] Create `/api/contacts/tags` endpoint
- [ ] Add chat count range filtering to `/api/contacts`
- [ ] Update types in `contact.ts`
- [ ] Write API tests (15 tests)
- [ ] Verify API works with existing filters

### Chunk 2: Frontend - Tag Filter Component
- [ ] Create `use-contact-tags` hook
- [ ] Add tag multi-select to filter component
- [ ] Implement tag search
- [ ] Add selected tags badges
- [ ] Write hook tests (5 tests)
- [ ] Write component tests (8 tests)

### Chunk 3: Frontend - Date Range Filters
- [ ] Add date range picker components
- [ ] Implement preset date ranges
- [ ] Add date badges to filter display
- [ ] Handle timezone considerations
- [ ] Write tests (12 tests)

### Chunk 4: Frontend - Chat Count Range Filter
- [ ] Add chat count selector dropdown
- [ ] Map ranges to API parameters
- [ ] Add chat count badge
- [ ] Write tests (8 tests)

### Chunk 5: Integration & Polish
- [ ] Improve responsive layout
- [ ] Add mobile filter collapse
- [ ] Optimize performance
- [ ] Accessibility improvements
- [ ] Write integration tests (8 tests)
- [ ] Update documentation

**Total Tests**: ~56 new tests

---

## Notes
- API already supports tags and date range filtering - just need to expose in UI
- Follow existing filter patterns from chat view feature
- Use shadcn components for consistency
- Maintain backward compatibility with existing filters
