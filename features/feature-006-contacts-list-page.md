# Feature 006: Contacts List Page with Advanced Filtering

**Status:** 🚧 **IN PROGRESS**

## Requirements

### Original User Requirements
- Create a dedicated page to view all contacts in a data table format
- Display all contact data fields (name, email, phone, company, tags, merchant ID, dates, etc.)
- Enable comprehensive search and filtering capabilities (by name, email, phone, tags, VIP status, merchant ID, contact type, dates)
- Support column sorting across all fields
- Implement pagination with 100 contacts per page
- Allow clicking on a contact row to view their complete chat history
- Route: `/dashboard/contacts`
- Analytics-only app (no add/edit/delete operations)
- No separate contact details view (chat history modal is sufficient)

### Acceptance Criteria
- [ ] Contacts page accessible at `/dashboard/contacts` with navigation item in sidebar
- [ ] Data table displays all contacts with all relevant fields
- [ ] Search functionality works across name, email, mobile, and phone fields
- [ ] Filters available for: tags (multi-select), VIP status, contact type (first-time/repeat/VIP), merchant ID, date ranges (created/updated)
- [ ] All columns sortable (ascending/descending)
- [ ] Pagination working with 100 contacts per page, showing total count
- [ ] Clicking contact row opens existing contact history panel modal
- [ ] Proper loading states and empty states
- [ ] Responsive design for mobile/tablet/desktop
- [ ] Performance: Page load under 2 seconds with 10,000+ contacts

## Architecture Design

### How This Feature Fits Into Existing App Patterns

Following the **5-layer architecture** (Layer 1: Database → Layer 2: Sync Engine → Layer 3: API → Layer 4: Frontend → Layer 5: Infrastructure):

**Layer 1 - Database Schema**:
- No database changes required
- Existing Contact model has all required fields
- Existing indexes support filtering and sorting (b2chatId, email, mobile, phoneNumber, merchantId, isDeleted)

**Layer 2 - B2Chat Client & Sync Engine**:
- No changes required
- Contact sync already working via existing transform engine

**Layer 3 - API Endpoints**:
- Create new `/api/contacts` GET endpoint for listing contacts with:
  - Pagination support (page, limit)
  - Search across multiple fields
  - Multi-dimensional filtering (tags, VIP, contact type, merchant, dates)
  - Flexible sorting (any column, asc/desc)
  - Aggregated data (chat count, last contact date per contact)

**Layer 4 - Frontend**:
- Create `/app/dashboard/contacts/page.tsx` - Main contacts page
- Create `/components/contacts/contacts-table.tsx` - Table component using TanStack Table
- Create `/components/contacts/contacts-columns.tsx` - Column definitions
- Create `/components/contacts/contact-filters.tsx` - Comprehensive filter bar
- Create `/lib/hooks/use-contacts.ts` - React Query hook for data fetching
- Update `/components/dashboard/sidebar.tsx` - Add "Contacts" navigation item

**Layer 5 - Infrastructure**:
- Caching: 15-minute TTL for contacts list (following Pattern 51-52)
- Rate limiting: 30 requests/minute for contacts endpoint (following Pattern 57)
- No feature flags needed (no risk of breaking existing functionality)

### Components/Services Created/Modified

**New API Routes**:
- `src/app/api/contacts/route.ts` - Main contacts list endpoint with filtering/sorting/pagination

**New Frontend Components**:
- `src/app/dashboard/contacts/page.tsx` - Contacts page (Server Component wrapper)
- `src/components/contacts/contacts-table.tsx` - Table component with TanStack Table
- `src/components/contacts/contacts-columns.tsx` - Column definitions and cell renderers
- `src/components/contacts/contact-filters.tsx` - Filter bar with search and multiple filter controls
- `src/lib/hooks/use-contacts.ts` - React Query hook for contacts data

**Reused Existing Components**:
- `src/components/contacts/contact-tags.tsx` - Display tags in table cells
- `src/components/chats/contact-badge.tsx` - Display customer type (first-time/repeat/VIP)
- `src/components/chats/contact-history-panel.tsx` - Modal for viewing contact chat history

