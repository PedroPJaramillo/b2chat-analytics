# Feature 007: Raw Data Viewer Page

**Status:** 📋 **PLANNED**

## Requirements

### Original User Requirements
- Create a page to view all raw data records (RawContact and RawChat)
- Display in a data table format similar to the Contacts page
- Show raw JSON data from B2Chat API
- Enable filtering by processing status, sync ID, entity type, and date ranges
- Support column sorting
- Implement pagination with 100 records per page
- Allow viewing/comparing raw JSON vs transformed data
- Route: `/dashboard/raw-data`
- Analytics/debugging tool (read-only, no add/edit/delete)
- Help identify sync issues and data quality problems

### Acceptance Criteria
- [ ] Raw data page accessible at `/dashboard/raw-data` with navigation item
- [ ] Data table displays both RawContact and RawChat records
- [ ] Tab or toggle to switch between contacts and chats
- [ ] Columns show: B2Chat ID, Sync ID, Status, Fetched Date, Processed Date, API Page, Error (if failed)
- [ ] Search functionality across B2Chat IDs and Sync IDs
- [ ] Filters: Processing status (pending/processing/completed/failed), entity type, sync batch, date ranges
- [ ] All columns sortable
- [ ] Pagination with 100 records per page
- [ ] Click row to view full raw JSON in a modal/panel
- [ ] JSON viewer with syntax highlighting and formatting
- [ ] Option to compare raw data with transformed record (if exists)
- [ ] Show processing errors for failed records
- [ ] Proper loading, empty, and error states
- [ ] Admin-only access (debugging tool)

## Architecture Design

### How This Feature Fits Into Existing App Patterns

Following the **5-layer architecture**:

**Layer 1 - Database Schema**:
- No database changes required
- Existing RawContact and RawChat models have all required fields
- Existing indexes support filtering and sorting

**Layer 2 - Sync Engine**:
- No changes required
- Read-only viewer consumes data created by existing ExtractEngine

**Layer 3 - API Endpoints**:
- Create new `/api/raw-data` GET endpoint for listing raw records with:
  - Pagination support (page, limit)
  - Entity type selection (contacts, chats, all)
  - Search across b2chatContactId, b2chatChatId, syncId
  - Filters (processingStatus, syncId, dateRanges)
  - Flexible sorting
- Create `/api/raw-data/[id]` GET endpoint for single record details:
  - Returns full raw JSON
  - Returns corresponding transformed record if exists
  - Returns extract operation metadata

**Layer 4 - Frontend**:
- Create `/app/dashboard/raw-data/page.tsx` - Main raw data page
- Create `/components/raw-data/raw-data-table.tsx` - Table component
- Create `/components/raw-data/raw-data-columns.tsx` - Column definitions
- Create `/components/raw-data/raw-data-filters.tsx` - Filter bar
- Create `/components/raw-data/raw-json-viewer.tsx` - JSON viewer modal
- Create `/lib/hooks/use-raw-data.ts` - React Query hook
- Update `/components/dashboard/sidebar.tsx` - Add navigation (Admin section)

**Layer 5 - Infrastructure**:
- Caching: 5-minute TTL for raw data list (data changes infrequently)
- Rate limiting: 30 requests/minute
- Admin-only access control via middleware or page-level check
- No feature flags needed

### Components/Services Created/Modified

**New API Routes**:
- `src/app/api/raw-data/route.ts` - List raw records with filtering/sorting/pagination
- `src/app/api/raw-data/[id]/route.ts` - Get single raw record with details

**New Frontend Components**:
- `src/app/dashboard/raw-data/page.tsx` - Raw data page
- `src/components/raw-data/raw-data-table.tsx` - Table with TanStack Table
- `src/components/raw-data/raw-data-columns.tsx` - Column definitions
- `src/components/raw-data/raw-data-filters.tsx` - Filter controls
- `src/components/raw-data/raw-json-viewer.tsx` - JSON viewer with syntax highlighting
- `src/lib/hooks/use-raw-data.ts` - React Query hook

