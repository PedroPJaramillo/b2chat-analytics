# Fix 006: Contact Deduplication with Smart Stub Strategy

## Requirements

### Problem Statement
Contacts are currently extracted from TWO sources, causing duplication and data inconsistency:
1. **Direct Contact API Extraction** (extract-engine.ts:74-366): B2Chat `/contacts` endpoint → raw_contacts → contacts
2. **Embedded in Chats** (transform-engine.ts:1024-1095): chat.contact → extractAndUpsertContact() → contacts

### User Requirements
- Keep both extraction sources (contacts may not participate in recent chats)
- Eliminate duplicate contact creation
- Handle edge cases: missing contact data, deleted contacts, sync timing issues
- Use B2Chat Contacts API as authoritative source of truth
- Maintain referential integrity (no broken foreign keys)
- Support both sync orders (chats before contacts OR contacts before chats)

### Acceptance Criteria
- [ ] No duplicate contacts created regardless of sync order
- [ ] Contacts from API have complete data, stubs have minimal data
- [ ] Stubs are automatically upgraded when API data arrives
- [ ] Chats with missing contact data have NULL contactId (graceful degradation)
- [ ] All existing tests pass (37 tests)
- [ ] New tests cover all edge cases (8+ new tests)
- [ ] Zero database errors from broken foreign keys

## Architecture Design

### How This Feature Fits into Existing Patterns
This fix enhances the existing **two-stage sync architecture** (extract → transform) with a **smart stub strategy**:
- **Stage 1 (Extract)**: No changes - continues to extract contacts from API and chats separately
- **Stage 2 (Transform)**: Enhanced with three-tier contact lifecycle: Stub → Upgraded → Full

### Two-Tier Contact System
```
Tier 1 - STUB CONTACT (from chat embedding):
  - Created during chat transform when contact doesn't exist
  - Contains minimal data: b2chatId, fullName, mobile
  - Marked: syncSource='chat_embedded', needsFullSync=true
  - Allows chats to link immediately (maintains referential integrity)

Tier 2 - FULL CONTACT (from contacts API):
  - Created during contact transform from dedicated API
  - Contains complete data: all fields from B2Chat contacts endpoint
  - Marked: syncSource='contacts_api' (new) or 'upgraded' (upgraded stub)
  - Authoritative source of truth

RECONCILIATION (optional background job):
  - Fixes orphaned chats (NULL contactId but contact exists)
  - Reports stale stubs (needsFullSync=true for >7 days)
  - Provides data quality metrics
```

### Components Modified/Created
- **Modified**: prisma/schema.prisma - Add syncSource enum, needsFullSync flag
- **Modified**: src/lib/sync/transform-engine.ts - Smart stub logic in extractAndUpsertContact()
- **Modified**: src/lib/sync/transform-engine.ts - Upgrade logic in transformContacts()
- **Created**: src/app/api/sync/reconcile-contacts/route.ts - Reconciliation endpoint
- **Modified**: src/app/api/sync/stats/route.ts - Include stub counts
- **Modified**: src/app/dashboard/sync/page.tsx - Display stub indicators
- **Created**: Tests for all edge cases

### Integration Points with Existing Systems
- **Data Sync Engine**: Enhanced contact transform logic, no breaking changes
- **Dashboard Analytics**: Stub contacts still usable in queries (have b2chatId)
- **Chat Management**: Chats can link to stubs or full contacts transparently
- **System Administration**: Sync stats show stub vs full contact counts

### Database Changes Required
```sql
-- Add enum for tracking contact data source
CREATE TYPE contact_sync_source AS ENUM ('contacts_api', 'chat_embedded', 'upgraded');

-- Add fields to contacts table
ALTER TABLE contacts
  ADD COLUMN sync_source contact_sync_source DEFAULT 'contacts_api',
  ADD COLUMN needs_full_sync BOOLEAN DEFAULT FALSE;

-- Add indexes for efficient queries
CREATE INDEX idx_contacts_sync_source ON contacts(sync_source);
CREATE INDEX idx_contacts_needs_full_sync ON contacts(needs_full_sync) WHERE needs_full_sync = TRUE;
```

## Implementation Chunks