**Modified Components**:
- `src/components/dashboard/sidebar.tsx` - Add "Contacts" navigation item to "Data" section

**New Types/Interfaces**:
- `src/types/contact.ts` - Contact list types and filter interfaces (if not exists, add to existing file)

### Integration Points with Existing Systems

**1. Data Sync Engine**:
- No changes required
- Contacts page consumes data already synced by existing transform engine
- Soft delete support: Only display contacts where `isDeleted = false`

**2. Dashboard Navigation**:
- Add "Contacts" link to sidebar in "Data" section (after "Agents", before "Chats")
- Use `Contact` or `Users` icon from Lucide React
- No badge needed (not admin-only, not AI feature)

**3. Chat Management**:
- Clicking contact opens existing `ContactHistoryPanel` component
- Reuses existing `/api/contacts/[contactId]/history` endpoint
- Maintains consistency with chat-based contact view

**4. Customer Analysis**:
- Contacts page shows raw contact data
- Customer Analysis page shows AI-analyzed insights
- Complementary views of the same underlying contact data

**5. Authentication**:
- Protected by Clerk authentication (following Pattern 16)
- Multi-tenant: Filters contacts by merchantId if tenant-scoped

### Database Changes Required

**No database migrations needed** - all required fields and indexes already exist in Contact model:
- Primary fields: id, b2chatId, fullName, email, mobile, phoneNumber, company
- Filter fields: tags (JSON), merchantId, isDeleted, createdAt, updatedAt
- Existing indexes: b2chatId, email, mobile, phoneNumber, merchantId, isDeleted

**Aggregation Requirements**:
- Chat count: `COUNT(chats)` via relation
- Last contact date: `MAX(chats.lastModifiedAt)` via relation

## Implementation Chunks

### Chunk 1: API Endpoint for Contacts List
**Type**: Backend
**Dependencies**: None
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/app/api/contacts/route.ts` (new)

**Implementation Steps**:
1. Create GET route with dynamic = 'force-dynamic' and revalidate = 60 (Pattern 15)
2. Implement Clerk authentication check (Pattern 16)
3. Parse and validate query parameters:
   - `page` (default: 1) and `limit` (default: 100)
   - `search` (string, searches name/email/mobile/phone)
   - `tags` (comma-separated, filter contacts with ANY of these tags)
   - `isVIP` (boolean, filter by VIP status from customAttributes)
   - `contactType` (first-time | repeat | vip)
   - `merchantId` (string)
   - `createdAfter`, `createdBefore`, `updatedAfter`, `updatedBefore` (ISO dates)
   - `sortBy` (column name) and `sortOrder` (asc | desc)
4. Build Prisma query with:
   - WHERE clause for filters (isDeleted = false always)
   - Search across fullName, email, mobile, phoneNumber with OR
   - Tag filtering via JSON contains operator
   - Date range filtering
   - Include: chats relation for aggregation
5. Calculate aggregations:
   - Chat count per contact
   - Last contact date (max lastModifiedAt from chats)
6. Apply sorting and pagination
7. Return response with:
   - `contacts` array with aggregated data
   - `pagination` object (page, limit, total, totalPages)
8. Add error handling with secure error responses (Pattern 59)

**Tests required**: Yes
- Unit tests in `__tests__/route.test.ts`
- Test authentication (401 for null userId)
- Test validation (400 for invalid params)
- Test search functionality
- Test each filter type
- Test sorting
- Test pagination calculation
- Test aggregation logic

**Acceptance criteria**:
- [ ] API returns paginated contacts with filters and sorting
- [ ] Search works across name, email, mobile, phone
- [ ] All filter types work correctly
- [ ] Aggregations (chat count, last contact date) calculated correctly
- [ ] Pagination metadata accurate
- [ ] Authentication and validation enforced
- [ ] Tests pass with >80% coverage

### Chunk 2: React Query Hook for Contacts
**Type**: Frontend
**Dependencies**: Chunk 1 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/lib/hooks/use-contacts.ts` (new)
- `src/types/contact.ts` (modify or create)

