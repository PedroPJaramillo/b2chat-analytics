# Feature 016: Capture viewer_url, location, and broadcasted Fields

## Requirements

### Original User Requirements
- Capture `viewer_url` field from B2Chat chat responses for direct access to B2Chat web interface
- Capture `location` field from B2Chat messages to track GPS/location data shared by customers
- Capture `broadcasted` field from B2Chat messages to identify broadcast campaign messages

### Acceptance Criteria
- [ ] Database schema includes `viewerUrl` field in Chat model
- [ ] Database schema includes `location` and `broadcasted` fields in Message model
- [ ] Migration successfully adds all three fields without breaking existing data
- [ ] Transform engine extracts and stores all three fields from B2Chat API responses
- [ ] UI displays "View in B2Chat" button/link when `viewerUrl` is present
- [ ] UI displays broadcast indicator badge on messages where `broadcasted === true`
- [ ] UI displays location link/indicator for messages with location data
- [ ] Change detector tracks `viewerUrl` changes for incremental sync
- [ ] All three fields are documented in B2CHAT_API_FIELD_MAPPING.md

### Context
The B2Chat API already returns these three fields:
- `viewer_url` (string) - Web viewer URL at chat level
- `location` (JSON object) - GPS coordinates at message level
- `broadcasted` (boolean) - Broadcast flag at message level

Our B2Chat client Zod schemas already parse these fields (client.ts:33-34, 168), but we're not storing them in the database. This feature completes the data capture by adding database storage and UI display.

## Architecture Design

### Integration with Existing Systems
This feature integrates with:
1. **Database Schema** (Layer 1) - Add three new columns to existing tables
2. **B2Chat Client** (Layer 2) - Already parses fields, no changes needed
3. **Transform Engine** (Layer 2) - Update to save parsed fields to database
4. **Change Detector** (Layer 2) - Add viewerUrl to change tracking
5. **Chat Card Component** (Layer 4) - Add "View in B2Chat" button
6. **Message Display Component** (Layer 4) - Add broadcast/location indicators

### Components to Create/Modify

**Create:**
- Migration: `prisma/migrations/[timestamp]_add_viewer_url_location_broadcasted/migration.sql`

**Modify:**
- `prisma/schema.prisma` - Add 3 fields (Chat.viewerUrl, Message.location, Message.broadcasted)
- `src/lib/sync/transform-engine.ts` - Extract and save viewerUrl in chat operations
- `src/lib/sync/transform-engine.ts` - Extract and save location/broadcasted in message operations
- `src/lib/sync/change-detector.ts` - Add viewerUrl to change tracking
- `src/types/chat.ts` - Add viewerUrl to Chat type (if needed)
- `src/components/chats/chat-card.tsx` - Add "View in B2Chat" button with ExternalLink icon
- `src/components/messages/message-bubble-list.tsx` - Add broadcast badge and location indicator
- `docs/development/B2CHAT_API_FIELD_MAPPING.md` - Update field mapping documentation

### Database Changes

**Chat table:**
```sql
ALTER TABLE "chats" ADD COLUMN "viewer_url" TEXT;
CREATE INDEX "chats_viewer_url_idx" ON "chats"("viewer_url") WHERE "viewer_url" IS NOT NULL;
```

**Message table:**
```sql
ALTER TABLE "messages" ADD COLUMN "location" JSONB;
ALTER TABLE "messages" ADD COLUMN "broadcasted" BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX "messages_location_idx" ON "messages"("location") WHERE "location" IS NOT NULL;
CREATE INDEX "messages_broadcasted_idx" ON "messages"("broadcasted") WHERE "broadcasted" = true;
```

**Prisma Schema:**
```prisma
model Chat {
  // ... existing fields
  viewerUrl String? @map("viewer_url") // B2Chat web viewer link
}

model Message {
  // ... existing fields
  location     Json?    @map("location")                    // GPS coordinates {lat, lng}
  broadcasted  Boolean  @default(false) @map("broadcasted") // Broadcast message flag
}
```

## Implementation Chunks

### Chunk 1: Database Schema and Migration
**Type:** Backend
**Dependencies:** None
**Estimated Time:** 0.5 days
**Files to create/modify:**
- `prisma/schema.prisma` (modify Chat and Message models)
- `prisma/migrations/[timestamp]_add_viewer_url_location_broadcasted/migration.sql` (create)

