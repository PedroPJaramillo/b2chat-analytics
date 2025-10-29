# Feature 014: Audit Logging User Synchronization Fix

## Requirements

### Original Problem Statement
The audit logging system currently crashes when attempting to log events for Clerk-authenticated users whose records don't exist in the local User table. This creates a foreign key constraint violation (`audit_logs_user_id_fkey`) preventing audit logs from being created.

### Current Workaround
All audit logging calls are wrapped in try-catch blocks to prevent the feature from crashing:
```typescript
try {
  await auditLogger.log({ userId, ... })
} catch (auditError) {
  console.error('Failed to log event:', auditError)
}
```

This allows the application to continue functioning but silently fails audit logging, creating gaps in compliance tracking.

### Root Cause Analysis
1. **Authentication Flow**: Clerk manages authentication and provides `userId` from their system
2. **Database Schema**: `AuditLog` table has foreign key constraint to `User` table
3. **Sync Gap**: User records are only created in local database via Clerk webhook or on-demand operations
4. **Race Condition**: User can authenticate with Clerk before webhook creates local User record
5. **Result**: Audit logging fails with foreign key constraint violation

### Acceptance Criteria
- [ ] Audit logging never crashes or prevents main operations from completing
- [ ] All authenticated user actions are properly logged without gaps
- [ ] User records are automatically synchronized from Clerk when needed
- [ ] No foreign key constraint violations occur in production
- [ ] Existing audit logs remain intact and queryable
- [ ] Performance impact is minimal (<50ms overhead per audit log)
- [ ] Solution works for all authentication flows (login, signup, API access)
- [ ] Admin dashboard displays audit logs with user information correctly
- [ ] Migration strategy handles existing audit logs with missing users
- [ ] Solution is compatible with future multi-tenancy requirements

### Business Value
- **Compliance**: Ensures complete audit trail for security and regulatory requirements
- **Debugging**: Enables troubleshooting user actions without data gaps
- **Security**: Tracks all user operations for security analysis and incident response
- **Reliability**: Prevents audit logging failures from impacting core features
- **Maintainability**: Removes technical debt from temporary workarounds

## Architecture Design

### Solution Comparison

#### Option A: Eager User Sync via Webhook (RECOMMENDED)
**Approach**: Enhance Clerk webhook to always create User record on user.created event before user can access application.

**Pros:**
- ✅ Guarantees User record exists before any audit logging
- ✅ No runtime performance overhead
- ✅ Maintains referential integrity
- ✅ Simple audit logging code (no try-catch needed)
- ✅ Works with existing foreign key constraints

**Cons:**
- ⚠️ Depends on webhook reliability (Clerk must deliver webhook before first login)
- ⚠️ Requires webhook endpoint to be highly available
- ⚠️ May have slight delay between signup and User record creation

**Risk Level**: Low

#### Option B: Lazy User Sync with Just-In-Time Creation
**Approach**: Check if User exists before audit logging; create if missing.

**Pros:**
- ✅ Self-healing - automatically fixes missing users
- ✅ No dependency on webhooks
- ✅ Works even if webhook fails

**Cons:**
- ⚠️ Performance overhead on every audit log (extra database query)
- ⚠️ Concurrent request race conditions (multiple simultaneous user creations)
- ⚠️ Complexity in audit logging code

**Risk Level**: Medium

#### Option C: Nullable Foreign Key with Loose Coupling
**Approach**: Make `userId` nullable in `AuditLog` table, accept orphaned audit logs.

**Pros:**
- ✅ Never crashes
- ✅ No performance overhead
- ✅ Simple implementation

**Cons:**
- ❌ Breaks referential integrity
- ❌ Orphaned audit logs can't be queried by user
- ❌ Loses user information if Clerk record deleted
- ❌ Violates audit logging best practices

**Risk Level**: High (not recommended)

#### Option D: Separate Clerk User ID Storage
**Approach**: Store `clerkUserId` string directly in `AuditLog` without foreign key, separate User table relationship.

**Pros:**
- ✅ Never crashes
- ✅ Always captures Clerk user ID
- ✅ No dependency on User table

**Cons:**
- ⚠️ Loses User table metadata (role, email, etc)
- ⚠️ Requires joins with Clerk API for user details
- ⚠️ Duplicates user identification across tables

**Risk Level**: Medium

### Recommended Solution: Hybrid Approach (A + B)

Combine **Option A (Webhook)** and **Option B (Just-In-Time)** for defense-in-depth:

1. **Primary**: Webhook creates User record eagerly
2. **Fallback**: Audit logger checks and creates User if missing (with caching to avoid repeated queries)
3. **Safety**: Try-catch remains but should never trigger

### How This Feature Fits Into Existing App Patterns