**Implementation Steps**:
1. Define TypeScript interfaces:
   ```typescript
   interface ContactsFilters {
     search?: string
     tags?: string[]
     isVIP?: boolean
     contactType?: 'first-time' | 'repeat' | 'vip'
     merchantId?: string
     createdAfter?: Date
     createdBefore?: Date
     updatedAfter?: Date
     updatedBefore?: Date
   }

   interface ContactsSorting {
     sortBy: string
     sortOrder: 'asc' | 'desc'
   }

   interface ContactWithStats {
     id: string
     b2chatId: string
     fullName: string
     email: string | null
     mobile: string | null
     phoneNumber: string | null
     company: string | null
     tags: Array<{ name: string; assigned_at: number }> | null
     merchantId: string | null
     customAttributes: Record<string, any> | null
     createdAt: string
     updatedAt: string
     chatCount: number
     lastContactDate: string | null
   }

   interface ContactsResponse {
     contacts: ContactWithStats[]
     pagination: {
       page: number
       limit: number
       total: number
       totalPages: number
     }
   }
   ```

2. Create `useContacts` hook using TanStack Query (Pattern 17):
   - Build query key from filters, sorting, page
   - Build API URL with URLSearchParams
   - Fetch with error handling
   - Return `{ data, isLoading, error, refetch }`
   - Cache config: staleTime 5 minutes, cacheTime 15 minutes (Pattern 51)

3. Add helper functions:
   - `buildContactsQueryString(filters, sorting, page, limit)`
   - `parseContactsResponse(data)`

**Tests required**: Yes
- Unit tests in `hooks/__tests__/use-contacts.test.ts`
- Test query key generation
- Test API URL building with various filter combinations
- Test caching behavior
- Test error handling

**Acceptance criteria**:
- [ ] Hook fetches contacts with all filter/sort/pagination parameters
- [ ] TypeScript interfaces match API response
- [ ] Caching works correctly
- [ ] Error states handled properly
- [ ] Tests pass

### Chunk 3: Table Column Definitions
**Type**: Frontend
**Dependencies**: Chunk 2 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/components/contacts/contacts-columns.tsx` (new)

**Implementation Steps**:
1. Create column definitions using TanStack Table's ColumnDef:
   - **Name** column:
     - Accessor: `fullName`
     - Header: Sortable "Name"
     - Cell: Display full name with bold font
   - **Email** column:
     - Accessor: `email`
     - Header: Sortable "Email"
     - Cell: Display email or "—" if null
   - **Mobile** column:
     - Accessor: `mobile`
     - Header: Sortable "Mobile"
     - Cell: Display mobile, fallback to phoneNumber, or "—"
   - **Company** column:
     - Accessor: `company`
     - Header: Sortable "Company"
     - Cell: Display company or "—" if null
   - **Tags** column:
     - Accessor: `tags`
     - Header: "Tags"
     - Cell: Use `<ContactTags tags={row.tags} variant="compact" />` (Pattern: reuse existing component)
   - **Customer Type** column:
     - Accessor: Custom based on chatCount and isVIP
     - Header: "Type"
     - Cell: Use `<ContactBadge chatCount={row.chatCount} isVIP={isVIP(row)} />` (Pattern: reuse existing)
   - **Chats** column:
     - Accessor: `chatCount`
     - Header: Sortable "Total Chats"
     - Cell: Display number with formatting (e.g., "42")
   - **Last Contact** column:
     - Accessor: `lastContactDate`
     - Header: Sortable "Last Contact"
     - Cell: Display relative time (e.g., "2 days ago") or "Never"
   - **Merchant ID** column (conditional on multi-tenant):
     - Accessor: `merchantId`
     - Header: Sortable "Merchant"
     - Cell: Display merchantId or "—"
   - **Created** column:
     - Accessor: `createdAt`
     - Header: Sortable "Created"
     - Cell: Display formatted date (e.g., "Jan 15, 2025")

2. Implement helper functions:
   - `isVIPContact(customAttributes)` - Check VIP status
   - `formatRelativeTime(date)` - Format last contact date
   - `formatDate(dateString)` - Format created/updated dates

3. Configure column properties:
   - Enable sorting for applicable columns
   - Set column widths (responsive)
   - Add column visibility toggle support

**Tests required**: No (visual/UI component)

**Acceptance criteria**:
- [ ] All columns defined with proper types
- [ ] Existing components (ContactTags, ContactBadge) integrated
- [ ] Formatting helpers work correctly
- [ ] Columns sortable where appropriate
- [ ] Responsive column widths

### Chunk 4: Contact Filters Component
**Type**: Frontend
**Dependencies**: Chunk 2 must be completed
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/components/contacts/contact-filters.tsx` (new)

