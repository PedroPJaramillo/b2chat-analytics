/**
 * Authorization utilities for customer analysis endpoints
 */

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'

export interface AuthResult {
  authorized: boolean
  userId?: string
  userRole?: UserRole
  userDepartmentIds?: string[]
  error?: string
  statusCode?: number
}

/**
 * Checks if user is authenticated and has Manager or Admin role
 * Reads role from Clerk metadata via getCurrentUser()
 */
export async function checkAnalysisPermission(): Promise<AuthResult> {
  // Get user with role from Clerk metadata
  const user = await getCurrentUser()

  if (!user) {
    return {
      authorized: false,
      error: 'Unauthorized',
      statusCode: 401,
    }
  }

  // Check if user has Manager or Admin role (from Clerk publicMetadata)
  if (user.role !== 'Manager' && user.role !== 'Admin') {
    return {
      authorized: false,
      error: 'Forbidden: Only Manager and Admin roles can access customer analysis',
      statusCode: 403,
    }
  }

  // For managers, get their department access
  // For now, we'll implement a simple version - in production you'd want to
  // store department assignments in user metadata or a separate table
  const userDepartmentIds: string[] = []

  // If Admin, they can access all departments (empty array means no restriction)
  // If Manager, get their assigned departments
  if (user.role === 'Manager') {
    // TODO: In production, fetch from user's department assignments
    // For now, we'll get all departments they might have access to
    // This would typically come from Clerk metadata or a UserDepartment table
  }

  return {
    authorized: true,
    userId: user.id,
    userRole: user.role,
    userDepartmentIds,
  }
}

/**
 * Checks if user has access to requested departments
 */
export function canAccessDepartments(
  requestedDeptIds: string[] | undefined,
  userRole: UserRole,
  userDepartmentIds: string[]
): { allowed: boolean; error?: string } {
  // Admins can access all departments
  if (userRole === 'Admin') {
    return { allowed: true }
  }

  // If no departments requested, allow (will be scoped to user's departments)
  if (!requestedDeptIds || requestedDeptIds.length === 0) {
    return { allowed: true }
  }

  // For Managers, check if requested departments are in their allowed list
  // If userDepartmentIds is empty, it means the manager has no restrictions
  // (this handles the case where department assignments aren't set up yet)
  if (userDepartmentIds.length === 0) {
    return { allowed: true }
  }

  const unauthorizedDepts = requestedDeptIds.filter(
    (deptId) => !userDepartmentIds.includes(deptId)
  )

  if (unauthorizedDepts.length > 0) {
    return {
      allowed: false,
      error: `Access denied to departments: ${unauthorizedDepts.join(', ')}`,
    }
  }

  return { allowed: true }
}
