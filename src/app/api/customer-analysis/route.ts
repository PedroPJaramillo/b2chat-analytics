/**
 * POST /api/customer-analysis - Trigger a new analysis job
 * GET /api/customer-analysis - Get analysis history
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAnalysisPermission, canAccessDepartments } from '@/lib/customer-analysis/auth'
import { validateAnalysisFilters, estimateProcessingTime } from '@/lib/customer-analysis/validation'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/customer-analysis/rate-limit'
import type {
  TriggerAnalysisRequest,
  TriggerAnalysisResponse,
  AnalysisHistoryResponse,
} from '@/types/customer-analysis'

/**
 * POST /api/customer-analysis
 * Triggers a new customer service analysis job
 */
export async function POST(request: NextRequest) {
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

    const { userId, userRole, userDepartmentIds } = authResult

    // Check rate limit
    const rateLimit = checkRateLimit(userId!, 'trigger')
    const rateLimitHeaders = getRateLimitHeaders(rateLimit, 10)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: rateLimit.error,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 429, headers: rateLimitHeaders }
      )
    }

    // Parse request body
    const body = (await request.json()) as TriggerAnalysisRequest

    // Validate filters
    const validation = validateAnalysisFilters(body.filters)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_DATE_RANGE',
            message: validation.error,
            details: { filters: body.filters },
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    // Check department access
    const deptAccess = canAccessDepartments(
      body.filters.departmentIds,
      userRole!,
      userDepartmentIds || []
    )

    if (!deptAccess.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN_DEPARTMENT',
            message: deptAccess.error,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403, headers: rateLimitHeaders }
      )
    }

    // Count chats and messages that will be analyzed
    const startDate = new Date(body.filters.dateStart)
    const endDate = new Date(body.filters.dateEnd)
    endDate.setHours(23, 59, 59, 999) // End of day

    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDeleted: false,
    }

    // Apply filters
    if (body.filters.agentIds && body.filters.agentIds.length > 0) {
      whereClause.agentId = { in: body.filters.agentIds }
    }

    if (body.filters.departmentIds && body.filters.departmentIds.length > 0) {
      whereClause.departmentId = { in: body.filters.departmentIds }
    }

    if (body.filters.contactIds && body.filters.contactIds.length > 0) {
      whereClause.contactId = { in: body.filters.contactIds }
    }

    // For Managers without specific department filters, scope to their departments
    if (
      userRole === 'Manager' &&
      userDepartmentIds &&
      userDepartmentIds.length > 0 &&
      !body.filters.departmentIds
    ) {
      whereClause.departmentId = { in: userDepartmentIds }
    }

    const [chatCount, messageCount] = await Promise.all([
      prisma.chat.count({ where: whereClause }),
      prisma.message.count({
        where: {
          chat: whereClause,
        },
      }),
    ])

    // Estimate processing time
    const estimatedTime = estimateProcessingTime(chatCount, messageCount)

    // Create analysis record
    const analysis = await prisma.customerAnalysis.create({
      data: {
        triggeredBy: userId!,
        filters: body.filters as any,
        status: 'PENDING',
      },
    })

    // Trigger background worker
    // Note: In production, use a proper job queue (e.g., BullMQ, Inngest)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/customer-analysis/worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: analysis.id }),
    }).catch((error) => {
      console.error('Failed to trigger worker:', error)
    })

    const response: TriggerAnalysisResponse = {
      analysisId: analysis.id,
      status: 'PENDING',
      estimatedProcessingTime: estimatedTime,
      message: `Analysis job created successfully. Processing ${chatCount} chats with ${messageCount} messages.`,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: rateLimitHeaders,
    })
  } catch (error) {
    console.error('Error triggering analysis:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to trigger analysis',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/customer-analysis
 * Retrieves analysis history for the authenticated user
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

    const { userId, userRole } = authResult

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    // Build where clause
    const where: any = {}

    // For Managers, only show their analyses
    // For Admins, show all analyses
    if (userRole === 'Manager') {
      where.triggeredBy = userId
    }

    if (status) {
      where.status = status
    }

    // Fetch analyses
    const [analyses, total] = await Promise.all([
      prisma.customerAnalysis.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          status: true,
          filters: true,
          totalChatsAnalyzed: true,
          totalMessagesAnalyzed: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.customerAnalysis.count({ where }),
    ])

    const response: AnalysisHistoryResponse = {
      analyses: analyses.map((a) => ({
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        status: a.status,
        filters: a.filters as any,
        summary: {
          totalChatsAnalyzed: a.totalChatsAnalyzed,
          totalMessagesAnalyzed: a.totalMessagesAnalyzed,
        },
      })),
      pagination: {
        total,
        limit,
        offset,
      },
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Error fetching analysis history:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch analysis history',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}
