# Contact Transformation Analysis

**Date**: 2025-10-23
**Purpose**: Compare B2Chat Contacts API with current transformation logic to identify gaps and issues

---

## Executive Summary

**Status**: ⚠️ **ISSUES FOUND** - Data loss and schema mismatches detected

**Critical Issues**:
1. 🔴 **Tags data completely lost** - Schema incompatibility (array of objects vs array of strings)
2. 🟡 **Landline field mismatch** - API returns `landline`, code expects `phone_number`
3. 🟡 **Missing fields** - `merchant_id`, B2Chat `created`/`updated` timestamps not stored
4. 🟡 **Tags structure** - Not stored in Contact model (only in customAttributes as workaround)

**Impact**:
- Contact tags from B2Chat are silently discarded during sync
- Landline phone numbers may be lost or incorrectly mapped
- Cannot track original B2Chat creation/update dates
- Cannot segment contacts by merchant_id

---

## B2Chat API Response Structure

### Actual API Response (from documentation)

```json
{
  "total": 22197,
  "exported": 3,
  "contacts": [
    {
      "contact_id": 123456789,
      "fullname": "John Doe",
      "identification": "123456789",
      "email": "jhondoe@b2chat.io",
      "landline": "",                    // ⚠️ API returns "landline"
      "mobile": "+57123456789",
      "address": "5th avenue north",
      "country": "CO",
      "city": "Medellin",
      "company": "B2CHAT",
      "merchant_id": null,               // ⚠️ Not captured in our schema
      "created": "2020-11-09 19:10:23",  // ⚠️ Original B2Chat creation date
      "updated": "2024-01-25 16:24:14",  // ⚠️ Original B2Chat update date
      "custom_attributes": [             // ✅ Handled correctly (array of objects)
        {
          "name": "Asesor",
          "value": null
        }
      ],
      "tags": [                          // 🔴 CRITICAL: Lost during transform!
        {
          "name": "Tag1",
          "assigned_at": 1706644084
        }
      ]
    }
  ]
}
```

### Field Comparison Table

| B2Chat API Field | Type | Current Schema | Current Transform | Status |
|------------------|------|----------------|-------------------|---------|
| `contact_id` | number | ✅ `b2chatId` (string) | ✅ Mapped correctly | ✅ OK |
| `fullname` | string | ✅ `fullName` | ✅ Mapped (with `name` fallback) | ✅ OK |
| `identification` | string | ✅ `identification` | ✅ Mapped correctly | ✅ OK |
| `email` | string | ✅ `email` | ✅ Mapped correctly | ✅ OK |
| `landline` | string | ⚠️ `phoneNumber` | ⚠️ Mapped as `phone_number` (wrong field) | 🟡 MISMATCH |
| `mobile` | string | ✅ `mobile` | ✅ Mapped (with `mobile_number` fallback) | ✅ OK |
| `address` | string | ✅ `address` | ✅ Mapped correctly | ✅ OK |
| `country` | string | ✅ `country` | ✅ Mapped correctly | ✅ OK |
| `city` | string | ✅ `city` | ✅ Mapped correctly | ✅ OK |
| `company` | string | ✅ `company` | ✅ Mapped correctly | ✅ OK |
| `merchant_id` | number/null | ❌ Missing | ❌ Not mapped | 🔴 LOST |
| `created` | string (datetime) | ❌ Missing | ❌ Not mapped | 🟡 LOST |
| `updated` | string (datetime) | ❌ Missing | ❌ Not mapped | 🟡 LOST |
| `custom_attributes` | array of objects | ✅ `customAttributes` (JSON) | ✅ Mapped correctly | ✅ OK |
| `tags` | array of objects | ❌ Missing | 🔴 Schema expects strings! | 🔴 CRITICAL |

---

## Detailed Issue Analysis

### Issue 1: Tags Data Loss 🔴 CRITICAL

**Problem**: Tags structure mismatch causes complete data loss

