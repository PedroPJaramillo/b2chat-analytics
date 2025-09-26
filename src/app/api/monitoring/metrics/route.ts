import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { healthMonitor } from '@/lib/health-monitor'
import { getCacheStats } from '@/lib/cache'
import { auditLogger } from '@/lib/audit'
import { SessionTracker } from '@/lib/activity-tracker'
import { logger } from '@/lib/logger'
import { dashboardRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting
    const rateLimitResponse = await dashboardRateLimit(request, userId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('range') as '1h' | '6h' | '24h') || '24h'
    const includeHistory = searchParams.get('history') === 'true'

    // Collect current metrics
    const currentMetrics = await healthMonitor.collectMetrics()

    // Get metrics history if requested
    const metricsHistory = includeHistory
      ? healthMonitor.getMetricsHistory(timeRange)
      : []

    // Get cache statistics
    const cacheStats = getCacheStats()

    // Get active sessions
    const activeSessions = SessionTracker.getActiveSessions()

    // Get audit statistics
    const auditStats = await auditLogger.getAuditStats(timeRange)

    // Get database statistics
    const dbStats = await getDatabaseStats()

    // Get API performance stats
    const apiStats = await getAPIPerformanceStats(timeRange)

    const response = {
      timestamp: new Date().toISOString(),
      timeRange,
      current: currentMetrics,
      ...(includeHistory && { history: metricsHistory }),
      cache: {
        stats: cacheStats,
        summary: Array.isArray(cacheStats) ? {
          totalCaches: cacheStats.length,
          totalSize: cacheStats.reduce((sum, cache) => sum + cache.size, 0),
          totalCapacity: cacheStats.reduce((sum, cache) => sum + cache.max, 0),
          avgUtilization: cacheStats.length > 0
            ? cacheStats.reduce((sum, cache) => sum + (cache.size / cache.max), 0) / cacheStats.length * 100
            : 0
        } : null
      },
      sessions: {
        active: activeSessions.length,
        details: activeSessions.map(session => ({
          userId: session.userId,
          duration: Math.round(session.duration / 1000), // seconds
          activityCount: session.activityCount,
          lastActivity: session.lastActivity,
        }))
      },
      audit: auditStats,
      database: dbStats,
      api: apiStats,
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Metrics API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    })

    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    )
  }
}

// Get database statistics
async function getDatabaseStats() {
  try {
    const [
      tableStats,
      connectionInfo,
      indexUsage,
    ] = await Promise.all([
      // Table sizes and row counts
      prisma.$queryRaw<Array<{
        table_name: string
        row_count: number
        size_mb: number
      }>>`
        SELECT
          schemaname || '.' || tablename as table_name,
          n_tup_ins + n_tup_upd + n_tup_del as row_count,
          ROUND(pg_total_relation_size(schemaname||'.'||tablename) / 1024.0 / 1024.0, 2) as size_mb
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `,

      // Active connections
      prisma.$queryRaw<Array<{
        state: string
        count: number
      }>>`
        SELECT
          COALESCE(state, 'unknown') as state,
          count(*) as count
        FROM pg_stat_activity
        WHERE pid != pg_backend_pid()
        GROUP BY state
      `,

      // Index usage (simplified)
      prisma.$queryRaw<Array<{
        index_name: string
        usage_count: number
      }>>`
        SELECT
          indexrelname as index_name,
          idx_tup_read as usage_count
        FROM pg_stat_user_indexes
        WHERE idx_tup_read > 0
        ORDER BY idx_tup_read DESC
        LIMIT 10
      `,
    ])

    return {
      tables: tableStats,
      connections: connectionInfo,
      indexes: indexUsage,
      summary: {
        totalTables: tableStats.length,
        totalSize: tableStats.reduce((sum, table) => sum + Number(table.size_mb), 0),
        activeConnections: connectionInfo.find(c => c.state === 'active')?.count || 0,
        idleConnections: connectionInfo.find(c => c.state === 'idle')?.count || 0,
      }
    }
  } catch (error) {
    logger.error('Database stats error', { error })
    return {
      error: 'Could not retrieve database statistics',
      summary: {
        totalTables: 0,
        totalSize: 0,
        activeConnections: 0,
        idleConnections: 0,
      }
    }
  }
}

// Get API performance statistics
async function getAPIPerformanceStats(timeRange: '1h' | '6h' | '24h') {
  try {
    // This would typically come from your logging system
    // For now, return mock data structure
    return {
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      slowRequests: 0,
      endpointStats: [],
      note: 'API performance tracking not fully implemented - integrate with logging system'
    }
  } catch (error) {
    return {
      error: 'Could not retrieve API performance statistics'
    }
  }
}