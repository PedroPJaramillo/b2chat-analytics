# Authentication & Authorization

## Architecture

### Source of Truth: Clerk Metadata
User roles are managed in Clerk's `publicMetadata.role` field. The database `users.role` is a synchronized copy for audit trails only.

**Important**: The database role field is READ-ONLY from the application's perspective. All authorization decisions must read from Clerk metadata.

### Architecture Diagram

```
┌─────────────────────────────────────┐
│  Clerk (Source of Truth)            │
│  publicMetadata: { role: "Admin" }  │
└───────────┬─────────────────────────┘
            │
            ├──────────────────┐
            ↓                  ↓
    ┌──────────────┐   ┌──────────────────┐
    │   Frontend   │   │   Webhook        │
    │   useUser()  │   │   Syncs to DB    │
    └──────────────┘   └──────────────────┘
            ↓                  ↓
            ↓          ┌────────────────┐
            ↓          │  Database      │
            ↓          │  (Read-only    │
            ↓          │   for audit)   │
            ↓          └────────────────┘
            ↓
    ┌──────────────────┐
    │   Backend API    │
    │  getCurrentUser()│
    └──────────────────┘
```

## Role Management

### Setting User Roles in Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Users**
3. Click on the user you want to modify
4. Scroll to the **Metadata** section
5. Click **Edit** next to "Public metadata"
6. Add the role field:
   ```json
   {
     "role": "Admin"
   }
   ```
7. Click **Save**

### Available Roles

- **Admin**: Full access to all features, settings, and admin panels
- **Manager**: Limited access, cannot modify system settings or configurations

### Role Hierarchy

```
Admin > Manager
```

Admins have all Manager permissions plus:
- System settings (Office Hours, Holidays, SLA Configuration)
- User management
- Advanced analytics

## Backend Implementation

### ✅ CORRECT Pattern

All API routes MUST use `getCurrentUser()` from `@/lib/auth`:

```typescript
import { getCurrentUser } from "@/lib/auth"

export async function PUT(request: Request) {
  // Get user with role from Clerk metadata
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  // Check role (from Clerk publicMetadata)
  if (user.role !== "Admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    )
  }

  // ... rest of handler
}
```

### ❌ WRONG Pattern (DO NOT USE)

```typescript
// ❌ NEVER query database for roles
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { role: true }
})

if (user.role !== "Admin") { ... }  // This reads stale data!
```

**Why is this wrong?**
- Database role might be out of sync with Clerk
- Creates maintenance burden (two sources of truth)
- Requires database query for every auth check
- Clerk metadata changes don't reflect immediately

## Frontend Implementation

### Using Clerk's `useUser()` Hook

```typescript
import { useUser } from "@clerk/nextjs"

export default function MyComponent() {
  const { user } = useUser()

  const getUserRole = () => {
    return (user?.publicMetadata?.role as string) || "Manager"
  }

  const isAdmin = getUserRole() === "Admin"

  if (!isAdmin) {
    return <div>Access Denied</div>
  }

  return <AdminPanel />
}
```

### Page-Level Protection

```typescript
"use client"

import { useUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default function AdminPage() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return <LoadingSkeleton />
  }

  const isAdmin = (user?.publicMetadata?.role === "Admin")

  if (!isAdmin) {
    redirect("/dashboard/settings/profile")
  }

  return <AdminContent />
}
```

## User Synchronization

### Automatic Sync (Webhook)

The Clerk webhook at `/api/webhook/clerk` automatically syncs users when:
- New user signs up (`user.created` event)
- User profile is updated (`user.updated` event)
- User is deleted (`user.deleted` event)

The webhook:
1. Reads `publicMetadata.role` from Clerk
2. Falls back to email-based logic if metadata not set
3. Syncs to database using `upsert`
4. Logs the role source for debugging

### Manual Sync (Migration Script)

To sync all existing Clerk users to database:

```bash
npx tsx sync-my-user.ts
```

This script:
- Fetches all users from Clerk (with pagination)
- Reads role from `publicMetadata.role`
- Syncs each user to database
- Reports success/failure for each user

**When to use:**
- After updating roles in Clerk Dashboard
- After deploying this auth fix
- When database and Clerk are out of sync

### Checking Sync Status

Use Prisma Studio to view database users:

```bash
npx prisma studio
```

Then:
1. Open http://localhost:5555
2. Click on **User** table
3. Verify role matches Clerk metadata

## How It Works

### User Login Flow

```
1. User logs in via Clerk
   ↓
2. Clerk creates session with publicMetadata
   ↓
3. Frontend reads role from user.publicMetadata.role
   ↓
4. Backend reads role via getCurrentUser()
   ↓
5. Both use same source (Clerk metadata) ✓
```

### Role Change Flow

```
1. Admin changes role in Clerk Dashboard
   ↓
2. Clerk fires user.updated webhook
   ↓
3. Webhook syncs new role to database
   ↓
4. User's next request uses new role (immediate)
   ↓
5. Database has synced copy (for audit/analytics)
```

## Troubleshooting

### Issue: "Admin access required" error

**Symptoms:**
- User has Admin role in Clerk
- Getting 403 errors on admin routes
- Frontend shows admin access, backend denies

