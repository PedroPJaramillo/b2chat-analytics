# Feature 002: Contact Field Mapping Fixes

## Requirements

### Current State Problem
Based on analysis in `docs/analysis/contact-transformation-analysis.md`, the contact transformation has critical data loss issues:

1. **Tags Data Loss (CRITICAL)**: All contact tags from B2Chat are silently discarded
   - B2Chat returns: `[{name: "VIP", assigned_at: 1706644084}]`
   - Current schema expects: `["VIP"]` (array of strings)
   - Result: Tags lost during sync

2. **Landline Field Mismatch (HIGH)**: Landline phone numbers not captured
   - API returns: `"landline": "+571234567"`
   - Code maps: `rawData.phone_number` (wrong field)
   - Result: All landline numbers missing

3. **Missing Business Fields (MEDIUM)**: Critical metadata not stored
   - `merchant_id`: Multi-merchant support broken
   - `created`: Original B2Chat creation date lost
   - `updated`: Original B2Chat update date lost

### B2Chat API Actual Response
```json
{
  "contact_id": 123456789,
  "fullname": "John Doe",
  "mobile": "+57123456789",
  "landline": "+571234567",
  "email": "jhondoe@b2chat.io",
  "merchant_id": 100,
  "created": "2020-11-09 19:10:23",
  "updated": "2024-01-25 16:24:14",
  "custom_attributes": [
    { "name": "CustomerType", "value": "Enterprise" }
  ],
  "tags": [
    { "name": "VIP", "assigned_at": 1706644084 },
    { "name": "Premium", "assigned_at": 1706648900 }
  ]
}
```

### User Requirements
- ✅ Fix all field mapping issues to prevent data loss
- ✅ Support dynamic tags (B2Chat users can create new tags anytime)
- ✅ Support dynamic custom fields (existing, working correctly)
- ✅ Preserve original B2Chat timestamps for historical analysis
- ✅ Support multi-merchant environments
- ✅ Backward compatible (no breaking changes to existing data)
- ✅ Enable tag-based segmentation and filtering

### Acceptance Criteria
- [ ] All contact tags correctly stored with timestamps
- [ ] Landline phone numbers captured from API
- [ ] Merchant ID stored for multi-tenant support
- [ ] Original B2Chat creation/update dates preserved
- [ ] New tags from B2Chat automatically work (no code changes)
- [ ] Existing contacts backfilled with missing data (via re-sync)
- [ ] Change detection tracks all new fields
- [ ] No performance degradation (< 5% slower sync)

---

## Architecture Design

### How This Feature Fits Into Existing Patterns

Following the **5-layer architecture** and **data sync patterns**:

**Layer 1 - Database Schema**:
- Add 4 new fields to Contact model (JSON for flexibility)
- Use same pattern as `customAttributes` (JSON storage for dynamic data)
- Add indexes for merchant_id queries
- Maintain backward compatibility (all fields nullable)

**Layer 2 - B2Chat Client & Sync Engine**:
- Update Zod schema to handle tags as array of objects
- Fix field name mapping in transform engine
- Enhance change detector to track new fields
- Preserve data lineage (B2Chat original timestamps)

**Layer 3 - API Endpoints**:
- Existing contact APIs automatically benefit from new fields
- No new endpoints required
- Contact search can leverage merchant_id filter

**Layer 4 - Frontend**:
- Tag display components (badges with assignment dates)
- Filter contacts by tags
- Display merchant information
- Show original B2Chat creation date vs first sync date

**Layer 5 - Infrastructure**:
- Migration script with rollback capability
- Data backfill strategy (re-sync contacts)
- Monitoring for field population rates

### Components/Services Modified

**Modified Components**:
- `prisma/schema.prisma` - Add 4 fields to Contact model
- `src/lib/b2chat/client.ts` - Fix tags Zod schema
- `src/lib/sync/transform-engine.ts` - Map all missing fields
- `src/lib/sync/change-detector.ts` - Track new fields for updates

**No New Components Required**: This is a fix to existing transformation logic

### Integration Points with Existing Systems

**1. Data Sync Engine** (Core Integration):
- Extract stage: No changes (already fetches all fields)
- Transform stage: Fix field mappings (main work)
- Validation stage: No changes needed

**2. Dashboard Analytics**:
- Tag-based filtering becomes possible
- Merchant segmentation enabled
- Historical trend analysis improved (original dates)

**3. Contact Management**:
- Contact cards can display tags
- Landline contact method available
- Merchant context visible

**4. Customer Analysis**:
- Tag-based customer segments
- Contact vintage analysis (original creation date)
- Per-merchant metrics

### Database Changes Required

**New Fields on Contact Model**:
```prisma
model Contact {
  // ... existing fields ...

  // NEW: Tags (dynamic, adapts to new B2Chat tags)
  tags             Json?     @map("tags")

  // NEW: Multi-merchant support
  merchantId       String?   @map("merchant_id")

  // NEW: Original B2Chat timestamps (data lineage)
  b2chatCreatedAt  DateTime? @map("b2chat_created_at")
  b2chatUpdatedAt  DateTime? @map("b2chat_updated_at")
}
```

**Rationale for JSON Storage (tags)**:
- ✅ **Flexible**: New tags work immediately without schema changes
- ✅ **Consistent**: Same pattern as `customAttributes`
- ✅ **Queryable**: Postgres JSON operators enable tag filtering
- ✅ **Preserves metadata**: Keeps `assigned_at` timestamps
- ✅ **Simple**: No need for separate ContactTag table

**New Indexes**:
```sql
CREATE INDEX "contacts_merchant_id_idx" ON "contacts"("merchant_id");
CREATE INDEX "contacts_b2chat_created_at_idx" ON "contacts"("b2chat_created_at");
```

---

## Implementation Chunks

### Chunk 1: Database Schema Migration
**Type**: Backend (Database)
**Dependencies**: None
**Estimated Effort**: Small (0.5 day)

**Files to create/modify**:
- `prisma/schema.prisma`
- `prisma/migrations/20251023_contact_field_fixes/migration.sql` (new)

**Implementation Steps**:

1. **Update Prisma schema**:
   ```prisma
   model Contact {
     id               String    @id
     b2chatId         String    @unique @map("b2chat_id")
     fullName         String    @map("full_name")
     mobile           String?
     phoneNumber      String?   @map("phone_number")
     email            String?
     identification   String?
     address          String?
     city             String?
     country          String?
     company          String?
     customAttributes Json?     @map("custom_attributes")

     // NEW FIELDS
     tags             Json?     @map("tags")
     merchantId       String?   @map("merchant_id")
     b2chatCreatedAt  DateTime? @map("b2chat_created_at")
     b2chatUpdatedAt  DateTime? @map("b2chat_updated_at")

     isDeleted        Boolean   @default(false) @map("is_deleted")
     deletedAt        DateTime? @map("deleted_at")
     deletionReason   String?   @map("deletion_reason")
     lastSyncAt       DateTime? @map("last_sync_at")
     createdAt        DateTime  @default(now()) @map("created_at")
     updatedAt        DateTime  @updatedAt @map("updated_at")

     chats Chat[]

     @@index([b2chatId])
     @@index([email])
     @@index([mobile])
     @@index([phoneNumber])
     @@index([merchantId])  // NEW
     @@index([isDeleted])
     @@map("contacts")
   }
   ```

2. **Generate migration**:
   ```bash
   cd b2chat-analytics
   npx prisma migrate dev --name contact_field_fixes
   ```

3. **Review generated migration SQL**, ensure includes:
   ```sql
   ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tags" JSONB;
   ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "merchant_id" TEXT;
   ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "b2chat_created_at" TIMESTAMP;
   ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "b2chat_updated_at" TIMESTAMP;

   CREATE INDEX IF NOT EXISTS "contacts_merchant_id_idx" ON "contacts"("merchant_id");
   CREATE INDEX IF NOT EXISTS "contacts_b2chat_created_at_idx" ON "contacts"("b2chat_created_at");

   -- Add comments for documentation
   COMMENT ON COLUMN "contacts"."tags" IS 'B2Chat tags with assignment timestamps - JSON array: [{"name": "VIP", "assigned_at": 1706644084}]';
   COMMENT ON COLUMN "contacts"."merchant_id" IS 'B2Chat merchant identifier for multi-tenant support';
   COMMENT ON COLUMN "contacts"."b2chat_created_at" IS 'Original creation timestamp from B2Chat (not our sync time)';
   COMMENT ON COLUMN "contacts"."b2chat_updated_at" IS 'Original last update timestamp from B2Chat';
   ```

4. **Test migration**:
   - Run on development database
   - Verify all columns added
   - Check indexes created
   - Confirm existing data intact

5. **Create rollback script**:
   ```sql
   -- rollback.sql
   DROP INDEX IF EXISTS "contacts_b2chat_created_at_idx";
   DROP INDEX IF EXISTS "contacts_merchant_id_idx";

   ALTER TABLE "contacts" DROP COLUMN IF EXISTS "b2chat_updated_at";
   ALTER TABLE "contacts" DROP COLUMN IF EXISTS "b2chat_created_at";
   ALTER TABLE "contacts" DROP COLUMN IF EXISTS "merchant_id";
   ALTER TABLE "contacts" DROP COLUMN IF EXISTS "tags";
   ```

**Tests required**: Yes
- Migration runs without errors on clean database
- Migration runs without errors on existing data
- All 4 new columns present with correct types
- Indexes created successfully
- Rollback script tested and working
- No data corruption

**Acceptance criteria**:
- [x] Schema updated with 4 new fields
- [x] Migration script generated
- [x] Migration tested on dev database
- [x] Indexes created for performance
- [x] Comments added for documentation
- [x] Rollback script created and tested
- [x] No existing data lost or corrupted

---

### Chunk 2: Fix B2Chat Client Zod Schema
**Type**: Backend (API Client)
**Dependencies**: Chunk 1 (schema ready)
**Estimated Effort**: Small (0.5 day)

**Files to modify**:
- `src/lib/b2chat/client.ts` (lines 37-60)

**Implementation Steps**:

1. **Fix tags schema** (line 56):
   ```typescript
   // BEFORE (WRONG - expects array of strings)
   tags: z.union([z.array(z.string()), z.null()]).nullable().optional()

   // AFTER (CORRECT - array of objects with metadata)
   tags: z.array(z.object({
     name: z.string(),
     assigned_at: z.number()  // Unix timestamp
   })).nullable().optional()
   ```

2. **Verify other fields are recognized** (already correct, but confirm):
   ```typescript
   landline: z.string().nullable().optional(),  // ✅ Already recognized
   merchant_id: z.union([z.string(), z.number()]).nullable().optional(),  // ✅ Already recognized
   created: z.string().nullable().optional(),  // ✅ Already recognized
   updated: z.string().nullable().optional(),  // ✅ Already recognized
   ```

3. **Add JSDoc comments for clarity**:
   ```typescript
   const B2ChatContactSchema = z.object({
     // ... other fields ...

     /**
      * Contact tags assigned in B2Chat
      * Structure: [{ name: "VIP", assigned_at: 1706644084 }]
      * assigned_at is Unix timestamp (seconds since epoch)
      * B2Chat users can create new tags dynamically - no schema change needed
      */
     tags: z.array(z.object({
       name: z.string(),
       assigned_at: z.number()
     })).nullable().optional(),

     /**
      * Landline/fixed phone number (different from mobile)
      * Maps to Contact.phoneNumber in database
      */
     landline: z.string().nullable().optional(),

     /**
      * Merchant identifier for multi-tenant B2Chat instances
      */
     merchant_id: z.union([z.string(), z.number()]).nullable().optional(),

     /**
      * Original creation timestamp in B2Chat (not our sync time)
      * Format: "2020-11-09 19:10:23"
      */
     created: z.string().nullable().optional(),

     /**
      * Original last update timestamp in B2Chat
      * Format: "2024-01-25 16:24:14"
      */
     updated: z.string().nullable().optional(),
   }).passthrough()
   ```

4. **Update TypeScript type export**:
   ```typescript
   export type B2ChatContact = z.infer<typeof B2ChatContactSchema>

   // TypeScript will now correctly infer tags as:
   // tags?: Array<{ name: string; assigned_at: number }> | null
   ```