1. **Authentication Integration** (Pattern #16, #30): Enhances existing Clerk webhook at `/api/webhook/clerk`
2. **Database Sync Pattern** (Pattern #8-14): Follows two-stage approach - webhook primary, on-demand fallback
3. **Audit Logging Pattern** (Pattern #36): Improves existing audit system reliability
4. **Error Handling Pattern** (Pattern #38, #50): Graceful degradation with comprehensive error handling
5. **Caching Strategy** (Pattern #51-55): Uses LRU cache to optimize User existence checks

### Components/Services Created/Modified

**Modified:**
- `src/app/api/webhook/clerk/route.ts` - Enhance user.created handler to ensure User record
- `src/lib/audit.ts` - Add getOrCreateUser() helper with caching
- `src/app/api/sla/recalculate/route.ts` - Remove try-catch workarounds (no longer needed)
- `prisma/schema.prisma` - Add indexes for userId lookups (optimization)

**Created:**
- `src/lib/user-sync.ts` - User synchronization utilities (getOrCreateUser, syncUserFromClerk)
- `src/lib/user-sync-cache.ts` - LRU cache for User existence checks
- `prisma/migrations/20250129000001_audit_user_indexes.sql` - Add indexes for performance
- `src/app/api/webhook/clerk/__tests__/user-sync.test.ts` - Test webhook user creation
- `src/lib/__tests__/user-sync.test.ts` - Test just-in-time user creation

### Integration Points With Existing Systems

1. **Clerk Webhook System** (existing `/api/webhook/clerk`):
   - Handles user.created, user.updated, user.deleted events
   - Creates/updates/soft-deletes User records
   - Verifies webhook signature for security
   - Currently creates User records but may have reliability gaps

2. **Audit Logging System** (`lib/audit.ts`, Pattern #36):
   - Every API endpoint calls auditLogger.log()
   - Currently wrapped in try-catch due to FK constraint issues
   - Will use getOrCreateUser() before logging

3. **Authentication System** (`@clerk/nextjs/server`, Pattern #16):
   - All API routes call auth() to get userId
   - Provides userId for audit logging
   - userId is Clerk's internal ID

4. **User Management** (`prisma/schema.prisma` User model):
   - Stores user metadata (email, role, name)
   - Referenced by AuditLog, AnalysisExport, SystemSettings
   - Soft delete support (isDeleted, deletedAt fields)

5. **Database Layer** (Prisma ORM, Pattern #8-14):
   - Foreign key constraints enforce referential integrity
   - Indexes optimize User lookups
   - Transactions ensure atomic user creation

### Database Changes Required

#### Migration 1: Add User Sync Indexes (Performance)
**File**: `prisma/migrations/20250129000001_audit_user_indexes.sql`

```sql
-- Optimize User lookups by clerkUserId (most common query)
CREATE INDEX IF NOT EXISTS "users_clerk_user_id_idx"
  ON "User" ("clerkUserId")
  WHERE "isDeleted" = false;

-- Optimize audit log user lookups
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_event_type_idx"
  ON "audit_logs" ("user_id", "event_type", "created_at" DESC);

-- Optimize user existence checks
CREATE INDEX IF NOT EXISTS "users_clerk_user_id_is_deleted_idx"
  ON "User" ("clerkUserId", "isDeleted");
```

**Why these indexes:**
- `users_clerk_user_id_idx`: Fast lookup when converting Clerk userId to local User.id
- `audit_logs_user_id_event_type_idx`: Efficient audit log queries by user and event type
- `users_clerk_user_id_is_deleted_idx`: Optimizes WHERE clerkUserId = ? AND isDeleted = false

#### Schema Updates
**File**: `prisma/schema.prisma`

No schema changes required - existing User model already has:
- `clerkUserId` field (unique, indexed)
- `email`, `firstName`, `lastName`, `imageUrl` fields
- `role` field for authorization
- `isDeleted`, `deletedAt` for soft delete support

## Implementation Chunks

### Chunk 1: User Sync Utilities and Caching

**Type:** Backend
**Dependencies:** None
**Estimated Effort:** Small (1 day)

**Files to create:**
- `src/lib/user-sync.ts` - Core user synchronization logic
- `src/lib/user-sync-cache.ts` - LRU cache for User existence checks
- `src/lib/__tests__/user-sync.test.ts` - Unit tests for user sync

**Files to modify:**
- None (new utilities, no integration yet)

**Implementation Details:**

**1. User Sync Cache** (`user-sync-cache.ts`):
```typescript
import { LRUCache } from 'lru-cache'

// Cache User.id by clerkUserId to avoid repeated DB queries
// TTL: 5 minutes (users rarely deleted/updated)
// Max: 1000 entries (sufficient for most deployments)
export const userIdCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
})

// Cache negative results (user doesn't exist) with shorter TTL
// TTL: 30 seconds (allow quick retry if webhook delayed)
export const userNotFoundCache = new LRUCache<string, boolean>({
  max: 500,
  ttl: 1000 * 30, // 30 seconds
})

export function getCachedUserId(clerkUserId: string): string | null {
  return userIdCache.get(clerkUserId) || null
}

export function setCachedUserId(clerkUserId: string, userId: string): void {
  userIdCache.set(clerkUserId, userId)
  userNotFoundCache.delete(clerkUserId) // Clear negative cache
}

export function isUserNotFound(clerkUserId: string): boolean {
  return userNotFoundCache.get(clerkUserId) === true
}

export function setUserNotFound(clerkUserId: string): void {
  userNotFoundCache.set(clerkUserId, true)
}

export function invalidateUserCache(clerkUserId: string): void {
  userIdCache.delete(clerkUserId)
  userNotFoundCache.delete(clerkUserId)
}
```

**2. User Sync Logic** (`user-sync.ts`):
```typescript
import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger-pino'
import {
  getCachedUserId,
  setCachedUserId,
  isUserNotFound,
  setUserNotFound,
  invalidateUserCache,
} from './user-sync-cache'

export interface UserSyncResult {
  userId: string
  created: boolean
  source: 'cache' | 'database' | 'clerk'
}

/**
 * Get or create User record for Clerk user ID
 *
 * Flow:
 * 1. Check cache for existing User.id
 * 2. Query database for User record
 * 3. If not found, fetch from Clerk API and create User
 * 4. Cache result and return User.id
 *
 * @param clerkUserId - Clerk user ID from auth()
 * @param correlationId - For logging/tracing
 * @returns User.id from local database
 * @throws Error if Clerk user not found or creation fails
 */
export async function getOrCreateUser(
  clerkUserId: string,
  correlationId?: string
): Promise<UserSyncResult> {
  const startTime = Date.now()
  const context = { clerkUserId, correlationId }

  // Step 1: Check cache
  const cachedUserId = getCachedUserId(clerkUserId)
  if (cachedUserId) {
    logger.debug({ ...context, userId: cachedUserId, duration: Date.now() - startTime },
      'User ID found in cache')
    return { userId: cachedUserId, created: false, source: 'cache' }
  }

  // Don't retry if recently failed (avoid hammering Clerk API)
  if (isUserNotFound(clerkUserId)) {
    logger.warn({ ...context, duration: Date.now() - startTime },
      'User not found in recent check, skipping retry')
    throw new Error(`User not found: ${clerkUserId}`)
  }

  // Step 2: Query database
  let user = await prisma.user.findUnique({
    where: { clerkUserId, isDeleted: false },
    select: { id: true },
  })

  if (user) {
    logger.debug({ ...context, userId: user.id, duration: Date.now() - startTime },
      'User found in database')
    setCachedUserId(clerkUserId, user.id)
    return { userId: user.id, created: false, source: 'database' }
  }

  // Step 3: User not in database - fetch from Clerk and create
  logger.info({ ...context }, 'User not found in database, syncing from Clerk')

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId)

    user = await prisma.user.create({
      data: {
        clerkUserId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        imageUrl: clerkUser.imageUrl || null,
        role: (clerkUser.publicMetadata?.role as string) || 'user',
      },
      select: { id: true },
    })

    logger.info(
      { ...context, userId: user.id, duration: Date.now() - startTime },
      'User created from Clerk data'
    )

    setCachedUserId(clerkUserId, user.id)
    return { userId: user.id, created: true, source: 'clerk' }
  } catch (error) {
    logger.error({ ...context, error, duration: Date.now() - startTime },
      'Failed to sync user from Clerk')

    // Cache negative result to avoid repeated failures
    setUserNotFound(clerkUserId)

    throw new Error(`Failed to sync user from Clerk: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Sync user data from Clerk to local database
 * Used by webhook to ensure User record exists and is up-to-date
 */
export async function syncUserFromClerk(clerkUserId: string): Promise<string> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId)

  const user = await prisma.user.upsert({
    where: { clerkUserId: clerkUser.id },
    create: {
      clerkUserId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || null,
      role: (clerkUser.publicMetadata?.role as string) || 'user',
    },
    update: {
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || null,
      role: (clerkUser.publicMetadata?.role as string) || 'user',
      isDeleted: false, // Un-delete if was soft-deleted
      deletedAt: null,
    },
    select: { id: true },
  })

  // Invalidate cache to force fresh lookup
  invalidateUserCache(clerkUserId)

  logger.info({ clerkUserId, userId: user.id }, 'User synced from Clerk')

  return user.id
}
```

**Tests required:** Yes - Comprehensive unit tests

**Test Coverage:**
1. ✅ Cache hit returns cached User.id without database query
2. ✅ Database hit returns User.id and caches result
3. ✅ Missing user fetches from Clerk and creates User record
4. ✅ Clerk API failure throws error and caches negative result
5. ✅ Negative cache prevents repeated Clerk API calls
6. ✅ syncUserFromClerk creates new user if not exists
7. ✅ syncUserFromClerk updates existing user
8. ✅ syncUserFromClerk un-deletes soft-deleted user
9. ✅ Concurrent calls don't create duplicate users (race condition)

**Acceptance criteria:**
- [ ] getOrCreateUser returns existing User.id from cache in <1ms
- [ ] getOrCreateUser returns existing User.id from database in <10ms
- [ ] getOrCreateUser creates new user from Clerk in <200ms
- [ ] Cache prevents repeated database queries for same user
- [ ] Negative cache prevents repeated Clerk API calls for missing users
- [ ] Unit tests achieve >95% code coverage
- [ ] All error paths are tested and logged
- [ ] Concurrent request race conditions are handled

---

### Chunk 2: Enhanced Clerk Webhook User Sync

**Type:** Backend
**Dependencies:** Chunk 1
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- `src/app/api/webhook/clerk/__tests__/user-sync.test.ts` - Integration tests

**Files to modify:**
- `src/app/api/webhook/clerk/route.ts` - Use syncUserFromClerk in user.created handler

**Implementation Details:**

**Enhanced Webhook Handler** (`route.ts`):
```typescript
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { syncUserFromClerk } from '@/lib/user-sync'
import { logger } from '@/lib/logger-pino'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env')
  }

  // Get headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing svix headers', { status: 400 })
  }

  // Get body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    logger.error({ error: err }, 'Webhook signature verification failed')
    return new Response('Error: Verification failed', { status: 400 })
  }

  // Handle events
  const { id: clerkUserId } = evt.data
  const eventType = evt.type

  logger.info({ eventType, clerkUserId }, 'Clerk webhook received')

  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated':
        // Sync user to local database (create or update)
        const userId = await syncUserFromClerk(clerkUserId!)
        logger.info({ eventType, clerkUserId, userId }, 'User synced successfully')
        break

      case 'user.deleted':
        // Soft delete user
        await prisma.user.update({
          where: { clerkUserId: clerkUserId! },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        })
        logger.info({ eventType, clerkUserId }, 'User soft deleted')
        break

      default:
        logger.debug({ eventType, clerkUserId }, 'Unhandled webhook event')
    }

    return new Response('Webhook processed successfully', { status: 200 })
  } catch (error) {
    logger.error({ error, eventType, clerkUserId }, 'Webhook processing failed')
    // Return 200 to prevent Clerk from retrying (we log error for manual investigation)
    return new Response('Webhook received but processing failed', { status: 200 })
  }
}
```

**Tests required:** Yes - Integration tests

**Test Coverage:**
1. ✅ user.created event creates User record
2. ✅ user.updated event updates existing User record
3. ✅ user.updated event creates User if missing (idempotency)
4. ✅ user.deleted event soft-deletes User record
5. ✅ Invalid signature returns 400
6. ✅ Missing headers return 400
7. ✅ Unknown event types are logged but don't crash
8. ✅ Database errors are caught and logged

**Acceptance criteria:**
- [ ] user.created event always creates User record before user can access app
- [ ] user.updated event keeps User data in sync with Clerk
- [ ] user.deleted event soft-deletes User but preserves audit logs
- [ ] Webhook signature verification prevents unauthorized access
- [ ] All webhook processing errors are logged for debugging
- [ ] Webhook returns 200 even on processing errors (prevent Clerk retries)
- [ ] Integration tests cover all webhook event types
- [ ] Tests verify User cache is invalidated after sync

---

### Chunk 3: Integrate User Sync into Audit Logger

**Type:** Backend
**Dependencies:** Chunk 1, Chunk 2
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- `src/lib/__tests__/audit-with-user-sync.test.ts` - Test audit logging with user sync

**Files to modify:**
- `src/lib/audit.ts` - Use getOrCreateUser before logging
- `src/lib/__tests__/audit.test.ts` - Update existing tests

**Implementation Details:**

**Enhanced Audit Logger** (`audit.ts`):
```typescript
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger-pino'
import { getOrCreateUser } from '@/lib/user-sync'