**Implementation Steps**:
1. Create filter bar component structure:
   - Horizontal layout with flex wrap for responsive
   - Search input on left
   - Filter controls in center
   - Clear filters button on right

2. Implement Search Input:
   - Debounced input (300ms delay) to reduce API calls
   - Placeholder: "Search by name, email, or phone..."
   - Search icon from Lucide React
   - Clear button (X) when search has value

3. Implement Tag Filter:
   - Multi-select dropdown (use Radix UI Select or Combobox)
   - Fetch available tags from API or derive from data
   - Display selected tags as badges with remove option
   - "All Tags" option to clear

4. Implement VIP Status Toggle:
   - Radix UI Switch component
   - Label: "VIP Only"
   - Three states: undefined (all), true (VIP only), false (non-VIP only)

5. Implement Contact Type Filter:
   - Dropdown/Select with options:
     - "All Types" (default)
     - "First-Time Customers"
     - "Repeat Customers"
     - "VIP Customers"

6. Implement Merchant ID Filter (if multi-tenant):
   - Dropdown/Select with merchant IDs
   - Fetch merchant list from API or context

7. Implement Date Range Filters:
   - Two date pickers: "Created" and "Updated"
   - Each has "From" and "To" date inputs
   - Use Radix UI Popover + date picker component
   - Clear button for each date range

8. Implement Clear All Filters button:
   - Resets all filters to default state
   - Only visible when any filter is active
   - Shows count of active filters in badge

9. Connect filters to parent state:
   - Emit filter changes via onChange callback
   - Accept current filter state as props
   - Derive "active filters count" for badge

10. Add filter persistence (optional):
    - Save filters to URL query params
    - Restore filters on page load
    - Enable shareable filtered views

**Tests required**: Yes
- Component tests in `__tests__/contact-filters.test.tsx`
- Test search debouncing
- Test each filter type
- Test clear filters
- Test filter state management
- Test onChange callbacks

**Acceptance criteria**:
- [ ] Search input works with debouncing
- [ ] All filter controls functional
- [ ] Multiple filters can be combined
- [ ] Clear filters resets all controls
- [ ] Active filter count displayed
- [ ] Responsive design works on mobile
- [ ] Tests pass

