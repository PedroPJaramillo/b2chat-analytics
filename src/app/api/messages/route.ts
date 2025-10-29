// API route for fetching messages across chats (Messages View)

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { searchRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let userId: string | null = null

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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all' // all, unread, customer, agent
    const priority = searchParams.get('priority')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause for messages
    const messageWhere: any = {}

    // Filter by message type (customer/agent)
    if (type === 'customer') {
      messageWhere.incoming = true
    } else if (type === 'agent') {
      messageWhere.incoming = false
    }

    // Search in message text
    if (search) {
      messageWhere.text = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Build where clause for related chat
    const chatWhere: any = {
      isDeleted: false
    }

    if (priority && priority !== 'all') {
      chatWhere.priority = priority
    }

    if (status && status !== 'all') {
      chatWhere.status = status
    }

    // Fetch messages with related chat and contact data
    const messages = await prisma.message.findMany({
      where: {
        ...messageWhere,
        chat: chatWhere
      },
      select: {
        id: true,
        chatId: true,
        text: true,
        type: true,
        incoming: true,
        timestamp: true,
        chat: {
          select: {
            id: true,
            topic: true,
            priority: true,
            status: true,
            contact: {
              select: {
                fullName: true,
                email: true
              }
            },
            agent: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const totalCount = await prisma.message.count({
      where: {
        ...messageWhere,
        chat: chatWhere
      }
    })

    // Transform messages to include enriched data
    const enrichedMessages = messages.map(message => ({
      id: message.id,
      chatId: message.chatId,
      text: message.text,
      type: message.type,
      incoming: message.incoming,
      timestamp: message.timestamp,
      // Enriched fields
      customer: message.chat.contact?.fullName || 'Unknown',
      customerEmail: message.chat.contact?.email || null,
      sender: message.incoming
        ? (message.chat.contact?.fullName || 'Customer')
        : (message.chat.agent?.name || 'Agent'),
      senderIsAgent: !message.incoming,
      chatTopic: message.chat.topic,
      chatPriority: message.chat.priority,
      chatStatus: message.chat.status
    }))

    return NextResponse.json({
      data: enrichedMessages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    logger.error('Error fetching messages', {
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