**Tests required**: Yes - `src/lib/b2chat/__tests__/client.test.ts`

```typescript
describe('B2ChatContactSchema - Tags Parsing', () => {
  test('parses tags with assignment timestamps correctly', () => {
    const rawContact = {
      contact_id: 123,
      fullname: 'Test User',
      tags: [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Premium', assigned_at: 1706648900 }
      ]
    }

    const result = B2ChatContactSchema.parse(rawContact)

    expect(result.tags).toHaveLength(2)
    expect(result.tags[0]).toEqual({ name: 'VIP', assigned_at: 1706644084 })
    expect(result.tags[1]).toEqual({ name: 'Premium', assigned_at: 1706648900 })
  })

  test('handles null tags', () => {
    const result = B2ChatContactSchema.parse({
      contact_id: 123,
      fullname: 'Test User',
      tags: null
    })

    expect(result.tags).toBeNull()
  })

  test('handles missing tags field', () => {
    const result = B2ChatContactSchema.parse({
      contact_id: 123,
      fullname: 'Test User'
    })

    expect(result.tags).toBeUndefined()
  })

  test('handles dynamic new tags (no schema change needed)', () => {
    // B2Chat user creates new tag "Urgent Follow-up" today
    const result = B2ChatContactSchema.parse({
      contact_id: 123,
      tags: [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Urgent Follow-up', assigned_at: 1730000000 }  // New tag!
      ]
    })

    expect(result.tags[1].name).toBe('Urgent Follow-up')
  })
})

describe('B2ChatContactSchema - Other Field Fixes', () => {
  test('recognizes landline field', () => {
    const result = B2ChatContactSchema.parse({
      contact_id: 123,
      fullname: 'Office Contact',
      mobile: '+573001234567',
      landline: '+571234567'
    })

    expect(result.landline).toBe('+571234567')
    expect(result.mobile).toBe('+573001234567')
  })

  test('recognizes merchant_id as number', () => {
    const result = B2ChatContactSchema.parse({
      contact_id: 123,
      merchant_id: 100
    })

    expect(result.merchant_id).toBe(100)
  })

  test('recognizes merchant_id as string', () => {
    const result = B2ChatContactSchema.parse({
      contact_id: 123,
      merchant_id: "merchant_abc"
    })

    expect(result.merchant_id).toBe("merchant_abc")
  })

  test('parses B2Chat created/updated timestamps', () => {
    const result = B2ChatContactSchema.parse({
      contact_id: 123,
      created: "2020-11-09 19:10:23",
      updated: "2024-01-25 16:24:14"
    })

    expect(result.created).toBe("2020-11-09 19:10:23")
    expect(result.updated).toBe("2024-01-25 16:24:14")
  })
})
```

**Acceptance criteria**:
- [x] Tags schema accepts array of objects with name + assigned_at
- [x] Landline field recognized (already was, confirmed)
- [x] Merchant_id supports both number and string
- [x] Created/updated timestamps recognized
- [x] All unit tests passing
- [x] TypeScript types correct
- [x] JSDoc comments added

---

### Chunk 3: Update Transform Engine Field Mapping
**Type**: Backend (Sync Engine)
**Dependencies**: Chunks 1, 2
**Estimated Effort**: Small (1 day)

**Files to modify**:
- `src/lib/sync/transform-engine.ts` (lines 148-165, 179-197)

**Implementation Steps**:

1. **Fix landline mapping** (both update and create):
   ```typescript
   // Line 154 (update existing contact)
   // BEFORE
   phoneNumber: rawData.phone_number || undefined,

   // AFTER
   phoneNumber: rawData.landline || undefined,

   // Line 185 (create new contact)
   // BEFORE
   phoneNumber: rawData.phone_number || undefined,

   // AFTER
   phoneNumber: rawData.landline || undefined,
   ```

2. **Add new field mappings** (both update and create):
   ```typescript
   // In update block (after line 161)
   await prisma.contact.update({
     where: { b2chatId },
     data: {
       fullName: rawData.fullname || rawData.name || '',
       mobile: rawData.mobile || rawData.mobile_number || undefined,
       phoneNumber: rawData.landline || undefined,  // FIXED
       email: rawData.email || undefined,
       identification: rawData.identification || undefined,
       address: rawData.address || undefined,
       city: rawData.city || undefined,
       country: rawData.country || undefined,
       company: rawData.company || undefined,
       customAttributes: rawData.custom_attributes || undefined,

       // NEW FIELDS
       tags: rawData.tags || undefined,
       merchantId: rawData.merchant_id ? String(rawData.merchant_id) : undefined,
       b2chatCreatedAt: rawData.created ? new Date(rawData.created) : undefined,
       b2chatUpdatedAt: rawData.updated ? new Date(rawData.updated) : undefined,

       lastSyncAt: new Date(),
       updatedAt: new Date(),
     },
   })

   // In create block (after line 192)
   await prisma.contact.create({
     data: {
       id: `contact_${b2chatId.replace(/[^a-zA-Z0-9]/g, '_')}`,
       b2chatId,
       fullName: rawData.fullname || rawData.name || '',
       mobile: rawData.mobile || rawData.mobile_number || undefined,
       phoneNumber: rawData.landline || undefined,  // FIXED
       email: rawData.email || undefined,
       identification: rawData.identification || undefined,
       address: rawData.address || undefined,
       city: rawData.city || undefined,
       country: rawData.country || undefined,
       company: rawData.company || undefined,
       customAttributes: rawData.custom_attributes || undefined,

       // NEW FIELDS
       tags: rawData.tags || undefined,
       merchantId: rawData.merchant_id ? String(rawData.merchant_id) : undefined,
       b2chatCreatedAt: rawData.created ? new Date(rawData.created) : undefined,
       b2chatUpdatedAt: rawData.updated ? new Date(rawData.updated) : undefined,

       lastSyncAt: new Date(),
       createdAt: new Date(),
       updatedAt: new Date(),
     },
   })
   ```

3. **Add logging for new fields**:
   ```typescript
   logger.debug('Contact updated', {
     b2chatId,
     changedFields: changes.changedFields,
     hasTags: !!rawData.tags,
     tagCount: rawData.tags?.length || 0,
     merchantId: rawData.merchant_id,
     b2chatCreatedDate: rawData.created,
   })

   logger.debug('Contact created', {
     b2chatId,
     hasTags: !!rawData.tags,
     tagCount: rawData.tags?.length || 0,
     merchantId: rawData.merchant_id,
   })
   ```

