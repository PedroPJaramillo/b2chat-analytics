import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { syncCancellationManager } from '@/lib/sync/cancellation'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const logsQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  entityType: z.string().optional(),
  status: z.string().optional(),
  operation: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export async function GET(request: NextRequest) {
  let userId: string | null = null;

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = logsQuerySchema.parse({
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '50',
      entityType: searchParams.get('entityType') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      operation: searchParams.get('operation') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    })

    const page = parseInt(query.page)
    const limit = Math.min(parseInt(query.limit), 100) // Cap at 100 records
    const offset = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (query.entityType) {
      where.entityType = query.entityType
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.operation) {
      where.operation = query.operation
    }

    if (query.dateFrom || query.dateTo) {
      where.startedAt = {}
      if (query.dateFrom) {
        where.startedAt.gte = new Date(query.dateFrom)
      }
      if (query.dateTo) {
        where.startedAt.lte = new Date(query.dateTo)
      }
    }

    // Get logs with pagination
    const [logs, totalCount] = await Promise.all([
      prisma.syncLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: {
          startedAt: 'desc'
        },
        skip: offset,
        take: limit,
      }),
      prisma.syncLog.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Get active syncs and statistics
    const activeSyncIds = syncCancellationManager.getActiveSyncIds()
    const activeSyncs = logs.filter(log =>
      activeSyncIds.includes(log.id) &&
      (log.status === 'running' || log.status === 'started')
    )

    // Calculate statistics for last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [completedCount, failedCount, totalLast24h] = await Promise.all([
      prisma.syncLog.count({
        where: {
          status: 'completed',
          startedAt: { gte: twentyFourHoursAgo }
        }
      }),
      prisma.syncLog.count({
        where: {
          status: 'failed',
          startedAt: { gte: twentyFourHoursAgo }
        }
      }),
      prisma.syncLog.count({
        where: {
          startedAt: { gte: twentyFourHoursAgo }
        }
      })
    ])

    const successRate = totalLast24h > 0
      ? Math.round((completedCount / totalLast24h) * 100)
      : 0

    return NextResponse.json({
      data: logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      statistics: {
        activeCount: activeSyncs.length,
        completedLast24h: completedCount,
        failedLast24h: failedCount,
        successRate
      },
      activeSyncs: activeSyncs.map(sync => ({
        ...sync,
        metadata: sync.metadata || {},
        duration: sync.completedAt
          ? new Date(sync.completedAt).getTime() - new Date(sync.startedAt).getTime()
          : Date.now() - new Date(sync.startedAt).getTime()
      })),
      filters: {
        entityType: query.entityType,
        status: query.status,
        operation: query.operation,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      }
    })

  } catch (error) {
    logger.error('Sync logs API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get aggregated sync log statistics
export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { timeRange = '24h' } = body

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Get statistics
    const [statusCounts, entityCounts, operationCounts, recentActivity] = await Promise.all([
      // Status distribution
      prisma.syncLog.groupBy({
        by: ['status'],
        where: {
          startedAt: {
            gte: startDate
          }
        },
        _count: {
          status: true
        }
      }),

      // Entity type distribution
      prisma.syncLog.groupBy({
        by: ['entityType'],
        where: {
          startedAt: {
            gte: startDate
          }
        },
        _count: {
          entityType: true
        }
      }),

      // Operation distribution
      prisma.syncLog.groupBy({
        by: ['operation'],
        where: {
          startedAt: {
            gte: startDate
          }
        },
        _count: {
          operation: true
        }
      }),

      // Recent failed syncs
      prisma.syncLog.findMany({
        where: {
          status: 'failed',
          startedAt: {
            gte: startDate
          }
        },
        orderBy: {
          startedAt: 'desc'
        },
        take: 10,
        select: {
          id: true,
          entityType: true,
          operation: true,
          errorMessage: true,
          startedAt: true,
        }
      })
    ])

    const stats = {
      timeRange,
      period: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      statusDistribution: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<string, number>),
      entityDistribution: entityCounts.reduce((acc, item) => {
        acc[item.entityType] = item._count.entityType
        return acc
      }, {} as Record<string, number>),
      operationDistribution: operationCounts.reduce((acc, item) => {
        acc[item.operation] = item._count.operation
        return acc
      }, {} as Record<string, number>),
      recentFailures: recentActivity
    }

    return NextResponse.json({ stats })

  } catch (error) {
    logger.error('Sync logs stats API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}