**Solution:**
1. Verify role in Clerk Dashboard (publicMetadata.role)
2. Check database has user record:
   ```bash
   npx prisma studio
   # Look for user in User table
   ```
3. Run migration script to sync:
   ```bash
   npx tsx sync-my-user.ts
   ```
4. Or manually update in Prisma Studio:
   - Find your user
   - Set role to "Admin"
   - Save

### Issue: Role changes not taking effect

**Cause:** Frontend/backend caching or old session

**Solution:**
1. Log out and log back in (clears Clerk session)
2. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
3. Check Clerk Dashboard shows correct role
4. Verify webhook processed (check server logs)

### Issue: Database user doesn't exist

**Cause:** Webhook not configured or never fired

**Solution:**
1. Check `CLERK_WEBHOOK_SECRET` in .env
2. Configure webhook in Clerk Dashboard:
   - Endpoint: `https://your-domain/api/webhook/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
3. Run migration script:
   ```bash
   npx tsx sync-my-user.ts
   ```

### Issue: Webhook not working

**Symptoms:**
- New users not appearing in database
- Role changes in Clerk not syncing

**Debug steps:**
1. Check webhook endpoint is configured in Clerk
2. Check server logs for webhook errors
3. Verify `CLERK_WEBHOOK_SECRET` matches Clerk Dashboard
4. Test webhook manually:
   - Change user role in Clerk
   - Check server logs for "Clerk webhook received"
   - Check database for updated role

## API Reference

### `getCurrentUser()`

**Location:** `src/lib/auth.ts`

**Returns:** `Promise<AuthUser | null>`

```typescript
interface AuthUser {
  id: string
  email: string
  name: string | null
  role: "Admin" | "Manager"
  clerkUser: User  // Full Clerk user object
}
```

**Usage:**
```typescript
const user = await getCurrentUser()
if (!user) {
  // Not authenticated
}
if (user.role === "Admin") {
  // Admin access
}
```

### `syncUserToDatabase()`

**Location:** `src/lib/auth.ts`

**Parameters:**
- `clerkUser: User` - Clerk user object

**Returns:** `Promise<void>`

**Usage:**
```typescript
import { clerkClient } from "@clerk/nextjs/server"
import { syncUserToDatabase } from "@/lib/auth"

const client = await clerkClient()
const users = await client.users.getUserList()

for (const user of users.data) {
  await syncUserToDatabase(user)
}
```

## Security Considerations

### Why Clerk Metadata is Secure

- **Server-side only**: publicMetadata can only be modified via Clerk Dashboard or server-side API
- **Not client-editable**: Users cannot modify their own roles
- **Audit trail**: All role changes logged in Clerk
- **Centralized**: One place to manage roles

### Database Role Field

The database `users.role` field is kept for:
- **Audit trails**: Historical records of user roles
- **Analytics**: Query user counts by role
- **Performance**: Avoid extra API calls for read-only queries

But NEVER for authorization decisions.

## Best Practices

1. **Always use `getCurrentUser()`** in API routes
2. **Always read from Clerk metadata** for auth decisions
3. **Keep database role in sync** via webhook
4. **Test role changes** after updating in Clerk
5. **Document admin routes** with "Admin Only" badges
6. **Use consistent patterns** across all routes
7. **Log role source** for debugging (webhook does this)

## Migration Checklist

When adding new admin routes:

- [ ] Import `getCurrentUser` from `@/lib/auth`
- [ ] Call `getCurrentUser()` instead of `auth()`
- [ ] Check `user.role` instead of database query
- [ ] Return 401 if `!user`
- [ ] Return 403 if `user.role !== "Admin"`
- [ ] Add tests for Admin/Manager/Unauthenticated cases
- [ ] Document route as "Admin Only"

## Examples

### Complete Admin Route

```typescript
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request) {
  try {
    // Authentication & Authorization
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (user.role !== "Admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    // Business logic
    const body = await request.json()
    // ... validate and process

    // Success response
    return NextResponse.json({
      success: true,
      message: "Updated successfully"
    })

  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

### Frontend Admin Check

```typescript
import { useUser } from "@clerk/nextjs"

export function AdminPanel() {
  const { user } = useUser()

  const isAdmin = (user?.publicMetadata?.role === "Admin")

  if (!isAdmin) {
    return (
      <div className="p-4">
        <p>Admin access required</p>
      </div>
    )
  }

  return (
    <div>
      <h2>Admin Panel</h2>
      {/* Admin content */}
    </div>
  )
}
```

## Related Documentation

- [User Management](./USER_MANAGEMENT.md) - Managing users and roles
- [API Documentation](../api/README.md) - API endpoint reference
- [Clerk Documentation](https://clerk.com/docs) - Official Clerk docs
- [Database Schema](../development/DATA_MODEL_GUIDE.md) - Database structure

## Support

For issues or questions:
- Check this documentation first
- Review server logs for auth errors
- Check Clerk Dashboard for role configuration
- Verify webhook is configured and working
- Use Prisma Studio to inspect database state

---

**Last Updated:** 2025-10-29
**Auth Pattern Version:** 2.0 (Clerk Metadata)