### Chunk 5: Contacts Table Component
**Type**: Frontend
**Dependencies**: Chunks 2, 3, and 4 must be completed
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/components/contacts/contacts-table.tsx` (new)

**Implementation Steps**:
1. Create table component using TanStack Table:
   ```typescript
   export function ContactsTable() {
     const [filters, setFilters] = useState<ContactsFilters>({})
     const [sorting, setSorting] = useState<SortingState>([])
     const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 100 })

     const { data, isLoading, error } = useContacts({
       filters,
       sorting: sorting[0],
       page: pagination.pageIndex + 1,
       limit: pagination.pageSize
     })

     // TanStack Table setup...
   }
   ```

2. Configure TanStack Table:
   - Import column definitions from Chunk 3
   - Enable sorting with `onSortingChange`
   - Enable pagination with `onPaginationChange`
   - Configure manual pagination (server-side)
   - Configure manual sorting (server-side)

3. Implement table UI:
   - Use Radix UI Table components (following existing patterns)
   - Header row with sortable column headers
   - Sort indicators (up/down arrows)
   - Body rows with hover effect
   - Row click handler to open contact history

4. Implement row click behavior:
   - Track selected contact ID in state
   - Open ContactHistoryPanel when row clicked
   - Pass contactId to panel
   - Handle panel close

5. Add loading state:
   - Skeleton rows while loading (10 skeleton rows)
   - Use existing Skeleton component pattern

6. Add empty state:
   - Show when no contacts match filters
   - Message: "No contacts found"
   - Suggest clearing filters
   - Icon from Lucide React (Users or UserX)

7. Add error state:
   - Show error message in card
   - Retry button
   - Error details in dev mode only

8. Implement pagination controls:
   - "Previous" and "Next" buttons
   - Page number display (e.g., "Page 1 of 42")
   - Total contacts count (e.g., "4,234 contacts")
   - Jump to page input (optional)
   - Rows per page selector (25, 50, 100, 200)

9. Add ContactHistoryPanel integration:
   - Import existing component
   - Control open state
   - Pass contactId
   - Handle close event

10. Add accessibility:
    - Proper ARIA labels
    - Keyboard navigation (arrow keys, Enter to open)
    - Focus management

**Tests required**: Yes
- Component tests in `__tests__/contacts-table.test.tsx`
- E2E tests in `e2e/contacts-page.spec.ts`
- Test table rendering with data
- Test sorting interaction
- Test pagination interaction
- Test row click opens history panel
- Test loading state
- Test empty state
- Test error state
- E2E test: Navigate to page, filter, sort, click contact

**Acceptance criteria**:
- [ ] Table renders with all columns
- [ ] Sorting works on all sortable columns
- [ ] Pagination controls work correctly
- [ ] Row click opens contact history panel
- [ ] Loading/empty/error states display correctly
- [ ] Keyboard navigation works
- [ ] Tests pass (unit and E2E)

### Chunk 6: Contacts Page Component
**Type**: Frontend
**Dependencies**: Chunks 4 and 5 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/app/dashboard/contacts/page.tsx` (new)

**Implementation Steps**:
1. Create page component following Pattern 27-29:
   ```typescript
   export default async function ContactsPage() {
     // Server Component - authentication check happens in layout
     return <ContactsPageClient />
   }
   ```

2. Create Client Component wrapper:
   ```typescript
   'use client'

   export function ContactsPageClient() {
     return (
       <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
         {/* Page header */}
         <div className="flex items-center justify-between space-y-2">
           <div>
             <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
             <p className="text-muted-foreground">
               View and analyze all customer contacts
             </p>
           </div>
         </div>

         {/* Filter bar */}
         <ContactFilters filters={filters} onChange={setFilters} />

         {/* Contacts table */}
         <ContactsTable filters={filters} />
       </div>
     )
   }
   ```

3. Add page metadata (Pattern 27):
   ```typescript
   export const metadata = {
     title: 'Contacts | B2Chat Analytics',
     description: 'View and analyze all customer contacts'
   }
   ```

4. Add stats summary cards (optional enhancement):
   - Total contacts count
   - New contacts this month
   - VIP contacts count
   - Most active contact (highest chat count)

5. Follow spacing patterns (Pattern 29):
   - Use `flex-1 space-y-4 p-4 pt-6 md:p-8`
   - Page header with h2 title + description
   - Consistent spacing between sections

**Tests required**: Yes
- E2E test in `e2e/contacts-page.spec.ts`
- Test page loads correctly
- Test authentication redirect (if not authenticated)
- Test page metadata

**Acceptance criteria**:
- [ ] Page accessible at `/dashboard/contacts`
- [ ] Page header displays correctly
- [ ] Filters and table integrated properly
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
1. Import Contact icon from Lucide React:
   ```typescript
   import { Contact } from "lucide-react"
   ```

