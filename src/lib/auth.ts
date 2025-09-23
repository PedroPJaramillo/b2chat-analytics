import { auth, clerkClient, currentUser } from "@clerk/nextjs"
import type { User } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export type UserRole = "Admin" | "Manager"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  clerkUser: User
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const user = await currentUser()

    if (!user) {
      return null
    }

    const metadata = user.publicMetadata as { role?: UserRole } | undefined
    const role = metadata?.role || "Manager"

    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || "",
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || null,
      role,
      clerkUser: user
    }
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

export async function syncUserToDatabase(clerkUser: User) {
  try {
    const metadata = clerkUser.publicMetadata as { role?: UserRole } | undefined
    const role = metadata?.role || "Manager"

    await prisma.user.upsert({
      where: { id: clerkUser.id },
      update: {
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : clerkUser.firstName || clerkUser.lastName || null,
        role: role,
      },
      create: {
        id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : clerkUser.firstName || clerkUser.lastName || null,
        role: role,
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