### Chunk 1: Database Migration - Add Contact Tracking Fields
**Type:** Backend (Database)
**Dependencies:** None (can start immediately)
**Files to create/modify:**
- `prisma/schema.prisma` (modify Contact model)
- `prisma/migrations/20251029000001_add_contact_sync_source/migration.sql` (create)

**Implementation Details:**
1. Add ContactSyncSource enum to Prisma schema:
   ```prisma
   enum ContactSyncSource {
     contacts_api    // Created from dedicated contacts API endpoint
     chat_embedded   // Created from contact embedded in chat
     upgraded        // Started as stub, upgraded with API data
   }
   ```

2. Add fields to Contact model:
   ```prisma
   model Contact {
     // ... existing fields ...
     syncSource     ContactSyncSource @default(contacts_api) @map("sync_source")
     needsFullSync  Boolean          @default(false) @map("needs_full_sync")
   }
   ```

3. Create migration SQL with safe defaults and indexes

**Tests required:**
- Migration idempotency test (can run twice without errors)
- Default value test (existing contacts get 'contacts_api' source)

**Acceptance criteria:**
- [ ] Prisma schema compiles without errors
- [ ] Migration SQL includes IF NOT EXISTS clauses for safety
- [ ] Indexes created for syncSource and needsFullSync
- [ ] Existing contacts default to syncSource='contacts_api', needsFullSync=false
- [ ] TypeScript types updated via `prisma generate`

---

### Chunk 2: Update extractAndUpsertContact() - Smart Stub Logic
**Type:** Backend
**Dependencies:** Chunk 1 (database fields must exist)
**Files to create/modify:**
- `src/lib/sync/transform-engine.ts` (modify extractAndUpsertContact method, lines 1024-1095)

**Implementation Details:**
Update `extractAndUpsertContact()` to implement smart stub creation:

```typescript
private async extractAndUpsertContact(contactData: any): Promise<string | null> {
  // 1. Handle NULL contact data gracefully
  if (!contactData) return null

  // 2. Extract b2chatId (identification > mobile > email > name)
  const b2chatId = this.extractContactId(contactData)
  if (!b2chatId) return null

  // 3. Look for existing contact
  const existingContact = await prisma.contact.findUnique({
    where: { b2chatId },
  })

  if (existingContact) {
    // 4a. If contact from contacts_api or upgraded → LINK ONLY, don't update
    if (existingContact.syncSource === 'contacts_api' ||
        existingContact.syncSource === 'upgraded') {
      logger.debug('Linking to authoritative contact', { b2chatId })
      return existingContact.id
    }

    // 4b. If contact is stub (chat_embedded) → UPDATE with newer embedded data
    logger.debug('Updating stub contact with newer data', { b2chatId })
    await prisma.contact.update({
      where: { b2chatId },
      data: {
        fullName: extractName(contactData) || existingContact.fullName,
        mobile: contactData.mobile || existingContact.mobile,
        email: contactData.email || existingContact.email,
        lastSyncAt: new Date(),
      },
    })
    return existingContact.id
  }

  // 5. Create minimal STUB contact
  logger.info('Creating stub contact from chat embedding', { b2chatId })
  const contact = await prisma.contact.create({
    data: {
      id: generateContactId(b2chatId),
      b2chatId,
      fullName: extractName(contactData) || 'Unknown Contact',
      mobile: contactData.mobile || contactData.mobile_number || null,
      email: contactData.email || null,
      syncSource: 'chat_embedded',
      needsFullSync: true,
      lastSyncAt: new Date(),
    },
  })

  return contact.id
}
```

**Tests required:** Yes - 5 test cases:
1. NULL contact data → returns null (no error)
2. New contact → creates stub with syncSource='chat_embedded', needsFullSync=true
3. Existing full contact → links without updating
4. Existing stub → updates stub with newer data
5. Invalid contact data (no identifiers) → returns null

**Acceptance criteria:**
- [ ] Returns NULL for missing contact data (graceful degradation)
- [ ] Creates stubs with syncSource='chat_embedded', needsFullSync=true
- [ ] Respects authoritative contacts (no updates to 'contacts_api' or 'upgraded')
- [ ] Updates existing stubs with newer embedded data
- [ ] All contact creation is logged with appropriate level
- [ ] No database errors or broken FKs