**Implementation Details:**
1. Add `viewerUrl String? @map("viewer_url")` to Chat model after `alias` field
2. Add `location Json? @map("location")` to Message model after `caption` field
3. Add `broadcasted Boolean @default(false) @map("broadcasted")` to Message model after `location`
4. Run `npx prisma migrate dev --name add_viewer_url_location_broadcasted`
5. Verify migration creates columns with indexes as specified above

**Tests required:** No unit tests - manual verification
**Acceptance criteria:**
- [ ] Migration file created with IF NOT EXISTS clauses
- [ ] All three columns added successfully
- [ ] Indexes created for efficient querying
- [ ] Prisma client regenerated with new fields
- [ ] Migration is idempotent (can be run multiple times)

---

### Chunk 2: Update Transform Engine - Chat viewerUrl
**Type:** Backend
**Dependencies:** Chunk 1 must be completed
**Estimated Time:** 0.5 days
**Files to create/modify:**
- `src/lib/sync/transform-engine.ts` (modify transformChats method around line 680)

**Implementation Details:**
1. In `transformChats` method, extract `viewerUrl` from `rawData`:
   ```typescript
   const viewerUrl = rawData.viewer_url || null
   ```
2. Add `viewerUrl` to chat `create` operation (around line 680)
3. Add `viewerUrl` to chat `update` operation when changes detected (around line 790)
4. Ensure null values are handled gracefully

**Tests required:** Yes - unit tests for transform logic
**Test cases:**
- Chat with viewer_url present is stored correctly
- Chat with viewer_url null/missing is handled gracefully
- Chat update with changed viewer_url triggers update

**Acceptance criteria:**
- [ ] viewerUrl extracted from rawData.viewer_url
- [ ] viewerUrl saved in chat create operation
- [ ] viewerUrl saved in chat update operation
- [ ] Null/missing viewer_url handled without errors
- [ ] Unit tests passing

---

### Chunk 3: Update Transform Engine - Message location and broadcasted
**Type:** Backend
**Dependencies:** Chunk 1 must be completed
**Estimated Time:** 0.5 days
**Files to create/modify:**
- `src/lib/sync/transform-engine.ts` (modify insertMessage method around line 1280)

**Implementation Details:**
1. In `insertMessage` method, extract fields from `messageData`:
   ```typescript
   location: messageData.location || null,
   broadcasted: messageData.broadcasted === true,
   ```
2. Add both fields to message `create` operation (around line 1277)
3. Note: Messages use upsert with update only touching lastSyncAt, no need to update these fields

**Tests required:** Yes - unit tests for message transform
**Test cases:**
- Message with location JSON is stored correctly
- Message with broadcasted=true is stored as true
- Message with broadcasted=false or missing is stored as false
- Message with location=null is handled gracefully

**Acceptance criteria:**
- [ ] location extracted from messageData.location
- [ ] broadcasted extracted with proper boolean coercion
- [ ] Both fields saved in message create operation
- [ ] Null/missing values handled with proper defaults
- [ ] Unit tests passing

---

### Chunk 4: Update Change Detector for viewerUrl
**Type:** Backend
**Dependencies:** Chunk 2 must be completed
**Estimated Time:** 0.25 days
**Files to create/modify:**
- `src/lib/sync/change-detector.ts` (modify CHAT_CHANGE_FIELDS around line 297)

**Implementation Details:**
1. Add to `CHAT_CHANGE_FIELDS` array:
   ```typescript
   { key: 'viewerUrl', raw: 'viewer_url' },
   ```
2. Position after `alias` field for logical grouping
3. No special change detection logic needed (simple string comparison)

**Tests required:** Yes - unit test for change detection
**Test cases:**
- Chat with changed viewer_url is detected as changed
- Chat with unchanged viewer_url is not detected as changed
- Chat with null → value transition is detected
- Chat with value → null transition is detected

**Acceptance criteria:**
- [ ] viewerUrl added to change tracking fields
- [ ] Change detection works for null ↔ value transitions
- [ ] Unit test passing for viewer_url change detection
- [ ] Incremental sync captures viewer_url changes

---