**New Types/Interfaces**:
- `src/types/raw-data.ts` - Raw data types and filter interfaces

**Modified Components**:
- `src/components/dashboard/sidebar.tsx` - Add "Raw Data" link to Admin section

### Integration Points with Existing Systems

**1. Sync Engine**:
- Read-only consumer of data created by ExtractEngine
- Uses existing RawContact and RawChat tables
- Links to ExtractLog for sync batch metadata

**2. Dashboard Navigation**:
- Add "Raw Data" link in Admin section (after "Data Sync")
- Use Database or FileJson icon from Lucide
- Badge: "Debug" or "Admin"

**3. Data Sync Page**:
- Can link from sync history to raw data filtered by syncId
- Complementary debugging tool

**4. Contacts/Chats Pages**:
- Could add "View Raw Data" link from contact/chat details (future enhancement)
- Cross-reference b2chatId to find original API response

**5. Authentication**:
- Protected by Clerk authentication
- Admin-only access (check user role/permissions)

### Database Changes Required

**No database migrations needed** - all required fields and indexes already exist:

**RawContact fields**:
- id, syncId, b2chatContactId, rawData (JSON), apiPage, apiOffset
- fetchedAt, processedAt, processingStatus, processingError, processingAttempt

**RawChat fields**:
- id, syncId, b2chatChatId, rawData (JSON), apiPage, apiOffset
- fetchedAt, processedAt, processingStatus, processingError, processingAttempt

**Existing indexes** (sufficient for filtering/sorting):
- syncId, b2chatContactId/b2chatChatId, processingStatus, fetchedAt

## Implementation Chunks

### Chunk 1: API Endpoint for Raw Data List
**Type**: Backend
**Dependencies**: None
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/app/api/raw-data/route.ts` (new)
- `src/types/raw-data.ts` (new)

**Implementation Steps**:
1. Create GET route with dynamic = 'force-dynamic' and revalidate = 300 (5 min cache)
2. Implement Clerk authentication check (Pattern 16)
3. Check admin role/permissions (return 403 if not admin)
4. Parse and validate query parameters:
   - `page` (default: 1) and `limit` (default: 100)
   - `entityType` (contacts | chats | all)
   - `search` (string, searches b2chatContactId, b2chatChatId, syncId)
   - `processingStatus` (pending | processing | completed | failed)
   - `syncId` (filter by specific sync batch)
   - `fetchedAfter`, `fetchedBefore` (date filters)
   - `sortBy` (column name) and `sortOrder` (asc | desc)
5. Build Prisma query with:
   - WHERE clause based on filters
   - Search across IDs using OR
   - Date range filtering
   - Union query for "all" entity type (combine RawContact + RawChat)
6. Fetch total count for pagination
7. Fetch records with select (exclude full rawData for list view):
   - Include: id, b2chatId, syncId, status, dates, apiPage, error
   - Exclude rawData field (too large for list view)
8. Apply sorting and pagination
9. Return response with pagination metadata
10. Add error handling with secure error responses

**Tests required**: Yes
- Unit tests in `__tests__/route.test.ts`
- Test authentication (401 for null userId)
- Test authorization (403 for non-admin)
- Test validation (400 for invalid params)
- Test search functionality
- Test each filter type
- Test union query for "all" entity type
- Test sorting and pagination

**Acceptance criteria**:
- [ ] API returns paginated raw records with filters
- [ ] Entity type filtering works (contacts, chats, all)
- [ ] Search works across IDs
- [ ] All filter types work correctly
- [ ] Pagination metadata accurate
- [ ] Authentication and authorization enforced
- [ ] Tests pass with >80% coverage

### Chunk 2: API Endpoint for Single Raw Record
**Type**: Backend
**Dependencies**: None (parallel with Chunk 1)
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/app/api/raw-data/[id]/route.ts` (new)