---

### Chunk 3: Update transformContacts() - Upgrade Stub Logic
**Type:** Backend
**Dependencies:** Chunk 1 (database fields), Chunk 2 (stub creation)
**Files to create/modify:**
- `src/lib/sync/transform-engine.ts` (modify transformContacts method, lines 267-386)

**Implementation Details:**
Enhance `transformContacts()` to upgrade stubs to full contacts:

```typescript
async transformContacts(
  extractSyncId?: string,
  options: TransformOptions = {}
): Promise<TransformResult> {
  // ... existing batch-agnostic fetching logic ...

  for (const rawContact of rawContacts) {
    const contactData = rawContact.rawData as any
    const b2chatId = extractContactId(contactData)

    // 1. Check if contact exists
    const existingContact = await prisma.contact.findUnique({
      where: { b2chatId },
    })

    if (existingContact) {
      // 2a. UPGRADE STUB to full contact
      if (existingContact.syncSource === 'chat_embedded') {
        logger.info('Upgrading stub contact to full', { b2chatId })

        await prisma.contact.update({
          where: { b2chatId },
          data: {
            // Merge: API data wins, preserve existing if API null
            fullName: contactData.full_name || existingContact.fullName,
            mobile: contactData.mobile || existingContact.mobile,
            email: contactData.email || existingContact.email,
            phoneNumber: contactData.phone_number,
            identification: contactData.identification,
            address: contactData.address,
            city: contactData.city,
            country: contactData.country,
            company: contactData.company,
            customAttributes: contactData.custom_attributes,
            tags: contactData.tags,
            merchantId: contactData.merchant_id,
            b2chatCreatedAt: parseDate(contactData.created_at),
            b2chatUpdatedAt: parseDate(contactData.updated_at),

            // Update tracking fields
            syncSource: 'upgraded',
            needsFullSync: false,
            lastSyncAt: new Date(),
          },
        })

        stats.recordsUpdated++
        continue
      }

      // 2b. UPDATE existing full contact (normal upsert)
      const changes = detectContactChanges(existingContact, contactData)
      if (changes?.hasChanges) {
        logger.debug('Updating full contact with API data', { b2chatId, changes })
        await prisma.contact.update({
          where: { b2chatId },
          data: {
            // ... all fields from API ...
            lastSyncAt: new Date(),
          },
        })
        stats.recordsUpdated++
      } else {
        stats.recordsSkipped++
      }
    } else {
      // 3. CREATE new full contact from API
      logger.info('Creating full contact from API', { b2chatId })
      await prisma.contact.create({
        data: {
          // ... all fields from API ...
          syncSource: 'contacts_api',
          needsFullSync: false,
          lastSyncAt: new Date(),
        },
      })
      stats.recordsCreated++
    }

    // Mark raw record as processed
    await prisma.rawContact.update({
      where: { id: rawContact.id },
      data: { processingStatus: 'completed', processedAt: new Date() },
    })
  }

  return stats
}
```

**Tests required:** Yes - 4 test cases:
1. Transform with stub contact → upgrades to 'upgraded', sets needsFullSync=false
2. Transform with full contact → normal update, preserves syncSource
3. Transform with new contact → creates with syncSource='contacts_api'
4. Upgrade preserves existing data when API returns null

**Acceptance criteria:**
- [ ] Stubs upgraded to syncSource='upgraded', needsFullSync=false
- [ ] API data wins on merge conflicts during upgrade
- [ ] Existing full contacts updated normally (preserves syncSource)
- [ ] New contacts created with syncSource='contacts_api'
- [ ] Stats correctly reflect created/updated/skipped counts
- [ ] All operations logged appropriately

---

### Chunk 4: Add Reconciliation Endpoint (Optional)
**Type:** Backend (API)
**Dependencies:** Chunk 1, 2, 3 (full transform logic in place)
**Files to create/modify:**
- `src/app/api/sync/reconcile-contacts/route.ts` (create new file)
- `src/app/api/sync/reconcile-contacts/__tests__/route.test.ts` (create new file)