**B2Chat API Returns**:
```json
"tags": [
  {
    "name": "VIP Customer",
    "assigned_at": 1706644084
  },
  {
    "name": "Premium",
    "assigned_at": 1706648900
  }
]
```

**Current Schema Expects** (`client.ts:56`):
```typescript
tags: z.union([z.array(z.string()), z.null()]).nullable().optional()
// Expects: ["VIP Customer", "Premium"]
// Gets: [{ name: "VIP Customer", assigned_at: 1706644084 }, ...]
// Result: Validation fails or data coerced incorrectly
```

**Database Schema**:
```prisma
// Contact model has NO tags field!
// Tags are completely lost
```

**Impact**:
- All contact tags from B2Chat are silently discarded
- Cannot filter or segment contacts by tags
- Loss of business-critical categorization data
- No audit trail of when tags were assigned

**Example Data Loss**:
```
B2Chat Contact:
  - Tags: ["VIP Customer" (assigned 2024-01-30), "Urgent" (assigned 2024-02-01)]

After Transform:
  - Tags: null (completely lost)
```

---

### Issue 2: Landline Field Mismatch 🟡

**Problem**: API field name doesn't match code expectations

**B2Chat API Field**: `landline`
**Code Expects**: `phone_number` (transform-engine.ts:154, 185)

**Current Transform Logic**:
```typescript
// Line 154 (update)
phoneNumber: rawData.phone_number || undefined,

// Line 185 (create)
phoneNumber: rawData.phone_number || undefined,
```

**Actual API Response**:
```json
{
  "landline": "+571234567",  // ⚠️ This is the actual field name
  "mobile": "+573001234567"
}
```

**Impact**:
- Landline phone numbers from B2Chat API are not captured
- `phoneNumber` field in database always null (unless coincidentally named `phone_number`)
- Contact landline information lost

**Correct Mapping Should Be**:
```typescript
phoneNumber: rawData.landline || undefined,
```

---

### Issue 3: Missing Merchant ID 🟡

**Problem**: `merchant_id` field not captured

**B2Chat API Provides**:
```json
"merchant_id": 12345  // or null
```

**Current Implementation**:
- Zod schema acknowledges field exists (client.ts:54)
- But NOT stored in Contact model
- NOT mapped in transform

**Impact**:
- Cannot segment contacts by merchant
- Loss of multi-merchant tenant information
- Cannot analyze per-merchant contact distribution

**Business Use Cases Affected**:
- Multi-merchant platforms can't distinguish contacts by merchant
- Merchant-specific analytics not possible
- Contact assignment by merchant lost

---

### Issue 4: B2Chat Original Timestamps Missing 🟡

**Problem**: Original B2Chat `created` and `updated` timestamps not preserved

**B2Chat API Provides**:
```json
{
  "created": "2020-11-09 19:10:23",   // When contact created in B2Chat
  "updated": "2024-01-25 16:24:14"    // When contact last updated in B2Chat
}
```

**Current Implementation**:
- Uses internal `createdAt` (when synced to our DB)
- Uses internal `updatedAt` (when last synced)
- Original B2Chat timestamps discarded

**Impact**:
- Cannot determine actual contact creation date in B2Chat
- Cannot calculate contact age accurately
- Historical data analysis impossible (e.g., "contacts created before 2022")
- Data lineage lost

**Example Discrepancy**:
```
Contact created in B2Chat: 2020-11-09
First synced to our system: 2024-01-15
Our createdAt field shows: 2024-01-15 ❌ (wrong - this is sync date, not creation date)
```

---

### Issue 5: Custom Attributes Handling ✅ (Working but worth documenting)

**Current Implementation**: ✅ Correctly handles both formats

**B2Chat API Returns**:
```json
"custom_attributes": [
  { "name": "CustomerType", "value": "Enterprise" },
  { "name": "AccountManager", "value": "John Smith" }
]
```