**Implementation Steps**:
1. Create GET route with authentication
2. Check admin role/permissions
3. Parse `id` parameter and optional `entityType` query param
4. Determine which table to query:
   - If entityType provided, query that table
   - Otherwise, try RawContact first, then RawChat
5. Fetch raw record with full rawData JSON
6. Fetch associated ExtractLog for sync metadata
7. If record is completed, try to fetch transformed record:
   - Query Contact or Chat by b2chatId
   - Include relevant fields for comparison
8. Return comprehensive response:
   - Raw record with full JSON
   - Extract operation metadata
   - Transformed record (if exists)
   - Processing timeline
9. Return 404 if not found
10. Add error handling

**Tests required**: Yes
- Unit tests
- Test authentication and authorization
- Test fetching from correct table
- Test with completed vs pending records
- Test 404 handling

**Acceptance criteria**:
- [ ] API returns full raw record with JSON
- [ ] Includes extract metadata
- [ ] Includes transformed record if exists
- [ ] Proper 404 handling
- [ ] Tests pass

### Chunk 3: React Query Hook and Types
**Type**: Frontend
**Dependencies**: Chunks 1 and 2 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/lib/hooks/use-raw-data.ts` (new)
- `src/types/raw-data.ts` (modify - add frontend types)

**Implementation Steps**:
1. Define TypeScript interfaces:
   ```typescript
   interface RawDataFilters {
     search?: string
     entityType: 'contacts' | 'chats' | 'all'
     processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
     syncId?: string
     fetchedAfter?: Date
     fetchedBefore?: Date
   }

   interface RawDataRecord {
     id: string
     entityType: 'contact' | 'chat'
     b2chatId: string
     syncId: string
     processingStatus: string
     fetchedAt: string
     processedAt: string | null
     apiPage: number
     apiOffset: number
     processingError: string | null
     processingAttempt: number
   }

   interface RawDataRecordDetail extends RawDataRecord {
     rawData: any // Full JSON from B2Chat API
     extractMetadata?: {
       operation: string
       dateRange: any
       recordsFetched: number
     }
     transformedRecord?: any
   }

   interface RawDataResponse {
     records: RawDataRecord[]
     pagination: {
       page: number
       limit: number
       total: number
       totalPages: number
     }
   }
   ```

2. Create `useRawData` hook using TanStack Query:
   - Build query key from filters, sorting, page
   - Build API URL with URLSearchParams
   - Fetch with error handling
   - Return `{ data, isLoading, error, refetch }`
   - Cache config: staleTime 5 minutes, cacheTime 15 minutes

3. Create `useRawDataRecord` hook for single record:
   - Fetch full record with rawData
   - Cache: staleTime 1 minute (for debugging, want fresh data)

4. Add helper functions:
   - `buildRawDataQueryString(filters, sorting, page, limit)`
   - `formatProcessingStatus(status)` - Badge variants

**Tests required**: Yes
- Unit tests in `hooks/__tests__/use-raw-data.test.ts`
- Test query key generation
- Test API URL building
- Test caching behavior

**Acceptance criteria**:
- [ ] Hook fetches raw data with all filters
- [ ] TypeScript interfaces complete
- [ ] Caching works correctly
- [ ] Tests pass

### Chunk 4: Table Column Definitions
**Type**: Frontend
**Dependencies**: Chunk 3 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/components/raw-data/raw-data-columns.tsx` (new)

