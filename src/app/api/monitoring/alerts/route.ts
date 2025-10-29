/**
 * Alerts API - Alert management endpoints
 *
 * Provides REST endpoints for managing system alerts including
 * listing, acknowledging, and resolving alerts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'
import { dashboardRateLimit } from '@/lib/rate-limit'
import { validateRequestBody, validateSearchParams, createValidationError, isValidationError } from '@/lib/validation'
import { z } from 'zod'
import {
  AlertSeverity,
  AlertStatus,
  getAllAlerts,
  getAlert,
  acknowledgeAlert,
  resolveAlert,
  getAlertSummary
} from '@/lib/monitoring/alerts'

export const dynamic = 'force-dynamic'

// Validation schemas
const AlertQuerySchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved', 'all']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  source: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
})

const AlertActionSchema = z.object({
  action: z.enum(['acknowledge', 'resolve']),
  alertId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  let userId: string | null = null;

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
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

    const { status = 'all', severity, source, limit = '50', offset = '0' } = validationResult
    const limitNum = parseInt(limit)
    const offsetNum = parseInt(offset)

    // Get all alerts
    let alerts = getAllAlerts()

    // Apply filters
    if (status !== 'all') {
      alerts = alerts.filter(alert => alert.status === status)
    }

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity)
    }

    if (source) {
      alerts = alerts.filter(alert => alert.source.includes(source))
    }

    // Apply pagination
    const total = alerts.length
    const paginatedAlerts = alerts.slice(offsetNum, offsetNum + limitNum)

    // Get summary if requested
    const summary = getAlertSummary()

    return NextResponse.json({
      alerts: paginatedAlerts,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
      summary,
    })

  } catch (error) {
    logger.error('Alerts API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: userId ?? undefined,
    })

    return NextResponse.json(
      { error: 'Failed to retrieve alerts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
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

    const { action, alertId } = validationResult

    // Get the alert
    const alert = getAlert(alertId)
    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    // Perform the action
    let updatedAlert
    switch (action) {
      case 'acknowledge':
        updatedAlert = acknowledgeAlert(alertId, userId)
        break
      case 'resolve':
        updatedAlert = resolveAlert(alertId, userId)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    if (!updatedAlert) {
      return NextResponse.json(
        { error: 'Failed to update alert' },
        { status: 500 }
      )
    }

    logger.info('Alert action performed', {
      action,
      alertId,
      userId: userId ?? undefined,
      severity: updatedAlert.severity,
    })

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
    })

  } catch (error) {
    logger.error('Alert action API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: userId ?? undefined,
    })

    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}