**Zod Schema** (client.ts:55):
```typescript
custom_attributes: z.union([z.record(z.any()), z.array(z.any())]).nullable().optional()
```

**Storage**: Stored as JSON in `customAttributes` field

**Status**: ✅ Working correctly, but:
- Array format from API is preserved as-is
- Frontend may need to normalize for display
- Consider transforming to object format for easier access:
  ```json
  { "CustomerType": "Enterprise", "AccountManager": "John Smith" }
  ```

---

## Current Transform Logic Flow

### Step 1: Zod Validation (`client.ts`)

```typescript
const B2ChatContactSchema = z.object({
  contact_id: z.union([z.string(), z.number()]).transform(String).optional(),
  fullname: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  landline: z.string().nullable().optional(),     // ✅ Recognized in schema
  email: z.string().nullable().optional(),
  // ... other fields ...
  merchant_id: z.union([z.string(), z.number()]).nullable().optional(),  // ✅ Recognized
  custom_attributes: z.union([z.record(z.any()), z.array(z.any())]).nullable().optional(),
  tags: z.union([z.array(z.string()), z.null()]).nullable().optional(),  // 🔴 WRONG TYPE
  created: z.string().nullable().optional(),      // ✅ Recognized
  updated: z.string().nullable().optional(),      // ✅ Recognized
}).passthrough()
```

**Issues at this stage**:
- Tags validation may fail due to type mismatch
- Even if passed through, tags won't map correctly

### Step 2: Transform to Contact Model (`transform-engine.ts:148-165`)

```typescript
await prisma.contact.update({
  where: { b2chatId },
  data: {
    fullName: rawData.fullname || rawData.name || '',        // ✅ OK
    mobile: rawData.mobile || rawData.mobile_number || undefined,  // ✅ OK
    phoneNumber: rawData.phone_number || undefined,          // ❌ WRONG - should be landline
    email: rawData.email || undefined,                       // ✅ OK
    identification: rawData.identification || undefined,     // ✅ OK
    address: rawData.address || undefined,                   // ✅ OK
    city: rawData.city || undefined,                         // ✅ OK
    country: rawData.country || undefined,                   // ✅ OK
    company: rawData.company || undefined,                   // ✅ OK
    customAttributes: rawData.custom_attributes || undefined, // ✅ OK
    lastSyncAt: new Date(),                                  // ✅ OK
    updatedAt: new Date(),                                   // ✅ OK (our update time)

    // ❌ MISSING:
    // - merchant_id not mapped
    // - tags not mapped (and no field in schema)
    // - created (original B2Chat date) not preserved
    // - updated (original B2Chat date) not preserved
  },
})
```

---

## Recommendations & Fix Priority

### Priority 1: Critical - Fix Tags Data Loss 🔴

**Action Required**: Immediately

**Solution Options**:

**Option A: Add tags to Contact model (Recommended)**
```prisma
model Contact {
  // ... existing fields ...
  tags          Json?     @map("tags")  // Store full tag objects with assigned_at
  merchantId    String?   @map("merchant_id")
  b2chatCreatedAt  DateTime? @map("b2chat_created_at")
  b2chatUpdatedAt  DateTime? @map("b2chat_updated_at")
}
```

**Option B: Store in customAttributes (Quick workaround)**
- Transform tags into customAttributes
- Preserves data but less queryable

**Schema Update**:
```typescript
// client.ts
tags: z.array(z.object({
  name: z.string(),
  assigned_at: z.number()
})).nullable().optional()
```

**Transform Update**:
```typescript
// transform-engine.ts
tags: rawData.tags || undefined,  // Store full tag objects
merchantId: rawData.merchant_id ? String(rawData.merchant_id) : undefined,
b2chatCreatedAt: rawData.created ? new Date(rawData.created) : undefined,
b2chatUpdatedAt: rawData.updated ? new Date(rawData.updated) : undefined,
```

### Priority 2: High - Fix Landline Mapping 🟡