**Implementation Steps**:
1. Create column definitions using TanStack Table's ColumnDef:
   - **Entity Type** column:
     - Accessor: `entityType`
     - Header: "Type"
     - Cell: Badge (Contact/Chat with color)
   - **B2Chat ID** column:
     - Accessor: `b2chatId`
     - Header: Sortable "B2Chat ID"
     - Cell: Monospace font, truncate with tooltip
   - **Sync ID** column:
     - Accessor: `syncId`
     - Header: Sortable "Sync ID"
     - Cell: Truncated UUID with tooltip, link to filter by this syncId
   - **Status** column:
     - Accessor: `processingStatus`
     - Header: Sortable "Status"
     - Cell: Badge (pending=yellow, processing=blue, completed=green, failed=red)
   - **Fetched** column:
     - Accessor: `fetchedAt`
     - Header: Sortable "Fetched"
     - Cell: Relative time (e.g., "2 hours ago")
   - **Processed** column:
     - Accessor: `processedAt`
     - Header: Sortable "Processed"
     - Cell: Relative time or "Not yet"
   - **API Page** column:
     - Accessor: `apiPage`
     - Header: Sortable "Page"
     - Cell: Page number
   - **Attempts** column:
     - Accessor: `processingAttempt`
     - Header: "Retries"
     - Cell: Number (highlight if > 0)
   - **Error** column:
     - Accessor: `processingError`
     - Header: "Error"
     - Cell: Truncated error with tooltip, only show if failed

2. Implement helper functions:
   - `getStatusBadge(status)` - Badge variant and color
   - `getEntityTypeBadge(type)` - Badge for contact/chat
   - `truncateId(id, length)` - Shorten UUIDs

3. Configure column properties:
   - Enable sorting where appropriate
   - Set column widths
   - Hidden by default: apiOffset, processingAttempt (unless > 0)

**Tests required**: No (visual component)

**Acceptance criteria**:
- [ ] All columns defined with proper types
- [ ] Status badges with correct colors
- [ ] Formatting helpers work correctly
- [ ] Columns sortable where appropriate

### Chunk 5: Filters Component
**Type**: Frontend
**Dependencies**: Chunk 3 must be completed
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/components/raw-data/raw-data-filters.tsx` (new)

**Implementation Steps**:
1. Create filter bar component structure:
   - Horizontal layout with tabs for entity type
   - Search input
   - Filter controls
   - Clear filters button

2. Implement Entity Type Tabs:
   - Three tabs: All, Contacts, Chats
   - Default: All
   - Changes entityType filter

3. Implement Search Input:
   - Debounced input (300ms delay)
   - Placeholder: "Search by B2Chat ID or Sync ID..."
   - Clear button

4. Implement Processing Status Filter:
   - Dropdown/Select with options:
     - "All Statuses" (default)
     - "Pending"
     - "Processing"
     - "Completed"
     - "Failed"
   - Show count badges for each status (from stats API)

5. Implement Sync Batch Filter:
   - Dropdown/Combobox with recent sync IDs
   - Fetch from `/api/sync/extract` endpoint
   - Show sync metadata (date, record count)

6. Implement Date Range Filters:
   - "Fetched" date range
   - Two date pickers: From and To
   - Preset buttons: Last 24h, Last 7d, Last 30d, All Time

7. Implement Clear All Filters button:
   - Resets all filters except entityType
   - Only visible when filters active

8. Add active filter pills:
   - Display active filters as removable badges
   - Click X to remove individual filter

**Tests required**: Yes
- Component tests
- Test search debouncing
- Test each filter type
- Test clear filters

**Acceptance criteria**:
- [ ] Entity type tabs work
- [ ] Search input with debouncing
- [ ] All filter controls functional
- [ ] Clear filters works
- [ ] Active filter display
- [ ] Tests pass

### Chunk 6: JSON Viewer Component
**Type**: Frontend
**Dependencies**: None (parallel with others)
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/components/raw-data/raw-json-viewer.tsx` (new)

**Implementation Steps**:
1. Create JSON viewer dialog/modal component:
   - Full-screen or large modal
   - Tabs: Raw JSON, Transformed Record (if exists), Comparison
   - Close button

2. Implement Raw JSON Tab:
   - Display rawData JSON with syntax highlighting
   - Use `react-json-view` or similar library
   - Options: collapsed/expanded, theme
   - Copy to clipboard button