**Implementation Details:**
Create optional reconciliation endpoint for data quality monitoring:

```typescript
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // 1. Authentication
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results = {
    orphanedChatsFixed: 0,
    staleStubsFound: 0,
    errors: [] as string[],
  }

  try {
    // 2. Find orphaned chats (NULL contactId but have b2chatContactId in rawData)
    const orphanedChats = await prisma.chat.findMany({
      where: { contactId: null },
      select: { id: true, b2chatId: true },
    })

    for (const chat of orphanedChats) {
      // Try to link to existing contact
      // ... implementation ...
      results.orphanedChatsFixed++
    }

    // 3. Find stale stubs (needsFullSync=true for >7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const staleStubs = await prisma.contact.count({
      where: {
        needsFullSync: true,
        lastSyncAt: { lt: sevenDaysAgo },
      },
    })
    results.staleStubsFound = staleStubs

    logger.info('Contact reconciliation completed', results)

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    logger.error('Reconciliation failed', { error })
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 }
    )
  }
}
```

**Tests required:** Yes - 3 test cases:
1. Authentication failure → 401
2. Successful reconciliation → fixes orphans, reports stale stubs
3. Error handling → 500 with logged error

**Acceptance criteria:**
- [ ] Requires authentication (401 if not authenticated)
- [ ] Finds and fixes orphaned chats
- [ ] Reports stale stubs (>7 days old)
- [ ] Returns reconciliation stats
- [ ] All operations logged
- [ ] Tests cover success and failure cases

---

### Chunk 5: Update Tests - Comprehensive Edge Case Coverage
**Type:** Backend (Testing)
**Dependencies:** Chunks 1-4 (all implementation complete)
**Files to create/modify:**
- `src/lib/sync/transform-engine.test.ts` (add 8+ test cases)
- `src/app/api/sync/reconcile-contacts/__tests__/route.test.ts` (create)

**Implementation Details:**
Add comprehensive test coverage for all edge cases:

**New Test Cases for transform-engine.test.ts:**
```typescript
describe('Contact Deduplication - Smart Stub Strategy', () => {
  describe('extractAndUpsertContact', () => {
    test('handles NULL contact data gracefully', async () => {
      const result = await engine.extractAndUpsertContact(null)
      expect(result).toBeNull()
    })

    test('creates stub contact from chat embedding', async () => {
      const contactData = { mobile: '1234567890', name: 'John Doe' }
      const contactId = await engine.extractAndUpsertContact(contactData)

      const contact = await prisma.contact.findUnique({ where: { id: contactId } })
      expect(contact.syncSource).toBe('chat_embedded')
      expect(contact.needsFullSync).toBe(true)
    })

    test('links to existing full contact without updating', async () => {
      // Create full contact
      await prisma.contact.create({
        data: {
          b2chatId: '123',
          syncSource: 'contacts_api',
          fullName: 'Original Name',
        }
      })

      // Try to upsert with different name
      const contactId = await engine.extractAndUpsertContact({
        identification: '123',
        name: 'Different Name'
      })

      const contact = await prisma.contact.findUnique({ where: { id: contactId } })
      expect(contact.fullName).toBe('Original Name') // Not updated
      expect(contact.syncSource).toBe('contacts_api') // Preserved
    })

    test('updates existing stub with newer embedded data', async () => {
      // Create stub
      await prisma.contact.create({
        data: {
          b2chatId: '456',
          syncSource: 'chat_embedded',
          needsFullSync: true,
          fullName: 'Old Name',
        }
      })

      // Update with newer data
      await engine.extractAndUpsertContact({
        identification: '456',
        name: 'New Name',
        email: 'new@example.com'
      })

      const contact = await prisma.contact.findFirst({ where: { b2chatId: '456' } })
      expect(contact.fullName).toBe('New Name')
      expect(contact.email).toBe('new@example.com')
      expect(contact.syncSource).toBe('chat_embedded') // Still stub
      expect(contact.needsFullSync).toBe(true)
    })

    test('handles contact with no valid identifier', async () => {
      const result = await engine.extractAndUpsertContact({ random: 'data' })
      expect(result).toBeNull()
    })
  })

  describe('transformContacts - Upgrade Logic', () => {
    test('upgrades stub to full contact with API data', async () => {
      // Create stub
      await prisma.contact.create({
        data: {
          b2chatId: '789',
          syncSource: 'chat_embedded',
          needsFullSync: true,
          fullName: 'Stub Name',
          mobile: '111',
        }
      })

      // Create raw contact with full API data
      await prisma.rawContact.create({
        data: {
          syncId: 'sync_123',
          b2chatContactId: '789',
          rawData: {
            contact_id: '789',
            full_name: 'Full Name',
            mobile: '111',
            email: 'full@example.com',
            address: '123 Main St',
            // ... complete API data
          },
          processingStatus: 'pending',
        }
      })

      // Transform
      const result = await engine.transformContacts('sync_123')

      const contact = await prisma.contact.findFirst({ where: { b2chatId: '789' } })
      expect(contact.syncSource).toBe('upgraded')
      expect(contact.needsFullSync).toBe(false)
      expect(contact.fullName).toBe('Full Name')
      expect(contact.email).toBe('full@example.com')
      expect(contact.address).toBe('123 Main St')
      expect(result.recordsUpdated).toBe(1)
    })

    test('creates full contact from API when no stub exists', async () => {
      await prisma.rawContact.create({
        data: {
          syncId: 'sync_456',
          b2chatContactId: '999',
          rawData: { contact_id: '999', full_name: 'New Contact' },
          processingStatus: 'pending',
        }
      })

      const result = await engine.transformContacts('sync_456')

      const contact = await prisma.contact.findFirst({ where: { b2chatId: '999' } })
      expect(contact.syncSource).toBe('contacts_api')
      expect(contact.needsFullSync).toBe(false)
      expect(result.recordsCreated).toBe(1)
    })

    test('preserves existing data when API returns null during upgrade', async () => {
      // Create stub with mobile
      await prisma.contact.create({
        data: {
          b2chatId: '111',
          syncSource: 'chat_embedded',
          fullName: 'Name',
          mobile: '555-1234', // Has mobile
        }
      })

      // API data has no mobile
      await prisma.rawContact.create({
        data: {
          syncId: 'sync_789',
          b2chatContactId: '111',
          rawData: { contact_id: '111', full_name: 'Name', mobile: null },
          processingStatus: 'pending',
        }
      })

      await engine.transformContacts('sync_789')

      const contact = await prisma.contact.findFirst({ where: { b2chatId: '111' } })
      expect(contact.mobile).toBe('555-1234') // Preserved
    })
  })
})
```

**Tests required:**
- 8 new tests for transform-engine.ts
- 3 tests for reconcile-contacts API route

**Acceptance criteria:**
- [ ] All 37 existing tests still pass
- [ ] 8+ new tests cover edge cases (NULL, stubs, upgrades, links)
- [ ] Test coverage >85% for modified code
- [ ] All tests use mocked Prisma client
- [ ] Tests follow jest naming conventions

---

### Chunk 6: Update UI - Display Stub Status
**Type:** Frontend
**Dependencies:** Chunks 1-3 (backend implementation complete)
**Files to create/modify:**
- `src/app/api/sync/stats/route.ts` (add stub counts)
- `src/app/dashboard/sync/page.tsx` (display stub indicators)
- `src/hooks/use-sync-stats.ts` (update types)

**Implementation Details:**

1. **Update stats API to include stub counts:**
```typescript
// src/app/api/sync/stats/route.ts
const [contactsCount, stubContactsCount] = await Promise.all([
  prisma.contact.count(),
  prisma.contact.count({
    where: { needsFullSync: true },
  }),
])

return NextResponse.json({
  synced: {
    contacts: contactsCount,
    contactsNeedingSync: stubContactsCount, // NEW
    chats: chatsCount,
  },
  // ... rest
})
```

2. **Update hook types:**
```typescript
// src/hooks/use-sync-stats.ts
export interface SyncStats {
  synced: {
    contacts: number
    contactsNeedingSync: number // NEW
    chats: number
  }
}
```