**Action Required**: Next sprint

**Fix**:
```typescript
// transform-engine.ts:154, 185
phoneNumber: rawData.landline || undefined,  // Changed from phone_number
```

**Testing**: Verify landline numbers appear in Contact records after fix

### Priority 3: Medium - Add Missing Fields 🟡

**Action Required**: Include in next schema migration

**Fields to Add**:
1. `merchantId` - for multi-merchant support
2. `b2chatCreatedAt` - original B2Chat creation timestamp
3. `b2chatUpdatedAt` - original B2Chat update timestamp

**Migration**:
```sql
ALTER TABLE "contacts" ADD COLUMN "merchant_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN "b2chat_created_at" TIMESTAMP;
ALTER TABLE "contacts" ADD COLUMN "b2chat_updated_at" TIMESTAMP;

CREATE INDEX "contacts_merchant_id_idx" ON "contacts"("merchant_id");
```

### Priority 4: Low - Custom Attributes Normalization

**Action Required**: Future enhancement

**Consider**: Transform array format to object for easier querying
```typescript
// Transform from:
[{ name: "Type", value: "VIP" }]

// To:
{ "Type": "VIP" }
```

---

## Testing Recommendations

### Test Case 1: Tags Preservation

**Setup**: Contact with tags from B2Chat
```json
{
  "contact_id": 123,
  "fullname": "Test User",
  "tags": [
    { "name": "VIP", "assigned_at": 1706644084 },
    { "name": "Premium", "assigned_at": 1706648900 }
  ]
}
```

**Expected After Fix**:
```sql
SELECT tags FROM contacts WHERE b2chat_id = '123';
-- Should return: [{"name": "VIP", "assigned_at": 1706644084}, {"name": "Premium", "assigned_at": 1706648900}]
```

**Current Behavior**: Tags are null ❌

### Test Case 2: Landline Mapping

**Setup**: Contact with landline
```json
{
  "contact_id": 456,
  "fullname": "Office Contact",
  "mobile": "+573001234567",
  "landline": "+571234567"
}
```

**Expected After Fix**:
```sql
SELECT phone_number, mobile FROM contacts WHERE b2chat_id = '456';
-- Should return: phone_number = '+571234567', mobile = '+573001234567'
```

**Current Behavior**: phone_number is null ❌

### Test Case 3: Merchant ID Preservation

**Setup**: Contact with merchant_id
```json
{
  "contact_id": 789,
  "merchant_id": 100,
  "fullname": "Merchant Contact"
}
```

**Expected After Fix**:
```sql
SELECT merchant_id FROM contacts WHERE b2chat_id = '789';
-- Should return: '100'
```

**Current Behavior**: merchant_id doesn't exist in schema ❌

### Test Case 4: Original Timestamps

**Setup**: Contact created in 2020
```json
{
  "contact_id": 999,
  "fullname": "Old Contact",
  "created": "2020-11-09 19:10:23",
  "updated": "2024-01-25 16:24:14"
}
```

**Expected After Fix**:
```sql
SELECT b2chat_created_at, created_at FROM contacts WHERE b2chat_id = '999';
-- b2chat_created_at: 2020-11-09 19:10:23 (original)
-- created_at: 2025-10-23 (when we first synced it)
```

**Current Behavior**: Only created_at exists (sync time, not original time) ❌

---

## Impact Assessment

### Data Already Synced

**Tags**: All historical tags are **permanently lost** (not in database)
- Cannot backfill without re-syncing from B2Chat
- Need to run full re-sync after fix to recover tags

**Landline**: Landline numbers **may be lost**
- If B2Chat returns `landline` field, it was ignored
- Need to verify if any contacts have landline data

**Merchant ID**: Merchant associations **lost**
- Multi-merchant setups affected
- Need re-sync after adding field

**Original Timestamps**: Creation/update dates **permanently lost**
- Cannot determine actual contact age
- Need re-sync to recover original dates