3. Implement Transformed Record Tab (if exists):
   - Display normalized record in structured format
   - Show Contact or Chat model fields
   - Highlight key fields
   - Copy button

4. Implement Comparison Tab (if both exist):
   - Side-by-side or diff view
   - Highlight what changed during transformation
   - Field mapping explanation
   - Show what was added/removed/modified

5. Add metadata section:
   - Extract operation info (syncId, timestamp, record count)
   - Processing info (status, attempts, error)
   - API pagination context (page, offset)

6. Add actions:
   - Copy raw JSON
   - Download as file
   - Link to extract operation in sync logs
   - Link to transformed record in contacts/chats (if exists)

**Tests required**: Yes
- Component tests
- Test JSON rendering
- Test copy functionality
- Test with/without transformed record

**Acceptance criteria**:
- [ ] JSON displays with syntax highlighting
- [ ] All tabs render correctly
- [ ] Copy and download work
- [ ] Comparison view highlights changes
- [ ] Tests pass

### Chunk 7: Raw Data Table Component
**Type**: Frontend
**Dependencies**: Chunks 3, 4, 5, and 6 must be completed
**Estimated Effort**: Medium (1 day)

**Files to create/modify**:
- `src/components/raw-data/raw-data-table.tsx` (new)

**Implementation Steps**:
1. Create table component using TanStack Table:
   ```typescript
   export function RawDataTable() {
     const [filters, setFilters] = useState<RawDataFilters>({
       entityType: 'all'
     })
     const [sorting, setSorting] = useState<SortingState>([
       { id: 'fetchedAt', desc: true }
     ])
     const [pagination, setPagination] = useState({
       pageIndex: 0,
       pageSize: 100
     })
     const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)

     const { data, isLoading, error } = useRawData({
       filters,
       sorting: sorting[0],
       page: pagination.pageIndex + 1,
       limit: pagination.pageSize
     })

     // TanStack Table setup...
   }
   ```

2. Configure TanStack Table:
   - Import column definitions from Chunk 4
   - Enable sorting with `onSortingChange`
   - Enable pagination with `onPaginationChange`
   - Manual pagination and sorting (server-side)

3. Implement table UI:
   - Header row with sortable columns
   - Body rows with hover effect
   - Row click opens JSON viewer
   - Status badges with colors
   - Error indicator for failed records

4. Implement row click behavior:
   - Track selected record ID
   - Open RawJsonViewer modal
   - Fetch full record details via useRawDataRecord

5. Add loading state:
   - Skeleton rows (10 skeletons)

6. Add empty state:
   - Show when no records match filters
   - Different messages for "no data" vs "no matches"
   - Suggest clearing filters

7. Add error state:
   - Show error message
   - Retry button

8. Implement pagination controls:
   - Previous/Next buttons
   - Page number display
   - Total records count

9. Add RawJsonViewer integration:
   - Pass selected record ID
   - Control open state
   - Handle close event

10. Add stats summary cards (optional):
    - Total raw records
    - By status (pending, completed, failed)
    - Last sync timestamp

**Tests required**: Yes
- Component tests
- Test table rendering
- Test sorting
- Test pagination
- Test row click
- Test loading/empty/error states

**Acceptance criteria**:
- [ ] Table renders with all columns
- [ ] Sorting works
- [ ] Pagination works
- [ ] Row click opens JSON viewer
- [ ] All states display correctly
- [ ] Tests pass

### Chunk 8: Raw Data Page Component
**Type**: Frontend
**Dependencies**: Chunks 5 and 7 must be completed
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `src/app/dashboard/raw-data/page.tsx` (new)

**Implementation Steps**:
1. Create page component:
   ```typescript
   'use client'

   export default function RawDataPage() {
     return (
       <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
         {/* Page Header */}
         <div className="flex items-center justify-between">
           <div>
             <h2 className="text-3xl font-bold tracking-tight">Raw Data</h2>
             <p className="text-muted-foreground">
               View raw data extracted from B2Chat API
             </p>
           </div>
         </div>

         {/* Raw Data Table */}
         <RawDataTable />
       </div>
     )
   }
   ```

