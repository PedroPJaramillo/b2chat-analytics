import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/reconcile-contacts
 *
 * Fix 006: Contact Deduplication - Reconciliation Endpoint
 *
 * Optional background job for data quality monitoring and cleanup:
 * - Finds and reports stale stub contacts (needsFullSync=true for >7 days)
 * - Provides statistics on contact data quality
 * - Helps identify contacts that may need manual review
 */
export async function POST() {
  let userId: string | null = null

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting contact reconciliation', { userId })

    const results = {
      staleStubsFound: 0,
      totalStubs: 0,
      totalFullContacts: 0,
      totalUpgradedContacts: 0,
      staleStubIds: [] as string[],
    }

    // Count contacts by sync source
    const [totalStubs, totalFullContacts, totalUpgradedContacts] = await Promise.all([
      prisma.contact.count({
        where: { syncSource: 'chat_embedded' },
      }),
      prisma.contact.count({
        where: { syncSource: 'contacts_api' },
      }),
      prisma.contact.count({
        where: { syncSource: 'upgraded' },
      }),
    ])

    results.totalStubs = totalStubs
    results.totalFullContacts = totalFullContacts
    results.totalUpgradedContacts = totalUpgradedContacts

    // Find stale stubs (needsFullSync=true for >7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const staleStubs = await prisma.contact.findMany({
      where: {
        needsFullSync: true,
        lastSyncAt: { lt: sevenDaysAgo },
      },
      select: {
        id: true,
        b2chatId: true,
        fullName: true,
        lastSyncAt: true,
      },
      take: 100, // Limit to first 100 for reporting
    })

    results.staleStubsFound = staleStubs.length
    results.staleStubIds = staleStubs.map(s => s.b2chatId)

    // Log warnings for stale stubs
    if (staleStubs.length > 0) {
      logger.warn('Found stale stub contacts needing full sync', {
        userId,
        count: staleStubs.length,
        oldestStub: staleStubs[0]?.b2chatId,
        oldestLastSync: staleStubs[0]?.lastSyncAt,
      })
    }

    // Audit log the reconciliation
    await auditLogger.log({
      userId,
      eventType: AuditEventType.DATA_VIEWED,
      severity: AuditSeverity.LOW,
      success: true,
      resource: 'contact_reconciliation',
      details: {
        staleStubsFound: results.staleStubsFound,
        totalStubs: results.totalStubs,
        totalFullContacts: results.totalFullContacts,
        totalUpgradedContacts: results.totalUpgradedContacts,
      },
    })

    logger.info('Contact reconciliation completed', {
      userId,
      ...results,
    })

    return NextResponse.json({
      success: true,
      results: {
        summary: {
          totalStubs: results.totalStubs,
          totalFullContacts: results.totalFullContacts,
          totalUpgradedContacts: results.totalUpgradedContacts,
          staleStubsFound: results.staleStubsFound,
        },
        staleStubs: staleStubs.map(stub => ({
          b2chatId: stub.b2chatId,
          fullName: stub.fullName,
          lastSyncAt: stub.lastSyncAt,
          daysSinceLastSync: Math.floor(
            (Date.now() - (stub.lastSyncAt?.getTime() || Date.now())) / (24 * 60 * 60 * 1000)
          ),
        })),
        recommendations: results.staleStubsFound > 0
          ? [
              'Run contact extraction to upgrade stale stubs',
              'Review stale contacts - they may be deleted from B2Chat',
            ]
          : ['No action needed - all contacts are up to date'],
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('Contact reconciliation failed', {
      userId: userId ?? undefined,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Audit log the failure
    if (userId) {
      await auditLogger.log({
        userId,
        eventType: AuditEventType.DATA_VIEWED,
        severity: AuditSeverity.MEDIUM,
        success: false,
        resource: 'contact_reconciliation',
        details: {
          error: errorMessage,
        },
      })
    }

    return NextResponse.json(
      { error: 'Failed to reconcile contacts' },
      { status: 500 }
    )
  }
}