### Chunk 5: Update TypeScript Types
**Type:** Both (Backend types)
**Dependencies:** Chunk 1 must be completed
**Estimated Time:** 0.25 days
**Files to create/modify:**
- `src/types/chat.ts` (modify Chat interface if explicit type exists)
- Verify Prisma-generated types include new fields

**Implementation Details:**
1. Run `npx prisma generate` to regenerate Prisma client types
2. Check if `src/types/chat.ts` has explicit Chat interface that needs updating
3. Add fields if custom type exists:
   ```typescript
   viewerUrl?: string | null
   ```
4. For Message type, add if custom interface exists:
   ```typescript
   location?: any | null  // or { lat: number, lng: number } if structure known
   broadcasted?: boolean
   ```

**Tests required:** No - TypeScript compilation is the test
**Acceptance criteria:**
- [ ] Prisma client types regenerated
- [ ] TypeScript compilation successful with no type errors
- [ ] Custom types updated if they exist
- [ ] IDE autocomplete works for new fields

---

### Chunk 6: Add "View in B2Chat" Button to Chat Card
**Type:** Frontend
**Dependencies:** Chunks 1-5 must be completed
**Estimated Time:** 0.5 days
**Files to create/modify:**
- `src/components/chats/chat-card.tsx` (modify CardHeader section around line 50)

**Implementation Details:**
1. Import `ExternalLink` icon from `lucide-react`
2. Add button in CardHeader near existing actions:
   ```tsx
   {chat.viewerUrl && (
     <Button variant="outline" size="sm" asChild>
       <a href={chat.viewerUrl} target="_blank" rel="noopener noreferrer">
         <ExternalLink className="h-4 w-4 mr-2" />
         View in B2Chat
       </a>
     </Button>
   )}
   ```
3. Position after priority badge, before action buttons
4. Use `asChild` pattern for proper Link rendering
5. Open in new tab with security attributes

**Tests required:** Yes - E2E test with Playwright
**Test cases:**
- Button appears when viewerUrl is present
- Button does not appear when viewerUrl is null/missing
- Button opens correct URL in new tab
- Button has proper accessibility attributes

**Acceptance criteria:**
- [ ] Button renders when viewerUrl present
- [ ] Button hidden when viewerUrl null/missing
- [ ] Button opens viewer_url in new tab
- [ ] Button has external link icon
- [ ] Proper security attributes (rel="noopener noreferrer")
- [ ] E2E test passing

---

### Chunk 7: Add Broadcast Indicator to Messages
**Type:** Frontend
**Dependencies:** Chunks 1-5 must be completed
**Estimated Time:** 0.5 days
**Files to create/modify:**
- `src/components/messages/message-bubble-list.tsx` (modify message rendering logic)

**Implementation Details:**
1. Import `Radio` icon from `lucide-react` (broadcast symbol)
2. Add broadcast badge next to timestamp for broadcasted messages:
   ```tsx
   {message.broadcasted && (
     <Badge variant="secondary" className="ml-2">
       <Radio className="h-3 w-3 mr-1" />
       Broadcast
     </Badge>
   )}
   ```
3. Style: small badge, secondary variant, positioned inline with timestamp
4. Only show for outgoing messages (message.incoming === false) since broadcasts are agent-initiated

**Tests required:** Yes - component test with React Testing Library
**Test cases:**
- Broadcast badge appears for broadcasted=true messages
- Broadcast badge hidden for broadcasted=false messages
- Badge only appears on outgoing messages
- Badge has proper icon and text

**Acceptance criteria:**
- [ ] Badge renders for broadcasted messages
- [ ] Badge hidden for non-broadcasted messages
- [ ] Badge styled appropriately (secondary variant, small size)
- [ ] Radio icon displayed
- [ ] Component test passing

---

### Chunk 8: Add Location Indicator to Messages
**Type:** Frontend
**Dependencies:** Chunks 1-5 must be completed
**Estimated Time:** 0.5 days
**Files to create/modify:**
- `src/components/messages/message-bubble-list.tsx` (modify message rendering logic)