2. Add page metadata:
   ```typescript
   export const metadata = {
     title: 'Raw Data | B2Chat Analytics',
     description: 'View and debug raw data from B2Chat API'
   }
   ```

3. Add admin role check (optional):
   - Check user role from Clerk
   - Show 403 if not admin
   - Or rely on middleware protection

4. Add stats summary cards (optional):
   - Fetch stats from `/api/sync/stats`
   - Display raw data counts
   - Sync completion percentage

**Tests required**: Yes
- E2E test
- Test page loads
- Test admin access

**Acceptance criteria**:
- [ ] Page accessible at `/dashboard/raw-data`
- [ ] Page header displays
- [ ] Table integrated
- [ ] Admin-only access enforced
- [ ] E2E test passes

### Chunk 9: Navigation Integration
**Type**: Frontend
**Dependencies**: Chunk 8 must be completed
**Estimated Effort**: Small (0.25 day)

**Files to create/modify**:
- `src/components/dashboard/sidebar.tsx` (modify)

**Implementation Steps**:
1. Import FileJson or Database icon from Lucide React

2. Add "Raw Data" navigation item to "Admin" section:
   ```typescript
   {
     title: "Admin",
     items: [
       {
         title: "Data Sync",
         href: "/dashboard/sync",
         icon: Database,
         badge: "Admin"
       },
       {
         title: "Raw Data",
         href: "/dashboard/raw-data",
         icon: FileJson,
         badge: "Debug"
       },
       // ... Settings
     ]
   }
   ```

3. Test navigation:
   - Verify link appears in sidebar
   - Verify active state
   - Verify tooltip in collapsed mode

**Tests required**: No (manual verification)

**Acceptance criteria**:
- [ ] "Raw Data" link appears in Admin section
- [ ] Link has FileJson icon and "Debug" badge
- [ ] Active state works
- [ ] Navigation works correctly

## Testing Strategy

### Unit Tests
**When**: During implementation of each chunk
**What to test**:
- API routes: Authentication, authorization, filtering, sorting, pagination
- React Query hooks: Query key generation, URL building, caching
- Filter component: Filter state management, debouncing
- Table component: Rendering, sorting, pagination, row interactions

**Tools**: Jest, React Testing Library, MSW for API mocking

### Integration Tests
**When**: After Chunk 7 (table component) is complete
**What to test**:
- Filter changes trigger API calls with correct parameters
- Sorting updates and fetches new data
- Pagination updates and fetches new data
- Row click opens JSON viewer with correct data

**Tools**: Jest, React Testing Library

### E2E Tests
**When**: After Chunk 8 (page component) is complete
**What to test**:
- Admin navigates to /dashboard/raw-data
- Page loads with raw data table
- User switches entity type tabs
- User searches for a record
- User applies filters
- User sorts by column
- User changes page
- User clicks record - JSON viewer opens
- User views raw JSON, transformed record, comparison

**Tools**: Playwright

### Performance Tests
**When**: After all chunks complete
**What to test**:
- Page load time
- API response time with large datasets
- Table rendering performance with 100 rows
- JSON viewer performance with large JSON objects

**Tools**: Lighthouse, Chrome DevTools Performance

**Target Metrics**:
- Page load < 2 seconds
- API response < 500ms
- Table render < 200ms
- JSON viewer < 500ms

## Database Changes

**No database migrations required.**

All required tables and indexes already exist:
- RawContact: id, syncId, b2chatContactId, rawData, processingStatus, fetchedAt, etc.
- RawChat: id, syncId, b2chatChatId, rawData, processingStatus, fetchedAt, etc.
- ExtractLog: For sync metadata
- Contact/Chat: For transformed data comparison

Existing indexes support all filtering and sorting requirements.

## API Changes

### New Endpoints