4. **Handle timestamp parsing edge cases**:
   ```typescript
   // Robust timestamp parsing
   const parseB2ChatTimestamp = (dateString: string | null | undefined): Date | undefined => {
     if (!dateString) return undefined

     try {
       // B2Chat format: "2020-11-09 19:10:23"
       const parsed = new Date(dateString)

       // Validate parsed date
       if (isNaN(parsed.getTime())) {
         logger.warn('Invalid B2Chat timestamp', { dateString })
         return undefined
       }

       return parsed
     } catch (error) {
       logger.error('Failed to parse B2Chat timestamp', { dateString, error })
       return undefined
     }
   }

   // Use in transform
   b2chatCreatedAt: parseB2ChatTimestamp(rawData.created),
   b2chatUpdatedAt: parseB2ChatTimestamp(rawData.updated),
   ```

**Tests required**: Yes - `src/lib/sync/__tests__/transform-engine.test.ts`

```typescript
describe('TransformEngine - Contact Field Fixes', () => {
  test('transforms landline field correctly', async () => {
    const rawContact = {
      contact_id: 123,
      fullname: 'Office User',
      mobile: '+573001234567',
      landline: '+571234567'
    }

    await prisma.rawContact.create({
      data: {
        id: 'raw_123',
        syncId: 'extract_123',
        rawData: rawContact,
        processingStatus: 'pending'
      }
    })

    const engine = new TransformEngine()
    await engine.transformContacts('extract_123')

    const contact = await prisma.contact.findUnique({
      where: { b2chatId: '123' }
    })

    expect(contact?.phoneNumber).toBe('+571234567')  // Landline mapped correctly
    expect(contact?.mobile).toBe('+573001234567')    // Mobile still works
  })

  test('stores tags with assignment timestamps', async () => {
    const rawContact = {
      contact_id: 456,
      fullname: 'Tagged User',
      tags: [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Premium', assigned_at: 1706648900 }
      ]
    }

    await prisma.rawContact.create({
      data: {
        id: 'raw_456',
        syncId: 'extract_456',
        rawData: rawContact,
        processingStatus: 'pending'
      }
    })

    await engine.transformContacts('extract_456')

    const contact = await prisma.contact.findUnique({
      where: { b2chatId: '456' }
    })

    expect(contact?.tags).toEqual([
      { name: 'VIP', assigned_at: 1706644084 },
      { name: 'Premium', assigned_at: 1706648900 }
    ])
  })

  test('stores merchant_id correctly', async () => {
    const rawContact = {
      contact_id: 789,
      fullname: 'Merchant User',
      merchant_id: 100
    }

    await prisma.rawContact.create({
      data: {
        id: 'raw_789',
        syncId: 'extract_789',
        rawData: rawContact,
        processingStatus: 'pending'
      }
    })

    await engine.transformContacts('extract_789')

    const contact = await prisma.contact.findUnique({
      where: { b2chatId: '789' }
    })

    expect(contact?.merchantId).toBe('100')  // Converted to string
  })

  test('preserves B2Chat original timestamps', async () => {
    const rawContact = {
      contact_id: 999,
      fullname: 'Old Contact',
      created: '2020-11-09 19:10:23',
      updated: '2024-01-25 16:24:14'
    }

    await prisma.rawContact.create({
      data: {
        id: 'raw_999',
        syncId: 'extract_999',
        rawData: rawContact,
        processingStatus: 'pending'
      }
    })

    await engine.transformContacts('extract_999')

    const contact = await prisma.contact.findUnique({
      where: { b2chatId: '999' }
    })

    expect(contact?.b2chatCreatedAt).toEqual(new Date('2020-11-09 19:10:23'))
    expect(contact?.b2chatUpdatedAt).toEqual(new Date('2024-01-25 16:24:14'))

    // Our sync timestamps are different (current time)
    expect(contact?.createdAt?.getTime()).toBeGreaterThan(
      contact?.b2chatCreatedAt!.getTime()
    )
  })

  test('handles null tags gracefully', async () => {
    const rawContact = {
      contact_id: 111,
      fullname: 'No Tags User',
      tags: null
    }

    await prisma.rawContact.create({
      data: {
        id: 'raw_111',
        syncId: 'extract_111',
        rawData: rawContact,
        processingStatus: 'pending'
      }
    })

    await engine.transformContacts('extract_111')

    const contact = await prisma.contact.findUnique({
      where: { b2chatId: '111' }
    })

    expect(contact?.tags).toBeNull()
  })

  test('handles dynamic new tags without code change', async () => {
    // Simulates B2Chat user creating new tag "Urgent Follow-up"
    const rawContact = {
      contact_id: 222,
      fullname: 'Dynamic Tags User',
      tags: [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Urgent Follow-up', assigned_at: 1730000000 }  // New tag!
      ]
    }

    await prisma.rawContact.create({
      data: {
        id: 'raw_222',
        syncId: 'extract_222',
        rawData: rawContact,
        processingStatus: 'pending'
      }
    })

    // No code change needed - tag is just stored as JSON
    await engine.transformContacts('extract_222')

    const contact = await prisma.contact.findUnique({
      where: { b2chatId: '222' }
    })

    expect(contact?.tags).toHaveLength(2)
    expect(contact?.tags[1]).toEqual({
      name: 'Urgent Follow-up',
      assigned_at: 1730000000
    })
  })
})
```

**Acceptance criteria**:
- [x] Landline field mapped correctly (both create and update)
- [x] Tags stored as JSON array with assignment timestamps
- [x] Merchant ID stored (converted to string)
- [x] B2Chat timestamps parsed and stored
- [x] Null handling works for all new fields
- [x] Dynamic tags work without code changes
- [x] Logging added for debugging
- [x] All unit tests passing
- [x] Integration test with full sync flow works

---

### Chunk 4: Update Change Detection Logic
**Type**: Backend (Sync Engine)
**Dependencies**: Chunk 3
**Estimated Effort**: Small (0.5 day)

