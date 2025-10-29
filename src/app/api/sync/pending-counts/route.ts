import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/pending-counts
 * Returns pending transformation counts for contacts, chats, and total
 * Only counts data from completed extracts (safety)
 */
export async function GET() {
  let userId: string | null = null;

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get completed extract sync IDs
    const completedExtracts = await prisma.extractLog.findMany({
      where: { status: 'completed' },
      select: { syncId: true, entityType: true },
    })

    // Filter extract IDs by entity type
    const contactExtractIds = completedExtracts
      .filter(e => e.entityType === 'contacts' || e.entityType === 'all')
      .map(e => e.syncId)

    const chatExtractIds = completedExtracts
      .filter(e => e.entityType === 'chats' || e.entityType === 'all')
      .map(e => e.syncId)

    // Count pending contacts and chats from completed extracts in parallel
    const [pendingContacts, pendingChats] = await Promise.all([
      prisma.rawContact.count({
        where: {
          processingStatus: 'pending',
          syncId: { in: contactExtractIds },
        },
      }),
      prisma.rawChat.count({
        where: {
          processingStatus: 'pending',
          syncId: { in: chatExtractIds },
        },
      })
    ])

    logger.info('Pending counts fetched', {
      userId,
      pendingContacts,
      pendingChats,
      completedExtractsCount: completedExtracts.length,
    })

    return NextResponse.json({
      success: true,
      counts: {
        contacts: pendingContacts,
        chats: pendingChats,
        total: pendingContacts + pendingChats,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch pending counts', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Failed to fetch pending counts' },
      { status: 500 }
    )
  }
}