**GET /api/raw-data**
- **Purpose**: Fetch paginated, filtered, sorted list of raw records
- **Authentication**: Required (Clerk)
- **Authorization**: Admin only (403 for non-admin)
- **Rate Limit**: 30 requests/minute
- **Cache**: 5-minute TTL

**Query Parameters**:
```typescript
{
  // Pagination
  page?: number          // Default: 1
  limit?: number         // Default: 100

  // Entity selection
  entityType: 'contacts' | 'chats' | 'all'  // Default: 'all'

  // Search
  search?: string        // Searches b2chatContactId, b2chatChatId, syncId

  // Filters
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  syncId?: string        // Filter by sync batch
  fetchedAfter?: string  // ISO date
  fetchedBefore?: string // ISO date

  // Sorting
  sortBy?: string        // Column name
  sortOrder?: string     // 'asc' | 'desc'
}
```

**Response**:
```typescript
{
  records: Array<{
    id: string
    entityType: 'contact' | 'chat'
    b2chatId: string
    syncId: string
    processingStatus: string
    fetchedAt: string
    processedAt: string | null
    apiPage: number
    apiOffset: number
    processingError: string | null
    processingAttempt: number
    // Note: rawData NOT included in list view for performance
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats?: {
    byStatus: { pending, processing, completed, failed }
  }
}
```

**GET /api/raw-data/[id]**
- **Purpose**: Fetch single raw record with full details
- **Authentication**: Required (Clerk)
- **Authorization**: Admin only
- **Cache**: 1-minute TTL

**Query Parameters**:
```typescript
{
  entityType?: 'contact' | 'chat'  // Optional hint for which table to query
}
```

**Response**:
```typescript
{
  record: {
    id: string
    entityType: 'contact' | 'chat'
    b2chatId: string
    syncId: string
    rawData: any // Full JSON from B2Chat API
    processingStatus: string
    fetchedAt: string
    processedAt: string | null
    apiPage: number
    apiOffset: number
    processingError: string | null
    processingAttempt: number
  }
  extractMetadata?: {
    operation: string
    entityType: string
    recordsFetched: number
    dateRange: { from, to }
    startedAt: string
    completedAt: string
  }
  transformedRecord?: {
    // Contact or Chat model fields if processing completed
  }
}
```

### Modified Endpoints
None - all existing endpoints remain unchanged

## Integration Points

### Services Affected
1. **Authentication Service (Clerk)**:
   - Raw data API requires authentication
   - Admin role check required

2. **Caching Service**:
   - Add 'raw-data' cache namespace
   - 5-minute TTL for list, 1-minute for details

3. **Rate Limiting Service**:
   - Add raw data endpoint to rate limit config
   - 30 requests/minute

4. **Logging/Monitoring**:
   - Track raw data API usage
   - Monitor query performance
   - Alert on slow queries (>1 second)

### External Systems
None - raw data is internal only

## Rollback Plan

### How to Undo This Feature
This feature is additive and low-risk. To rollback:

1. **Remove navigation link** from sidebar:
   - Edit `src/components/dashboard/sidebar.tsx`
   - Remove "Raw Data" item from Admin section

2. **Remove API endpoints** (optional):
   - Delete `src/app/api/raw-data/route.ts`
   - Delete `src/app/api/raw-data/[id]/route.ts`
   - Note: Endpoints are read-only, so no data cleanup needed

3. **Remove page and components** (optional):
   - Delete `src/app/dashboard/raw-data/`
   - Delete `src/components/raw-data/`
   - Delete `src/lib/hooks/use-raw-data.ts`
   - Delete `src/types/raw-data.ts`

4. **Database rollback**: Not applicable (no database changes)

5. **Cache cleanup**: Not required (cache expires automatically)

### Risks
- **Very low risk**: Feature is read-only and doesn't modify data
- **Very low risk**: No database migrations to revert
- **Very low risk**: No impact on existing functionality (additive only)
- **Low risk**: Admin-only access minimizes user impact

