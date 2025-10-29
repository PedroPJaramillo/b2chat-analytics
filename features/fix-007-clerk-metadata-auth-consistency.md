# Fix 007: Clerk Metadata Authentication Consistency

## Requirements

### Problem Statement
The application has an inconsistent authentication/authorization implementation:
- **Frontend pages** correctly read user roles from Clerk's `publicMetadata.role`
- **Backend API routes** incorrectly query the database for user roles
- **Clerk webhook handler** doesn't read roles from Clerk metadata, uses hardcoded email-based logic
- This causes "Admin access required" errors even when users have Admin role in Clerk

### Root Cause
1. Webhook creates users in database with roles determined by hardcoded email list (route.ts:231-256)
2. Backend API routes query `prisma.user.findUnique()` for role instead of reading from Clerk
3. Clerk metadata is the source of truth for roles, but backend doesn't use it

### Acceptance Criteria
- [ ] All backend API routes read roles from Clerk metadata (not database)
- [ ] Webhook handler syncs roles from Clerk metadata to database
- [ ] Database user roles stay in sync with Clerk metadata
- [ ] No "Admin access required" errors when user has Admin in Clerk
- [ ] Consistent auth pattern across all routes using `getCurrentUser()` helper
- [ ] Existing `getCurrentUser()` in lib/auth.ts is used consistently
- [ ] All tests pass with updated auth pattern

## Architecture Design

### Current State (Inconsistent)
```
Frontend: useUser() → publicMetadata.role ✅ CORRECT
                              ↓
Backend API: prisma.user.findUnique() → role ❌ WRONG
                              ↓
Webhook: determineUserRole(email) → hardcoded logic ❌ WRONG
                              ↓
Database: User.role (out of sync with Clerk)
```

### Target State (Consistent)
```
Clerk publicMetadata.role (SOURCE OF TRUTH)
            ↓                          ↓
Frontend: useUser()              Backend: getCurrentUser()
publicMetadata.role ✅           publicMetadata.role ✅
                                      ↓
                    Webhook: syncUserToDatabase()
                    (reads public_metadata.role) ✅
                                      ↓
                    Database: User.role (synced, for audit only)
```

### Integration Points
- **Affected files:**
  - ✅ Already correct: `src/lib/auth.ts` (getCurrentUser, syncUserToDatabase)
  - ❌ Need fixing: All API routes that check roles
  - ❌ Need fixing: `src/app/api/webhook/clerk/route.ts`

### Database Changes
- **No schema changes required** - User table already has role field
- Database role becomes read-only sync'd copy of Clerk metadata
- Database role used only for audit trails and analytics queries

## Implementation Chunks

### Chunk 1: Update Webhook to Read Clerk Metadata
**Type:** Backend
**Dependencies:** None
**Files to modify:**
- `src/app/api/webhook/clerk/route.ts`

**Implementation:**
```typescript
// Lines 107-118: Update handleUserCreated
async function handleUserCreated(eventData: any) {
  const { id, email_addresses, first_name, last_name, public_metadata, private_metadata } = eventData;
  const email = email_addresses?.[0]?.email_address;
  const name = [first_name, last_name].filter(Boolean).join(' ') || null;

  // Read role from Clerk metadata first, fallback to email-based logic
  const clerkRole = public_metadata?.role || private_metadata?.role;
  const role = (clerkRole === 'Admin' || clerkRole === 'Manager')
    ? clerkRole
    : determineUserRole(email); // Fallback only if metadata not set

  logger.info('Creating user with role from Clerk metadata', {
    userId: id,
    email,
    roleSource: clerkRole ? 'metadata' : 'email-fallback',
    role
  });

  // ... rest of code
}

// Lines 151-175: Update handleUserUpdated similarly
async function handleUserUpdated(eventData: any) {
  const { id, email_addresses, first_name, last_name, public_metadata, private_metadata } = eventData;
  const email = email_addresses?.[0]?.email_address;
  const name = [first_name, last_name].filter(Boolean).join(' ') || null;

  // Read role from Clerk metadata
  const clerkRole = public_metadata?.role || private_metadata?.role;
  const role = (clerkRole === 'Admin' || clerkRole === 'Manager')
    ? clerkRole
    : determineUserRole(email);

  // Upsert will update role if it changed in Clerk
  await prisma.user.upsert({
    where: { id },
    update: {
      email,
      name,
      role, // Update role from Clerk metadata
      updatedAt: new Date(),
    },
    create: {
      id,
      email,
      name,
      role,
    },
  });

  logger.info('User updated with role from Clerk metadata', {
    userId: id,
    email,
    roleSource: clerkRole ? 'metadata' : 'email-fallback',
    role
  });
}
```

