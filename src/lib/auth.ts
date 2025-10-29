/**
 * Authentication & Authorization Utilities
 *
 * ⚠️ CRITICAL: This file defines the ONLY correct way to handle auth in this app
 *
 * KEY PRINCIPLES:
 * 1. Clerk publicMetadata.role is the SINGLE SOURCE OF TRUTH for user roles
 * 2. Database users.role is a READ-ONLY synchronized copy (for audit/analytics only)
 * 3. ALWAYS use getCurrentUser() for authentication in API routes
 * 4. NEVER query database (prisma.user.findUnique) to check roles
 *
 * WHY?
 * - Clerk metadata changes take effect immediately
 * - Database may be out of sync during role changes
 * - Prevents "Admin access required" errors when user has Admin in Clerk
 * - Single source of truth = easier to reason about and maintain
 *
 * HOW TO USE IN API ROUTES:
 * ```typescript
 * import { getCurrentUser } from "@/lib/auth"
 *
 * export async function PUT(request: Request) {
 *   const user = await getCurrentUser()  // ✅ CORRECT
 *
 *   if (!user) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
 *   }
 *
 *   if (user.role !== "Admin") {
 *     return NextResponse.json({ error: "Admin access required" }, { status: 403 })
 *   }
 *   // ... rest of handler
 * }
 * ```
 *
 * WHAT NOT TO DO:
 * ```typescript
 * // ❌ WRONG - Never do this!
 * const user = await prisma.user.findUnique({
 *   where: { id: userId },
 *   select: { role: true }
 * })
 * if (user.role !== "Admin") { ... }
 * ```
 *
 * See docs/operations/AUTHENTICATION.md for complete documentation.
 */

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server"
import type { User } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export type UserRole = "Admin" | "Manager"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole  // From Clerk publicMetadata - this is the source of truth
  clerkUser: User
}

/**
 * Get the currently authenticated user with role from Clerk metadata
 *
 * ⚠️ USE THIS FUNCTION in all API routes for authentication/authorization
 *
 * This function:
 * 1. Gets user from Clerk session
 * 2. Reads role from Clerk publicMetadata (source of truth)
 * 3. Returns AuthUser object with role
 *
 * @returns AuthUser with role from Clerk metadata, or null if not authenticated
 *
 * @example
 * ```typescript
 * // In API route handler:
 * export async function PUT(request: Request) {
 *   const user = await getCurrentUser()
 *
 *   if (!user) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
 *   }
 *
 *   if (user.role !== "Admin") {
 *     return NextResponse.json({ error: "Admin access required" }, { status: 403 })
 *   }
 *   // ... authorized code
 * }
 * ```
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const user = await currentUser()

    if (!user) {
      return null
    }

    // Read role from Clerk publicMetadata - this is the source of truth!
    const metadata = user.publicMetadata as { role?: UserRole } | undefined
    const role = metadata?.role || "Manager"

    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || "",
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || null,
      role,  // From Clerk metadata - always current and accurate
      clerkUser: user
    }
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

/**
 * Sync user data from Clerk to database
 *
 * This function reads user data (including role) from Clerk and syncs it to
 * the database. The database role is a READ-ONLY copy for:
 * - Audit trails (who had what role when)
 * - Analytics queries (count users by role)
 * - Historical records
 *
 * ⚠️ IMPORTANT: The database role is NEVER used for authorization decisions.
 * All authorization MUST use getCurrentUser() which reads from Clerk metadata.
 *
 * This function is called by:
 * - Webhook when user is created/updated in Clerk
 * - Manual migration script (sync-my-user.ts)
 *
 * @param clerkUser - The Clerk user object with metadata
 */
export async function syncUserToDatabase(clerkUser: User) {
  try {
    // Read role from Clerk metadata
    const metadata = clerkUser.publicMetadata as { role?: UserRole } | undefined
    const role = metadata?.role || "Manager"

    // Sync to database (upsert = create or update)
    await prisma.user.upsert({
      where: { id: clerkUser.id },
      update: {
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : clerkUser.firstName || clerkUser.lastName || null,
        role: role,  // Synced from Clerk metadata for audit purposes only
      },
      create: {
        id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : clerkUser.firstName || clerkUser.lastName || null,
        role: role,  // Synced from Clerk metadata for audit purposes only
      },
    })
  } catch (error) {
    console.error("Error syncing user to database:", error)
  }
}

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    "Manager": 1,
    "Admin": 2,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}