### Business Impact

**High Impact**:
- Tag-based segmentation impossible (e.g., "VIP customers", "Churn risk")
- Cannot analyze contact vintage (created before date X)
- Multi-merchant platforms missing tenant data

**Medium Impact**:
- Landline contact methods unavailable
- Marketing campaigns can't target by tags
- Historical trend analysis inaccurate

**Low Impact**:
- Custom attributes still working (minimal disruption)

---

## Migration Strategy

### Phase 1: Schema Updates (Week 1)

1. Add fields to Contact model:
   ```prisma
   tags            Json?     @map("tags")
   merchantId      String?   @map("merchant_id")
   b2chatCreatedAt DateTime? @map("b2chat_created_at")
   b2chatUpdatedAt DateTime? @map("b2chat_updated_at")
   ```

2. Generate and run migration
3. Add indexes for merchant_id

### Phase 2: Code Updates (Week 1)

1. Fix Zod schema for tags (array of objects)
2. Update transform logic to map all fields
3. Add unit tests for new fields
4. Update change-detector to track new fields

### Phase 3: Data Backfill (Week 2)

1. Run full contact re-sync from B2Chat
2. Verify tags, merchant_id, timestamps populated
3. Validate data quality

### Phase 4: Verification (Week 2)

1. Test tag-based filtering
2. Verify landline numbers appear
3. Check merchant segmentation works
4. Validate original timestamps preserved

---

## Code Changes Required

### File 1: `prisma/schema.prisma`

```diff
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
+ tags             Json?     @map("tags")
+ merchantId       String?   @map("merchant_id")
+ b2chatCreatedAt  DateTime? @map("b2chat_created_at")
+ b2chatUpdatedAt  DateTime? @map("b2chat_updated_at")
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
+ @@index([merchantId])
  @@index([isDeleted])
  @@map("contacts")
}
```

### File 2: `src/lib/b2chat/client.ts`

```diff
const B2ChatContactSchema = z.object({
  contact_id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  fullname: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  mobile_number: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  landline: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  identification: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  merchant_id: z.union([z.string(), z.number()]).nullable().optional(),
  custom_attributes: z.union([z.record(z.any()), z.array(z.any())]).nullable().optional(),
- tags: z.union([z.array(z.string()), z.null()]).nullable().optional(),
+ tags: z.array(z.object({
+   name: z.string(),
+   assigned_at: z.number()
+ })).nullable().optional(),
  row_index: z.union([z.number(), z.null()]).nullable().optional(),
  created: z.string().nullable().optional(),
  updated: z.string().nullable().optional(),
}).passthrough()
```

### File 3: `src/lib/sync/transform-engine.ts`

```diff
// Update contact (line 148-165)
await prisma.contact.update({
  where: { b2chatId },
  data: {
    fullName: rawData.fullname || rawData.name || '',
    mobile: rawData.mobile || rawData.mobile_number || undefined,
-   phoneNumber: rawData.phone_number || undefined,
+   phoneNumber: rawData.landline || undefined,
    email: rawData.email || undefined,
    identification: rawData.identification || undefined,
    address: rawData.address || undefined,
    city: rawData.city || undefined,
    country: rawData.country || undefined,
    company: rawData.company || undefined,
    customAttributes: rawData.custom_attributes || undefined,
+   tags: rawData.tags || undefined,
+   merchantId: rawData.merchant_id ? String(rawData.merchant_id) : undefined,
+   b2chatCreatedAt: rawData.created ? new Date(rawData.created) : undefined,
+   b2chatUpdatedAt: rawData.updated ? new Date(rawData.updated) : undefined,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  },
})

// Create contact (line 179-197)
await prisma.contact.create({
  data: {
    id: `contact_${b2chatId.replace(/[^a-zA-Z0-9]/g, '_')}`,
    b2chatId,
    fullName: rawData.fullname || rawData.name || '',
    mobile: rawData.mobile || rawData.mobile_number || undefined,
-   phoneNumber: rawData.phone_number || undefined,
+   phoneNumber: rawData.landline || undefined,
    email: rawData.email || undefined,
    identification: rawData.identification || undefined,
    address: rawData.address || undefined,
    city: rawData.city || undefined,
    country: rawData.country || undefined,
    company: rawData.company || undefined,
    customAttributes: rawData.custom_attributes || undefined,
+   tags: rawData.tags || undefined,
+   merchantId: rawData.merchant_id ? String(rawData.merchant_id) : undefined,
+   b2chatCreatedAt: rawData.created ? new Date(rawData.created) : undefined,
+   b2chatUpdatedAt: rawData.updated ? new Date(rawData.updated) : undefined,
    lastSyncAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
})
```

