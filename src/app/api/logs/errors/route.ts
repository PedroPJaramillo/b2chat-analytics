import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger-pino'
import { getCorrelationId } from '@/middleware/correlation-id'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const logsQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  level: z.string().optional(),
  source: z.string().optional(),
  userId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const correlationId = getCorrelationId(request) ?? undefined

    const { searchParams } = new URL(request.url)
    const query = logsQuerySchema.parse({
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '50',
      level: searchParams.get('level') ?? undefined,
      source: searchParams.get('source') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    })

    const page = parseInt(query.page)
    const limit = Math.min(parseInt(query.limit), 100) // Cap at 100 records
    const offset = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (query.level) {
      where.level = query.level
    }

    if (query.source) {
      where.source = query.source
    }

    if (query.userId) {
      where.userId = query.userId
    }

    if (query.dateFrom || query.dateTo) {
      where.timestamp = {}
      if (query.dateFrom) {
        where.timestamp.gte = new Date(query.dateFrom)
      }
      if (query.dateTo) {
        where.timestamp.lte = new Date(query.dateTo)
      }
    }

    // Get logs with pagination
    const [logs, totalCount] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        },
        skip: offset,
        take: limit,
      }),
      prisma.errorLog.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Calculate statistics for last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [errorCount, warnCount, fatalCount, totalLast24h] = await Promise.all([
      prisma.errorLog.count({
        where: {
          level: 'error',
          timestamp: { gte: twentyFourHoursAgo }
        }
      }),
      prisma.errorLog.count({
        where: {
          level: 'warn',
          timestamp: { gte: twentyFourHoursAgo }
        }
      }),
      prisma.errorLog.count({
        where: {
          level: 'fatal',
          timestamp: { gte: twentyFourHoursAgo }
        }
      }),
      prisma.errorLog.count({
        where: {
          timestamp: { gte: twentyFourHoursAgo }
        }
      })
    ])

    logger.info('Error logs retrieved', {
      userId,
      correlationId,
      source: 'api',
      totalCount,
      page,
      limit
    })

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
        errorLast24h: errorCount,
        warnLast24h: warnCount,
        fatalLast24h: fatalCount,
        totalLast24h
      },
      filters: {
        level: query.level,
        source: query.source,
        userId: query.userId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      }
    })

  } catch (error) {
    logger.error('Error logs API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'api'
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
