import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { B2ChatClient } from '@/lib/b2chat/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  let userId: string | null = null;

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get B2Chat total counts
    const b2chatClient = new B2ChatClient()
    const b2chatTotals = await b2chatClient.getTotalCounts()

    // Get local synced counts and raw table counts in parallel
    const [
      contactsCount,
      chatsCount,
      stubContactsCount, // Fix 006: Count of contacts needing full sync
      rawContactsData,
      rawChatsData
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.chat.count(),
      // Fix 006: Count stub contacts (need full sync from API)
      prisma.contact.count({
        where: { needsFullSync: true },
      }),
      // Raw contacts grouped by processing status
      prisma.rawContact.groupBy({
        by: ['processingStatus'],
        _count: {
          id: true
        }
      }),
      // Raw chats grouped by processing status
      prisma.rawChat.groupBy({
        by: ['processingStatus'],
        _count: {
          id: true
        }
      })
    ])

    // Calculate raw table statistics
    const rawContactsStats = {
      total: rawContactsData.reduce((sum, item) => sum + item._count.id, 0),
      pending: rawContactsData.find(item => item.processingStatus === 'pending')?._count.id || 0,
      processing: rawContactsData.find(item => item.processingStatus === 'processing')?._count.id || 0,
      completed: rawContactsData.find(item => item.processingStatus === 'completed')?._count.id || 0,
      failed: rawContactsData.find(item => item.processingStatus === 'failed')?._count.id || 0
    }

    const rawChatsStats = {
      total: rawChatsData.reduce((sum, item) => sum + item._count.id, 0),
      pending: rawChatsData.find(item => item.processingStatus === 'pending')?._count.id || 0,
      processing: rawChatsData.find(item => item.processingStatus === 'processing')?._count.id || 0,
      completed: rawChatsData.find(item => item.processingStatus === 'completed')?._count.id || 0,
      failed: rawChatsData.find(item => item.processingStatus === 'failed')?._count.id || 0
    }

    return NextResponse.json({
      b2chat: {
        contacts: b2chatTotals.contacts,
        chats: b2chatTotals.chats,
        total: b2chatTotals.contacts + b2chatTotals.chats
      },
      synced: {
        contacts: contactsCount,
        chats: chatsCount,
        contactsNeedingSync: stubContactsCount, // Fix 006: Stub contacts needing upgrade
        total: contactsCount + chatsCount
      },
      raw: {
        contacts: rawContactsStats,
        chats: rawChatsStats,
        total: rawContactsStats.total + rawChatsStats.total
      },
      syncPercentage: {
        contacts: b2chatTotals.contacts > 0 ? Math.round((contactsCount / b2chatTotals.contacts) * 100) : 100,
        chats: b2chatTotals.chats > 0 ? Math.round((chatsCount / b2chatTotals.chats) * 100) : 100,
        overall: (b2chatTotals.contacts + b2chatTotals.chats) > 0
          ? Math.round(((contactsCount + chatsCount) / (b2chatTotals.contacts + b2chatTotals.chats)) * 100)
          : 100
      }
    })

  } catch (error) {
    logger.error('Sync stats API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Failed to get sync statistics' },
      { status: 500 }
    )
  }
}