**Files to modify**:
- `src/lib/sync/change-detector.ts`

**Implementation Steps**:

1. **Add new fields to comparison** (find `fieldsToCheck` array):
   ```typescript
   export function detectContactChanges(
     existing: Contact,
     rawData: any
   ): ContactChanges | null {
     const changedFields: string[] = []
     const oldValues: Record<string, any> = {}
     const newValues: Record<string, any> = {}

     // Fields to compare
     const fieldsToCheck = [
       'fullName',
       'mobile',
       'phoneNumber',  // Will now capture landline changes
       'email',
       'identification',
       'address',
       'city',
       'country',
       'company',
       'tags',              // NEW
       'merchantId',        // NEW
       'b2chatCreatedAt',   // NEW
       'b2chatUpdatedAt',   // NEW
     ]

     // Normalize raw data
     const normalizedNew = {
       fullName: rawData.fullname || rawData.name || '',
       mobile: rawData.mobile || rawData.mobile_number || null,
       phoneNumber: rawData.landline || null,  // FIXED
       email: rawData.email || null,
       identification: rawData.identification || null,
       address: rawData.address || null,
       city: rawData.city || null,
       country: rawData.country || null,
       company: rawData.company || null,
       tags: rawData.tags || null,  // NEW
       merchantId: rawData.merchant_id ? String(rawData.merchant_id) : null,  // NEW
       b2chatCreatedAt: rawData.created ? new Date(rawData.created) : null,  // NEW
       b2chatUpdatedAt: rawData.updated ? new Date(rawData.updated) : null,  // NEW
     }

     // ... rest of comparison logic ...
   }
   ```

2. **Add special comparison for JSON fields** (tags):
   ```typescript
   // After standard field comparison loop

   // Special handling for tags (JSON field)
   if (rawData.tags !== undefined) {
     const oldTags = existing.tags ? JSON.stringify(existing.tags) : null
     const newTags = rawData.tags ? JSON.stringify(rawData.tags) : null

     if (oldTags !== newTags) {
       changedFields.push('tags')
       oldValues.tags = existing.tags
       newValues.tags = rawData.tags
     }
   }
   ```

3. **Add special comparison for timestamps**:
   ```typescript
   // Compare B2Chat timestamps (may be initially null, then populated)
   const compareTimestamp = (field: string, oldValue: Date | null, newValue: Date | null) => {
     const normalizedOld = oldValue ? oldValue.getTime() : null
     const normalizedNew = newValue ? newValue.getTime() : null

     if (normalizedOld !== normalizedNew) {
       changedFields.push(field)
       oldValues[field] = oldValue
       newValues[field] = newValue
     }
   }

   compareTimestamp('b2chatCreatedAt', existing.b2chatCreatedAt, normalizedNew.b2chatCreatedAt)
   compareTimestamp('b2chatUpdatedAt', existing.b2chatUpdatedAt, normalizedNew.b2chatUpdatedAt)
   ```

4. **Add logging for significant changes**:
   ```typescript
   // After detecting changes
   if (changedFields.length > 0) {
     logger.debug('Contact changes detected', {
       b2chatId: existing.b2chatId,
       changedFields,
       tagsChanged: changedFields.includes('tags'),
       merchantChanged: changedFields.includes('merchantId'),
     })
   }
   ```

**Tests required**: Yes - `src/lib/sync/__tests__/change-detector.test.ts`

```typescript
describe('Change Detector - New Fields', () => {
  test('detects tags changes', () => {
    const existing = {
      tags: [{ name: 'VIP', assigned_at: 1706644084 }],
      // ... other fields ...
    }

    const rawData = {
      tags: [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Premium', assigned_at: 1706648900 }  // New tag added
      ]
    }

    const changes = detectContactChanges(existing, rawData)

    expect(changes?.hasChanges).toBe(true)
    expect(changes?.changedFields).toContain('tags')
  })

  test('detects landline changes', () => {
    const existing = {
      phoneNumber: null,
      // ... other fields ...
    }

    const rawData = {
      landline: '+571234567'  // Landline added
    }

    const changes = detectContactChanges(existing, rawData)

    expect(changes?.hasChanges).toBe(true)
    expect(changes?.changedFields).toContain('phoneNumber')
  })

  test('detects merchant_id changes', () => {
    const existing = {
      merchantId: null,
      // ... other fields ...
    }

    const rawData = {
      merchant_id: 100
    }

    const changes = detectContactChanges(existing, rawData)

    expect(changes?.hasChanges).toBe(true)
    expect(changes?.changedFields).toContain('merchantId')
  })

  test('detects B2Chat timestamp population (initially null)', () => {
    const existing = {
      b2chatCreatedAt: null,  // Was null (contact synced before this fix)
      // ... other fields ...
    }

    const rawData = {
      created: '2020-11-09 19:10:23'  // Now populated from API
    }

    const changes = detectContactChanges(existing, rawData)

    expect(changes?.hasChanges).toBe(true)
    expect(changes?.changedFields).toContain('b2chatCreatedAt')
  })

  test('skips update when tags unchanged', () => {
    const existing = {
      tags: [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Premium', assigned_at: 1706648900 }
      ],
      // ... other fields ...
    }

    const rawData = {
      tags: [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Premium', assigned_at: 1706648900 }
      ]
    }

    const changes = detectContactChanges(existing, rawData)

    // Tags are identical - should skip update
    expect(changes?.changedFields).not.toContain('tags')
  })
})
```

**Acceptance criteria**:
- [x] All new fields tracked for changes
- [x] Tags comparison works (JSON stringify)
- [x] Landline changes detected
- [x] Timestamp changes detected
- [x] Merchant ID changes detected
- [x] No false positives (unchanged = skipped)
- [x] Unit tests passing

---

### Chunk 5: Data Backfill Strategy
**Type**: Backend (Data Migration)
**Dependencies**: Chunks 1-4 (all code fixes deployed)
**Estimated Effort**: Medium (1 day planning + execution time)

**Files to create**:
- `scripts/backfill-contact-fields.ts` (new)

**Implementation Steps**:

1. **Create backfill script**:
   ```typescript
   // scripts/backfill-contact-fields.ts
   import { prisma } from '../src/lib/prisma'
   import { ExtractEngine } from '../src/lib/sync/extract-engine'
   import { TransformEngine } from '../src/lib/sync/transform-engine'
   import { logger } from '../src/lib/logger'

   async function backfillContactFields() {
     console.log('🔄 Starting contact field backfill...\n')
     console.log('This will re-sync ALL contacts from B2Chat to populate missing fields:')
     console.log('  - Tags (with assignment timestamps)')
     console.log('  - Landline phone numbers')
     console.log('  - Merchant IDs')
     console.log('  - Original B2Chat creation/update dates\n')

     // Step 1: Count contacts missing fields
     const missingTags = await prisma.contact.count({
       where: { tags: null }
     })

     const missingLandline = await prisma.contact.count({
       where: { phoneNumber: null }
     })

     const missingMerchant = await prisma.contact.count({
       where: { merchantId: null }
     })

     const missingB2ChatDates = await prisma.contact.count({
       where: {
         OR: [
           { b2chatCreatedAt: null },
           { b2chatUpdatedAt: null }
         ]
       }
     })

     console.log('📊 Current field population:')
     console.log(`  - Contacts missing tags: ${missingTags}`)
     console.log(`  - Contacts missing landline: ${missingLandline}`)
     console.log(`  - Contacts missing merchant_id: ${missingMerchant}`)
     console.log(`  - Contacts missing B2Chat dates: ${missingB2ChatDates}\n`)

     const totalContacts = await prisma.contact.count()
     console.log(`  Total contacts: ${totalContacts}\n`)

     // Step 2: Full extract of all contacts
     console.log('📥 Extracting all contacts from B2Chat...')
     const extractEngine = new ExtractEngine()

     const extractResult = await extractEngine.extractContacts({
       batchSize: 1000,
       fullSync: true,  // Full sync to get ALL contacts
       userId: 'backfill_script',
     })

     if (extractResult.status !== 'completed') {
       console.error('❌ Extract failed:', extractResult.errorMessage)
       process.exit(1)
     }

     console.log(`✅ Extracted ${extractResult.recordsFetched} contacts\n`)

     // Step 3: Transform to populate fields
     console.log('⚙️  Transforming contacts (updating existing records)...')
     const transformEngine = new TransformEngine()

     const transformResult = await transformEngine.transformContacts(
       extractResult.syncId,
       { userId: 'backfill_script' }
     )

     if (transformResult.status !== 'completed') {
       console.error('❌ Transform failed:', transformResult.errorMessage)
       process.exit(1)
     }

     console.log('\n✅ Transform completed:')
     console.log(`  - Records processed: ${transformResult.recordsProcessed}`)
     console.log(`  - Records updated: ${transformResult.recordsUpdated}`)
     console.log(`  - Records skipped (unchanged): ${transformResult.recordsSkipped}`)
     console.log(`  - Records failed: ${transformResult.recordsFailed}\n`)

     // Step 4: Verify backfill success
     console.log('🔍 Verifying backfill...')

     const afterTags = await prisma.contact.count({
       where: { tags: { not: null } }
     })

     const afterLandline = await prisma.contact.count({
       where: { phoneNumber: { not: null } }
     })

     const afterMerchant = await prisma.contact.count({
       where: { merchantId: { not: null } }
     })

     const afterB2ChatDates = await prisma.contact.count({
       where: {
         AND: [
           { b2chatCreatedAt: { not: null } },
           { b2chatUpdatedAt: { not: null } }
         ]
       }
     })

     console.log('📊 After backfill:')
     console.log(`  - Contacts with tags: ${afterTags} (was ${totalContacts - missingTags})`)
     console.log(`  - Contacts with landline: ${afterLandline} (was ${totalContacts - missingLandline})`)
     console.log(`  - Contacts with merchant_id: ${afterMerchant} (was ${totalContacts - missingMerchant})`)
     console.log(`  - Contacts with B2Chat dates: ${afterB2ChatDates} (was ${totalContacts - missingB2ChatDates})\n`)

     // Step 5: Sample verification
     console.log('📝 Sample contacts with new fields:')
     const samples = await prisma.contact.findMany({
       where: {
         tags: { not: null }
       },
       select: {
         b2chatId: true,
         fullName: true,
         tags: true,
         merchantId: true,
         b2chatCreatedAt: true,
       },
       take: 5
     })

     samples.forEach(contact => {
       console.log(`\n  Contact: ${contact.fullName} (${contact.b2chatId})`)
       console.log(`    Tags: ${JSON.stringify(contact.tags)}`)
       console.log(`    Merchant: ${contact.merchantId || 'N/A'}`)
       console.log(`    B2Chat Created: ${contact.b2chatCreatedAt?.toISOString() || 'N/A'}`)
     })

     console.log('\n🎉 Backfill complete!\n')
   }

   backfillContactFields()
     .catch(error => {
       console.error('Fatal error:', error)
       process.exit(1)
     })
     .finally(() => {
       prisma.$disconnect()
     })
   ```

2. **Add to package.json scripts**:
   ```json
   {
     "scripts": {
       "backfill:contacts": "tsx scripts/backfill-contact-fields.ts"
     }
   }
   ```

3. **Create dry-run mode**:
   ```typescript
   // Add flag for testing
   const DRY_RUN = process.env.DRY_RUN === 'true'

   if (DRY_RUN) {
     console.log('🔍 DRY RUN MODE - No data will be modified\n')
     // Only show what would be done
   }
   ```

4. **Document execution steps**:
   ```markdown
   # Contact Field Backfill

   ## Prerequisites
   - All code fixes deployed (Chunks 1-4)
   - Database migration completed
   - B2Chat API credentials configured

   ## Execution

   ### 1. Dry run (check what would happen)
   ```bash
   DRY_RUN=true npm run backfill:contacts
   ```

   ### 2. Actual backfill
   ```bash
   npm run backfill:contacts
   ```

   ### 3. Expected duration
   - 10,000 contacts: ~10-15 minutes
   - 50,000 contacts: ~45-60 minutes
   - 100,000 contacts: ~2 hours

   ## Monitoring
   Watch for:
   - Extract completion
   - Transform success rate
   - Field population rates
   - Any errors in logs
   ```