**Implementation Details:**
1. Import `MapPin` icon from `lucide-react`
2. Add location link for messages with location data:
   ```tsx
   {message.location && message.location.lat && message.location.lng && (
     <a
       href={`https://www.google.com/maps?q=${message.location.lat},${message.location.lng}`}
       target="_blank"
       rel="noopener noreferrer"
       className="text-blue-600 hover:underline inline-flex items-center ml-2"
     >
       <MapPin className="h-3 w-3 mr-1" />
       View Location
     </a>
   )}
   ```
3. Parse location JSON structure (expect `{lat: number, lng: number}`)
4. Open Google Maps in new tab with coordinates
5. Position inline with message metadata

**Tests required:** Yes - component test with React Testing Library
**Test cases:**
- Location link appears when location data present
- Location link hidden when location null/missing
- Location link has correct Google Maps URL
- Location link opens in new tab

**Acceptance criteria:**
- [ ] Link renders for messages with location
- [ ] Link hidden when location null/missing
- [ ] Google Maps URL correctly formatted with lat/lng
- [ ] MapPin icon displayed
- [ ] Link opens in new tab with security attributes
- [ ] Component test passing

---

### Chunk 9: Update Field Mapping Documentation
**Type:** Documentation
**Dependencies:** Chunks 1-8 must be completed
**Estimated Time:** 0.25 days
**Files to create/modify:**
- `docs/development/B2CHAT_API_FIELD_MAPPING.md` (update "Not Extracted" section)

**Implementation Details:**
1. Move three fields from "Not Extracted" to "Extracted" sections
2. Add to Chat-level extracted fields table:
   ```markdown
   | `viewer_url` | `viewerUrl` | Yes | Direct string mapping |
   ```
3. Add to Message-level extracted fields table:
   ```markdown
   | `location` | `location` | Yes | JSON object with lat/lng coordinates |
   | `broadcasted` | `broadcasted` | Yes | Boolean flag for broadcast messages |
   ```
4. Update "Available but Ignored Fields" section to remove these three
5. Add usage notes explaining UI display features

**Tests required:** No
**Acceptance criteria:**
- [ ] Documentation moved from "Not Extracted" to "Extracted"
- [ ] Field descriptions added with data types
- [ ] Usage notes explain UI features
- [ ] Documentation is clear and accurate

---

### Chunk 10: Testing and Validation
**Type:** Both (Integration testing)
**Dependencies:** All chunks 1-9 must be completed
**Estimated Time:** 0.5 days
**Files to create/modify:**
- No new files - run existing tests and manual validation

**Implementation Details:**
1. **Database validation:**
   - Verify migration applied successfully
   - Check columns exist with correct types
   - Verify indexes created

2. **Backend validation:**
   - Run full sync from B2Chat API
   - Verify viewerUrl populated in chats table
   - Verify location and broadcasted populated in messages table
   - Check logs for any transformation errors

3. **Frontend validation:**
   - Find chat with viewerUrl in UI
   - Click "View in B2Chat" button, verify opens correct URL
   - Find broadcasted message, verify badge appears
   - Find message with location, verify link appears and opens Google Maps

4. **Unit test suite:**
   - Run `npm test` - all existing tests must pass
   - New transform tests must pass
   - New change detector test must pass
   - New component tests must pass

5. **E2E test suite:**
   - Run `npm run test:e2e` - verify no regressions
   - New E2E test for "View in B2Chat" button must pass

**Tests required:** All test suites must pass
**Acceptance criteria:**
- [ ] Migration applied successfully
- [ ] All three fields populated from sync
- [ ] "View in B2Chat" button works correctly
- [ ] Broadcast badge displays correctly
- [ ] Location link displays and opens Maps correctly
- [ ] All unit tests passing (npm test)
- [ ] All E2E tests passing (npm run test:e2e)
- [ ] No console errors or warnings
- [ ] No TypeScript compilation errors

---

## Testing Strategy

### Unit Tests
**When:** During implementation of Chunks 2, 3, 4, 7, 8
**What to test:**
- Transform engine extracts viewerUrl correctly
- Transform engine extracts location and broadcasted correctly
- Change detector tracks viewerUrl changes
- Message bubble component renders broadcast badge conditionally
- Message bubble component renders location link conditionally

**Test files to create:**
- `src/lib/sync/__tests__/transform-engine-viewer-url.test.ts`
- `src/lib/sync/__tests__/change-detector-viewer-url.test.ts`
- `src/components/messages/__tests__/message-broadcast-indicator.test.tsx`
- `src/components/messages/__tests__/message-location-indicator.test.tsx`

### Integration Tests
**When:** After Chunks 1-5 complete (backend)
**What to test:**
- Full sync from B2Chat populates all three fields
- Incremental sync captures viewerUrl changes
- Database constraints and defaults work correctly

**Manual testing:**
- Trigger full sync via `/api/sync/extract` endpoint
- Query database for sample records with new fields
- Verify JSON structure of location field

### E2E Tests
**When:** After Chunks 6-8 complete (frontend)
**What to test:**
- Chat card displays "View in B2Chat" button when viewerUrl present
- Button opens correct URL in new tab
- Broadcast badge appears on broadcasted messages
- Location link appears on messages with location
- Location link opens Google Maps with correct coordinates

**Test file to create:**
- `e2e/chat-viewer-url.spec.ts` - Test viewer URL button
- Add test cases to existing `e2e/chat-messages.spec.ts` for broadcast/location

---

## Database Changes

### Migrations Needed
1. **Migration: add_viewer_url_location_broadcasted**
   - **Timing:** Chunk 1 (first step)
   - **Operations:**
     - Add `viewer_url` column to `chats` table (TEXT, nullable)
     - Add `location` column to `messages` table (JSONB, nullable)
     - Add `broadcasted` column to `messages` table (BOOLEAN, default false, not null)
     - Create partial index on `chats.viewer_url` for non-null values
     - Create partial index on `messages.location` for non-null values
     - Create partial index on `messages.broadcasted` for true values
   - **Rollback:** SQL provided in migration down script

### Data Changes
- **No data transformation needed** - these are additive columns
- Existing records will have:
  - `viewer_url`: NULL (until next sync)
  - `location`: NULL (no historical location data)
  - `broadcasted`: false (default applies to existing messages)
- Future syncs will populate fields going forward

---

## API Changes

### New Endpoints
- None - this feature adds database fields and UI, no new API endpoints

### Modified Endpoints
- None - existing sync and query endpoints automatically include new fields once Prisma schema updated

**Note:** All API endpoints that return Chat or Message objects will automatically include the new fields after Prisma client regeneration (Chunk 5). No explicit API changes required due to Prisma's automatic type generation.

---

## Integration Points

### Services Affected

1. **B2Chat Client (`src/lib/b2chat/client.ts`)**
   - **Impact:** None - already parses these fields in Zod schemas
   - **Changes Required:** None

2. **Transform Engine (`src/lib/sync/transform-engine.ts`)**
   - **Impact:** Medium - needs to extract and save three new fields
   - **Changes Required:**
     - Extract `viewerUrl` in chat transformation
     - Extract `location` and `broadcasted` in message transformation
   - **Risk:** Low - additive changes only

3. **Change Detector (`src/lib/sync/change-detector.ts`)**
   - **Impact:** Low - needs to track viewerUrl changes
   - **Changes Required:** Add viewerUrl to CHAT_CHANGE_FIELDS array
   - **Risk:** Very Low - standard change tracking pattern

4. **Chat Card Component (`src/components/chats/chat-card.tsx`)**
   - **Impact:** Medium - UI changes to add button
   - **Changes Required:** Add "View in B2Chat" button with conditional rendering
   - **Risk:** Low - isolated UI component

5. **Message Display Component (`src/components/messages/message-bubble-list.tsx`)**
   - **Impact:** Medium - UI changes to add indicators
   - **Changes Required:** Add broadcast badge and location link
   - **Risk:** Low - additive display logic

### External Systems
- **B2Chat API:** No changes - already provides these fields
- **Google Maps:** New integration for location links (read-only, no API key required for basic links)
- **Vercel Blob Storage:** No impact
- **Clerk Auth:** No impact
- **Database (PostgreSQL):** Schema changes only

---

## Rollback Plan

### Database Rollback
If issues arise, rollback via migration down script:

```sql
-- Drop indexes first
DROP INDEX IF EXISTS "chats_viewer_url_idx";
DROP INDEX IF EXISTS "messages_location_idx";
DROP INDEX IF EXISTS "messages_broadcasted_idx";