export class AuditLogger {
  // ... existing code ...

  /**
   * Log an audit event with automatic user sync
   *
   * @param event - Audit event details
   * @throws Error if user sync fails (caller should handle gracefully)
   */
  async log(event: AuditLogEvent): Promise<void> {
    const startTime = Date.now()

    try {
      // Ensure User record exists for foreign key constraint
      const { userId } = await getOrCreateUser(event.userId, event.correlationId)

      // Create audit log with local User.id
      const auditLog = {
        userId, // Local User.id (not Clerk ID)
        eventType: event.eventType,
        severity: event.severity,
        resource: event.resource,
        action: event.action,
        details: event.details || {},
        success: event.success,
        errorMessage: event.errorMessage || null,
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        correlationId: event.correlationId || null,
        requestId: event.requestId || null,
        sessionId: event.sessionId || null,
      }

      // Add to buffer for batch insert
      this.buffer.push(auditLog)

      // Flush if buffer full
      if (this.buffer.length >= this.bufferSize) {
        await this.flush()
      }

      logger.debug(
        {
          eventType: event.eventType,
          userId,
          duration: Date.now() - startTime
        },
        'Audit event buffered'
      )
    } catch (error) {
      logger.error(
        {
          error,
          eventType: event.eventType,
          userId: event.userId,
          duration: Date.now() - startTime,
        },
        'Failed to log audit event'
      )

      // Re-throw error so caller can handle (e.g., try-catch in API routes)
      throw error
    }
  }

  // ... existing flush() method ...
}