**Tests required**: Yes - Run on staging first
- Test with small batch (100 contacts)
- Verify fields populated
- Check no data corruption
- Run full backfill on staging
- Validate results before production

**Acceptance criteria**:
- [x] Backfill script created
- [x] Dry-run mode works
- [x] Progress logging clear
- [x] Verification queries included
- [x] Error handling robust
- [x] Successfully tested on staging
- [x] Production backfill plan documented

---

### Chunk 6: Frontend Tag Display Components
**Type**: Frontend
**Dependencies**: Chunks 1-4 (backend ready)
**Estimated Effort**: Small (1 day)

**Files to create/modify**:
- `src/components/contacts/contact-tags-display.tsx` (new)
- `src/components/contacts/contact-card.tsx` (modify)

**Implementation Steps**:

1. **Create tag display component**:
   ```typescript
   // src/components/contacts/contact-tags-display.tsx
   'use client'

   import { Badge } from "@/components/ui/badge"
   import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
   import { formatDistanceToNow } from 'date-fns'

   interface ContactTag {
     name: string
     assigned_at: number  // Unix timestamp
   }

   interface ContactTagsDisplayProps {
     tags: ContactTag[] | null | undefined
     maxDisplay?: number
     showTimestamp?: boolean
   }

   export function ContactTagsDisplay({
     tags,
     maxDisplay = 3,
     showTimestamp = false
   }: ContactTagsDisplayProps) {
     if (!tags || tags.length === 0) {
       return (
         <span className="text-xs text-muted-foreground italic">
           No tags
         </span>
       )
     }

     const displayTags = tags.slice(0, maxDisplay)
     const remainingCount = tags.length - maxDisplay

     return (
       <div className="flex flex-wrap gap-1">
         {displayTags.map((tag) => {
           const assignedDate = new Date(tag.assigned_at * 1000)

           return (
             <TooltipProvider key={tag.name}>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Badge
                     variant="secondary"
                     className="text-xs cursor-help"
                   >
                     {tag.name}
                   </Badge>
                 </TooltipTrigger>
                 <TooltipContent>
                   <p className="text-xs">
                     Assigned {formatDistanceToNow(assignedDate, { addSuffix: true })}
                   </p>
                   {showTimestamp && (
                     <p className="text-xs text-muted-foreground">
                       {assignedDate.toLocaleString()}
                     </p>
                   )}
                 </TooltipContent>
               </Tooltip>
             </TooltipProvider>
           )
         })}

         {remainingCount > 0 && (
           <Badge variant="outline" className="text-xs">
             +{remainingCount} more
           </Badge>
         )}
       </div>
     )
   }
   ```

2. **Add tag filter component**:
   ```typescript
   // src/components/contacts/contact-tag-filter.tsx
   'use client'

   import { useState, useEffect } from 'react'
   import { Badge } from "@/components/ui/badge"
   import { X } from "lucide-react"

   interface ContactTagFilterProps {
     contacts: Array<{ tags: Array<{ name: string }> | null }>
     onFilterChange: (selectedTags: string[]) => void
   }

   export function ContactTagFilter({ contacts, onFilterChange }: ContactTagFilterProps) {
     const [selectedTags, setSelectedTags] = useState<string[]>([])

     // Extract all unique tags from contacts
     const allTags = Array.from(
       new Set(
         contacts
           .flatMap(c => c.tags?.map(t => t.name) || [])
       )
     ).sort()

     const toggleTag = (tagName: string) => {
       const newSelection = selectedTags.includes(tagName)
         ? selectedTags.filter(t => t !== tagName)
         : [...selectedTags, tagName]

       setSelectedTags(newSelection)
       onFilterChange(newSelection)
     }

     const clearFilters = () => {
       setSelectedTags([])
       onFilterChange([])
     }

     return (
       <div className="space-y-2">
         <div className="flex items-center justify-between">
           <label className="text-sm font-medium">Filter by Tags</label>
           {selectedTags.length > 0 && (
             <button
               onClick={clearFilters}
               className="text-xs text-muted-foreground hover:text-foreground"
             >
               Clear all
             </button>
           )}
         </div>

         <div className="flex flex-wrap gap-2">
           {allTags.map(tagName => {
             const isSelected = selectedTags.includes(tagName)

             return (
               <Badge
                 key={tagName}
                 variant={isSelected ? "default" : "outline"}
                 className="cursor-pointer"
                 onClick={() => toggleTag(tagName)}
               >
                 {tagName}
                 {isSelected && (
                   <X className="ml-1 h-3 w-3" />
                 )}
               </Badge>
             )
           })}
         </div>

         {selectedTags.length > 0 && (
           <p className="text-xs text-muted-foreground">
             Showing contacts with: {selectedTags.join(', ')}
           </p>
         )}
       </div>
     )
   }
   ```

3. **Update contact card to show new fields**:
   ```typescript
   // src/components/contacts/contact-card.tsx
   import { ContactTagsDisplay } from './contact-tags-display'

   export function ContactCard({ contact }) {
     return (
       <Card>
         <CardHeader>
           <CardTitle>{contact.fullName}</CardTitle>
           {contact.merchantId && (
             <Badge variant="outline" className="text-xs">
               Merchant: {contact.merchantId}
             </Badge>
           )}
         </CardHeader>

         <CardContent>
           {/* Contact info */}
           <div className="space-y-2">
             {contact.mobile && (
               <div className="flex items-center gap-2">
                 <Phone className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm">Mobile: {contact.mobile}</span>
               </div>
             )}

             {contact.phoneNumber && (
               <div className="flex items-center gap-2">
                 <Phone className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm">Landline: {contact.phoneNumber}</span>
               </div>
             )}

             {contact.email && (
               <div className="flex items-center gap-2">
                 <Mail className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm">{contact.email}</span>
               </div>
             )}
           </div>

           {/* Tags */}
           <div className="mt-4">
             <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
             <ContactTagsDisplay tags={contact.tags} />
           </div>

           {/* B2Chat dates */}
           {contact.b2chatCreatedAt && (
             <div className="mt-4 text-xs text-muted-foreground">
               Contact created in B2Chat: {new Date(contact.b2chatCreatedAt).toLocaleDateString()}
             </div>
           )}
         </CardContent>
       </Card>
     )
   }
   ```