**Tests required:**
- Unit test: webhook with metadata sets correct role
- Unit test: webhook without metadata falls back to email logic
- Unit test: user.updated event updates role in database

**Acceptance criteria:**
- [ ] Webhook reads `public_metadata.role` from Clerk events
- [ ] Webhook falls back to `determineUserRole()` if metadata not set
- [ ] Role from metadata is synced to database on create and update
- [ ] Logger includes roleSource for debugging

---

### Chunk 2: Refactor Office Hours API Route
**Type:** Backend
**Dependencies:** None (can run parallel with Chunk 1)
**Files to modify:**
- `src/app/api/settings/office-hours/route.ts`

**Current code (Lines 58-68):**
```typescript
// Check if user is admin
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { role: true },
})

if (!user || user.role !== "Admin") {
  return NextResponse.json(
    { error: "Admin access required" },
    { status: 403 }
  )
}
```

**New code:**
```typescript
import { getCurrentUser } from "@/lib/auth"

// Check if user is admin
const user = await getCurrentUser()

if (!user || user.role !== "Admin") {
  return NextResponse.json(
    { error: "Admin access required" },
    { status: 403 }
  )
}
```

**Tests required:** Yes
- Test: Admin user can update office hours
- Test: Manager user gets 403
- Test: Unauthenticated user gets 401

**Acceptance criteria:**
- [ ] Route uses `getCurrentUser()` from lib/auth.ts
- [ ] No prisma.user.findUnique() for auth
- [ ] Admin role from Clerk metadata is respected
- [ ] Tests pass

---

### Chunk 3: Refactor SLA Settings API Route
**Type:** Backend
**Dependencies:** None (can run parallel)
**Files to modify:**
- `src/app/api/settings/sla/route.ts`

**Implementation:** Same pattern as Chunk 2
- Replace prisma user query with `getCurrentUser()`
- Verify Admin role from Clerk metadata
- Update tests

**Tests required:** Yes
- Test: Admin can update SLA settings
- Test: Manager gets 403

**Acceptance criteria:**
- [ ] Route uses `getCurrentUser()` helper
- [ ] Admin check reads from Clerk metadata
- [ ] Tests pass

---

### Chunk 4: Refactor Holidays API Route
**Type:** Backend
**Dependencies:** None (can run parallel)
**Files to modify:**
- `src/app/api/settings/holidays/route.ts`

**Implementation:** Same pattern as Chunk 2
- Replace prisma user query with `getCurrentUser()`
- Verify Admin role from Clerk metadata
- Update tests

**Tests required:** Yes
- Test: Admin can update holidays
- Test: Manager gets 403

**Acceptance criteria:**
- [ ] Route uses `getCurrentUser()` helper
- [ ] Admin check reads from Clerk metadata
- [ ] Tests pass

---

### Chunk 5: Audit All Other API Routes
**Type:** Backend
**Dependencies:** Chunks 2-4 completed (to validate pattern)
**Files to check:**
- `src/app/api/sla/recalculate/route.ts`
- `src/app/api/sync/route.ts`
- `src/app/api/raw-data/route.ts`
- All routes in `src/app/api/customer-analysis/`
- Any other admin-only routes

**Implementation:**
```bash
# Search for routes doing database role checks
grep -r "prisma.user.findUnique" src/app/api/
grep -r "user.role" src/app/api/
grep -r "Admin access required" src/app/api/
```

For each route found:
1. Verify it's doing auth incorrectly
2. Refactor to use `getCurrentUser()`
3. Update/add tests
4. Document in this chunk

**Tests required:** Yes - for each route updated

**Acceptance criteria:**
- [ ] All API routes audited
- [ ] Any routes using database for auth are refactored
- [ ] All tests updated and passing
- [ ] Document routes that were changed

---

### Chunk 6: Create Migration Script for Existing Users
**Type:** Backend
**Dependencies:** Chunk 1 completed (webhook fixed)
**Files to create:**
- `scripts/sync-clerk-users-to-db.ts`