### Feature Flag Considerations
Not required - feature can be safely deployed without a flag due to:
- Read-only operations
- No database changes
- Additive only (doesn't modify existing pages)
- Admin-only access
- Can be hidden by removing nav link if issues arise

## Documentation Updates

### Files to Create/Update
1. **User documentation**:
   - Create `docs/features/raw-data-viewer-guide.md`
   - Content: How to use raw data viewer, interpret statuses, debug sync issues

2. **API documentation**:
   - Update `docs/api/endpoints.md`
   - Add GET /api/raw-data and GET /api/raw-data/[id] specifications

3. **Development documentation**:
   - Update `docs/development/COMPONENTS.md`
   - Add RawDataTable, RawJsonViewer component documentation

4. **Admin guide**:
   - Create `docs/admin/debugging-sync-issues.md`
   - How to use raw data viewer for troubleshooting

5. **Implementation status**:
   - Update `docs/implementation/IMPLEMENTATION_STATUS.md`
   - Add Feature 007 to completed features list

### README Updates
- Add "Raw Data Viewer" to admin features list
- Update screenshots if applicable

## Success Criteria

### Feature is Complete When:
- [ ] All 9 implementation chunks completed
- [ ] Unit tests passing with >80% coverage
- [ ] E2E tests passing
- [ ] Performance targets met (page load <2s, API <500ms)
- [ ] Code review approved
- [ ] Documentation created/updated
- [ ] Manual QA completed on staging
- [ ] Deployed to production
- [ ] Admin users trained on usage

### Metrics/Validation Criteria:

**Functional Success**:
- Admin can view all raw data records
- Entity type filtering works (contacts, chats, all)
- All filters work correctly (status, sync batch, search, dates)
- Sorting works on all columns
- Pagination displays 100 records per page
- Clicking record opens JSON viewer with full data
- JSON viewer shows raw data, transformed record, and comparison
- Error records display error messages

**Performance Success**:
- Page initial load < 2 seconds
- API response time < 500ms (even with 10k+ records)
- Table rendering < 200ms (100 rows)
- JSON viewer opens < 500ms
- No memory leaks (checked with Chrome DevTools)

**Quality Success**:
- Zero console errors
- Lighthouse score >90
- Responsive design works on desktop (primary use case)
- Admin-only access enforced (403 for non-admin)
- All tests passing (unit, integration, E2E)

**User Experience Success**:
- Loading states clear and informative
- Empty state helpful
- Error messages actionable
- Filters intuitive to use
- Table easy to read and navigate
- JSON viewer easy to use for debugging
- Admins can quickly identify sync issues

## Use Cases

### Primary Use Cases:

1. **Debug Failed Syncs**:
   - Admin filters by processingStatus = 'failed'
   - Views error messages
   - Inspects raw JSON to identify data quality issues
   - Compares with expected format

2. **Audit Data Quality**:
   - Admin reviews raw API responses
   - Identifies missing or malformed fields
   - Checks for data inconsistencies
   - Reports issues to B2Chat

3. **Verify Transformations**:
   - Admin views comparison between raw and transformed
   - Ensures field mappings are correct
   - Validates data not being lost during transformation

4. **Track Sync Progress**:
   - Admin filters by specific syncId
   - Sees all records from that batch
   - Checks processing status
   - Monitors for stuck records

5. **Troubleshoot Customer Issues**:
   - Admin searches by b2chatContactId or b2chatChatId
   - Views original API response
   - Compares with what customer reports
   - Identifies data discrepancies

### Secondary Use Cases:

6. **Performance Analysis**:
   - Review API pagination (apiPage, apiOffset)
   - Identify slow processing records (high processingAttempt)

7. **Data Retention Audit**:
   - View oldest raw data
   - Plan cleanup/archival if needed

8. **Integration Testing**:
   - View raw responses for test data
   - Verify API contract with B2Chat