-- Drop columns
ALTER TABLE "chats" DROP COLUMN IF EXISTS "viewer_url";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "location";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "broadcasted";
```

**Steps:**
1. Run `npx prisma migrate down` (if migration system supports it)
2. Or manually execute rollback SQL
3. Regenerate Prisma client: `npx prisma generate`
4. Redeploy application without feature code changes

### Code Rollback
**Backend:**
1. Revert changes to `transform-engine.ts` (remove field extractions)
2. Revert changes to `change-detector.ts` (remove viewerUrl from tracking)
3. Revert changes to `schema.prisma` (remove fields)
4. Regenerate Prisma client

**Frontend:**
1. Revert changes to `chat-card.tsx` (remove viewer button)
2. Revert changes to `message-bubble-list.tsx` (remove indicators)
3. Revert type changes if custom types modified

### Feature Flag Considerations
**Option:** Add environment variable for gradual rollout:
```env
ENABLE_VIEWER_URL_FEATURES=false
```

**Implementation:** Wrap UI components in feature flag checks:
```tsx
{process.env.NEXT_PUBLIC_ENABLE_VIEWER_URL_FEATURES && chat.viewerUrl && (
  <ViewInB2ChatButton url={chat.viewerUrl} />
)}
```

**Benefit:** Can disable feature without code changes if issues discovered in production

---

## Documentation Updates

### Files to Create/Update

1. **B2CHAT_API_FIELD_MAPPING.md** (Chunk 9)
   - Move fields from "Not Extracted" to "Extracted" sections
   - Add usage notes for new UI features
   - Document location JSON structure

2. **README.md** (After completion)
   - Add to "Recent Features" section:
     ```markdown
     - **Viewer URL Integration:** Direct links to view chats in B2Chat web interface
     - **Broadcast Message Tracking:** Visual indicators for campaign messages
     - **Location Data Capture:** GPS coordinates from customer messages with map links
     ```

3. **CHANGELOG.md** (After completion)
   - Add entry:
     ```markdown
     ## [Version] - [Date]
     ### Added
     - Chat `viewerUrl` field with "View in B2Chat" button in chat cards
     - Message `location` field (JSON) with Google Maps integration
     - Message `broadcasted` field with visual broadcast indicators
     - Database indexes for efficient querying of new fields
     ```

4. **Feature Documentation** (This file)
   - Move to `features/done_feature-016-capture-viewer-url-location-broadcasted.md` after completion
   - Add completion date and lessons learned

---

## Success Criteria

### Feature Complete When:
- [ ] All 10 implementation chunks completed
- [ ] Migration applied successfully in all environments
- [ ] All unit tests passing (npm test)
- [ ] All E2E tests passing (npm run test:e2e)
- [ ] TypeScript compilation successful with no errors
- [ ] "View in B2Chat" button functional in production
- [ ] Broadcast indicators displaying correctly in production
- [ ] Location links opening Google Maps correctly
- [ ] Documentation updated (B2CHAT_API_FIELD_MAPPING.md, README.md, CHANGELOG.md)
- [ ] No performance degradation (test with k6 load tests)
- [ ] No console errors or warnings in browser/server logs

### Metrics and Validation

**Database Metrics:**
```sql
-- Verify field population after sync
SELECT
  COUNT(*) as total_chats,
  COUNT(viewer_url) as chats_with_viewer_url,
  ROUND(COUNT(viewer_url)::numeric / COUNT(*)::numeric * 100, 2) as viewer_url_pct