**Implementation:**
```typescript
/**
 * One-time script to sync all Clerk users to database with correct roles
 * Run with: npx tsx scripts/sync-clerk-users-to-db.ts
 */

import { config } from "dotenv";
config();

import { clerkClient } from "@clerk/nextjs/server";
import { syncUserToDatabase } from "../src/lib/auth";

async function main() {
  const client = await clerkClient();

  // Fetch all users from Clerk (paginate if needed)
  let hasMore = true;
  let offset = 0;
  const limit = 100;
  let totalSynced = 0;

  while (hasMore) {
    const response = await client.users.getUserList({
      limit,
      offset
    });

    console.log(`\nProcessing ${response.data.length} users (offset: ${offset})...`);

    for (const user of response.data) {
      const email = user.emailAddresses[0]?.emailAddress;
      const role = (user.publicMetadata as any)?.role || 'Manager';

      console.log(`  Syncing: ${email} (${role})`);

      try {
        await syncUserToDatabase(user);
        totalSynced++;
      } catch (error) {
        console.error(`    ✗ Failed to sync ${email}:`, error);
      }
    }

    hasMore = response.data.length === limit;
    offset += limit;
  }

  console.log(`\n✓ Synced ${totalSynced} users successfully!`);
}

main().catch(console.error);
```

**Tests required:** No (one-time script)

**Acceptance criteria:**
- [ ] Script syncs all Clerk users to database
- [ ] Roles from Clerk metadata are used
- [ ] Script handles pagination for large user counts
- [ ] Error handling for individual user failures
- [ ] Script can be run multiple times safely (upsert)

---

### Chunk 7: Update Documentation
**Type:** Documentation
**Dependencies:** All implementation chunks completed
**Files to create/modify:**
- `docs/operations/AUTHENTICATION.md` (new)
- `docs/operations/USER_MANAGEMENT.md` (update)
- Update README.md with auth architecture

**Implementation:**

Create `docs/operations/AUTHENTICATION.md`:
```markdown
# Authentication & Authorization

## Architecture

### Source of Truth: Clerk Metadata
User roles are managed in Clerk's `publicMetadata.role` field.
The database `users.role` is a synchronized copy for audit trails only.

### Role Management
1. Set role in Clerk Dashboard → Users → [User] → Metadata
2. Public metadata: `{"role": "Admin"}` or `{"role": "Manager"}`
3. Webhook automatically syncs to database
4. All API routes read from Clerk (via `getCurrentUser()`)

### Backend Implementation
All API routes MUST use:
```typescript
import { getCurrentUser } from "@/lib/auth"

const user = await getCurrentUser()
if (!user || user.role !== "Admin") {
  return NextResponse.json({ error: "Admin access required" }, { status: 403 })
}
```

NEVER query database for roles:
```typescript
// ❌ WRONG - Don't do this
const user = await prisma.user.findUnique({ where: { id: userId }})
if (user.role !== "Admin") { ... }
```

### User Sync
- Webhook at `/api/webhook/clerk` handles user.created/updated events
- `syncUserToDatabase()` function syncs Clerk data to database
- Run `npx tsx scripts/sync-clerk-users-to-db.ts` to sync all users

## Roles
- **Admin**: Full access to all features and settings
- **Manager**: Limited access, no settings/admin features
```

**Tests required:** No

**Acceptance criteria:**
- [ ] Documentation explains auth architecture
- [ ] Clear instructions for role management
- [ ] Backend pattern documented with examples
- [ ] User sync process documented

---

### Chunk 8: Integration Testing
**Type:** Testing
**Dependencies:** All implementation chunks completed
**Files to create:**
- `src/app/api/settings/__tests__/auth-integration.test.ts`