2. Add "Contacts" navigation item to "Data" section:
   ```typescript
   {
     title: "Data",
     items: [
       {
         title: "Agents",
         href: "/dashboard/agents",
         icon: Users,
       },
       {
         title: "Contacts",
         href: "/dashboard/contacts",
         icon: Contact,
       },
       {
         title: "Chats",
         href: "/dashboard/chats",
         icon: MessageSquare,
       },
     ]
   }
   ```

3. Test navigation:
   - Verify link appears in sidebar
   - Verify active state when on contacts page
   - Verify tooltip shows in collapsed mode

**Tests required**: No (manual verification)

**Acceptance criteria**:
- [ ] "Contacts" link appears in sidebar under "Data" section
- [ ] Link has Contact icon
- [ ] Active state shows when on contacts page
- [ ] Collapsed mode shows tooltip
- [ ] Navigation works correctly

## Testing Strategy

### Unit Tests
**When**: During implementation of each chunk
**What to test**:
- API route (Chunk 1): Authentication, validation, filtering, sorting, pagination, aggregation logic
- React Query hook (Chunk 2): Query key generation, URL building, caching
- Filter component (Chunk 4): Filter state management, debouncing, onChange callbacks
- Table component (Chunk 5): Rendering, sorting, pagination, row interactions

**Tools**: Jest, React Testing Library, MSW for API mocking

### Integration Tests
**When**: After Chunk 5 (table component) is complete
**What to test**:
- Filter changes trigger API calls with correct parameters
- Sorting updates URL and fetches new data
- Pagination updates URL and fetches new data
- Row click opens contact history panel with correct data

**Tools**: Jest, React Testing Library

### E2E Tests
**When**: After Chunk 6 (page component) is complete
**What to test**:
- User navigates to /dashboard/contacts
- Page loads with contacts table
- User searches for a contact - table updates
- User applies filters - table updates
- User sorts by column - table updates
- User changes page - table updates
- User clicks contact row - history panel opens
- User closes history panel - returns to table

**Tools**: Playwright

### Performance Tests
**When**: After all chunks complete
**What to test**:
- Page load time with 10,000+ contacts
- Time to first render
- API response time with complex filters
- Table rendering performance

**Tools**: Lighthouse, Chrome DevTools Performance

**Target Metrics**:
- Page load < 2 seconds
- API response < 500ms
- Table render < 200ms

## Database Changes

**No database migrations required.**

Existing Contact model and indexes are sufficient:
- Fields available: id, b2chatId, fullName, email, mobile, phoneNumber, company, tags, merchantId, customAttributes, createdAt, updatedAt, isDeleted
- Indexes available: b2chatId, email, mobile, phoneNumber, merchantId, isDeleted

## API Changes

### New Endpoints

**GET /api/contacts**
- **Purpose**: Fetch paginated, filtered, sorted list of contacts with aggregated stats
- **Authentication**: Required (Clerk)
- **Rate Limit**: 30 requests/minute (Pattern 57)
- **Cache**: 15-minute TTL (Pattern 51)

**Query Parameters**:
```typescript
{
  // Pagination
  page?: number          // Default: 1
  limit?: number         // Default: 100

  // Search
  search?: string        // Searches fullName, email, mobile, phoneNumber

  // Filters
  tags?: string          // Comma-separated tag names
  isVIP?: boolean        // Filter by VIP status
  contactType?: string   // 'first-time' | 'repeat' | 'vip'
  merchantId?: string    // Filter by merchant
  createdAfter?: string  // ISO date
  createdBefore?: string // ISO date
  updatedAfter?: string  // ISO date
  updatedBefore?: string // ISO date

  // Sorting
  sortBy?: string        // Column name
  sortOrder?: string     // 'asc' | 'desc'
}
```

