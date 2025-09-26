import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'
import { dashboardRateLimit } from '@/lib/rate-limit'
import { validateRequestBody, validateSearchParams, createValidationError, isValidationError } from '@/lib/validation'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Alert status
export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

// Alert interface
interface Alert {
  id: string
  title: string
  description: string
  severity: AlertSeverity
  status: AlertStatus
  source: string
  timestamp: Date
  acknowledgedBy?: string
  acknowledgedAt?: Date
  resolvedAt?: Date
  metadata?: Record<string, any>
}

// In-memory alert storage (in production, use database)
const alerts: Map<string, Alert> = new Map()

// Alert query schema
const AlertQuerySchema = z.object({
  status: z.nativeEnum(AlertStatus).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  source: z.string().optional(),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 100) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
})

// Alert action schema
const AlertActionSchema = z.object({
  alertId: z.string(),
  action: z.enum(['acknowledge', 'resolve']),
  note: z.string().optional(),
})

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

    // Validate query parameters
    const validationResult = validateSearchParams(request, AlertQuerySchema)
    if (isValidationError(validationResult)) {
      return NextResponse.json(createValidationError(validationResult.details), { status: 400 })
    }

    const { status, severity, source, limit, offset } = validationResult

    // Filter alerts
    let filteredAlerts = Array.from(alerts.values())

    if (status) {
      filteredAlerts = filteredAlerts.filter(alert => alert.status === status)
    }

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity)
    }

    if (source) {
      filteredAlerts = filteredAlerts.filter(alert => alert.source.includes(source))
    }

    // Sort by timestamp (newest first)
    filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Apply pagination
    const total = filteredAlerts.length
    const paginatedAlerts = filteredAlerts.slice(offset, offset + limit)

    // Get alert summary
    const summary = getAlertSummary()

    const response = {
      timestamp: new Date().toISOString(),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary,
      alerts: paginatedAlerts,
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Alerts API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    })

    return NextResponse.json(
      { error: 'Failed to retrieve alerts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Validate request body
    const validationResult = await validateRequestBody(request, AlertActionSchema)
    if (isValidationError(validationResult)) {
      return NextResponse.json(createValidationError(validationResult.details), { status: 400 })
    }

    const { alertId, action, note } = validationResult

    // Get the alert
    const alert = alerts.get(alertId)
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Perform the action
    const now = new Date()

    if (action === 'acknowledge') {
      if (alert.status === AlertStatus.ACTIVE) {
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledgedBy = userId
        alert.acknowledgedAt = now

        logger.info('Alert acknowledged', {
          alertId,
          userId,
          title: alert.title,
          note,
        })
      } else {
        return NextResponse.json({ error: 'Alert cannot be acknowledged' }, { status: 400 })
      }
    } else if (action === 'resolve') {
      if (alert.status === AlertStatus.ACTIVE || alert.status === AlertStatus.ACKNOWLEDGED) {
        alert.status = AlertStatus.RESOLVED
        alert.resolvedAt = now

        if (alert.status === AlertStatus.ACTIVE) {
          alert.acknowledgedBy = userId
          alert.acknowledgedAt = now
        }

        logger.info('Alert resolved', {
          alertId,
          userId,
          title: alert.title,
          note,
        })
      } else {
        return NextResponse.json({ error: 'Alert cannot be resolved' }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`,
      alert,
    })
  } catch (error) {
    logger.error('Alert action API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    })

    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}

// Alert summary
function getAlertSummary(): {
  total: number
  active: number
  acknowledged: number
  resolved: number
  bySeverity: Record<AlertSeverity, number>
  bySource: Record<string, number>
} {
  const allAlerts = Array.from(alerts.values())

  const bySeverity: Record<AlertSeverity, number> = {
    [AlertSeverity.LOW]: 0,
    [AlertSeverity.MEDIUM]: 0,
    [AlertSeverity.HIGH]: 0,
    [AlertSeverity.CRITICAL]: 0,
  }

  const bySource: Record<string, number> = {}

  let active = 0
  let acknowledged = 0
  let resolved = 0

  allAlerts.forEach(alert => {
    // Count by status
    if (alert.status === AlertStatus.ACTIVE) active++
    else if (alert.status === AlertStatus.ACKNOWLEDGED) acknowledged++
    else if (alert.status === AlertStatus.RESOLVED) resolved++

    // Count by severity
    bySeverity[alert.severity]++

    // Count by source
    bySource[alert.source] = (bySource[alert.source] || 0) + 1
  })

  return {
    total: allAlerts.length,
    active,
    acknowledged,
    resolved,
    bySeverity,
    bySource,
  }
}

// Alert creation function (to be used by monitoring systems)
export function createAlert(
  title: string,
  description: string,
  severity: AlertSeverity,
  source: string,
  metadata?: Record<string, any>
): string {
  const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const alert: Alert = {
    id: alertId,
    title,
    description,
    severity,
    status: AlertStatus.ACTIVE,
    source,
    timestamp: new Date(),
    metadata,
  }

  alerts.set(alertId, alert)

  logger.warn('Alert created', {
    alertId,
    title,
    severity,
    source,
  })

  return alertId
}

// Convenience functions for creating specific alerts
export const alerting = {
  // System alerts
  systemDown: (service: string, details?: any) =>
    createAlert(
      `System Service Down: ${service}`,
      `The ${service} service is not responding`,
      AlertSeverity.CRITICAL,
      'system',
      details
    ),

  highMemoryUsage: (percentage: number) =>
    createAlert(
      'High Memory Usage',
      `Memory usage is at ${percentage}%`,
      percentage > 95 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
      'system',
      { memoryPercentage: percentage }
    ),

  // Database alerts
  databaseConnectionFailed: (error: string) =>
    createAlert(
      'Database Connection Failed',
      `Unable to connect to database: ${error}`,
      AlertSeverity.CRITICAL,
      'database',
      { error }
    ),

  slowDatabaseQuery: (query: string, duration: number) =>
    createAlert(
      'Slow Database Query',
      `Query took ${duration}ms to execute`,
      duration > 10000 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      'database',
      { query: query.substring(0, 100), duration }
    ),

  // API alerts
  highErrorRate: (endpoint: string, errorRate: number) =>
    createAlert(
      'High API Error Rate',
      `Error rate for ${endpoint} is ${errorRate}%`,
      errorRate > 10 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      'api',
      { endpoint, errorRate }
    ),

  rateLimitExceeded: (clientId: string, endpoint: string) =>
    createAlert(
      'Rate Limit Exceeded',
      `Client ${clientId} exceeded rate limit for ${endpoint}`,
      AlertSeverity.MEDIUM,
      'security',
      { clientId, endpoint }
    ),

  // Security alerts
  suspiciousActivity: (userId?: string, activity?: string, details?: any) =>
    createAlert(
      'Suspicious Activity Detected',
      activity || 'Unusual activity pattern detected',
      AlertSeverity.HIGH,
      'security',
      { userId, activity, ...details }
    ),

  authenticationFailure: (attempts: number, ip?: string) =>
    createAlert(
      'Multiple Authentication Failures',
      `${attempts} failed authentication attempts`,
      attempts > 10 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      'security',
      { attempts, ip }
    ),

  // B2Chat alerts
  b2chatAPIDown: (error: string) =>
    createAlert(
      'B2Chat API Unavailable',
      `Cannot connect to B2Chat API: ${error}`,
      AlertSeverity.HIGH,
      'external_api',
      { service: 'b2chat', error }
    ),

  syncFailed: (entityType: string, error: string) =>
    createAlert(
      `Sync Failed: ${entityType}`,
      `Failed to sync ${entityType} data: ${error}`,
      AlertSeverity.MEDIUM,
      'sync',
      { entityType, error }
    ),
}

// Auto-resolve old alerts (could be run periodically)
export function resolveOldAlerts(maxAge: number = 7 * 24 * 60 * 60 * 1000): number { // 7 days
  const cutoff = new Date(Date.now() - maxAge)
  let resolvedCount = 0

  for (const [id, alert] of alerts.entries()) {
    if (alert.timestamp < cutoff && alert.status !== AlertStatus.RESOLVED) {
      alert.status = AlertStatus.RESOLVED
      alert.resolvedAt = new Date()
      resolvedCount++
    }
  }

  if (resolvedCount > 0) {
    logger.info('Auto-resolved old alerts', { count: resolvedCount })
  }

  return resolvedCount
}