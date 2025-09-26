import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { B2ChatClient } from '@/lib/b2chat/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get B2Chat total counts
    const b2chatClient = new B2ChatClient()
    const b2chatTotals = await b2chatClient.getTotalCounts()

    // Get local synced counts
    const [contactsCount, chatsCount] = await Promise.all([
      prisma.contact.count(),
      prisma.chat.count()
    ])

    return NextResponse.json({
      b2chat: {
        contacts: b2chatTotals.contacts,
        chats: b2chatTotals.chats,
        total: b2chatTotals.contacts + b2chatTotals.chats
      },
      synced: {
        contacts: contactsCount,
        chats: chatsCount,
        total: contactsCount + chatsCount
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