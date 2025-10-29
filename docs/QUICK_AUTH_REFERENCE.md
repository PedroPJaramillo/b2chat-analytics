# Quick Authentication Reference

> **🚨 STOP! Read this before implementing auth in any API route**

## The Golden Rule

**Clerk `publicMetadata.role` is the ONLY source of truth for user roles.**

Database `users.role` is a read-only copy. Never use it for authorization.

---

## ✅ Correct Pattern (Copy & Paste This)

```typescript
import { getCurrentUser } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function PUT(request: Request) {
  // Step 1: Get user from Clerk metadata
  const user = await getCurrentUser()

  // Step 2: Check authentication
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  // Step 3: Check authorization
  if (user.role !== "Admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    )
  }

  // Step 4: Your business logic here
  const body = await request.json()
  // ... do stuff

  return NextResponse.json({ success: true })
}
```

---

## ❌ Wrong Pattern (Never Do This)

```typescript
// ❌ WRONG #1: Using auth() directly
const { userId } = await auth()
const user = await prisma.user.findUnique({ where: { id: userId }})
if (user.role !== "Admin") { ... }  // Database role may be stale!

// ❌ WRONG #2: Checking database role
const dbUser = await prisma.user.findUnique({
  where: { id: userId },
  select: { role: true }
})
if (dbUser.role !== "Admin") { ... }  // NO!

// ❌ WRONG #3: Using sessionClaims
const { sessionClaims } = await auth()
if (sessionClaims?.metadata?.role !== "Admin") { ... }  // Might not be in claims
```

---

## Frontend Auth

```typescript
import { useUser } from "@clerk/nextjs"

export function MyComponent() {
  const { user } = useUser()

  // Read role from Clerk metadata
  const isAdmin = (user?.publicMetadata?.role === "Admin")

  if (!isAdmin) {
    return <AccessDenied />
  }

  return <AdminPanel />
}
```

---

## Managing Roles

### Set role for a user:

1. Go to https://dashboard.clerk.com
2. Navigate to **Users** → Select user
3. **Public metadata** → Edit
4. Add:
   ```json
   {
     "role": "Admin"
   }
   ```
5. **Save** - Takes effect immediately!

### Check current role:

```bash
# Option 1: Prisma Studio
npx prisma studio
# Open http://localhost:5555, check User table

# Option 2: Clerk Dashboard
# Go to Users → Select user → View metadata
```

### Sync all users from Clerk:

```bash
npx tsx sync-my-user.ts
```

---

## Available Roles

| Role | Permissions |
|------|------------|
| `Admin` | Full access: settings, admin panels, all features |
| `Manager` | Limited access: no settings or admin features |

---

## Troubleshooting

### "Admin access required" error

**Problem:** User has Admin in Clerk but gets 403

**Solution:**
1. Verify role in Clerk Dashboard (publicMetadata.role)
2. Open Prisma Studio: `npx prisma studio`
3. Check User table - if role is wrong, update it to "Admin"
4. OR run sync script: `npx tsx sync-my-user.ts`
5. Log out and back in

### Role change not working

**Solution:**
1. Log out completely
2. Log back in (new session picks up new role)
3. Hard refresh browser (Cmd+Shift+R)

---

## Why This Pattern?

| Aspect | Clerk Metadata ✅ | Database Query ❌ |
|--------|------------------|------------------|
| **Currency** | Always current | May be stale |
| **Performance** | Cached in session | Extra DB query |
| **Consistency** | Single source | Two sources = confusion |
| **Real-time** | Immediate changes | Requires webhook sync |
| **Admin UI** | Clerk Dashboard | Needs custom UI |

---

## File Locations

- **Auth utilities:** [`src/lib/auth.ts`](../src/lib/auth.ts)
- **Full documentation:** [`docs/operations/AUTHENTICATION.md`](./operations/AUTHENTICATION.md)
- **Migration script:** [`sync-my-user.ts`](../sync-my-user.ts)
- **Webhook handler:** [`src/app/api/webhook/clerk/route.ts`](../src/app/api/webhook/clerk/route.ts)

---

## Examples in Codebase

**✅ Correct implementations:**
- `src/app/api/settings/office-hours/route.ts`
- `src/app/api/settings/sla/route.ts`
- `src/app/api/settings/holidays/route.ts`
- `src/lib/customer-analysis/auth.ts`

---

## Quick Checklist for New Routes

When creating an admin-only route:

- [ ] Import `getCurrentUser` from `@/lib/auth`
- [ ] Call `getCurrentUser()` (not `auth()` directly)
- [ ] Check `if (!user)` return 401
- [ ] Check `if (user.role !== "Admin")` return 403
- [ ] Never query `prisma.user` for roles
- [ ] Add tests for Admin/Manager/Unauthenticated cases
- [ ] Document route as "Admin Only" in comments

---

## Need Help?

1. Read the [full authentication docs](./operations/AUTHENTICATION.md)
2. Check [README Security section](../README.md#-security--authentication)
3. Look at example implementations listed above
4. Check server logs for auth errors

---

**Remember: When in doubt, use `getCurrentUser()`. It's that simple!**