3. **Display stub count in UI:**
```tsx
// src/app/dashboard/sync/page.tsx
<CardContent>
  <div className="text-2xl font-bold">
    {formatCount(syncedContacts)}
  </div>
  {contactsNeedingSync > 0 && (
    <Badge variant="warning" className="mt-2">
      {formatCount(contactsNeedingSync)} need full sync
    </Badge>
  )}
</CardContent>
```

**Tests required:**
- Update existing stats API tests to check new field
- Snapshot tests for UI with stub indicators

**Acceptance criteria:**
- [ ] Stats API returns contactsNeedingSync count
- [ ] Dashboard shows warning badge when stubs exist
- [ ] Hover tooltip explains what "need full sync" means
- [ ] No UI errors or type errors
- [ ] Tests updated and passing

---

## Testing Strategy

### Unit Tests (Jest)
**When:** During each chunk implementation (Chunks 2-6)
**What to test:**
- Chunk 2: extractAndUpsertContact() with 5 test cases
- Chunk 3: transformContacts() upgrade logic with 4 test cases
- Chunk 4: Reconciliation API with 3 test cases
- All edge cases: NULL data, missing fields, timing scenarios

**Test Patterns:**
- Mock Prisma client with @jest-mock
- Test authentication (401 for unauthorized)
- Test validation (400 for invalid input)
- Test business logic with controlled DB responses

### Integration Tests
**When:** After Chunk 6 (all implementation complete)
**What to test:**
- End-to-end sync flow: Extract chats → Transform chats (creates stubs) → Extract contacts → Transform contacts (upgrades stubs)
- Reverse order: Extract contacts → Transform contacts → Extract chats → Transform chats (links to existing)
- Verify no duplicate contacts created
- Verify all foreign keys valid

### E2E Tests (Manual)
**When:** After Chunk 6 (before deployment)
**What to verify:**
1. Fresh database: Sync chats first → See stub contacts created
2. Run contact sync → Verify stubs upgraded
3. Check dashboard → Verify stub indicators show correctly
4. Run reconciliation → Verify orphan cleanup
5. Repeat with reverse order (contacts before chats)

## Database Changes

### Migrations Needed
**Migration 1:** Add contact tracking fields
- **File:** `20251029000001_add_contact_sync_source/migration.sql`
- **Timing:** Chunk 1 (before any code changes)
- **Rollback:** Can DROP COLUMN if needed (non-breaking)

**Migration SQL:**
```sql
-- Create enum
CREATE TYPE contact_sync_source AS ENUM ('contacts_api', 'chat_embedded', 'upgraded');

-- Add columns with safe defaults
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS sync_source contact_sync_source DEFAULT 'contacts_api',
  ADD COLUMN IF NOT EXISTS needs_full_sync BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_sync_source ON contacts(sync_source);
CREATE INDEX IF NOT EXISTS idx_contacts_needs_full_sync ON contacts(needs_full_sync)
  WHERE needs_full_sync = TRUE;

-- Update existing contacts (all from API historically)
UPDATE contacts
SET sync_source = 'contacts_api', needs_full_sync = FALSE
WHERE sync_source IS NULL;
```

### Data Changes
- **Existing contacts**: Default to syncSource='contacts_api', needsFullSync=false
- **No data loss**: All existing data preserved
- **Additive only**: No destructive changes

## API Changes

### New Endpoints
**POST /api/sync/reconcile-contacts** (optional, created in Chunk 4)
- **Purpose:** Manual reconciliation trigger for orphaned chats and stale stubs
- **Auth:** Required (401 if not authenticated)
- **Response:**
```typescript
{
  success: boolean
  results: {
    orphanedChatsFixed: number
    staleStubsFound: number
    errors: string[]
  }
}
```

### Modified Endpoints
**GET /api/sync/stats** (modified in Chunk 6)
- **Added field:** `synced.contactsNeedingSync: number`
- **Backward compatible:** Existing clients ignore new field
- **Type update:** SyncStats interface in use-sync-stats.ts

## Integration Points

### Services Affected

1. **Data Sync Engine** (transform-engine.ts)
   - Enhanced: extractAndUpsertContact() with smart stub logic
   - Enhanced: transformContacts() with upgrade logic
   - Impact: No breaking changes, graceful fallback