// Singleton instance
export const auditLogger = new AuditLogger()
```

**Tests required:** Yes - Update existing tests + new integration tests

**Test Coverage:**
1. ✅ Audit log succeeds when User exists in database
2. ✅ Audit log succeeds when User exists in cache
3. ✅ Audit log succeeds when User created from Clerk (just-in-time)
4. ✅ Audit log fails gracefully when Clerk API unavailable
5. ✅ Multiple audit logs for same user use cached User.id
6. ✅ Audit log buffer flush handles errors gracefully
7. ✅ Concurrent audit logs don't create duplicate Users
8. ✅ Audit log performance meets <50ms requirement

**Acceptance criteria:**
- [ ] Audit logging never throws foreign key constraint error
- [ ] User sync adds <10ms overhead for cached users
- [ ] User sync adds <50ms overhead for database lookups
- [ ] User sync adds <200ms overhead for Clerk API calls
- [ ] Failed user sync is logged but doesn't crash application
- [ ] Audit logs are created with correct local User.id
- [ ] All existing audit log tests still pass
- [ ] New integration tests verify end-to-end user sync flow

---

### Chunk 4: Remove Temporary Workarounds

**Type:** Backend
**Dependencies:** Chunk 1, Chunk 2, Chunk 3
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- None

**Files to modify:**
- `src/app/api/sla/recalculate/route.ts` - Remove try-catch around audit logs
- `src/app/api/customer-analysis/worker/route.ts` - Remove try-catch (if exists)
- `src/app/api/settings/sla/route.ts` - Remove try-catch (if exists)
- Any other API routes with audit log try-catch workarounds

**Implementation Details:**

**Before** (Temporary Workaround):
```typescript
// src/app/api/sla/recalculate/route.ts
try {
  await auditLogger.log({
    eventType: AuditEventType.SETTINGS_CHANGED,
    userId,
    severity: AuditSeverity.MEDIUM,
    resource: 'sla_metrics',
    action: 'recalculate_started',
    details: { startDate, endDate, chatId, limit },
    success: true,
  })
} catch (auditError) {
  console.error('Failed to log recalculation start:', auditError)
}
```

**After** (Proper Solution):
```typescript
// src/app/api/sla/recalculate/route.ts
await auditLogger.log({
  eventType: AuditEventType.SETTINGS_CHANGED,
  userId,
  severity: AuditSeverity.MEDIUM,
  resource: 'sla_metrics',
  action: 'recalculate_started',
  details: { startDate, endDate, chatId, limit },
  success: true,
})
```

**Optional: Keep try-catch for graceful degradation** (if audit logging is non-critical):
```typescript
// Only if business requirements allow audit logging failures
try {
  await auditLogger.log({ ... })
} catch (auditError) {
  // Log error but continue operation
  logger.error({ error: auditError }, 'Audit logging failed but continuing operation')
}
```

**Search Strategy:**
1. Search codebase for `auditLogger.log` wrapped in try-catch:
   ```bash
   git grep -A 5 "try {" | grep -B 2 "auditLogger.log"
   ```
2. Review each location and determine if try-catch is temporary workaround or intentional
3. Remove workarounds, keep intentional graceful degradation if business requirements allow

**Tests required:** Yes - Regression testing

**Test Coverage:**
1. ✅ All API routes with audit logging still work correctly
2. ✅ Audit logs are created successfully after workaround removal
3. ✅ No foreign key constraint violations occur in production
4. ✅ All existing tests still pass after workaround removal

**Acceptance criteria:**
- [ ] All try-catch workarounds around audit logging are removed (or justified)
- [ ] No console.error calls for audit logging failures (use logger instead)
- [ ] All API routes successfully create audit logs
- [ ] Integration tests verify audit logs are created without errors
- [ ] Regression test suite passes (all existing tests)
- [ ] No foreign key constraint errors in production after deployment

---

### Chunk 5: Add Performance Indexes

**Type:** Backend (Database)
**Dependencies:** None (can run in parallel with other chunks)
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- `prisma/migrations/20250129000001_audit_user_indexes/migration.sql`

**Files to modify:**
- None

**Implementation Details:**

**Migration SQL**:
```sql
-- Migration: Add indexes for user sync performance
-- Created: 2025-01-29
-- Purpose: Optimize User lookups for audit logging with user sync

BEGIN;

-- Index 1: Optimize User lookups by clerkUserId (most common query in getOrCreateUser)
-- Used by: lib/user-sync.ts getOrCreateUser()
-- Query: SELECT id FROM User WHERE clerkUserId = ? AND isDeleted = false
CREATE INDEX IF NOT EXISTS "users_clerk_user_id_active_idx"
  ON "User" ("clerkUserId")
  WHERE "isDeleted" = false;

-- Index 2: Optimize audit log queries by user and event type
-- Used by: Admin dashboard audit log viewer
-- Query: SELECT * FROM audit_logs WHERE user_id = ? AND event_type = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_event_type_created_idx"
  ON "audit_logs" ("user_id", "event_type", "created_at" DESC);

-- Index 3: Optimize user existence checks with soft delete filter
-- Used by: lib/user-sync.ts getOrCreateUser() and webhook handlers
-- Query: SELECT id FROM User WHERE clerkUserId = ? AND isDeleted = false
CREATE INDEX IF NOT EXISTS "users_clerk_user_id_is_deleted_idx"
  ON "User" ("clerkUserId", "isDeleted");

-- Index 4: Optimize audit log queries by correlation ID (distributed tracing)
-- Used by: Debugging and tracing related operations
-- Query: SELECT * FROM audit_logs WHERE correlation_id = ? ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS "audit_logs_correlation_id_created_idx"
  ON "audit_logs" ("correlation_id", "created_at" ASC)
  WHERE "correlation_id" IS NOT NULL;

COMMIT;

-- Verify indexes were created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE
  schemaname = 'public'
  AND (
    indexname LIKE '%users_clerk_user_id%'
    OR indexname LIKE '%audit_logs_user_id%'
    OR indexname LIKE '%audit_logs_correlation%'
  )
ORDER BY tablename, indexname;
```

**Performance Testing:**
```sql
-- Before migration: Check query plans
EXPLAIN ANALYZE
SELECT id FROM "User" WHERE "clerkUserId" = 'user_123' AND "isDeleted" = false;

EXPLAIN ANALYZE
SELECT * FROM "audit_logs" WHERE "user_id" = 'uuid' AND "event_type" = 'SETTINGS_CHANGED';

-- After migration: Verify indexes are used
EXPLAIN ANALYZE
SELECT id FROM "User" WHERE "clerkUserId" = 'user_123' AND "isDeleted" = false;
-- Expected: Index Scan using users_clerk_user_id_active_idx

EXPLAIN ANALYZE
SELECT * FROM "audit_logs" WHERE "user_id" = 'uuid' AND "event_type" = 'SETTINGS_CHANGED';
-- Expected: Index Scan using audit_logs_user_id_event_type_created_idx
```

**Tests required:** Yes - Migration testing

**Test Coverage:**
1. ✅ Migration runs successfully on development database
2. ✅ Migration runs successfully on production database (dry-run)
3. ✅ Indexes are created with correct names and definitions
4. ✅ Query plans use new indexes (EXPLAIN ANALYZE verification)
5. ✅ Performance improves for User lookups (<10ms target)
6. ✅ Performance improves for audit log queries
7. ✅ No downtime during migration (indexes created with IF NOT EXISTS)
8. ✅ Rollback migration drops indexes successfully

**Acceptance criteria:**
- [ ] Migration runs without errors in development
- [ ] Migration runs without errors in staging
- [ ] User lookups by clerkUserId use index (verify with EXPLAIN)
- [ ] Audit log queries by user_id + event_type use index
- [ ] User lookups improve from baseline to <10ms (95th percentile)
- [ ] No application downtime during migration
- [ ] Rollback plan tested and documented
- [ ] Migration added to deployment checklist

---

### Chunk 6: Documentation and Migration Guide

**Type:** Documentation
**Dependencies:** All implementation chunks (1-5)
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- `docs/architecture/audit-logging-user-sync.md` - Architecture documentation
- `docs/deployment/feature-014-migration-guide.md` - Deployment guide

**Files to modify:**
- `docs/sla-calculation-guide.md` - Remove notes about audit logging workarounds
- `README.md` - Update deployment instructions (if applicable)

**Implementation Details:**

**Architecture Documentation** (`docs/architecture/audit-logging-user-sync.md`):
```markdown
# Audit Logging User Synchronization

