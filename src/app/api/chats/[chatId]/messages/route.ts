import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Query parameters validation schema
const MessageQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.enum(['text', 'image', 'file']).optional(),
  incoming: z.coerce.boolean().optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams)

    // Validate query parameters
    const validatedParams = MessageQuerySchema.parse(queryParams)
    const { page, limit, type, incoming, search, startDate, endDate } = validatedParams

    // Check if chat exists and user has access
    const chat = await prisma.chat.findUnique({
      where: { id: resolvedParams.chatId },
      select: { id: true, b2chatId: true, alias: true }
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    // Build where clause for filtering
    const whereClause: any = {
      chatId: resolvedParams.chatId,
    }

    if (type) {
      whereClause.type = type
    }

    if (typeof incoming === 'boolean') {
      whereClause.incoming = incoming
    }

    if (search) {
      whereClause.text = {
        contains: search,
        mode: 'insensitive'
      }
    }

    if (startDate || endDate) {
      whereClause.timestamp = {}
      if (startDate) {
        whereClause.timestamp.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.timestamp.lte = new Date(endDate)
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get total count for pagination
    const totalMessages = await prisma.message.count({
      where: whereClause
    })

    // Fetch messages with pagination
    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        text: true,
        type: true,
        incoming: true,
        imageUrl: true,
        fileUrl: true,
        caption: true,
        timestamp: true,
      }
    })

    // Calculate pagination info
    const totalPages = Math.ceil(totalMessages / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    const response = {
      messages,
      pagination: {
        page,
        limit,
        totalMessages,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      chat: {
        id: chat.id,
        b2chatId: chat.b2chatId,
        alias: chat.alias
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    const resolvedParams = await params
    logger.error('Failed to fetch messages', {
      chatId: resolvedParams.chatId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}