### File 4: `src/lib/sync/change-detector.ts`

```diff
export function detectContactChanges(
  existing: Contact,
  rawData: any
): ContactChanges | null {
  const changedFields: string[] = []

  const fieldsToCheck = [
    'fullName', 'mobile', 'phoneNumber', 'email',
-   'identification', 'address', 'city', 'country', 'company'
+   'identification', 'address', 'city', 'country', 'company',
+   'tags', 'merchantId', 'b2chatCreatedAt', 'b2chatUpdatedAt'
  ]

  const normalizedNew = {
    fullName: rawData.fullname || rawData.name || '',
    mobile: rawData.mobile || rawData.mobile_number || null,
-   phoneNumber: rawData.phone_number || null,
+   phoneNumber: rawData.landline || null,
    email: rawData.email || null,
    identification: rawData.identification || null,
    address: rawData.address || null,
    city: rawData.city || null,
    country: rawData.country || null,
    company: rawData.company || null,
+   tags: rawData.tags || null,
+   merchantId: rawData.merchant_id ? String(rawData.merchant_id) : null,
+   b2chatCreatedAt: rawData.created ? new Date(rawData.created) : null,
+   b2chatUpdatedAt: rawData.updated ? new Date(rawData.updated) : null,
  }

  // ... rest of change detection logic ...
}
```

---

## Next Steps

1. **Immediate**: Review this analysis with team
2. **Week 1**: Implement schema changes and code fixes
3. **Week 2**: Run full contact re-sync to backfill data
4. **Week 3**: Validate tags, merchant_id, timestamps working correctly
5. **Ongoing**: Monitor for any additional field mismatches

---

## Appendix: Useful Queries

### Check Tags Data Loss
```sql
-- Count contacts with null tags (should be 0 after fix)
SELECT COUNT(*) FROM contacts WHERE tags IS NULL;

-- Sample contacts with tags
SELECT b2chat_id, full_name, tags::text
FROM contacts
WHERE tags IS NOT NULL
LIMIT 10;
```

### Verify Landline Mapping
```sql
-- Count contacts with landline
SELECT COUNT(*) FROM contacts WHERE phone_number IS NOT NULL;

-- Compare mobile vs landline
SELECT b2chat_id, full_name, mobile, phone_number
FROM contacts
WHERE phone_number IS NOT NULL
LIMIT 20;
```

### Check Merchant Distribution
```sql
-- Contacts per merchant
SELECT merchant_id, COUNT(*) as contact_count
FROM contacts
WHERE merchant_id IS NOT NULL
GROUP BY merchant_id
ORDER BY contact_count DESC;
```

### Validate Original Timestamps
```sql
-- Compare B2Chat dates vs our sync dates
SELECT
  b2chat_id,
  b2chat_created_at,
  created_at,
  EXTRACT(EPOCH FROM (created_at - b2chat_created_at))/86400 as days_between
FROM contacts
WHERE b2chat_created_at IS NOT NULL
ORDER BY days_between DESC
LIMIT 20;
```

---

**Document Version**: 1.0
**Analysis Complete**: 2025-10-23
**Analyst**: Claude (B2Chat Analytics Team)