## Overview
This document describes the audit logging user synchronization system that ensures all audit logs can be created without foreign key constraint violations.

## Problem Statement
[Copy from feature requirements]

## Solution Architecture
[Describe hybrid webhook + just-in-time approach]

## Components
### User Sync Cache
[Document LRU cache design and TTL strategy]

### getOrCreateUser Function
[Document flow, error handling, performance characteristics]

### Clerk Webhook Handler
[Document enhanced webhook processing]

### Audit Logger Integration
[Document how audit logger uses user sync]

## Performance Characteristics
- Cache hit: <1ms
- Database lookup: <10ms
- Clerk API sync: <200ms
- Overall audit log overhead: <50ms (95th percentile)

## Error Handling
[Document error scenarios and handling]

## Monitoring
[Document metrics and alerts for user sync]

## Testing
[Document test strategy and coverage]

## Deployment
[Link to migration guide]
```

**Migration Guide** (`docs/deployment/feature-014-migration-guide.md`):
```markdown
# Feature 014: Audit Logging User Sync - Migration Guide

## Pre-Deployment Checklist
- [ ] Verify Clerk webhook is configured and healthy
- [ ] Backup audit_logs and User tables
- [ ] Run migration in staging environment
- [ ] Verify indexes are created correctly
- [ ] Test audit logging end-to-end in staging
- [ ] Review monitoring dashboards are ready

## Deployment Steps

### Step 1: Deploy Database Migration
```bash
npm run prisma:migrate:deploy
```

Verify indexes created:
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('User', 'audit_logs')
ORDER BY tablename, indexname;
```

### Step 2: Deploy Application Code
```bash
git pull origin main
npm run build
pm2 reload all
```

### Step 3: Verify Clerk Webhook
```bash
# Test webhook endpoint
curl -X POST https://your-app.com/api/webhook/clerk \
  -H "svix-id: test" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: test"
```

### Step 4: Monitor Audit Logging
- Watch logs for user sync activity
- Verify no foreign key constraint errors
- Check audit log creation success rate

### Step 5: Remove Workarounds (Optional)
- Deploy code with try-catch workarounds removed
- Monitor for any audit logging failures
- Rollback if issues detected

## Rollback Plan
[Document rollback steps]

## Post-Deployment Verification
- [ ] Audit logs are created successfully
- [ ] User sync cache is working (check metrics)
- [ ] No foreign key constraint errors in logs
- [ ] Performance meets <50ms overhead requirement
- [ ] Webhook processing is healthy

## Troubleshooting
[Common issues and solutions]
```

**Tests required:** No (documentation only)

**Acceptance criteria:**
- [ ] Architecture documentation is complete and accurate
- [ ] Migration guide includes all deployment steps
- [ ] Rollback plan is documented and tested
- [ ] Troubleshooting section covers common issues
- [ ] Documentation reviewed by at least one other engineer
- [ ] SLA calculation guide updated to remove workaround notes

## Testing Strategy

### Unit Tests
**Location**: `src/lib/__tests__/user-sync.test.ts`, `src/lib/__tests__/audit-with-user-sync.test.ts`

**Coverage**:
- User sync cache hit/miss scenarios
- getOrCreateUser with existing user (cache, database)
- getOrCreateUser with missing user (Clerk API sync)
- getOrCreateUser error handling (Clerk API failure, database failure)
- Negative cache behavior (avoid repeated failures)
- Cache invalidation
- Concurrent request handling (race conditions)
- syncUserFromClerk create/update/un-delete

**Tools**: Jest with Prisma mock, Clerk client mock

**Success Criteria**: >95% code coverage, all edge cases tested

### Integration Tests
**Location**: `src/app/api/webhook/clerk/__tests__/user-sync.test.ts`

**Coverage**:
- Webhook signature verification
- user.created event creates User record
- user.updated event updates User record
- user.deleted event soft-deletes User record
- Audit logging after webhook user sync
- End-to-end flow: signup → webhook → audit log

**Tools**: Jest with real Prisma (test database), Clerk webhook mock

**Success Criteria**: All webhook events handled correctly, audit logs created

### API Tests
**Location**: `src/app/api/sla/recalculate/__tests__/route.test.ts` (update existing)

**Coverage**:
- API route audit logging with user sync
- Performance overhead of user sync (<50ms)
- Concurrent API requests with same user
- API route behavior when user sync fails

**Tools**: Jest with API route testing utilities

**Success Criteria**: All API routes create audit logs without errors

### Performance Tests
**Location**: `k6/load-test-audit-logging.js` (new)

**Coverage**:
- Audit logging throughput (with user sync)
- Cache effectiveness (hit rate >90%)
- User sync latency (p95 <50ms, p99 <200ms)
- Concurrent user operations

**Tools**: k6 for load testing, Grafana for visualization

**Success Criteria**:
- p95 latency <50ms
- p99 latency <200ms
- Cache hit rate >90%
- No foreign key constraint errors under load

### Migration Tests
**Location**: `prisma/migrations/__tests__/20250129000001_test.ts` (new)

**Coverage**:
- Migration runs without errors
- Indexes are created correctly
- Query plans use new indexes
- Rollback migration works

**Tools**: Jest with test database, PostgreSQL EXPLAIN ANALYZE

**Success Criteria**: Migration completes successfully, indexes improve performance

## Database Changes

### Migration: 20250129000001_audit_user_indexes

**Type**: DDL (index creation only, no schema changes)
**Risk**: Low (non-blocking, IF NOT EXISTS)
**Downtime**: None (indexes created online)

**Changes**:
- Add index: `users_clerk_user_id_active_idx` (partial index with WHERE isDeleted = false)
- Add index: `audit_logs_user_id_event_type_created_idx` (composite index for common queries)
- Add index: `users_clerk_user_id_is_deleted_idx` (composite index for existence checks)
- Add index: `audit_logs_correlation_id_created_idx` (partial index for distributed tracing)

**Performance Impact**: Positive (faster User lookups, faster audit log queries)
**Disk Space**: ~10-50 MB per index (depends on data volume)

**Rollback**:
```sql
DROP INDEX IF EXISTS "users_clerk_user_id_active_idx";
DROP INDEX IF EXISTS "audit_logs_user_id_event_type_created_idx";
DROP INDEX IF EXISTS "users_clerk_user_id_is_deleted_idx";
DROP INDEX IF EXISTS "audit_logs_correlation_id_created_idx";
```

## API Changes

### No API Contract Changes
This feature does not change any API endpoints, request/response formats, or client-facing behavior.