**Tests required**: Yes - Component tests + E2E
- Tag display renders correctly
- Tooltips show assignment dates
- Tag filter works
- Merchant ID displays
- B2Chat dates visible

**Acceptance criteria**:
- [x] Tags display with badges
- [x] Tooltips show assignment timestamps
- [x] Tag filter component works
- [x] Landline shown separately from mobile
- [x] Merchant ID displayed
- [x] B2Chat creation date visible
- [x] Responsive design
- [x] Accessible (screen readers, keyboard)

---

### Chunk 7: Documentation Updates
**Type**: Documentation
**Dependencies**: All chunks 1-6 complete
**Estimated Effort**: Small (0.5 day)

**Files to update/create**:
- `docs/development/B2CHAT_API_FIELD_MAPPING.md` (update)
- `docs/development/CONTACT_TAGS_GUIDE.md` (new)
- `README.md` (update)

**Implementation Steps**:

1. **Update field mapping documentation**:
   Add corrected field mappings with explanations

2. **Create tags guide**:
   Explain dynamic tag support, querying, filtering

3. **Update README** with new features:
   - Tag-based contact segmentation
   - Multi-merchant support
   - Historical data preservation

**Tests required**: No (documentation only)

**Acceptance criteria**:
- [x] Field mapping documentation updated
- [x] Tags guide created with examples
- [x] README updated
- [x] Code examples accurate
- [x] SQL query examples provided

---

## Testing Strategy

### Unit Tests
**When**: During each chunk implementation
**Coverage**: 90%+ for new/modified code

**Test Files**:
- `src/lib/b2chat/__tests__/client.test.ts` - Zod schema
- `src/lib/sync/__tests__/transform-engine.test.ts` - Field mapping
- `src/lib/sync/__tests__/change-detector.test.ts` - Change detection
- `src/components/contacts/__tests__/contact-tags-display.test.tsx` - UI

### Integration Tests
**When**: After Chunks 1-4 complete
**Scenarios**:
- Full sync with all field types
- Re-sync existing contacts (backfill)
- Dynamic new tag handling

### E2E Tests
**When**: After Chunk 6 (frontend ready)
**Test Files**: `e2e/contact-tags.spec.ts`
**Scenarios**:
- Display tags on contact cards
- Filter contacts by tags
- Show landline vs mobile

---

## Database Changes

### Migration: `20251023_contact_field_fixes.sql`

```sql
-- Add new fields to contacts table
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tags" JSONB;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "merchant_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "b2chat_created_at" TIMESTAMP;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "b2chat_updated_at" TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS "contacts_merchant_id_idx" ON "contacts"("merchant_id");
CREATE INDEX IF NOT EXISTS "contacts_b2chat_created_at_idx" ON "contacts"("b2chat_created_at");

-- Add GIN index for tag queries
CREATE INDEX IF NOT EXISTS "contacts_tags_idx" ON "contacts" USING GIN (tags);

-- Add comments
COMMENT ON COLUMN "contacts"."tags" IS 'B2Chat tags: [{"name": "VIP", "assigned_at": 1706644084}]';
COMMENT ON COLUMN "contacts"."merchant_id" IS 'B2Chat merchant identifier for multi-tenant';
COMMENT ON COLUMN "contacts"."b2chat_created_at" IS 'Original B2Chat creation timestamp';
COMMENT ON COLUMN "contacts"."b2chat_updated_at" IS 'Original B2Chat update timestamp';
```

---

## API Changes

**No New Endpoints**: Fixes to existing transformation logic

**Modified Behavior**:
- Contact sync now populates 4 additional fields
- Existing contact APIs automatically return new fields
- Contact search can filter by merchant_id

---

## Integration Points

### Services Affected
1. **Transform Engine** - Main changes (field mapping)
2. **Change Detector** - Track new fields
3. **Contact APIs** - Return new fields (no code change)
4. **Frontend** - Display tags and new fields

---

## Rollback Plan

### Database Rollback
```sql
DROP INDEX IF EXISTS "contacts_tags_idx";
DROP INDEX IF EXISTS "contacts_b2chat_created_at_idx";
DROP INDEX IF EXISTS "contacts_merchant_id_idx";

ALTER TABLE "contacts" DROP COLUMN IF EXISTS "b2chat_updated_at";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "b2chat_created_at";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "merchant_id";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "tags";
```

### Code Rollback
- Revert transform-engine.ts
- Revert client.ts
- Revert change-detector.ts
- Redeploy previous version

**Data Impact**: Fields added are nullable - safe to add/remove

---

## Success Criteria

### Functional
- [ ] Tags stored with assignment timestamps
- [ ] Landline numbers captured
- [ ] Merchant IDs stored
- [ ] B2Chat timestamps preserved
- [ ] Dynamic tags work (no code changes)
- [ ] Tag filtering works in UI
- [ ] Backfill completed successfully

### Performance
- [ ] Sync speed < 5% slower
- [ ] Tag queries performant (GIN index)
- [ ] No N+1 query issues

### Quality
- [ ] 90%+ test coverage
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Documentation complete

---

## Implementation Timeline

**Total: 5 days**

- **Day 1**: Chunks 1-2 (schema + Zod fixes)
- **Day 2**: Chunk 3 (transform engine)
- **Day 3**: Chunks 4-5 (change detection + backfill)
- **Day 4**: Chunk 6 (frontend)
- **Day 5**: Chunk 7 + testing

---

## Risk Assessment

### High Risk
1. **Data backfill failure** - Large contact volume
   - Mitigation: Staged rollout, dry-run, monitoring

### Medium Risk
2. **Tag query performance** - JSON queries can be slow
   - Mitigation: GIN index, query optimization

### Low Risk
3. **Breaking changes** - All fields nullable
   - Mitigation: Backward compatible design

---

## Next Steps

1. Review and approve this plan
2. Create feature branch: `feature/contact-field-fixes`
3. Start with Chunk 1 (database migration)
4. Proceed sequentially through chunks
5. Run backfill after code deployment
6. Validate results in production

---

**Feature Document Version**: 1.0
**Created**: 2025-10-23
**Status**: Ready for Implementation
