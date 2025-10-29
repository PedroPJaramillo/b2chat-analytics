/**
 * GET /api/customer-analysis/filter-options - Get available filter options
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAnalysisPermission } from '@/lib/customer-analysis/auth'
import type { AnalysisFilterOptions } from '@/types/customer-analysis'

/**
 * GET /api/customer-analysis/filter-options
 * Retrieves available agents, departments, and date range limits for filter dropdowns
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const authResult = await checkAnalysisPermission()
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN_ROLE',
            message: authResult.error,
            timestamp: new Date().toISOString(),
          },
        },
        { status: authResult.statusCode }
      )
    }

    const { userRole, userDepartmentIds } = authResult

    // Build where clause for department filtering
    const departmentWhere: any = {
      isActive: true,
    }

    // For Managers, only show their accessible departments
    if (userRole === 'Manager' && userDepartmentIds && userDepartmentIds.length > 0) {
      departmentWhere.id = { in: userDepartmentIds }
    }

    // Fetch departments
    const departments = await prisma.department.findMany({
      where: departmentWhere,
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })

    // Build where clause for agents
    const agentWhere: any = {
      isActive: true,
      isDeleted: false,
    }

    // For Managers, only show agents from their departments
    if (userRole === 'Manager' && userDepartmentIds && userDepartmentIds.length > 0) {
      agentWhere.departmentId = { in: userDepartmentIds }
    }

    // Fetch agents with their departments
    const agents = await prisma.agent.findMany({
      where: agentWhere,
      select: {
        id: true,
        name: true,
        departmentId: true,
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Get date range limits from chats
    const [earliestChat, latestChat] = await Promise.all([
      prisma.chat.findFirst({
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.chat.findFirst({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    const response: AnalysisFilterOptions = {
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        departmentId: agent.departmentId || '',
        departmentName: agent.department?.name || 'No Department',
      })),
      departments: departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
      })),
      dateRangeLimits: {
        earliestChatDate: earliestChat?.createdAt.toISOString().split('T')[0] || '2024-01-01',
        latestChatDate: latestChat?.createdAt.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        maxRangeDays: 90,
      },
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error fetching filter options:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch filter options',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}