**Affected Internal APIs**:
- `lib/audit.ts` - AuditLogger.log() now calls getOrCreateUser internally
- `lib/user-sync.ts` - New internal API for user synchronization
- `app/api/webhook/clerk/route.ts` - Enhanced webhook handler (no contract change)

**Backward Compatibility**: ✅ Full backward compatibility
- Existing audit log calls work without code changes
- Webhook payload format unchanged
- Database schema unchanged (only indexes added)

## Integration Points

### 1. Clerk Webhook System
**Integration**: Enhanced webhook handler calls syncUserFromClerk()
**Impact**: User records created earlier in authentication flow
**Risk**: Low (idempotent upsert, handles duplicates)
**Testing**: Integration tests verify webhook → user sync → audit log flow

### 2. Audit Logging System
**Integration**: AuditLogger.log() calls getOrCreateUser() before creating log
**Impact**: Performance overhead <50ms (cached users <10ms)
**Risk**: Low (graceful degradation, errors logged)
**Testing**: Unit tests verify user sync integration, performance tests verify latency

### 3. Authentication System
**Integration**: No changes (still uses auth() from Clerk)
**Impact**: None
**Risk**: None

### 4. Database Layer
**Integration**: New indexes improve query performance
**Impact**: Faster User lookups, faster audit log queries
**Risk**: Low (indexes created with IF NOT EXISTS, no locking)
**Testing**: Migration tests verify index creation and performance

### 5. Caching System
**Integration**: New user sync cache (LRU) separate from existing caches
**Impact**: Reduced database load for repeated User lookups
**Risk**: Low (TTL ensures cache freshness)
**Testing**: Unit tests verify cache behavior and invalidation

## Rollback Plan

### Scenario 1: User Sync Performance Issues
**Symptoms**: Audit logging >50ms overhead, database slow queries
**Rollback Steps**:
1. Revert audit.ts to use try-catch workaround (1 minute deployment)
2. Investigate user sync cache effectiveness
3. Fix performance issue and redeploy

**Data Impact**: None (workaround already tested)
**Downtime**: None (hot deploy)

### Scenario 2: Clerk API Unavailability
**Symptoms**: getOrCreateUser fails frequently, audit logging errors
**Rollback Steps**:
1. Negative cache prevents repeated failures (automatic)
2. If persistent, revert audit.ts to use try-catch workaround
3. Investigate Clerk API health

**Data Impact**: Audit logging gaps (acceptable for temporary outage)
**Downtime**: None

### Scenario 3: Database Migration Issues
**Symptoms**: Migration fails, indexes not created
**Rollback Steps**:
1. Rollback migration: `npm run prisma:migrate:rollback`
2. Drop indexes manually if needed (see Database Changes section)
3. Verify application still works with old indexes

**Data Impact**: None (indexes optional, app works without them)
**Downtime**: None (indexes created online)

### Scenario 4: Webhook Processing Errors
**Symptoms**: user.created events not creating User records
**Rollback Steps**:
1. Just-in-time user sync (getOrCreateUser) handles missing users automatically
2. Investigate webhook logs for errors
3. Fix webhook handler and redeploy

**Data Impact**: None (just-in-time sync ensures User records created)
**Downtime**: None

### Complete Rollback (Nuclear Option)
If all else fails, revert entire feature:
1. Revert git commit: `git revert <commit-hash>`
2. Rollback database migration: `npm run prisma:migrate:rollback`
3. Deploy reverted code
4. Verify audit logging works with try-catch workarounds

**Data Impact**: None (reverts to previous working state)
**Downtime**: <5 minutes (deployment time)

## Documentation Updates

### 1. Architecture Documentation
**File**: `docs/architecture/audit-logging-user-sync.md` (new)
**Content**:
- Solution architecture and design decisions
- Component descriptions (cache, user sync, audit logger)
- Performance characteristics and SLAs
- Error handling and monitoring

### 2. Deployment Guide
**File**: `docs/deployment/feature-014-migration-guide.md` (new)
**Content**:
- Pre-deployment checklist
- Step-by-step deployment instructions
- Verification steps
- Rollback procedures
- Troubleshooting guide

### 3. API Documentation
**File**: `docs/api/audit-logging.md` (update)
**Changes**:
- Document user sync behavior
- Update performance characteristics
- Add troubleshooting section for user sync errors

### 4. SLA Calculation Guide
**File**: `docs/sla-calculation-guide.md` (update)
**Changes**:
- Remove notes about audit logging workarounds (lines 850-860)
- Update recalculation section to reflect reliable audit logging
- Add note about improved audit trail completeness

### 5. README
**File**: `README.md` (update if needed)
**Changes**:
- Update deployment instructions to include new migration
- Add note about Clerk webhook requirement for audit logging

## Success Criteria

### Functional Success Criteria
- ✅ Audit logging never fails due to foreign key constraint violations
- ✅ All authenticated user actions are logged to audit trail
- ✅ User records are automatically synchronized from Clerk
- ✅ Webhook processing creates User records before first login
- ✅ Just-in-time user sync handles missing User records gracefully
- ✅ Soft-deleted users can be un-deleted via webhook
- ✅ Audit logs are queryable by user with correct User.id references

### Performance Success Criteria
- ✅ Audit logging overhead <50ms (p95) with user sync
- ✅ Cached user lookups <10ms (p99)
- ✅ Database user lookups <50ms (p99)
- ✅ Clerk API user sync <200ms (p99)
- ✅ User sync cache hit rate >90% in steady state
- ✅ No performance regression for existing audit logging

### Reliability Success Criteria
- ✅ Zero foreign key constraint errors in production (24h after deployment)
- ✅ Audit log creation success rate >99.9%
- ✅ User sync failure rate <0.1%
- ✅ Webhook processing success rate >99%
- ✅ No duplicate User records created (race condition handling)

### Testing Success Criteria
- ✅ Unit test coverage >95% for user sync code
- ✅ Integration tests cover all webhook event types
- ✅ Performance tests verify <50ms overhead
- ✅ Migration tests verify index creation and performance
- ✅ All existing tests continue to pass (regression)

### Documentation Success Criteria
- ✅ Architecture documentation complete and accurate
- ✅ Deployment guide includes all steps and rollback procedures
- ✅ API documentation updated with user sync behavior
- ✅ SLA guide updated to remove workaround notes
- ✅ Documentation reviewed by at least one engineer

### Operational Success Criteria
- ✅ No production incidents related to audit logging (1 week after deployment)
- ✅ No emergency rollbacks required
- ✅ Monitoring dashboards show healthy user sync metrics
- ✅ Support tickets related to audit logging reduced to zero
- ✅ Compliance audit trail is complete and accurate

## Risk Assessment

### High Impact Risks
**None identified** - This feature improves reliability without introducing new high-impact risks.

### Medium Impact Risks

**Risk 1: Clerk API Unavailability**
- **Impact**: User sync fails, audit logging may fail for new users
- **Likelihood**: Low (Clerk has 99.99% uptime SLA)
- **Mitigation**:
  - Negative cache prevents repeated failures
  - Try-catch can remain for graceful degradation
  - Just-in-time sync retries later
