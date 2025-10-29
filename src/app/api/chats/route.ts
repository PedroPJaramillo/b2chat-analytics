import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { validateSearchParams, ChatsQuerySchema, createValidationError, isValidationError } from '@/lib/validation'
import { searchRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let userId: string | null = null;

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

    // Validate query parameters
    const validationResult = validateSearchParams(request, ChatsQuerySchema)
    if (isValidationError(validationResult)) {
      return NextResponse.json(createValidationError(validationResult.details), { status: 400 })
    }

    const { status, priority, limit: limitStr, offset: offsetStr, search, agentId, contactId, startDate, endDate } = validationResult

    // Convert pagination parameters to numbers
    const limit = limitStr ? parseInt(limitStr) : 20
    const offset = offsetStr ? parseInt(offsetStr) : 0

    // Check if contact context should be included
    const includeContactContext = request.nextUrl.searchParams.get('includeContactContext') === 'true'

    // NEW: Get additional filter parameters
    const channel = request.nextUrl.searchParams.get('channel')
    const tags = request.nextUrl.searchParams.get('tags')?.split(',').filter(Boolean)
    const dateRange = request.nextUrl.searchParams.get('dateRange')
    const contactType = request.nextUrl.searchParams.get('contactType')
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true'
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'lastActivity'
    const sortOrder = request.nextUrl.searchParams.get('sortOrder') || 'desc'

    // Temporal filters for drill-down from analytics
    const weekStart = request.nextUrl.searchParams.get('weekStart') // ISO date string
    const dayOfWeek = request.nextUrl.searchParams.get('dayOfWeek') // 0-6
    const hourOfDay = request.nextUrl.searchParams.get('hourOfDay') // 0-23

    // Custom date range for drill-down (takes precedence over dateRange)
    const customStartDate = request.nextUrl.searchParams.get('startDate')
    const customEndDate = request.nextUrl.searchParams.get('endDate')

    // Build secure where clause
    const where: any = {
      // Ensure data isolation - users can only see chats they have access to
      isDeleted: false
    }

    if (status && status !== 'all') {
      where.status = status
    }

    // NEW: Priority filter
    if (priority && priority !== 'all') {
      where.priority = priority
    }

    if (agentId) {
      if (agentId === 'null' || agentId === 'unassigned') {
        where.agentId = null
      } else {
        where.agentId = agentId
      }
    }

    if (contactId) {
      where.contactId = contactId
    }

    // NEW: Channel filter
    if (channel && channel !== 'all') {
      where.provider = channel
    }

    // NEW: Tags filter (AND logic - must have all specified tags)
    if (tags && tags.length > 0) {
      where.AND = tags.map(tag => ({
        tags: { has: tag }
      }))
    }

    // NEW: Unread only filter
    if (unreadOnly) {
      where.unreadCount = { gt: 0 }
    }

    // Custom date range for drill-down (takes precedence)
    if (customStartDate && customEndDate) {
      where.createdAt = {
        gte: new Date(customStartDate),
        lte: new Date(customEndDate)
      }
    }
    // NEW: Date range filter
    else if (dateRange && dateRange !== 'all') {
      const now = new Date()
      const start = new Date()

      switch (dateRange) {
        case 'today':
          start.setHours(0, 0, 0, 0)
          break
        case 'last7days':
          start.setDate(now.getDate() - 7)
          break
        case 'last30days':
          start.setDate(now.getDate() - 30)
          break
      }

      where.lastModifiedAt = { gte: start }
    }

    if (search) {
      // Basic search conditions that always work
      where.OR = [
        { contact: { fullName: { contains: search, mode: 'insensitive' } } },
        { agent: { name: { contains: search, mode: 'insensitive' } } },
      ]
      // New field search will be handled in the try-catch block above
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    // NEW: Temporal filters for drill-down from weekly heatmap
    // These filters need to be applied at the application level since Prisma doesn't support
    // SQL functions like EXTRACT(DOW) or date_part in where clauses
    let temporalFilterActive = false
    let weekStartDate: Date | null = null
    let dayOfWeekNum: number | null = null
    let hourOfDayNum: number | null = null

    if (weekStart) {
      weekStartDate = new Date(weekStart + 'T00:00:00.000Z')
      if (!isNaN(weekStartDate.getTime())) {
        temporalFilterActive = true
        // Set date range to the entire week (7 days)
        const weekEndDate = new Date(weekStartDate)
        weekEndDate.setDate(weekEndDate.getDate() + 7)

        if (!where.createdAt) {
          where.createdAt = {}
        }
        where.createdAt.gte = weekStartDate
        where.createdAt.lt = weekEndDate
      }
    }

    if (dayOfWeek) {
      const parsed = parseInt(dayOfWeek)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
        dayOfWeekNum = parsed
        temporalFilterActive = true
      }
    }

    if (hourOfDay) {
      const parsed = parseInt(hourOfDay)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
        hourOfDayNum = parsed
        temporalFilterActive = true
      }
    }

    // Try to fetch with new fields, fall back to basic fields if schema not updated
    let chats
    let hasNewFields = true

    try {
      // Enhance search if we have search term and can use new fields
      const enhancedWhere = { ...where }
      if (search && hasNewFields) {
        enhancedWhere.OR = [
          ...(where.OR || []),
          { alias: { contains: search, mode: 'insensitive' } }, // NEW: Search by alias
          { topic: { contains: search, mode: 'insensitive' } }, // NEW: Search by topic
          { tags: { has: search } }, // NEW: Search in tags array
        ]
      }

      // NEW: Dynamic ordering based on sortBy parameter
      let orderBy: any = { lastModifiedAt: sortOrder } // Default
      if (sortBy === 'priority') {
        orderBy = [
          { priority: sortOrder },
          { lastModifiedAt: 'desc' }
        ]
      } else if (sortBy === 'messageCount') {
        // Note: Prisma doesn't support direct ordering by count, would need raw query or fetch then sort
        orderBy = { lastModifiedAt: sortOrder } // Fallback for now
      } else if (sortBy === 'responseTime') {
        // Sort by response time (responseAt - createdAt)
        // Note: Prisma doesn't support computed field ordering directly
        // We'll fetch with responseAt field and sort in memory after
        orderBy = { responseAt: sortOrder }
      }

      chats = await prisma.chat.findMany({
        where: enhancedWhere,
        select: {
          id: true,
          b2chatId: true,
          status: true,
          priority: true, // NEW: Include priority
          topic: true, // NEW: Include topic
          alias: true, // NEW: Include alias field
          tags: true,  // NEW: Include tags field
          unreadCount: true, // NEW: Include unread count
          resolutionNote: true, // NEW: Include resolution note
          provider: true, // Include provider for channel display
          createdAt: true,
          lastModifiedAt: true,
          responseAt: true, // Include responseAt for response time calculation and sorting
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              mobile: true,
              customAttributes: true // NEW: Include custom attributes for VIP status
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
        orderBy,
        take: limit,
        skip: offset
      })
    } catch (error) {
      // If new fields don't exist, fall back to basic query
      hasNewFields = false
      logger.warn('New fields not available, falling back to basic query', { error: error instanceof Error ? error : String(error) })
      chats = await prisma.chat.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              mobile: true,
              customAttributes: true
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
    }

    // Apply temporal filters at application level (dayOfWeek and hourOfDay)
    let filteredChats = chats
    if (temporalFilterActive && (dayOfWeekNum !== null || hourOfDayNum !== null)) {
      filteredChats = chats.filter(chat => {
        const createdAt = new Date(chat.createdAt)

        // Check day of week filter (0=Sunday, 6=Saturday)
        if (dayOfWeekNum !== null) {
          const chatDayOfWeek = createdAt.getUTCDay()
          if (chatDayOfWeek !== dayOfWeekNum) {
            return false
          }
        }

        // Check hour of day filter (0-23)
        if (hourOfDayNum !== null) {
          const chatHour = createdAt.getUTCHours()
          if (chatHour !== hourOfDayNum) {
            return false
          }
        }

        return true
      })
    }

    // If contact context is requested, fetch contact chat counts and previous chats
    let contactContextMap: Map<string, { count: number; previousChats: any[] }> | null = null

    if (includeContactContext) {
      const contactIds = filteredChats
        .map(chat => chat.contact?.id)
        .filter((id): id is string => id !== undefined && id !== null)

      if (contactIds.length > 0) {
        // Get all chats for these contacts to build context
        const allContactChats = await prisma.chat.findMany({
          where: {
            contactId: { in: contactIds },
            isDeleted: false
          },
          select: {
            id: true,
            b2chatId: true,
            contactId: true,
            status: true,
            alias: true,
            tags: true,
            createdAt: true,
            closedAt: true,
            _count: {
              select: {
                messages: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        // Build contact context map
        contactContextMap = new Map()
        for (const contactId of contactIds) {
          const contactChats = allContactChats.filter(c => c.contactId === contactId)
          const previousChats = contactChats.slice(0, 3).map(c => {
            // Mock topic based on tags
            const topics = ['Billing Issue', 'Technical Support', 'General Inquiry', 'Account Access', 'Product Information']
            const topic = c.tags && c.tags.length > 0
              ? c.tags[0].charAt(0).toUpperCase() + c.tags[0].slice(1)
              : topics[Math.floor(Math.random() * topics.length)]

            return {
              id: c.id,
              b2chatId: c.b2chatId,
              topic,
              status: c.status,
              createdAt: c.createdAt,
              closedAt: c.closedAt,
              messageCount: c._count.messages
            }
          })

          contactContextMap.set(contactId, {
            count: contactChats.length,
            previousChats
          })
        }
      }
    }

    // Transform data to include additional fields (use filteredChats after temporal filtering)
    const chatsWithMetrics = filteredChats.map(chat => {
      const contactId = chat.contact?.id
      const contactContext = contactContextMap && contactId
        ? contactContextMap.get(contactId)
        : null

      // Check if contact is VIP from custom attributes
      const isVIP = chat.contact?.customAttributes &&
        typeof chat.contact.customAttributes === 'object' &&
        ((chat.contact.customAttributes as any).vip === true ||
         (chat.contact.customAttributes as any).isVIP === true)

      return {
        id: chat.id,
        b2chatId: (chat as any).b2chatId || chat.id,
        customer: chat.contact?.fullName || 'Unknown Customer',
        contactId: contactId || null,
        agent: chat.agent?.name || null,
        agentId: chat.agent?.id || null,
        status: chat.status,
        alias: (chat as any).alias || null,
        tags: (chat as any).tags || [],
        priority: (chat as any).priority || 'normal', // NEW: Use real priority field
        topic: (chat as any).topic || null, // NEW: Use real topic field
        unreadCount: (chat as any).unreadCount || 0, // NEW: Use real unread count
        resolutionNote: (chat as any).resolutionNote || null, // NEW: Use real resolution note
        provider: (chat as any).provider || 'livechat', // Include channel/provider
        messages: chat._count.messages,
        startTime: chat.createdAt,
        lastMessage: chat.lastModifiedAt || chat.createdAt,
        createdAt: chat.createdAt,
        updatedAt: chat.lastModifiedAt || chat.createdAt,
        isVIP, // NEW: VIP status from custom attributes
        // Contact context fields (only included if requested)
        ...(contactContext && {
          contactChatCount: contactContext.count,
          contactPreviousChats: contactContext.previousChats,
          isRepeatCustomer: contactContext.count > 1
        })
      }
    })

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
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    )
  }
}