FROM chats;

SELECT
  COUNT(*) as total_messages,
  COUNT(location) as messages_with_location,
  SUM(CASE WHEN broadcasted THEN 1 ELSE 0 END) as broadcast_messages,
  ROUND(COUNT(location)::numeric / COUNT(*)::numeric * 100, 2) as location_pct,
  ROUND(SUM(CASE WHEN broadcasted THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2) as broadcast_pct
FROM messages;
```

**Expected Results:**
- `viewer_url` population: 80-100% (B2Chat should provide for most chats)
- `location` population: 1-5% (rare, only when customer shares location)
- `broadcasted` true: 5-15% (depends on campaign volume)

**Performance Validation:**
- Page load time unchanged (< 2 second target maintained)
- Sync time increase < 5% (minimal due to additive fields)
- Database query performance unchanged (verified with EXPLAIN ANALYZE)

**User Acceptance:**
- "View in B2Chat" button clicks tracked via analytics
- Positive user feedback on direct B2Chat access
- No user-reported bugs related to new fields

---

## Risk Assessment

### Potential Risks

1. **Migration Failure Risk:** LOW
   - **Mitigation:** Use IF NOT EXISTS clauses for idempotent migrations
   - **Mitigation:** Test migration on development/staging before production
   - **Rollback:** Down migration removes columns cleanly

2. **Performance Impact Risk:** LOW
   - **Mitigation:** Partial indexes only on non-null values (won't bloat)
   - **Mitigation:** JSONB column for location (efficient storage/querying)
   - **Validation:** Run k6 load tests before/after

3. **B2Chat API Inconsistency Risk:** MEDIUM
   - **Risk:** B2Chat may not provide viewer_url for all chats
   - **Mitigation:** Conditional rendering (only show button if URL exists)
   - **Mitigation:** Null-safe extraction in transform engine

4. **Location Data Format Risk:** MEDIUM
   - **Risk:** B2Chat location JSON structure unknown/variable
   - **Mitigation:** Store as flexible JSONB, handle multiple formats
   - **Mitigation:** Defensive parsing with null checks before map link

5. **UI Layout Risk:** LOW
   - **Risk:** New button/badges may break responsive layout
   - **Mitigation:** Use existing UI patterns (Button, Badge components)
   - **Mitigation:** Test on mobile/tablet/desktop viewports

6. **Browser Compatibility Risk:** VERY LOW
   - **Risk:** External links may not work in all browsers
   - **Mitigation:** Use standard HTML anchor tags with target="_blank"
   - **Mitigation:** Include rel="noopener noreferrer" for security

### Blocker Scenarios

**Scenario 1:** Migration fails due to database locks
- **Detection:** Migration command returns error
- **Resolution:** Retry during low-traffic window, or apply manually
- **Escalation:** Database admin intervention if persistent locks

**Scenario 2:** B2Chat viewer_url format changes
- **Detection:** Links not opening correctly in production
- **Resolution:** Update URL parsing logic in transform engine
- **Escalation:** Contact B2Chat support for URL format documentation

**Scenario 3:** Location JSON structure incompatible with Google Maps
- **Detection:** Map links not opening or showing wrong coordinates
- **Resolution:** Add format validation, log unexpected structures
- **Escalation:** Collect examples, implement format detection logic

---

## Timeline Estimate

**Total Effort:** 4 days (assuming single developer)

| Chunk | Description | Days | Cumulative |
|-------|-------------|------|------------|
| 1 | Database schema & migration | 0.5 | 0.5 |
| 2 | Transform engine - viewerUrl | 0.5 | 1.0 |
| 3 | Transform engine - location/broadcasted | 0.5 | 1.5 |
| 4 | Change detector update | 0.25 | 1.75 |
| 5 | TypeScript types update | 0.25 | 2.0 |
| 6 | Chat card UI - viewer button | 0.5 | 2.5 |
| 7 | Message UI - broadcast indicator | 0.5 | 3.0 |
| 8 | Message UI - location indicator | 0.5 | 3.5 |
| 9 | Documentation updates | 0.25 | 3.75 |
| 10 | Testing & validation | 0.5 | 4.25 |

**Parallel Execution Opportunities:**
- Chunks 2 & 3 can be done in parallel (both transform engine)
- Chunks 4 & 5 can be done in parallel (both typing/tracking)
- Chunks 6, 7, 8 can be done in parallel (all frontend UI)

**With parallel execution:** 3 days total

**Recommended approach:** Sequential for safety, parallel only if multiple developers

---

## Implementation Notes

### Key Considerations

1. **Location Data Structure Unknown:**
   - B2Chat documentation doesn't specify location JSON format
   - Assume `{lat: number, lng: number}` but code defensively
   - Consider logging location format examples during first sync
   - May need iteration once real data observed

2. **Viewer URL Format:**
   - Current example: `https://app.b2chat.io/viewer/{chat_id}/{token}`
   - Appears to be public link (no auth required in URL)
   - Consider adding security note in docs about sharing viewer URLs

3. **Broadcasted Message Semantics:**
   - Broadcast flag on individual messages, not just campaigns
   - May want to also detect campaigns at chat level (future enhancement)
   - Consider adding chat-level `isBroadcast` field in future feature

4. **Backward Compatibility:**
   - All changes are additive (no breaking changes)
   - Existing API consumers unaffected
   - Existing tests should continue passing
   - No changes to authentication or authorization logic

### Development Tips

**For Transform Engine:**
- Add debug logging for field extraction
- Use optional chaining: `rawData.viewer_url ?? null`
- Verify null handling in all code paths

**For UI Components:**
- Test with null/undefined/empty values
- Use Storybook for isolated component testing
- Verify mobile responsiveness
- Test keyboard navigation for accessibility

**For Testing:**
- Create mock data with various field combinations
- Test edge cases (malformed location, missing fields)
- Verify no performance regression with large datasets

---

## Questions and Clarifications

### Resolved
- Q: Should viewer_url be shown to all users?
- A: Yes, it's a convenience link to B2Chat's own interface, no security concerns

### Pending
- Q: What is the exact JSON structure of B2Chat's location field?
- A: **Needs investigation** - will determine from first sync with location data

- Q: Should we validate location coordinates (lat -90 to 90, lng -180 to 180)?
- A: **Nice to have** - add validation in future if issues arise

- Q: Should broadcast indicator have special color/styling?
- A: **User preference** - using secondary badge variant, can adjust based on feedback

- Q: Should we add analytics tracking for "View in B2Chat" clicks?
- A: **Out of scope** - can add in separate analytics enhancement feature

---

## Related Features

**Dependencies:**
- None - this is a standalone enhancement

**Enables Future Features:**
- **Feature 017:** Broadcast campaign analytics (analyze broadcast message patterns)
- **Feature 018:** Location-based customer insights (heatmaps, regional analysis)
- **Feature 019:** Enhanced message search (filter by broadcast status)

**Related Documentation:**
- `docs/development/B2CHAT_API_FIELD_MAPPING.md` - Field mapping reference
- `docs/architecture/product_architecture.md` - System architecture overview
- `features/done_feature-002-complete-b2chat-data-capture.md` - Previous data capture enhancement

---

## Appendix

### Sample B2Chat Data

**Chat with viewer_url:**
```json
{
  "chat_id": "1c5ba721-2c0f-475b-a0a7-da5fb350e5c0",
  "viewer_url": "https://app.b2chat.io/viewer/1c5ba721-2c0f-475b-a0a7-da5fb350e5c0/b3a7e7a3-47a9-4204-bff2-14fc9b67c144",
  "status": "ABANDONED_POLL",
  "provider": "whatsapp"
}
```

**Message with location (expected format):**
```json
{
  "body": "I'm here!",
  "type": "text",
  "incoming": true,
  "location": {
    "lat": 6.2442,
    "lng": -75.5812
  },
  "created_at": "2025-10-28 14:42:14"
}
```

**Message with broadcasted flag:**
```json
{
  "body": "**¡Esta es tu oportunidad de ser propietario! 🙌🏠**",
  "type": "text",
  "incoming": false,
  "broadcasted": true,
  "created_at": "2025-10-28 14:42:08"
}
```

### SQL Queries for Validation

**Check viewer_url population:**
```sql
SELECT
  COUNT(*) FILTER (WHERE viewer_url IS NOT NULL) as with_url,
  COUNT(*) FILTER (WHERE viewer_url IS NULL) as without_url,
  ROUND(
    COUNT(*) FILTER (WHERE viewer_url IS NOT NULL)::numeric /
    COUNT(*)::numeric * 100, 2
  ) as population_pct
FROM chats
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Find messages with location:**
```sql
SELECT
  m.id,
  m.text,
  m.location,
  m.timestamp,
  c.b2chat_id as chat_id
FROM messages m
JOIN chats c ON m.chat_id = c.id
WHERE m.location IS NOT NULL
ORDER BY m.timestamp DESC
LIMIT 10;
```

**Analyze broadcast message patterns:**
```sql
SELECT
  DATE(timestamp) as date,
  COUNT(*) FILTER (WHERE broadcasted) as broadcast_msgs,
  COUNT(*) FILTER (WHERE NOT broadcasted) as normal_msgs,
  ROUND(
    COUNT(*) FILTER (WHERE broadcasted)::numeric /
    COUNT(*)::numeric * 100, 2
  ) as broadcast_pct
FROM messages
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```