- **Detection**: Monitor Clerk API health, user sync failure rate
- **Recovery**: Automatic via just-in-time sync once Clerk recovers

**Risk 2: Performance Degradation**
- **Impact**: Audit logging >50ms overhead impacts API response times
- **Likelihood**: Low (cache hit rate expected >90%)
- **Mitigation**:
  - LRU cache reduces database queries
  - Indexes optimize database lookups
  - Performance tests validate <50ms overhead
- **Detection**: Monitor audit logging latency (p95, p99)
- **Recovery**: Revert to try-catch workaround if needed

### Low Impact Risks

**Risk 3: Cache Memory Usage**
- **Impact**: User sync cache consumes additional memory
- **Likelihood**: Medium (1000 entries ~1-2 MB)
- **Mitigation**: LRU cache with max size limit (1000 entries)
- **Detection**: Monitor application memory usage
- **Recovery**: Reduce cache size if memory becomes concern

**Risk 4: Database Index Storage**
- **Impact**: New indexes consume disk space (~10-50 MB per index)
- **Likelihood**: High (expected)
- **Mitigation**: Indexes improve performance, worth storage cost
- **Detection**: Monitor database disk usage
- **Recovery**: Drop indexes if storage becomes critical (app still works)

**Risk 5: Webhook Delivery Delays**
- **Impact**: User record not created before first login, just-in-time sync triggered
- **Likelihood**: Low (Clerk webhooks typically <1s delivery)
- **Mitigation**: Just-in-time sync handles delayed webhooks automatically
- **Detection**: Monitor user sync source (cache/database/clerk)
- **Recovery**: Automatic via just-in-time sync

**Risk 6: Race Conditions (Concurrent User Creation)**
- **Impact**: Multiple requests try to create same User record simultaneously
- **Likelihood**: Very Low (Prisma handles unique constraints)
- **Mitigation**:
  - Database unique constraint on clerkUserId prevents duplicates
  - Prisma throws error, caller retries lookup
- **Detection**: Monitor unique constraint violations in logs
- **Recovery**: Automatic retry succeeds (user created by first request)

## Timeline and Milestones

### Week 1: Core Implementation
- **Days 1-2**: Chunk 1 - User sync utilities and caching
  - Implement user-sync.ts and user-sync-cache.ts
  - Write comprehensive unit tests (>95% coverage)
  - Code review and iteration
- **Day 3**: Chunk 2 - Enhanced Clerk webhook
  - Integrate syncUserFromClerk into webhook handler
  - Write integration tests for all webhook events
  - Test webhook processing end-to-end
- **Day 4**: Chunk 3 - Audit logger integration
  - Integrate getOrCreateUser into AuditLogger
  - Update existing audit tests
  - Write new integration tests
- **Day 5**: Chunk 4 - Remove workarounds
  - Search codebase for audit logging try-catch blocks
  - Remove temporary workarounds
  - Run full regression test suite

### Week 2: Database and Documentation
- **Day 1**: Chunk 5 - Performance indexes
  - Create database migration
  - Test migration in development and staging
  - Verify query plans use new indexes
  - Performance testing (k6 load tests)
- **Day 2**: Chunk 6 - Documentation
  - Write architecture documentation
  - Write deployment/migration guide
  - Update SLA calculation guide
  - Documentation review
- **Days 3-5**: Testing and Staging
  - Deploy to staging environment
  - Run full test suite (unit, integration, performance)
  - Manual QA testing
  - Performance monitoring and validation

### Week 3: Production Deployment
- **Day 1**: Production deployment preparation
  - Final staging validation
  - Review deployment checklist
  - Prepare rollback procedures
- **Day 2**: Production deployment
  - Deploy database migration
  - Deploy application code
  - Monitor for issues (4-hour observation window)
- **Days 3-5**: Post-deployment monitoring
  - Monitor audit logging success rate
  - Monitor user sync performance metrics
  - Monitor Clerk webhook processing
  - Address any issues that arise

### Milestones
- ✅ **M1**: Core user sync implementation complete (End of Week 1, Day 2)
- ✅ **M2**: Audit logger integration complete (End of Week 1, Day 4)
- ✅ **M3**: All workarounds removed, tests passing (End of Week 1, Day 5)
- ✅ **M4**: Database migration and performance validated (End of Week 2, Day 1)
- ✅ **M5**: Documentation complete and reviewed (End of Week 2, Day 2)
- ✅ **M6**: Staging deployment successful (End of Week 2, Day 5)
- ✅ **M7**: Production deployment successful (Week 3, Day 2)
- ✅ **M8**: Post-deployment monitoring complete, no issues (Week 3, Day 5)

## Dependencies and Prerequisites

### External Dependencies
- **Clerk API**: User data source for syncUserFromClerk()
  - Version: Latest stable (@clerk/nextjs ^5.x)
  - SLA: 99.99% uptime
  - Fallback: Just-in-time sync handles temporary outages
- **Clerk Webhook**: User event notifications (user.created, user.updated, user.deleted)
  - Endpoint: `/api/webhook/clerk`
  - Must be configured in Clerk dashboard
  - Verification: CLERK_WEBHOOK_SECRET environment variable

### Internal Dependencies
- **Prisma ORM**: Database access layer
  - Version: 5.x or later
  - Required for User upserts and audit log creation
- **PostgreSQL**: Database
  - Version: 12.x or later (for partial indexes)
  - Disk space: +50-200 MB for indexes
- **Pino Logger**: Structured logging
  - Required for user sync debugging and monitoring
- **LRU Cache**: Memory caching library
  - Version: lru-cache ^10.x
  - Memory: ~1-2 MB for user sync cache

### Configuration Prerequisites
- **Environment Variables**:
  - `DATABASE_URL` - PostgreSQL connection string (existing)
  - `CLERK_SECRET_KEY` - Clerk API secret (existing)
  - `CLERK_WEBHOOK_SECRET` - Webhook verification (existing)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key (existing)
- **Clerk Dashboard Configuration**:
  - Webhook endpoint configured: `https://your-app.com/api/webhook/clerk`
  - Webhook events enabled: user.created, user.updated, user.deleted
  - Webhook secret configured and matches environment variable
- **Database Permissions**:
  - CREATE INDEX permission (for migration)
  - INSERT/UPDATE/SELECT permissions on User and audit_logs tables

### Team Prerequisites
- **Code Review**: At least one engineer must review all code changes
- **Testing**: QA engineer (or dev) must validate staging deployment
- **Deployment**: DevOps/SRE must approve production deployment
- **Documentation**: Technical writer (or dev) must review documentation

## Monitoring and Alerting

### Metrics to Track

**User Sync Metrics**:
- `user_sync.cache_hit_rate` - Percentage of User lookups from cache (target: >90%)
- `user_sync.database_lookup_count` - Number of database User lookups per minute
- `user_sync.clerk_api_call_count` - Number of Clerk API calls for user sync per minute
- `user_sync.user_created_count` - Number of new Users created via just-in-time sync
- `user_sync.latency_p95` - 95th percentile latency of getOrCreateUser() (target: <50ms)
- `user_sync.latency_p99` - 99th percentile latency of getOrCreateUser() (target: <200ms)
- `user_sync.error_rate` - Percentage of user sync failures (target: <0.1%)

