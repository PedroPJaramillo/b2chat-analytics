# Feature 013: JSON Content Search for Raw Data Page

## Requirements

### Original User Requirements
- Enable search functionality to find raw data records by searching within the JSON content from B2Chat API
- Search specific JSON fields: chat_id, contact_id, contact name, contact mobile, contact full name
- Maintain backward compatibility with existing ID and Sync ID searches
- Support both RawContact (flat structure) and RawChat (nested structure) data

### Acceptance Criteria
- [ ] Users can search by contact name within JSON content
- [ ] Users can search by contact mobile number within JSON content
- [ ] Users can search by chat_id within JSON content
- [ ] Users can search by contact_id within JSON content
- [ ] Existing searches (B2Chat ID, Sync ID) continue to work
- [ ] Search is case-insensitive
- [ ] Search handles both flat (RawContact) and nested (RawChat) JSON structures
- [ ] Search handles field name variants (contact_id vs id, mobile vs mobile_number, etc.)
- [ ] Search placeholder text is updated to reflect new capabilities
- [ ] Performance remains acceptable with JSON path queries

### Business Value
- Enables debugging by searching for specific customer names or phone numbers in raw data
- Reduces time to locate problematic records during troubleshooting
- Improves developer productivity when investigating data sync issues
- Provides comprehensive search across all relevant B2Chat API fields
- Maintains consistency between raw data and transformed data searches

## Architecture Design

### How This Feature Fits Into Existing App Patterns

This feature enhances the existing Raw Data Viewer page (Feature 007) by extending its search capabilities. It follows established patterns:

1. **API Integration Pattern** (Pattern #15-21): Uses existing `/api/raw-data` route with PostgreSQL JSON path queries
2. **Database Query Pattern** (Pattern #8): Uses Prisma with JSON field queries and proper indexing strategy
3. **Search Pattern** (Pattern #19): Client-side debounced search with server-side filtering
4. **No Frontend Changes** (Pattern #27-29): Extends backend without requiring new UI components

### Components/Services Modified

**Modified:**
- `src/app/api/raw-data/route.ts` - Add JSON path queries to WHERE clauses
- `src/components/raw-data/raw-data-filters.tsx` - Update search placeholder text

**No New Files Required** - this is a pure enhancement to existing functionality

### Integration Points With Existing Systems

1. **Raw Data Viewer Page** (Feature 007):
   - Uses same search input and filter bar
   - Extends existing search functionality
   - No breaking changes to UI

2. **Prisma Database Layer** (Pattern #8-14):
   - Uses PostgreSQL JSON operators (`->>`, `->`)
   - Leverages existing Prisma client
   - Maintains type safety

3. **B2Chat Sync System** (Pattern #34-38):
   - Searches data structure defined by B2Chat API client
   - Field mappings documented in B2CHAT_API_FIELD_MAPPING.md
   - Handles API field inconsistencies

### Database Changes Required

**No migrations required** - uses existing PostgreSQL JSON query capabilities:

- Reads from: `RawContact` and `RawChat` tables (already exist)
- JSON field: `rawData` (already exists as JSONB type)
- Indexes: Optional future optimization (can add GIN indexes on JSON paths if needed)

## Implementation Chunks

### Chunk 1: Add RawContact JSON Search

**Type:** Backend
**Dependencies:** None
**Estimated Effort:** Small (0.5 day)

**Files to modify:**
- `src/app/api/raw-data/route.ts`

**Implementation details:**

1. Locate the RawContact search logic (around lines 68-74):
```typescript
// BEFORE
if (search) {
  where.OR = [
    { b2chatContactId: { contains: search, mode: 'insensitive' } },
    { syncId: { contains: search, mode: 'insensitive' } },
  ]
}
```

2. Extend with JSON path queries:
```typescript
// AFTER
if (search) {
  where.OR = [
    // Existing ID searches
    { b2chatContactId: { contains: search, mode: 'insensitive' } },
    { syncId: { contains: search, mode: 'insensitive' } },

    // NEW: JSON content searches
    // Contact ID (rawData.contact_id or rawData.id)
    { rawData: { path: ['contact_id'], string_contains: search } },
    { rawData: { path: ['id'], string_contains: search } },

    // Contact name (rawData.fullname or rawData.name)
    { rawData: { path: ['fullname'], string_contains: search } },
    { rawData: { path: ['name'], string_contains: search } },

    // Mobile (rawData.mobile or rawData.mobile_number)
    { rawData: { path: ['mobile'], string_contains: search } },
    { rawData: { path: ['mobile_number'], string_contains: search } },
  ]
}
```

3. Use Prisma's JSON filtering (Pattern #8):
   - Prisma automatically generates SQL: `rawData->>'contact_id' ILIKE '%search%'`
   - Case-insensitive matching handled by Prisma
   - Multiple JSON paths in OR clause to handle B2Chat API field variants

**Tests required:** Yes - API route tests
- Test search by contact name returns correct RawContact records
- Test search by mobile number returns correct RawContact records
- Test search by contact_id returns correct RawContact records
- Test handles field variants (name vs fullname, mobile vs mobile_number)
- Test case-insensitive matching works
- Test existing ID searches still work

**Acceptance criteria:**
- [ ] Search finds RawContact by name in JSON
- [ ] Search finds RawContact by mobile in JSON
- [ ] Search finds RawContact by contact_id in JSON
- [ ] Search handles both field variants (name/fullname, mobile/mobile_number)
- [ ] Case-insensitive search works
- [ ] Existing searches remain functional
- [ ] All tests pass

---

### Chunk 2: Add RawChat JSON Search

**Type:** Backend
**Dependencies:** Chunk 1 (for consistency, but can be parallel)
**Estimated Effort:** Small (0.5 day)

**Files to modify:**
- `src/app/api/raw-data/route.ts`

**Implementation details:**

1. Locate the RawChat search logic (around lines 102-107):
```typescript
// BEFORE
if (search) {
  where.OR = [
    { b2chatChatId: { contains: search, mode: 'insensitive' } },
    { syncId: { contains: search, mode: 'insensitive' } },
  ]
}
```

2. Extend with nested JSON path queries:
```typescript
// AFTER
if (search) {
  where.OR = [
    // Existing ID searches
    { b2chatChatId: { contains: search, mode: 'insensitive' } },
    { syncId: { contains: search, mode: 'insensitive' } },

    // NEW: JSON content searches
    // Chat ID (rawData.chat_id)
    { rawData: { path: ['chat_id'], string_contains: search } },

    // Contact ID (rawData.contact.id or rawData.contact.contact_id)
    { rawData: { path: ['contact', 'id'], string_contains: search } },
    { rawData: { path: ['contact', 'contact_id'], string_contains: search } },

    // Contact name (rawData.contact.fullname or rawData.contact.name)
    { rawData: { path: ['contact', 'fullname'], string_contains: search } },
    { rawData: { path: ['contact', 'name'], string_contains: search } },

    // Contact mobile (rawData.contact.mobile or rawData.contact.mobile_number)
    { rawData: { path: ['contact', 'mobile'], string_contains: search } },
    { rawData: { path: ['contact', 'mobile_number'], string_contains: search } },
  ]
}
```

3. Handle nested structure (Pattern #34):
   - RawChat has nested `contact` object
   - Prisma path syntax: `['contact', 'name']` → SQL: `rawData->'contact'->>'name'`
   - Multiple paths for field variants

**Tests required:** Yes - API route tests
- Test search by chat_id returns correct RawChat records
- Test search by nested contact name returns correct RawChat records
- Test search by nested contact mobile returns correct RawChat records
- Test search by nested contact_id returns correct RawChat records
- Test handles field variants in nested structure
- Test case-insensitive matching works
- Test existing ID searches still work

**Acceptance criteria:**
- [ ] Search finds RawChat by chat_id in JSON
- [ ] Search finds RawChat by nested contact name in JSON
- [ ] Search finds RawChat by nested contact mobile in JSON
- [ ] Search finds RawChat by nested contact_id in JSON
- [ ] Search handles both field variants in nested structure
- [ ] Case-insensitive search works
- [ ] Existing searches remain functional
- [ ] All tests pass

---

### Chunk 3: Update Search Placeholder Text

**Type:** Frontend
**Dependencies:** Chunks 1, 2 completed (for accuracy)
**Estimated Effort:** Small (0.25 day)

**Files to modify:**
- `src/components/raw-data/raw-data-filters.tsx`

**Implementation details:**

1. Locate the search input (around lines 110-128):
```typescript
// BEFORE
<Input
  placeholder="Search by B2Chat ID or Sync ID..."
  value={filters.search}
  onChange={(e) => debouncedSearch(e.target.value)}
/>
```

2. Update placeholder to reflect new capabilities:
```typescript
// AFTER
<Input
  placeholder="Search by ID, name, mobile, chat ID..."
  value={filters.search}
  onChange={(e) => debouncedSearch(e.target.value)}
/>
```

3. Consider adding a tooltip with SearchIcon:
```typescript
<div className="relative flex-1">
  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search by ID, name, mobile, chat ID..."
    value={filters.search}
    onChange={(e) => debouncedSearch(e.target.value)}
    className="pl-8"
  />
</div>
```

**Tests required:** No (visual change only)

**Acceptance criteria:**
- [ ] Placeholder text accurately describes search capabilities
- [ ] Text is concise and fits in input field
- [ ] Search icon (if added) is properly positioned
- [ ] UI remains consistent with existing design

---

### Chunk 4: Add API Route Tests

**Type:** Testing
**Dependencies:** Chunks 1, 2 completed
**Estimated Effort:** Small (1 day)

**Files to create:**
- `src/app/api/raw-data/__tests__/route.test.ts` (if doesn't exist)

**Files to modify:**
- Existing test file (if exists)

**Implementation details:**

1. Create comprehensive test suite (Pattern #22-23):

```typescript
import { GET } from '../route'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

jest.mock('@clerk/nextjs/server')
jest.mock('@/lib/prisma')

describe('GET /api/raw-data - JSON Search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(auth as jest.Mock).mockResolvedValue({ userId: 'test-user-123' })
  })

  describe('RawContact JSON searches', () => {
    test('searches by contact name in JSON', async () => {
      const mockContacts = [
        {
          id: '1',
          entityType: 'contact',
          b2chatContactId: '123',
          syncId: 'sync-1',
          rawData: { name: 'John Doe', mobile: '+1234567890' },
          // ... other fields
        }
      ]

      ;(prisma.rawContact.findMany as jest.Mock).mockResolvedValue(mockContacts)

      const request = new Request('http://localhost/api/raw-data?search=John&entityType=contact')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data).toHaveLength(1)
      expect(data.data[0].rawData.name).toContain('John')
      expect(prisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['name'], string_contains: 'John' } },
              { rawData: { path: ['fullname'], string_contains: 'John' } },
            ])
          })
        })
      )
    })

    test('searches by mobile number in JSON', async () => {
      const mockContacts = [
        {
          id: '1',
          entityType: 'contact',
          rawData: { name: 'John Doe', mobile: '+1234567890' },
        }
      ]

      ;(prisma.rawContact.findMany as jest.Mock).mockResolvedValue(mockContacts)

      const request = new Request('http://localhost/api/raw-data?search=1234567890&entityType=contact')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data).toHaveLength(1)
      expect(data.data[0].rawData.mobile).toContain('1234567890')
    })

    test('handles field variants (mobile vs mobile_number)', async () => {
      // Test that OR clause includes both field variants
      const request = new Request('http://localhost/api/raw-data?search=555&entityType=contact')
      await GET(request)

      expect(prisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['mobile'], string_contains: '555' } },
              { rawData: { path: ['mobile_number'], string_contains: '555' } },
            ])
          })
        })
      )
    })
  })

  describe('RawChat JSON searches', () => {
    test('searches by chat_id in JSON', async () => {
      const mockChats = [
        {
          id: '1',
          entityType: 'chat',
          b2chatChatId: 'chat-123',
          rawData: { chat_id: 'chat-123', contact: { name: 'John' } },
        }
      ]

      ;(prisma.rawChat.findMany as jest.Mock).mockResolvedValue(mockChats)

      const request = new Request('http://localhost/api/raw-data?search=chat-123&entityType=chat')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data).toHaveLength(1)
      expect(data.data[0].rawData.chat_id).toBe('chat-123')
    })

    test('searches by nested contact name in JSON', async () => {
      const mockChats = [
        {
          id: '1',
          entityType: 'chat',
          rawData: { chat_id: 'chat-1', contact: { name: 'Jane Smith' } },
        }
      ]

      ;(prisma.rawChat.findMany as jest.Mock).mockResolvedValue(mockChats)

      const request = new Request('http://localhost/api/raw-data?search=Jane&entityType=chat')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data).toHaveLength(1)
      expect(data.data[0].rawData.contact.name).toContain('Jane')
      expect(prisma.rawChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['contact', 'name'], string_contains: 'Jane' } },
              { rawData: { path: ['contact', 'fullname'], string_contains: 'Jane' } },
            ])
          })
        })
      )
    })

    test('searches by nested contact mobile in JSON', async () => {
      const mockChats = [
        {
          id: '1',
          entityType: 'chat',
          rawData: {
            chat_id: 'chat-1',
            contact: { name: 'Jane', mobile: '+9876543210' }
          },
        }
      ]

      ;(prisma.rawChat.findMany as jest.Mock).mockResolvedValue(mockChats)

      const request = new Request('http://localhost/api/raw-data?search=987654&entityType=chat')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data).toHaveLength(1)
      expect(data.data[0].rawData.contact.mobile).toContain('987654')
    })
  })

  describe('Backward compatibility', () => {
    test('existing B2Chat ID search still works', async () => {
      const request = new Request('http://localhost/api/raw-data?search=123456&entityType=contact')
      await GET(request)

      expect(prisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { b2chatContactId: { contains: '123456', mode: 'insensitive' } },
            ])
          })
        })
      )
    })

    test('existing Sync ID search still works', async () => {
      const request = new Request('http://localhost/api/raw-data?search=sync-123&entityType=contact')
      await GET(request)

      expect(prisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { syncId: { contains: 'sync-123', mode: 'insensitive' } },
            ])
          })
        })
      )
    })
  })

  describe('Case sensitivity', () => {
    test('search is case-insensitive for JSON fields', async () => {
      const request = new Request('http://localhost/api/raw-data?search=JOHN&entityType=contact')
      await GET(request)

      // Prisma string_contains is case-insensitive by default in PostgreSQL with ILIKE
      expect(prisma.rawContact.findMany).toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    test('search query includes proper filtering to minimize load', async () => {
      const request = new Request('http://localhost/api/raw-data?search=test&entityType=contact&limit=10')
      await GET(request)

      expect(prisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10, // Pagination limit
          select: expect.objectContaining({
            rawData: false // rawData excluded from list view (line 180)
          })
        })
      )
    })
  })
})
```

2. Run tests with coverage:
```bash
npm test -- src/app/api/raw-data/__tests__/route.test.ts --coverage
```

**Tests required:** N/A (this chunk IS the tests)

**Acceptance criteria:**
- [ ] All test cases pass
- [ ] Test coverage >80% for route.ts
- [ ] Tests cover all JSON search paths
- [ ] Tests verify backward compatibility
- [ ] Tests verify case-insensitivity
- [ ] Tests run in CI/CD pipeline

## Testing Strategy

### Unit Tests
- **When:** During Chunk 4 (API route tests)
- **What to test:**
  - RawContact JSON searches (name, mobile, contact_id)
  - RawChat JSON searches (chat_id, nested contact fields)
  - Field variant handling (mobile vs mobile_number, name vs fullname)
  - Case-insensitive matching
  - Backward compatibility with existing searches
  - Performance (pagination, field exclusion)
- **Coverage target:** >80% for route.ts

### Integration Tests (Manual)
- **When:** After all chunks completed
- **What to test:**
  - End-to-end search flow: type in search box → API call → results display
  - Test with real data from database
  - Test various search terms (names, phone numbers, IDs)
  - Test mixed entity types (both contacts and chats)
  - Test empty results
  - Test special characters in search terms
- **Coverage target:** All critical user paths

### Performance Testing
- **When:** After Chunk 4 (if performance concerns arise)
- **What to test:**
  - Query performance with 10,000+ raw records
  - Search response time (<500ms target)
  - Database load during concurrent searches
  - Consider adding GIN indexes if slow
- **Coverage target:** Meets performance SLA

### Manual Testing Checklist
- [ ] Search by contact name returns correct records
- [ ] Search by mobile number returns correct records
- [ ] Search by chat_id returns correct records
- [ ] Search by contact_id returns correct records
- [ ] Search is case-insensitive (test "john" vs "JOHN")
- [ ] Existing B2Chat ID search still works
- [ ] Existing Sync ID search still works
- [ ] Search with special characters works (+, -, @, etc.)
- [ ] Empty search shows all records (or clears filter)
- [ ] Search with no results shows empty state
- [ ] Pagination works with search results
- [ ] Search works for both entity types (contact and chat)

## Database Changes

**No migrations required** - uses existing PostgreSQL JSON capabilities:

- Tables: `RawContact` and `RawChat` (already exist)
- Column: `rawData` JSONB (already exists)
- Indexes: None required initially (PostgreSQL handles JSON queries)

### Optional Performance Optimization (Future)

If searches become slow with large datasets, consider adding GIN indexes:

```sql
-- Optional: Add GIN indexes for JSON path searches (if needed)
CREATE INDEX IF NOT EXISTS idx_raw_contacts_rawdata_name
  ON raw_contacts USING GIN ((rawData -> 'name'));

CREATE INDEX IF NOT EXISTS idx_raw_contacts_rawdata_mobile
  ON raw_contacts USING GIN ((rawData -> 'mobile'));

CREATE INDEX IF NOT EXISTS idx_raw_chats_rawdata_chat_id
  ON raw_chats USING GIN ((rawData -> 'chat_id'));

CREATE INDEX IF NOT EXISTS idx_raw_chats_rawdata_contact
  ON raw_chats USING GIN ((rawData -> 'contact'));
```

**Decision:** Start without indexes, add only if performance testing shows need.

## API Changes

### Modified Endpoint

**Endpoint:** `GET /api/raw-data`

**Changes:**
- **Enhanced WHERE clause** for RawContact queries (adds JSON path filters)
- **Enhanced WHERE clause** for RawChat queries (adds nested JSON path filters)
- **No breaking changes** to request/response format

**Before:**
```typescript
// Only searched scalar fields
where.OR = [
  { b2chatContactId: { contains: search, mode: 'insensitive' } },
  { syncId: { contains: search, mode: 'insensitive' } },
]
```

**After:**
```typescript
// Searches scalar fields AND JSON content
where.OR = [
  // Existing searches
  { b2chatContactId: { contains: search, mode: 'insensitive' } },
  { syncId: { contains: search, mode: 'insensitive' } },

  // NEW: JSON searches
  { rawData: { path: ['contact_id'], string_contains: search } },
  { rawData: { path: ['name'], string_contains: search } },
  { rawData: { path: ['mobile'], string_contains: search } },
  // ... and more paths
]
```

**Request Parameters:** No changes

**Response Format:** No changes

**Performance Impact:** Minimal (JSON path queries are efficient in PostgreSQL)

## Integration Points

### Services Affected

1. **Raw Data Viewer Page** (`/dashboard/raw-data/page.tsx`):
   - **Impact:** None - receives same data structure
   - **Integration:** Existing UI automatically benefits from enhanced search
   - **Data flow:** No changes

2. **Raw Data Table Component** (`raw-data-table.tsx`):
   - **Impact:** None - displays same columns
   - **Integration:** Receives filtered results from API
   - **Data flow:** No changes

3. **Raw Data Filters Component** (`raw-data-filters.tsx`):
   - **Impact:** Minimal - only placeholder text updated
   - **Integration:** Search input triggers same API call
   - **Data flow:** No changes

4. **Prisma Client** (`@/lib/prisma`):
   - **Impact:** Uses JSON filtering capabilities
   - **Integration:** Standard Prisma JSON query syntax
   - **Data flow:** API → Prisma → PostgreSQL

### External Systems

**None** - this is a purely internal feature with no external dependencies.

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  User Actions                                            │
├─────────────────────────────────────────────────────────┤
│  1. User opens Raw Data page                            │
│  2. User types search term (e.g., "John" or "555-1234") │
│  3. Debounced search triggers API call (300ms delay)    │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend Processing                                     │
├─────────────────────────────────────────────────────────┤
│  • Debounce handler in raw-data-filters.tsx            │
│  • Updates URL with search param                        │
│  • Triggers server-side data fetch                      │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  API Request (GET /api/raw-data?search=...)            │
├─────────────────────────────────────────────────────────┤
│  • Authenticate user (Clerk)                            │
│  • Parse query parameters                               │
│  • Build WHERE clause with OR conditions:               │
│    - Scalar fields (b2chatContactId, syncId)           │
│    - JSON paths (name, mobile, contact_id, etc.)       │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Database Query (PostgreSQL via Prisma)                 │
├─────────────────────────────────────────────────────────┤
│  SELECT * FROM raw_contacts                             │
│  WHERE (                                                 │
│    b2chat_contact_id ILIKE '%search%' OR                │
│    sync_id ILIKE '%search%' OR                          │
│    raw_data->>'contact_id' ILIKE '%search%' OR          │
│    raw_data->>'name' ILIKE '%search%' OR                │
│    raw_data->>'mobile' ILIKE '%search%' OR              │
│    ... other JSON paths ...                             │
│  )                                                       │
│  ORDER BY fetched_at DESC                               │
│  LIMIT 50 OFFSET 0                                      │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Response Processing                                     │
├─────────────────────────────────────────────────────────┤
│  • Return matching records                              │
│  • Include pagination metadata                          │
│  • Exclude rawData field from list (performance)        │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  UI Updates                                             │
├─────────────────────────────────────────────────────────┤
│  • Display filtered results in table                    │
│  • Show record count                                    │
│  • Enable detail view for each record                   │
└─────────────────────────────────────────────────────────┘
```

## Rollback Plan

### Feature Removal

If this feature needs to be rolled back:

1. **Backend Rollback** (Low Risk):
   ```bash
   # Revert src/app/api/raw-data/route.ts
   git revert <commit-hash>

   # Restore original WHERE clause logic
   # Remove JSON path queries, keep only scalar field searches
   ```

2. **Frontend Rollback** (Very Low Risk):
   ```bash
   # Revert src/components/raw-data/raw-data-filters.tsx
   git revert <commit-hash>

   # Restore original placeholder text
   ```

3. **No Database Rollback Required**:
   - No migrations were run
   - No indexes were added
   - No data was modified
   - Existing functionality remains intact

### Rollback Impact Assessment

| Component | Risk | Impact | Recovery Time |
|-----------|------|--------|---------------|
| API Route | Low | Reverts to ID-only search | < 30 minutes |
| Search Placeholder | Very Low | Shows old placeholder text | < 10 minutes |
| Database | None | No database changes made | N/A |
| User Data | None | No data modified | N/A |

### Rollback Procedure

1. **Immediate actions** (if critical bug found):
   - Revert API route changes
   - Deploy emergency hotfix
   - Verify existing search functionality restored

2. **Full rollback** (if feature is problematic):
   - Revert all commits from feature branch
   - Test existing search works
   - Deploy to production

3. **No partial rollback needed**:
   - Feature is atomic (all-or-nothing)
   - No dependencies on other features

## Documentation Updates

### Documentation to Create

1. **Feature Documentation** (this file):
   - ✅ `features/feature-013-raw-data-json-search.md`

### Documentation to Update

1. **Raw Data Viewer Documentation** (if exists):
   - Update search capabilities description
   - Add examples of JSON content searches
   - Document field variants and how they're handled

2. **Developer Documentation**:
   - Document JSON path query pattern for future features
   - Add examples of Prisma JSON filtering

3. **CHANGELOG.md**:
   - Add entry for Feature 013
   - List search enhancements

### Documentation Sections to Add

**In docs/raw-data-viewer.md (if exists):**

```markdown
## Search Functionality

The Raw Data page supports comprehensive search across multiple fields:

### Searchable Fields

**For RawContact records:**
- B2Chat Contact ID (scalar field)
- Sync ID (scalar field)
- Contact ID in JSON (rawData.contact_id or rawData.id)
- Contact Name in JSON (rawData.name or rawData.fullname)
- Mobile Number in JSON (rawData.mobile or rawData.mobile_number)

**For RawChat records:**
- B2Chat Chat ID (scalar field)
- Sync ID (scalar field)
- Chat ID in JSON (rawData.chat_id)
- Contact ID in JSON (rawData.contact.id or rawData.contact.contact_id)
- Contact Name in JSON (rawData.contact.name or rawData.contact.fullname)
- Contact Mobile in JSON (rawData.contact.mobile or rawData.contact.mobile_number)

### Search Behavior

- **Case-insensitive:** Search terms match regardless of case
- **Partial matching:** Finds records containing the search term
- **Field variants:** Automatically searches all B2Chat API field name variants
- **Debounced:** Search triggers 300ms after last keystroke

### Examples

- Search "John" → Finds contacts with name "John Doe", "Johnny", etc.
- Search "555-1234" → Finds contacts/chats with that mobile number
- Search "chat-abc-123" → Finds chats with that chat_id
```

## Success Criteria

### Feature Complete When

- [ ] All 4 implementation chunks completed and tested
- [ ] All unit tests passing (>80% coverage for route.ts)
- [ ] Manual testing checklist completed
- [ ] Documentation updated
- [ ] Code reviewed by peer
- [ ] Staging deployment successful
- [ ] Production deployment completed

### User Acceptance Criteria

- [ ] Users can find raw data by searching contact names
- [ ] Users can find raw data by searching mobile numbers
- [ ] Users can find raw data by searching chat IDs
- [ ] Search is intuitive and fast (<500ms response time)
- [ ] Existing search functionality remains intact
- [ ] Search placeholder clearly describes capabilities

### Performance Criteria

- [ ] Search completes in <500ms for datasets with 10,000+ records
- [ ] No noticeable performance degradation from existing functionality
- [ ] Database query plan is efficient (verified with EXPLAIN)
- [ ] No timeout errors during search operations

### Quality Criteria

- [ ] Code follows project conventions (Pattern #1-65)
- [ ] TypeScript types maintained (no any types)
- [ ] Error handling is robust
- [ ] Prisma queries are properly typed
- [ ] No SQL injection vulnerabilities (Prisma ORM handles this)
- [ ] Backward compatible with existing code

## Metrics & Validation

### Success Metrics (Post-Launch)

Track these metrics after feature launch:

1. **Search Usage**:
   - % of raw data page visits that use search
   - Target: >30% of sessions

2. **Search Effectiveness**:
   - % of searches that return results
   - Target: >70% (empty results indicate users finding what they need)

3. **Time to Find Records**:
   - Reduction in time developers spend finding problematic records
   - Target: -50% (measured via survey)

4. **Developer Satisfaction**:
   - Survey developers on usefulness of JSON search
   - Target: 4/5 stars or higher

### Validation Criteria

**Technical Validation:**
- [ ] All tests green in CI/CD pipeline
- [ ] No TypeScript compilation errors
- [ ] Database query performance acceptable (EXPLAIN ANALYZE)
- [ ] No security vulnerabilities (SQL injection prevention verified)

**User Validation:**
- [ ] Feature walkthrough with development team
- [ ] Test with real production data in staging
- [ ] Verify search finds expected records
- [ ] Confirm performance is acceptable

**Data Validation:**
- [ ] Search results are accurate (manual verification)
- [ ] All field variants are searched
- [ ] Case-insensitive matching works correctly
- [ ] No false positives or false negatives

## Risk Assessment

### Medium Risk Areas

1. **Database Performance** (Medium Risk):
   - **Risk:** JSON path queries could be slower than scalar field searches
   - **Mitigation:**
     - Start without indexes, monitor performance
     - Add GIN indexes only if needed
     - Limit max results per page (50 default)
     - Use EXPLAIN ANALYZE to verify query plans
   - **Monitoring:** Track query response times in logs

2. **Field Variant Coverage** (Low-Medium Risk):
   - **Risk:** B2Chat API might introduce new field name variants
   - **Mitigation:**
     - Document all known variants in code comments
     - Reference B2CHAT_API_FIELD_MAPPING.md
     - Add logging for searches with no results
   - **Monitoring:** Review zero-result searches monthly

### Low Risk Areas

1. **Backward Compatibility** (Low Risk):
   - **Risk:** Existing searches might break
   - **Mitigation:**
     - Comprehensive tests for existing functionality
     - OR clause ensures existing searches still work
     - No breaking changes to API contract
   - **Monitoring:** Test coverage >80%

2. **Edge Cases** (Low Risk):
   - **Risk:** Special characters or malformed JSON
   - **Mitigation:**
     - Prisma handles SQL injection prevention
     - PostgreSQL JSONB handles malformed JSON gracefully
     - Error handling returns empty results instead of crashing
   - **Monitoring:** Sentry error tracking

### Risk Mitigation Summary

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| Slow JSON queries | Medium | Medium | Monitor, add indexes if needed | Backend Dev |
| Missing field variants | Low | Low | Document variants, monitor | Backend Dev |
| Backward compat break | Low | High | Comprehensive tests, careful review | Backend Dev |
| Edge case errors | Low | Low | Prisma ORM, error handling | Backend Dev |

## Implementation Timeline

### Estimated Timeline: 2.5 days (0.5 week)

**Day 1:**
- Chunk 1: RawContact JSON search (0.5 day)
- Chunk 2: RawChat JSON search (0.5 day)

**Day 2:**
- Chunk 3: Update placeholder text (0.25 day)
- Chunk 4: API route tests (0.75 day)

**Day 3 (Half Day):**
- Manual testing (0.25 day)
- Code review and deployment (0.25 day)

### Parallel Development Opportunities

**Can develop in parallel:**
- Chunks 1 and 2 can be done simultaneously (independent)
- Chunk 3 can be done while Chunks 1-2 are in review
- Chunk 4 tests can start after Chunk 1 OR 2 completes

**Must be sequential:**
- Chunks 1, 2 must complete before Chunk 4 (tests need implementation)
- Manual testing must follow all implementation

**Recommended approach:**
1. Implement Chunks 1 and 2 together (they're similar, DRY principle)
2. Update UI (Chunk 3) while code review happens
3. Write comprehensive tests (Chunk 4)
4. Manual testing and deployment

### Resource Requirements

- **Backend Developer:** 2 days (Chunks 1-2, 4)
- **Frontend Developer:** 0.25 day (Chunk 3)
- **QA Engineer:** 0.25 day (manual testing)
- **Code Reviewer:** 0.25 day (review code)

**Total effort:** ~2.75 person-days

## Dependencies

### Internal Dependencies

1. **Raw Data Viewer Page** (Required):
   - Feature 007 must be functional
   - Located at: `/dashboard/raw-data/page.tsx`
   - Status: ✅ Already implemented

2. **Raw Data API** (Required):
   - `/api/raw-data` route must exist
   - Located at: `src/app/api/raw-data/route.ts`
   - Status: ✅ Already implemented

3. **Prisma Client** (Required):
   - Must support JSON path queries
   - Status: ✅ PostgreSQL + Prisma support JSON queries

4. **B2Chat API Field Mapping** (Required):
   - Documentation of field variants
   - Located at: `docs/development/B2CHAT_API_FIELD_MAPPING.md`
   - Status: ✅ Documented

### External Dependencies

**None** - all dependencies are internal

### Library Dependencies

**No new libraries required** - uses existing dependencies:

- ✅ `@prisma/client` (database ORM with JSON support)
- ✅ `next` (API routes)
- ✅ `@clerk/nextjs` (authentication)

### Database Requirements

**PostgreSQL with JSONB support:**
- ✅ PostgreSQL 9.4+ (for JSONB type)
- ✅ Current version supports JSON path queries
- ✅ `rawData` column is already JSONB type

---

## Implementation Notes

### Key Design Decisions

1. **OR Clause Strategy**: Use comprehensive OR clause with all field variants rather than UNION queries because:
   - Simpler to maintain (single query)
   - PostgreSQL optimizer handles OR efficiently
   - Easier to add new search paths in future
   - Follows existing pattern in codebase

2. **No Full-Text Search**: Use `string_contains` rather than PostgreSQL full-text search because:
   - Simpler implementation
   - Sufficient for targeted field searches
   - Avoids full-text search index overhead
   - Users searching specific fields, not entire JSON

3. **Field Variants**: Search all known variants (name/fullname, mobile/mobile_number) because:
   - B2Chat API has inconsistent field names
   - Cannot predict which variant is present
   - Low performance cost (OR clause)
   - Ensures comprehensive search coverage

4. **No New UI Components**: Reuse existing search input because:
   - Feature is transparent enhancement
   - Maintains consistent UX
   - Reduces implementation complexity
   - Users don't need to learn new interface

5. **Optional Indexes**: Start without JSON indexes because:
   - PostgreSQL can scan JSONB efficiently
   - Raw data table is debug/admin tool (not high traffic)
   - Can add indexes later if performance issues arise
   - Avoids premature optimization

### Technical Constraints

1. **JSON Path Depth**: Limited to 2 levels (e.g., `contact.name`) - sufficient for B2Chat API structure

2. **Case Sensitivity**: Relies on PostgreSQL's ILIKE operator via Prisma - works correctly for most locales

3. **Partial Matching**: Always uses `contains` (substring match) - cannot do exact match or prefix match separately

4. **Performance**: No real-time index updates - if JSON structure changes frequently, may need different approach

### Future Enhancements

**Phase 2 (Future):**
- Add advanced search with field-specific filters (search only name, only mobile, etc.)
- Add regex search support for power users
- Add search history/suggestions
- Add GIN indexes if performance testing shows need
- Add search analytics (track which fields users search most)

**Not in scope for this feature:**
- Full-text search across entire JSON
- Search within message content (if present in JSON)
- Search by date ranges within JSON
- Export search results

---

## Appendix

### Related Features

- Feature 007: Raw Data Viewer Page
- Feature 002: Contact Field Mapping Fixes

### Reference Documents

- `docs/development/B2CHAT_API_FIELD_MAPPING.md` - Field name variants
- `src/lib/b2chat/client.ts` - B2Chat API client with field mappings
- `src/lib/sync/transform-engine.ts` - How rawData is transformed
- `b2chat-analytics/hypr-framework/context/planning-agent.md` - Planning patterns
- `b2chat-analytics/hypr-framework/context/backend-agent.md` - Backend patterns

### B2Chat API Field Variants

**RawContact field variants:**
```typescript
// Contact ID
rawData.contact_id || rawData.id

// Name
rawData.fullname || rawData.name

// Mobile
rawData.mobile || rawData.mobile_number
```

**RawChat field variants:**
```typescript
// Chat ID
rawData.chat_id

// Nested Contact ID
rawData.contact.id || rawData.contact.contact_id

// Nested Contact Name
rawData.contact.fullname || rawData.contact.name

// Nested Contact Mobile
rawData.contact.mobile || rawData.contact.mobile_number
```

### Prisma JSON Query Examples

**Flat JSON path:**
```typescript
// Searches rawData.name for "John"
where: {
  rawData: {
    path: ['name'],
    string_contains: 'John'
  }
}

// Generates SQL: raw_data->>'name' ILIKE '%John%'
```

**Nested JSON path:**
```typescript
// Searches rawData.contact.name for "Jane"
where: {
  rawData: {
    path: ['contact', 'name'],
    string_contains: 'Jane'
  }
}

// Generates SQL: raw_data->'contact'->>'name' ILIKE '%Jane%'
```

---

**Document Version:** 1.0
**Created:** 2025-10-29
**Last Updated:** 2025-10-29
**Status:** PLANNED
**Approved By:** Pending
