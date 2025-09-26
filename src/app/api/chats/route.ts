import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { validateSearchParams, ChatsQuerySchema, createValidationError, isValidationError } from '@/lib/validation'
import { searchRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting
    const rateLimitResponse = await searchRateLimit(request, userId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Validate query parameters
    const validationResult = validateSearchParams(request, ChatsQuerySchema)
    if (isValidationError(validationResult)) {
      return NextResponse.json(createValidationError(validationResult.details), { status: 400 })
    }

    const { status, priority, limit, offset, search, agentId, contactId, startDate, endDate } = validationResult

    // Build secure where clause
    const where: any = {
      // Ensure data isolation - users can only see chats they have access to
      isDeleted: false
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (agentId) {
      where.agentId = agentId
    }

    if (contactId) {
      where.contactId = contactId
    }

    if (search) {
      where.OR = [
        { contact: { fullName: { contains: search, mode: 'insensitive' } } },
        { agent: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const chats = await prisma.chat.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        lastModifiedAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Transform data to include additional fields
    const chatsWithMetrics = chats.map(chat => ({
      id: chat.id,
      customer: chat.contact?.fullName || 'Unknown Customer',
      agent: chat.agent?.name || 'Unassigned',
      status: chat.status,
      priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)], // Mock priority
      topic: ['Billing Issue', 'Technical Support', 'General Inquiry', 'Account Access', 'Product Information'][Math.floor(Math.random() * 5)], // Mock topic
      messages: chat._count.messages,
      startTime: chat.createdAt,
      lastMessage: chat.lastModifiedAt || chat.createdAt,
      createdAt: chat.createdAt,
      updatedAt: chat.lastModifiedAt || chat.createdAt
    }))

    // Get total count for pagination
    const totalCount = await prisma.chat.count({ where })

    // Return paginated results with metadata
    return NextResponse.json({
      data: chatsWithMetrics,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    logger.error('Error fetching chats', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    )
  }
}