2. **Dashboard Analytics** (sync/page.tsx)
   - Enhanced: Displays stub status indicators
   - Impact: Better visibility into data quality

3. **Chat Management**
   - Impact: None (chats transparently link to stubs or full contacts)
   - Benefit: No more broken foreign keys

4. **System Administration**
   - New: Reconciliation endpoint for data quality monitoring
   - Impact: Optional tool for admins to fix data issues

### External Systems
- **B2Chat API**: No changes required (read-only integration)
- **Clerk Auth**: No changes (continues to use existing auth patterns)
- **Database**: Additive schema changes only (no breaking changes)

## Rollback Plan

### How to Undo This Feature

1. **Database Rollback:**
```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_contacts_sync_source;
DROP INDEX IF EXISTS idx_contacts_needs_full_sync;

-- Remove columns
ALTER TABLE contacts DROP COLUMN IF EXISTS sync_source;
ALTER TABLE contacts DROP COLUMN IF EXISTS needs_full_sync;

-- Drop enum
DROP TYPE IF EXISTS contact_sync_source;
```

2. **Code Rollback:**
   - Revert transform-engine.ts changes (restore original extractAndUpsertContact)
   - Remove reconciliation endpoint
   - Revert stats API changes
   - Revert UI changes

3. **Data Impact:**
   - Existing contacts remain (no data loss)
   - Stubs remain (still valid contacts, just not marked)
   - No functional impact (old behavior restored)

### Database Rollback Procedures
- **Safe to rollback anytime**: Fields are additive with defaults
- **No data loss**: Dropping tracking fields doesn't affect core data
- **Migration down:** Create reverse migration if needed

### Feature Flag Considerations
**Optional:** Add feature flag to enable/disable smart stub behavior
```typescript
const ENABLE_SMART_STUBS = process.env.ENABLE_SMART_STUBS === 'true'

if (ENABLE_SMART_STUBS) {
  // Use smart stub logic
} else {
  // Use legacy extractAndUpsertContact
}
```

## Documentation Updates

### Code Documentation
- Add JSDoc comments to extractAndUpsertContact() explaining smart stub logic
- Add JSDoc comments to transformContacts() explaining upgrade flow
- Document ContactSyncSource enum values
- Add inline comments for complex merge logic

### API Documentation
- Document new reconcile-contacts endpoint
- Update sync stats API documentation with new field
- Add examples of stub vs full contact lifecycle

### User Documentation
- Add section to admin guide explaining stub contacts
- Document when reconciliation should be run
- Explain sync order recommendations (contacts before chats preferred)

### Developer Documentation
- Update sync architecture docs with smart stub pattern
- Add flow diagrams showing stub → upgraded lifecycle
- Document testing patterns for stub scenarios

## Success Criteria

### Functional Requirements
- [ ] No duplicate contacts created in any sync order scenario
- [ ] Stubs automatically upgraded when API data arrives
- [ ] Chats with missing contact data have NULL contactId (no errors)
- [ ] Reconciliation endpoint fixes orphaned chats
- [ ] All edge cases handled gracefully

### Technical Requirements
- [ ] All 37 existing tests pass
- [ ] 8+ new tests added with >85% coverage
- [ ] No database errors or foreign key violations
- [ ] Migration runs successfully on dev and production
- [ ] TypeScript compiles without errors

### Performance Requirements
- [ ] No significant performance degradation in transform operations
- [ ] Indexes ensure fast queries for stub filtering
- [ ] Reconciliation completes in <30 seconds for typical datasets

### Quality Requirements
- [ ] Code follows project patterns (backend-agent.md)
- [ ] All operations logged with appropriate context
- [ ] Error handling covers all failure scenarios
- [ ] UI provides clear feedback on stub status

### Metrics and Validation
- [ ] Monitor stub count over time (should decrease after contact sync)
- [ ] Track upgrade success rate (stubs → upgraded)
- [ ] Measure duplicate contact rate (should be 0%)
- [ ] Verify no broken foreign keys in production

### Deployment Readiness
- [ ] Migration tested on staging environment
- [ ] Rollback procedure documented and tested
- [ ] Feature flag implemented for safe rollout
- [ ] Monitoring alerts configured for stub accumulation
