import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncCancellationManager } from '@/lib/sync/cancellation'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const cancelRequestSchema = z.object({
  syncId: z.string().min(1),
  reason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let userId: string | null = null

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { syncId, reason } = cancelRequestSchema.parse(body)

    if (syncId === 'all') {
      // Cancel all active syncs
      const cancelledCount = syncCancellationManager.cancelAll(reason)
      const success = cancelledCount > 0

      await auditLogger.log({
        userId: userId ?? undefined,
        eventType: AuditEventType.SYNC_CANCELLED,
        severity: AuditSeverity.MEDIUM,
        success,
        resource: 'sync_cancellation_all',
        details: {
          cancelledCount,
          reason: reason || 'User requested cancellation',
        }
      })

      logger.info('User attempted to cancel all active syncs', {
        userId: userId ?? undefined,
        cancelledCount,
        reason,
        success,
      })

      if (!success) {
        return NextResponse.json(
          {
            success: false,
            error: 'No active sync operations to cancel',
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Cancelled ${cancelledCount} sync operation(s)`,
        cancelledCount,
      })
    } else {
      // Cancel specific sync
      const cancelled = syncCancellationManager.cancelSync(syncId, reason)
      const message = cancelled
        ? `Sync operation ${syncId} cancelled successfully`
        : `Sync operation ${syncId} not found or already completed`

      await auditLogger.log({
        userId: userId ?? undefined,
        eventType: AuditEventType.SYNC_CANCELLED,
        severity: AuditSeverity.MEDIUM,
        success: cancelled,
        resource: 'sync_cancellation',
        details: {
          syncId,
          reason: reason || 'User requested cancellation',
        }
      })

      logger.info('User cancelled sync operation', {
        userId: userId ?? undefined,
        syncId,
        success: cancelled,
        reason
      })

      if (!cancelled) {
        return NextResponse.json(
          {
            success: false,
            error: message,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message,
        cancelledCount: 1,
      })
    }

  } catch (error) {
    logger.error('Cancel sync API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: userId ?? undefined
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
