import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { searchRateLimit } from '@/lib/rate-limit'
import { validateSearchParams, createValidationError, isValidationError } from '@/lib/validation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Validation schema for audit query parameters
const AuditQuerySchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
  eventType: z.nativeEnum(AuditEventType).optional(),
  severity: z.nativeEnum(AuditSeverity).optional(),
  userId: z.string().uuid().optional(),
  resource: z.string().optional(),
  success: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 1000) : 100),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  search: z.string().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
})

export async function GET(request: NextRequest) {
  let userId: string | null = null;

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting
    const rateLimitResponse = await searchRateLimit(request, userId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Validate query parameters
    const validationResult = validateSearchParams(request, AuditQuerySchema)
    if (isValidationError(validationResult)) {
      return NextResponse.json(createValidationError(validationResult.details), { status: 400 })
    }

    const {
      timeRange,
      eventType,
      severity,
      userId: filterUserId,
      resource,
      success,
      limit,
      offset,
      search,
      format
    } = validationResult

    // Calculate time range
    const now = new Date()
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }
    const since = new Date(now.getTime() - timeRangeMs[timeRange])

    // Build database query
    const whereClause: any = {
      category: 'audit_log',
      createdAt: { gte: since }
    }

    // Get audit logs from database
    const auditLogs = await prisma.systemSetting.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1, // Get one extra to check if there are more
      select: {
        id: true,
        value: true,
        createdAt: true,
      }
    })

    // Parse and filter audit events
    const events = auditLogs
      .slice(0, limit) // Remove the extra record
      .map(log => {
        try {
          const event = JSON.parse(log.value)
          return {
            ...event,
            id: log.id,
            timestamp: log.createdAt,
          }
        } catch (error) {
          logger.warn('Failed to parse audit log', { logId: log.id })
          return null
        }
      })
      .filter(event => event !== null)
      .filter(event => {
        // Apply filters
        if (eventType && event.eventType !== eventType) return false
        if (severity && event.severity !== severity) return false
        if (filterUserId && event.userId !== filterUserId) return false
        if (resource && !event.resource?.includes(resource)) return false
        if (success !== undefined && event.success !== success) return false
        if (search) {
          const searchLower = search.toLowerCase()
          const searchableText = `${event.eventType} ${event.resource || ''} ${event.action || ''} ${event.details || ''}`.toLowerCase()
          if (!searchableText.includes(searchLower)) return false
        }
        return true
      })

    const hasMore = auditLogs.length > limit

    // Get summary statistics (map 6h to 24h for stats)
    const statsTimeRange = timeRange === '6h' ? '24h' : timeRange
    const stats = await auditLogger.getAuditStats(statsTimeRange)

    // Get event trends (simplified)
    const eventTrends = getEventTrends(events)

    // Prepare response
    const response = {
      timestamp: new Date().toISOString(),
      timeRange,
      pagination: {
        limit,
        offset,
        hasMore,
        total: stats.totalEvents,
      },
      summary: stats,
      trends: eventTrends,
      events: events.map(event => ({
        id: event.id,
        timestamp: event.timestamp,
        eventType: event.eventType,
        severity: event.severity,
        userId: event.userId,
        userEmail: event.userEmail,
        resource: event.resource,
        action: event.action,
        success: event.success,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: event.details,
        errorMessage: event.errorMessage,
      }))
    }

    // Handle different response formats
    if (format === 'csv') {
      const csvContent = convertToCSV(response.events)
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-log-${timeRange}-${Date.now()}.csv"`,
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Audit API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: userId ?? undefined,
    })

    return NextResponse.json(
      { error: 'Failed to retrieve audit logs' },
      { status: 500 }
    )
  }
}

// Get event trends
function getEventTrends(events: any[]): {
  byHour: Array<{ hour: string; count: number }>
  byType: Array<{ eventType: string; count: number }>
  bySeverity: Array<{ severity: string; count: number }>
  byUser: Array<{ userId: string; count: number }>
} {
  const now = new Date()
  const last24Hours = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000)
    return {
      hour: hour.toISOString().substring(0, 13) + ':00',
      count: 0
    }
  })

  const byType: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  const byUser: Record<string, number> = {}

  events.forEach(event => {
    // Count by hour
    const eventHour = new Date(event.timestamp).toISOString().substring(0, 13) + ':00'
    const hourBucket = last24Hours.find(h => h.hour === eventHour)
    if (hourBucket) hourBucket.count++

    // Count by type
    byType[event.eventType] = (byType[event.eventType] || 0) + 1

    // Count by severity
    bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1

    // Count by user
    if (event.userId) {
      byUser[event.userId] = (byUser[event.userId] || 0) + 1
    }
  })

  return {
    byHour: last24Hours,
    byType: Object.entries(byType)
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count),
    bySeverity: Object.entries(bySeverity)
      .map(([severity, count]) => ({ severity, count }))
      .sort((a, b) => b.count - a.count),
    byUser: Object.entries(byUser)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10), // Top 10 users
  }
}

// Convert events to CSV format
function convertToCSV(events: any[]): string {
  if (events.length === 0) return 'No data available'

  const headers = [
    'Timestamp',
    'Event Type',
    'Severity',
    'User ID',
    'Resource',
    'Action',
    'Success',
    'IP Address',
    'User Agent',
    'Error Message',
  ]

  const csvRows = [
    headers.join(','),
    ...events.map(event => [
      event.timestamp,
      event.eventType,
      event.severity,
      event.userId || '',
      event.resource || '',
      event.action || '',
      event.success,
      event.ipAddress || '',
      `"${(event.userAgent || '').replace(/"/g, '""')}"`, // Escape quotes
      `"${(event.errorMessage || '').replace(/"/g, '""')}"`,
    ].join(','))
  ]

  return csvRows.join('\n')
}