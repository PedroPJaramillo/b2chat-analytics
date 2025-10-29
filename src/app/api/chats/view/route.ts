import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  calculateChatResponseTimes,
  formatResponseTime,
  getResponseTimeIndicator,
  type MessageForResponseTime,
} from '@/lib/chat-response-time'
import type { ChatStatus, ChatPriority, ChatProvider } from '@/types/chat'
import type { ChatViewItem, ChatViewResponse } from '@/types/chat-view'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // 1 minute cache

export async function GET(request: NextRequest) {
  let userId: string | null = null

  try {
    // Authentication check (Pattern 16)
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '25', 10)

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 })
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'Invalid limit parameter (must be 1-100)' }, { status: 400 })
    }

    // Filter parameters - existing
    const statusParam = searchParams.get('status') || undefined
    const statuses: ChatStatus[] | undefined = statusParam
      ? statusParam.split(',').map(s => s.trim() as ChatStatus)
      : undefined

    const agentId = searchParams.get('agentId') || undefined
    const search = searchParams.get('search') || undefined // Contact name search

    const responseTimeMinStr = searchParams.get('responseTimeMin')
    const responseTimeMaxStr = searchParams.get('responseTimeMax')

    const responseTimeMin = responseTimeMinStr ? parseInt(responseTimeMinStr, 10) : undefined
    const responseTimeMax = responseTimeMaxStr ? parseInt(responseTimeMaxStr, 10) : undefined

    // Validate response time parameters
    if (responseTimeMin !== undefined && (isNaN(responseTimeMin) || responseTimeMin < 0)) {
      return NextResponse.json({ error: 'Invalid responseTimeMin parameter' }, { status: 400 })
    }
    if (responseTimeMax !== undefined && (isNaN(responseTimeMax) || responseTimeMax < 0)) {
      return NextResponse.json({ error: 'Invalid responseTimeMax parameter' }, { status: 400 })
    }

    // Filter parameters - Feature 011
    const departmentId = searchParams.get('departmentId') || undefined

    const priorityParam = searchParams.get('priority') || undefined
    const priorities: ChatPriority[] | undefined = priorityParam
      ? priorityParam.split(',').map(p => p.trim() as ChatPriority)
      : undefined

    const slaStatus = searchParams.get('slaStatus') || undefined
    if (slaStatus && !['within', 'breached'].includes(slaStatus)) {
      return NextResponse.json({ error: 'Invalid slaStatus parameter (must be within or breached)' }, { status: 400 })
    }

    const providerParam = searchParams.get('provider') || undefined
    const providers: ChatProvider[] | undefined = providerParam
      ? providerParam.split(',').map(p => p.trim() as ChatProvider)
      : undefined

    const messageCountRange = searchParams.get('messageCountRange') || undefined
    if (messageCountRange && !['0', '1-5', '6-10', '11-20', '20+'].includes(messageCountRange)) {
      return NextResponse.json({ error: 'Invalid messageCountRange parameter' }, { status: 400 })
    }

    const createdAtStart = searchParams.get('createdAtStart') || undefined
    const createdAtEnd = searchParams.get('createdAtEnd') || undefined
    const updatedAtStart = searchParams.get('updatedAtStart') || undefined
    const updatedAtEnd = searchParams.get('updatedAtEnd') || undefined

    // Validate date parameters
    if (createdAtStart && isNaN(Date.parse(createdAtStart))) {
      return NextResponse.json({ error: 'Invalid createdAtStart parameter (must be ISO date)' }, { status: 400 })
    }
    if (createdAtEnd && isNaN(Date.parse(createdAtEnd))) {
      return NextResponse.json({ error: 'Invalid createdAtEnd parameter (must be ISO date)' }, { status: 400 })
    }
    if (updatedAtStart && isNaN(Date.parse(updatedAtStart))) {
      return NextResponse.json({ error: 'Invalid updatedAtStart parameter (must be ISO date)' }, { status: 400 })
    }
    if (updatedAtEnd && isNaN(Date.parse(updatedAtEnd))) {
      return NextResponse.json({ error: 'Invalid updatedAtEnd parameter (must be ISO date)' }, { status: 400 })
    }

    // Sorting parameters - Feature 011 extended
    const sortBy = searchParams.get('sortBy') || 'updatedAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const validSortFields = ['responseTime', 'updatedAt', 'createdAt', 'messageCount', 'status', 'priority', 'departmentName', 'agentName', 'contactName', 'slaStatus']
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json({ error: `Invalid sortBy parameter (must be one of: ${validSortFields.join(', ')})` }, { status: 400 })
    }

    // Build WHERE clause
    const where: Prisma.ChatWhereInput = {
      isDeleted: false,
    }

    // Status filter
    if (statuses && statuses.length > 0) {
      where.status = { in: statuses }
    }

    // Agent filter
    if (agentId) {
      if (agentId === 'null' || agentId === 'unassigned') {
        where.agentId = null
      } else {
        where.agentId = agentId
      }
    }

    // Contact name search
    if (search) {
      where.contact = {
        fullName: { contains: search, mode: 'insensitive' }
      }
    }

    // Feature 011: Department filter
    if (departmentId) {
      where.departmentId = departmentId
    }

    // Feature 011: Priority filter
    if (priorities && priorities.length > 0) {
      where.priority = { in: priorities }
    }

    // Feature 011: SLA Status filter
    if (slaStatus) {
      where.overallSLA = slaStatus === 'within'
    }

    // Feature 011: Provider filter
    if (providers && providers.length > 0) {
      where.provider = { in: providers }
    }

    // Feature 011: Created at date range
    if (createdAtStart || createdAtEnd) {
      where.createdAt = {}
      if (createdAtStart) {
        where.createdAt.gte = new Date(createdAtStart)
      }
      if (createdAtEnd) {
        where.createdAt.lte = new Date(createdAtEnd)
      }
    }

    // Feature 011: Updated at date range (using lastModifiedAt)
    if (updatedAtStart || updatedAtEnd) {
      where.lastModifiedAt = {}
      if (updatedAtStart) {
        where.lastModifiedAt.gte = new Date(updatedAtStart)
      }
      if (updatedAtEnd) {
        where.lastModifiedAt.lte = new Date(updatedAtEnd)
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Fetch total count (before response time and message count filtering)
    const total = await prisma.chat.count({ where })

    // Fetch chats with messages, agent, contact, and department (Feature 011)
    const chats = await prisma.chat.findMany({
      where,
      select: {
        id: true,
        b2chatId: true,
        status: true,
        priority: true, // Feature 011
        provider: true, // Feature 011
        overallSLA: true, // Feature 011
        tags: true, // Feature 011
        topic: true, // Feature 011
        unreadCount: true, // Feature 011
        direction: true, // Feature 011
        lastModifiedAt: true,
        createdAt: true,
        openedAt: true, // Feature 011
        pickedUpAt: true, // Feature 011
        responseAt: true, // Feature 011
        closedAt: true, // Feature 011
        pickupSLA: true, // Feature 011
        firstResponseSLA: true, // Feature 011
        avgResponseSLA: true, // SLA Tooltips
        resolutionSLA: true, // Feature 011
        // SLA Tooltips: Business Hours fields
        overallSLABH: true,
        pickupSLABH: true,
        firstResponseSLABH: true,
        avgResponseSLABH: true,
        resolutionSLABH: true,
        timeToPickupBH: true,
        firstResponseTimeBH: true,
        avgResponseTimeBH: true,
        resolutionTimeBH: true,
        contact: {
          select: {
            id: true,
            fullName: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true
          }
        },
        department: { // Feature 011
          select: {
            id: true,
            name: true
          }
        },
        messages: {
          select: {
            timestamp: true,
            incoming: true
          },
          orderBy: {
            timestamp: 'asc'
          }
        }
      },
      orderBy: sortBy === 'updatedAt'
        ? { createdAt: sortOrder }
        : sortBy === 'createdAt'
        ? { createdAt: sortOrder }
        : sortBy === 'messageCount'
        ? { createdAt: sortOrder } // Will sort by message count later
        : { lastModifiedAt: sortOrder },
      skip: ['responseTime', 'messageCount'].includes(sortBy) ? 0 : skip,
      take: ['responseTime', 'messageCount'].includes(sortBy) ? undefined : limit
    })

    // Calculate response times for each chat
    const chatsWithResponseTimes: ChatViewItem[] = chats.map(chat => {
      // Transform messages to format expected by calculation function
      const messages: MessageForResponseTime[] = chat.messages.map(msg => ({
        timestamp: msg.timestamp,
        sender: msg.incoming ? 'customer' : 'agent'
      }))

      const responseMetrics = calculateChatResponseTimes(messages)

      // Calculate pickup time and resolution time (Feature 011)
      const pickupTimeMs = chat.openedAt && chat.pickedUpAt
        ? chat.pickedUpAt.getTime() - chat.openedAt.getTime()
        : null

      const resolutionTimeMs = chat.openedAt && chat.closedAt
        ? chat.closedAt.getTime() - chat.openedAt.getTime()
        : null

      return {
        id: chat.id,
        b2chatId: chat.b2chatId,
        contactName: chat.contact?.fullName || 'Unknown',
        contactId: chat.contact?.id || '',
        agentName: chat.agent?.name || null,
        agentId: chat.agent?.id || null,
        status: chat.status,
        messageCount: chat.messages.length,
        firstResponseTimeMs: responseMetrics.firstResponseTimeMs,
        firstResponseTimeFormatted: responseMetrics.firstResponseTimeMs
          ? formatResponseTime(responseMetrics.firstResponseTimeMs)
          : null,
        responseTimeIndicator: responseMetrics.firstResponseTimeMs
          ? getResponseTimeIndicator(responseMetrics.firstResponseTimeMs)
          : null,
        lastModifiedAt: chat.lastModifiedAt ? chat.lastModifiedAt.toISOString() : chat.createdAt.toISOString(),
        updatedAt: chat.createdAt.toISOString(),
        // Feature 011: New fields
        departmentName: chat.department?.name || null,
        departmentId: chat.department?.id || null,
        priority: chat.priority,
        slaStatus: chat.overallSLA === null
          ? 'incomplete'
          : chat.overallSLA
            ? 'within'
            : 'breached',
        createdAt: chat.createdAt.toISOString(),
        provider: chat.provider,
        tags: chat.tags || [],
        topic: chat.topic,
        unreadCount: chat.unreadCount,
        openedAt: chat.openedAt?.toISOString() || null,
        pickedUpAt: chat.pickedUpAt?.toISOString() || null,
        responseAt: chat.responseAt?.toISOString() || null,
        closedAt: chat.closedAt?.toISOString() || null,
        pickupTimeMs,
        resolutionTimeMs,
        avgResponseTimeMs: responseMetrics.avgResponseTimeMs,
        direction: chat.direction as 'inbound' | 'outbound' | null,
        // SLA Tooltips: Wall Clock SLA Compliance
        pickupSLA: chat.pickupSLA,
        firstResponseSLA: chat.firstResponseSLA,
        avgResponseSLA: chat.avgResponseSLA,
        resolutionSLA: chat.resolutionSLA,
        overallSLA: chat.overallSLA,
        // SLA Tooltips: Business Hours Time Metrics (convert seconds to milliseconds)
        pickupTimeBHMs: chat.timeToPickupBH ? chat.timeToPickupBH * 1000 : null,
        firstResponseTimeBHMs: chat.firstResponseTimeBH ? chat.firstResponseTimeBH * 1000 : null,
        avgResponseTimeBHMs: chat.avgResponseTimeBH ? chat.avgResponseTimeBH * 1000 : null,
        resolutionTimeBHMs: chat.resolutionTimeBH ? chat.resolutionTimeBH * 1000 : null,
        // SLA Tooltips: Business Hours SLA Compliance
        pickupSLABH: chat.pickupSLABH,
        firstResponseSLABH: chat.firstResponseSLABH,
        avgResponseSLABH: chat.avgResponseSLABH,
        resolutionSLABH: chat.resolutionSLABH,
        overallSLABH: chat.overallSLABH,
      }
    })

    // Apply response time filtering (application-level)
    let filteredChats = chatsWithResponseTimes

    if (responseTimeMin !== undefined || responseTimeMax !== undefined) {
      filteredChats = filteredChats.filter(chat => {
        if (chat.firstResponseTimeMs === null) return false

        if (responseTimeMin !== undefined && chat.firstResponseTimeMs < responseTimeMin) {
          return false
        }

        if (responseTimeMax !== undefined && chat.firstResponseTimeMs > responseTimeMax) {
          return false
        }

        return true
      })
    }

    // Feature 011: Apply message count range filtering (application-level)
    if (messageCountRange) {
      filteredChats = filteredChats.filter(chat => {
        const count = chat.messageCount
        switch (messageCountRange) {
          case '0':
            return count === 0
          case '1-5':
            return count >= 1 && count <= 5
          case '6-10':
            return count >= 6 && count <= 10
          case '11-20':
            return count >= 11 && count <= 20
          case '20+':
            return count > 20
          default:
            return true
        }
      })
    }

    // Sort by response time or message count if requested (application-level)
    if (sortBy === 'responseTime') {
      filteredChats.sort((a, b) => {
        const timeA = a.firstResponseTimeMs ?? Infinity
        const timeB = b.firstResponseTimeMs ?? Infinity
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
      })
      filteredChats = filteredChats.slice(skip, skip + limit)
    } else if (sortBy === 'messageCount') {
      filteredChats.sort((a, b) => {
        return sortOrder === 'asc'
          ? a.messageCount - b.messageCount
          : b.messageCount - a.messageCount
      })
      filteredChats = filteredChats.slice(skip, skip + limit)
    }

    // Calculate pagination metadata
    const adjustedTotal = (responseTimeMin !== undefined || responseTimeMax !== undefined || messageCountRange)
      ? filteredChats.length
      : total

    const totalPages = Math.ceil(adjustedTotal / limit)

    const response: ChatViewResponse = {
      chats: filteredChats,
      pagination: {
        page,
        limit,
        total: adjustedTotal,
        totalPages
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Error fetching chat view', {
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch chat view' },
      { status: 500 }
    )
  }
}