**Implementation:**
```typescript
/**
 * Integration tests for authentication pattern across all settings routes
 */

import { GET as getOfficeHours, PUT as putOfficeHours } from '../office-hours/route'
import { GET as getSLA, PUT as putSLA } from '../sla/route'
import { GET as getHolidays, PUT as putHolidays } from '../holidays/route'
import { auth, currentUser } from '@clerk/nextjs/server'

jest.mock('@clerk/nextjs/server')

describe('Settings API Authentication', () => {
  const mockAuth = auth as jest.MockedFunction<typeof auth>
  const mockCurrentUser = currentUser as jest.MockedFunction<typeof currentUser>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Admin access', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user_admin123' })
      mockCurrentUser.mockResolvedValue({
        id: 'user_admin123',
        emailAddresses: [{ emailAddress: 'admin@test.com' }],
        firstName: 'Admin',
        lastName: 'User',
        publicMetadata: { role: 'Admin' }, // Role from Clerk metadata
      } as any)
    })

    it('allows admin to update office hours', async () => {
      const request = new Request('http://localhost/api/settings/office-hours', {
        method: 'PUT',
        body: JSON.stringify({ /* valid config */ }),
      })

      const response = await putOfficeHours(request)
      expect(response.status).not.toBe(403)
    })

    it('allows admin to update SLA settings', async () => {
      const request = new Request('http://localhost/api/settings/sla', {
        method: 'PUT',
        body: JSON.stringify({ /* valid config */ }),
      })

      const response = await putSLA(request)
      expect(response.status).not.toBe(403)
    })

    it('allows admin to update holidays', async () => {
      const request = new Request('http://localhost/api/settings/holidays', {
        method: 'PUT',
        body: JSON.stringify({ /* valid config */ }),
      })

      const response = await putHolidays(request)
      expect(response.status).not.toBe(403)
    })
  })

  describe('Manager access', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user_manager123' })
      mockCurrentUser.mockResolvedValue({
        id: 'user_manager123',
        emailAddresses: [{ emailAddress: 'manager@test.com' }],
        firstName: 'Manager',
        lastName: 'User',
        publicMetadata: { role: 'Manager' }, // Role from Clerk metadata
      } as any)
    })

    it('denies manager from updating office hours', async () => {
      const request = new Request('http://localhost/api/settings/office-hours', {
        method: 'PUT',
        body: JSON.stringify({ /* valid config */ }),
      })

      const response = await putOfficeHours(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Admin access required')
    })

    it('denies manager from updating SLA settings', async () => {
      const request = new Request('http://localhost/api/settings/sla', {
        method: 'PUT',
        body: JSON.stringify({ /* valid config */ }),
      })

      const response = await putSLA(request)
      expect(response.status).toBe(403)
    })
  })

  describe('Unauthenticated access', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: null })
      mockCurrentUser.mockResolvedValue(null)
    })

    it('denies unauthenticated requests to all settings routes', async () => {
      const routes = [
        { handler: getOfficeHours, url: '/api/settings/office-hours' },
        { handler: getSLA, url: '/api/settings/sla' },
        { handler: getHolidays, url: '/api/settings/holidays' },
      ]

      for (const route of routes) {
        const request = new Request(`http://localhost${route.url}`)
        const response = await route.handler(request as any)
        expect(response.status).toBe(401)
      }
    })
  })
})
```

**Tests required:** This IS the test

**Acceptance criteria:**
- [ ] Integration tests cover all settings routes
- [ ] Tests verify Admin can access admin routes
- [ ] Tests verify Manager cannot access admin routes
- [ ] Tests verify unauthenticated users get 401
- [ ] All tests pass

## Testing Strategy

### Unit Tests
- **Webhook handler tests** (Chunk 1)
  - Test with public_metadata.role = "Admin"
  - Test with public_metadata.role = "Manager"
  - Test with no metadata (fallback to email)
  - Test user.updated event updates role

- **Individual API route tests** (Chunks 2-4)
  - Mock `getCurrentUser()` to return Admin user
  - Mock `getCurrentUser()` to return Manager user
  - Mock `getCurrentUser()` to return null
  - Verify 200/403/401 responses

### Integration Tests
- **Cross-route auth consistency** (Chunk 8)
  - Verify all settings routes use same auth pattern
  - Verify Clerk metadata is source of truth
  - End-to-end flow: Clerk → getCurrentUser → API response

### Manual Testing
1. Set role in Clerk Dashboard to "Admin"
2. Log out and log back in
3. Verify can access admin routes (office hours, SLA, holidays)
4. Change role in Clerk to "Manager"
5. Verify get 403 on admin routes

## Database Changes

**No schema migrations required.**

Database `users.role` column already exists and will be:
- Synchronized by webhook from Clerk metadata
- Used for audit trails and reporting queries only
- NOT used for authorization decisions

## API Changes

### Modified Endpoints
All settings endpoints change from database-based to Clerk-based auth:
- `PUT /api/settings/office-hours`
- `PUT /api/settings/sla`
- `PUT /api/settings/holidays`
- Any other admin-only routes found in audit (Chunk 5)

### No Breaking Changes
- External API contracts unchanged
- Request/response formats unchanged
- Only internal auth implementation changes

## Integration Points

### Services Affected
- **Clerk Authentication** - Already integrated, now properly used for roles
- **Prisma/Database** - Role field becomes read-only sync target
- **Webhook Handler** - Enhanced to sync metadata
- **All Settings APIs** - Refactored to use consistent pattern

### External Systems
- **Clerk Dashboard** - Admins manage roles in Clerk UI
- **Database** - Stores synced copy of roles for audit

## Rollback Plan

### If Issues Arise
1. **Immediate rollback:** Revert API routes to query database
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Database unchanged:** No migrations to rollback

3. **Webhook rollback:**
   - Revert webhook handler to email-based logic
   - Database role field still works as before

### Feature Flag Consideration
Could add environment variable for gradual rollout:
```typescript
const USE_CLERK_METADATA_AUTH = process.env.USE_CLERK_METADATA_AUTH === 'true'