**Audit Logging Metrics**:
- `audit_log.creation_success_rate` - Percentage of successful audit log creations (target: >99.9%)
- `audit_log.creation_error_count` - Number of audit log creation errors per minute (target: 0)
- `audit_log.foreign_key_violation_count` - FK constraint violations per hour (target: 0)
- `audit_log.latency_p95` - 95th percentile audit log creation time (target: <50ms)
- `audit_log.buffer_size` - Current audit log buffer size
- `audit_log.flush_frequency` - Audit log buffer flushes per minute

**Webhook Metrics**:
- `webhook.clerk.processing_success_rate` - Webhook processing success rate (target: >99%)
- `webhook.clerk.user_created_count` - user.created events processed per hour
- `webhook.clerk.user_updated_count` - user.updated events processed per hour
- `webhook.clerk.user_deleted_count` - user.deleted events processed per hour
- `webhook.clerk.processing_latency_p95` - Webhook processing time (target: <500ms)
- `webhook.clerk.error_count` - Webhook processing errors per hour (target: <5)

### Alerts to Configure

**Critical Alerts** (Page on-call):
- `audit_log.foreign_key_violation_count > 0` in last 5 minutes
  - **Impact**: Audit logging failing, compliance risk
  - **Action**: Check User table sync, investigate Clerk webhook health
- `audit_log.creation_success_rate < 95%` in last 15 minutes
  - **Impact**: High audit log failure rate
  - **Action**: Check user sync errors, database health, Clerk API status

**Warning Alerts** (Slack notification):
- `user_sync.error_rate > 1%` in last 15 minutes
  - **Impact**: User sync failing more than expected
  - **Action**: Check Clerk API health, review error logs
- `user_sync.cache_hit_rate < 80%` in last 30 minutes
  - **Impact**: Cache not effective, more database queries
  - **Action**: Review cache TTL, check cache invalidation frequency
- `user_sync.latency_p95 > 100ms` in last 15 minutes
  - **Impact**: User sync slower than expected
  - **Action**: Check database query performance, Clerk API latency
- `webhook.clerk.processing_success_rate < 95%` in last 1 hour
  - **Impact**: Webhook events not processed reliably
  - **Action**: Check webhook handler errors, verify CLERK_WEBHOOK_SECRET

**Info Alerts** (Dashboard only):
- `user_sync.clerk_api_call_count > 100` per minute
  - **Info**: High just-in-time sync rate, webhook may be delayed
  - **Action**: Monitor, no immediate action unless persistent
- `webhook.clerk.error_count > 10` per hour
  - **Info**: Some webhook processing errors
  - **Action**: Review error logs, check for patterns

### Dashboards

**User Sync Dashboard** (Grafana):
- Panel 1: User sync cache hit rate (line chart, 24h)
- Panel 2: User sync latency (p50, p95, p99 line charts)
- Panel 3: User sync sources (pie chart: cache/database/clerk)
- Panel 4: User sync error rate (line chart with alert threshold)
- Panel 5: Clerk API call rate (line chart)

**Audit Logging Dashboard** (Grafana):
- Panel 1: Audit log creation success rate (line chart, 24h)
- Panel 2: Audit log creation latency (p50, p95, p99)
- Panel 3: Audit log error count by type (stacked bar chart)
- Panel 4: Foreign key violation count (line chart, should be 0)
- Panel 5: Audit log buffer size and flush frequency

**Webhook Dashboard** (Grafana):
- Panel 1: Webhook event processing rate by type (stacked area chart)
- Panel 2: Webhook processing success rate (line chart)
- Panel 3: Webhook processing latency (p50, p95, p99)
- Panel 4: Webhook error count (line chart with alert threshold)
- Panel 5: Recent webhook errors (logs panel)

### Logging

**User Sync Logs**:
```typescript
// Success logs (debug level)
logger.debug({ clerkUserId, userId, source: 'cache', duration: 2 }, 'User ID found in cache')
logger.debug({ clerkUserId, userId, source: 'database', duration: 15 }, 'User found in database')
logger.info({ clerkUserId, userId, source: 'clerk', duration: 180, created: true }, 'User created from Clerk data')

// Error logs (error level)
logger.error({ clerkUserId, error, duration: 250 }, 'Failed to sync user from Clerk')
logger.error({ clerkUserId, error }, 'User not found and sync failed')
```

**Audit Logging Logs**:
```typescript
// Success logs (debug level)
logger.debug({ eventType, userId, duration: 25 }, 'Audit event buffered')
logger.info({ eventCount: 50, duration: 120 }, 'Audit log buffer flushed')

// Error logs (error level)
logger.error({ eventType, userId, error, duration: 35 }, 'Failed to log audit event')
logger.error({ eventCount: 50, error }, 'Failed to flush audit log buffer')
```

**Webhook Logs**:
```typescript
// Success logs (info level)
logger.info({ eventType: 'user.created', clerkUserId, userId }, 'User synced successfully')
logger.info({ eventType: 'user.updated', clerkUserId, userId }, 'User updated successfully')
logger.info({ eventType: 'user.deleted', clerkUserId }, 'User soft deleted')

// Error logs (error level)
logger.error({ eventType, clerkUserId, error }, 'Webhook processing failed')
logger.error({ error }, 'Webhook signature verification failed')
```

---

## Notes for Implementation

### Performance Optimization Tips
1. **Cache Warming**: Consider pre-warming user sync cache on application startup with recently active users
2. **Batch Processing**: If creating many audit logs in a loop, consider batching User lookups
3. **Index Maintenance**: Monitor index bloat, consider periodic REINDEX if performance degrades
4. **Connection Pooling**: Ensure Prisma connection pool sized appropriately for increased database queries

### Security Considerations
1. **Clerk User Data**: Treat Clerk user data as PII, ensure GDPR compliance
2. **Audit Log Sensitivity**: Audit logs may contain sensitive data, ensure proper access controls
3. **Webhook Verification**: Always verify webhook signatures to prevent unauthorized user creation
4. **Rate Limiting**: Consider rate limiting user sync operations to prevent abuse

### Maintenance Tasks
1. **Weekly**: Review user sync error logs for patterns
2. **Monthly**: Analyze cache hit rates and adjust TTL if needed
3. **Quarterly**: Review audit log storage growth, plan archival strategy
4. **Yearly**: Review user sync architecture for scalability improvements

### Future Enhancements
1. **User Sync Queue**: For high-volume deployments, consider async user sync queue
2. **Distributed Cache**: Replace LRU cache with Redis for multi-instance deployments
3. **Audit Log Archival**: Implement automated archival of old audit logs to cold storage
4. **User Metadata Sync**: Sync additional Clerk user metadata (phone, organization, etc.)
5. **Soft Delete Purging**: Implement cron job to permanently delete old soft-deleted users