**Response**:
```typescript
{
  contacts: Array<{
    id: string
    b2chatId: string
    fullName: string
    email: string | null
    mobile: string | null
    phoneNumber: string | null
    company: string | null
    tags: Array<{ name: string; assigned_at: number }> | null
    merchantId: string | null
    customAttributes: Record<string, any> | null
    createdAt: string
    updatedAt: string
    // Aggregated fields
    chatCount: number
    lastContactDate: string | null
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
None - all existing endpoints remain unchanged

## Integration Points

### Services Affected
1. **Authentication Service (Clerk)**:
   - Contacts API requires authentication
   - Multi-tenant filtering by merchantId if applicable

2. **Caching Service**:
   - Add 'contacts' cache namespace
   - 15-minute TTL (Pattern 51)
   - Invalidate on contact updates (though read-only for now)

3. **Rate Limiting Service**:
   - Add contacts endpoint to rate limit config
   - 30 requests/minute (Pattern 57)

4. **Logging/Monitoring**:
   - Track contacts API usage
   - Monitor query performance
   - Alert on slow queries (>1 second)

### External Systems
None - contacts data is internal only

## Rollback Plan

### How to Undo This Feature
This feature is additive and low-risk. To rollback:

1. **Remove navigation link** from sidebar:
   - Edit `src/components/dashboard/sidebar.tsx`
   - Remove "Contacts" item from "Data" section

2. **Remove API endpoint** (optional):
   - Delete `src/app/api/contacts/route.ts`
   - Note: Endpoint is stateless and read-only, so no data cleanup needed

3. **Remove page and components** (optional):
   - Delete `src/app/dashboard/contacts/`
   - Delete `src/components/contacts/contacts-table.tsx`
   - Delete `src/components/contacts/contacts-columns.tsx`
   - Delete `src/components/contacts/contact-filters.tsx`
   - Delete `src/lib/hooks/use-contacts.ts`

4. **Database rollback**: Not applicable (no database changes)

5. **Cache cleanup**: Not required (cache expires automatically)

### Risks
- **Low risk**: Feature is read-only and doesn't modify data
- **Low risk**: No database migrations to revert
- **Low risk**: No impact on existing functionality (additive only)

### Feature Flag Considerations
Not required - feature can be safely deployed without a flag due to:
- Read-only operations
- No database changes
- Additive only (doesn't modify existing pages)
- Can be hidden by removing nav link if issues arise

## Documentation Updates

### Files to Create/Update
1. **User documentation**:
   - Create `docs/features/contacts-page-user-guide.md`
   - Content: How to use contacts page, filter options, sorting, viewing chat history

2. **API documentation**:
   - Update `docs/api/endpoints.md`
   - Add GET /api/contacts endpoint specification

3. **Development documentation**:
   - Update `docs/development/COMPONENTS.md`
   - Add ContactsTable, ContactFilters component documentation

4. **Implementation status**:
   - Update `docs/implementation/IMPLEMENTATION_STATUS.md`
   - Add Feature 006 to completed features list

### README Updates
- Add "Contacts Management" to feature list
- Update screenshots if applicable

## Success Criteria

### Feature is Complete When:
- [ ] All 7 implementation chunks completed
- [ ] Unit tests passing with >80% coverage
- [ ] E2E tests passing
- [ ] Performance targets met (page load <2s, API <500ms)
- [ ] Code review approved
- [ ] Documentation created/updated
- [ ] Manual QA completed
- [ ] Deployed to production

### Metrics/Validation Criteria:
**Functional Success**:
- User can view all contacts in paginated table
- All filters work correctly (search, tags, VIP, contact type, merchant, dates)
- Sorting works on all columns
- Clicking contact opens chat history
- 100 contacts per page displayed

**Performance Success**:
- Page initial load < 2 seconds
- API response time < 500ms
- Table rendering < 200ms
- No memory leaks (checked with Chrome DevTools)

**Quality Success**:
- Zero console errors
- Lighthouse score >90
- Responsive design works on mobile, tablet, desktop
- Accessibility score >90 (WCAG AA compliant)
- All tests passing (unit, integration, E2E)

**User Experience Success**:
- Loading states clear and informative
- Empty state helpful
- Error messages actionable
- Filters intuitive to use
- Table easy to read and navigate