if (USE_CLERK_METADATA_AUTH) {
  const user = await getCurrentUser()
} else {
  // Old database query
}
```

### Verification After Rollback
- Admin users can still access admin routes
- No 403 errors for legitimate admins
- Webhook still creates users in database

## Documentation Updates

### Files to Create/Update
- ✅ `docs/operations/AUTHENTICATION.md` (new) - Architecture and patterns
- ✅ `docs/operations/USER_MANAGEMENT.md` (update) - Add Clerk role management
- ✅ `README.md` (update) - Add auth architecture section
- ✅ Code comments in `lib/auth.ts` - Clarify role source
- ✅ Webhook route comments - Document metadata sync

### Developer Onboarding
Update developer docs to include:
- "Always use `getCurrentUser()` for auth in API routes"
- "Roles are managed in Clerk Dashboard"
- "Database roles are read-only sync copies"

## Success Criteria

### Technical Success
- [ ] All API routes use `getCurrentUser()` for auth
- [ ] Webhook syncs roles from Clerk metadata
- [ ] No database queries for role authorization
- [ ] All tests pass (unit + integration)
- [ ] No "Admin access required" errors for Clerk admins

### User Success
- [ ] Admin users can access all admin features
- [ ] Manager users correctly restricted from admin features
- [ ] Role changes in Clerk take effect immediately (on next request)
- [ ] No manual database updates needed for role changes

### Code Quality Success
- [ ] Consistent auth pattern across all routes
- [ ] Single source of truth (Clerk metadata)
- [ ] Clear documentation for future developers
- [ ] No technical debt from inconsistent implementations

## Implementation Timeline

### Estimated Effort
- **Chunk 1:** 2 hours (webhook + tests)
- **Chunk 2-4:** 1 hour each (3 hours total for 3 routes)
- **Chunk 5:** 3 hours (audit + fixes for unknown routes)
- **Chunk 6:** 1 hour (migration script)
- **Chunk 7:** 2 hours (documentation)
- **Chunk 8:** 2 hours (integration tests)

**Total: 13 hours (~2 days)**

### Parallel Work Opportunities
- Chunks 2, 3, 4 can be done in parallel (different files)
- Chunk 1 and Chunks 2-4 can be done in parallel (independent)
- Chunk 6 can start after Chunk 1 completes
- Chunk 7 can be done anytime (documentation)
- Chunk 8 should be last (integration tests)

### Recommended Order
1. **Day 1 Morning:** Chunks 1 + 2 (webhook + one route)
2. **Day 1 Afternoon:** Chunks 3 + 4 (two more routes)
3. **Day 2 Morning:** Chunk 5 (audit + fixes) + Chunk 6 (migration)
4. **Day 2 Afternoon:** Chunk 8 (integration tests) + Chunk 7 (docs)

## Risk Assessment

### Low Risks
- ✅ `getCurrentUser()` already exists and works
- ✅ Frontend already using Clerk metadata successfully
- ✅ No database schema changes
- ✅ Easy to rollback (revert commits)

### Medium Risks
- ⚠️ Unknown admin-only routes might exist (mitigated by Chunk 5 audit)
- ⚠️ Existing users might not have roles in Clerk (mitigated by Chunk 6 migration)

### Mitigation Strategies
- Thorough code audit (Chunk 5)
- Migration script to sync existing users (Chunk 6)
- Integration tests to verify consistency (Chunk 8)
- Clear rollback plan documented

## Notes

### Why This Fix is Important
1. **Security:** Consistent auth prevents bypasses
2. **Maintainability:** Single source of truth easier to reason about
3. **User Experience:** No confusing "Admin access required" errors
4. **Best Practice:** Clerk metadata is the recommended pattern

### Future Enhancements
After this fix, consider:
- Adding role-based middleware for Next.js routes
- Creating reusable `requireRole()` helper
- Adding more granular permissions beyond Admin/Manager
- Implementing role hierarchy (Admin > Manager > User)

### Related Issues
- Fixes the original "Admin access required" error
- Closes inconsistency between frontend and backend auth
- Aligns with Clerk best practices
