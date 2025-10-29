import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { calculateChatResponseTimes, getResponseTimeIndicator } from '@/lib/chat-response-time'
import type { MessagePreview } from '@/types/contact'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  let userId: string | null = null

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contactId } = await params

    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    // Parse query parameters for filtering and sorting
    const { searchParams } = new URL(request.url)

    // Filter parameters
    const statusParam = searchParams.get('status')
    const statusFilter = statusParam ? statusParam.split(',') : undefined
    const agentIdFilter = searchParams.get('agentId') || undefined
    const tagsParam = searchParams.get('tags')
    const tagsFilter = tagsParam ? tagsParam.split(',') : undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    // Sort parameters
    const sortBy = searchParams.get('sortBy') as 'createdAt' | 'responseTime' | 'messageCount' | 'duration' || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc'

    // Fetch contact information
    const contact = await prisma.contact.findUnique({
      where: {
        id: contactId,
        isDeleted: false
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        phoneNumber: true,
        company: true,
        b2chatId: true
      }
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Build WHERE clause for filtering chats
    const chatWhere: any = {
      contactId,
      isDeleted: false
    }

    // Apply status filter
    if (statusFilter && statusFilter.length > 0) {
      chatWhere.status = { in: statusFilter }
    }

    // Apply agent filter
    if (agentIdFilter) {
      if (agentIdFilter === 'unassigned') {
        chatWhere.agentId = null
      } else {
        chatWhere.agentId = agentIdFilter
      }
    }

    // Apply tags filter (chat must have all specified tags)
    if (tagsFilter && tagsFilter.length > 0) {
      chatWhere.tags = {
        path: '$[*]',
        array_contains: tagsFilter
      }
    }

    // Apply date range filter
    if (dateFrom || dateTo) {
      chatWhere.createdAt = {}
      if (dateFrom) {
        chatWhere.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        chatWhere.createdAt.lte = new Date(dateTo)
      }
    }

    // Fetch all chats for this contact with filters
    const chats = await prisma.chat.findMany({
      where: chatWhere,
      select: {
        id: true,
        b2chatId: true,
        status: true,
        alias: true,
        tags: true,
        createdAt: true,
        closedAt: true,
        lastModifiedAt: true,
        duration: true,
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        messages: {
          select: {
            id: true,
            text: true,
            incoming: true,
            timestamp: true
          },
          orderBy: {
            timestamp: 'desc'
          },
          take: 100 // Get up to 100 messages for response time calculation
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc' // Default ordering, will be re-sorted later if needed
      }
    })

    // Calculate aggregated stats
    const totalChats = chats.length
    const openChats = chats.filter(chat => chat.status === 'open').length
    const closedChats = chats.filter(chat => chat.status === 'closed').length
    const pendingChats = chats.filter(chat => chat.status === 'pending').length

    // Calculate average resolution time (only for closed chats with duration)
    const chatsWithDuration = chats.filter(chat => chat.duration !== null)
    const avgResolutionTime = chatsWithDuration.length > 0
      ? chatsWithDuration.reduce((sum, chat) => sum + (chat.duration || 0), 0) / chatsWithDuration.length
      : 0

    // Collect all tags across chats
    const allTags = chats.flatMap(chat => chat.tags || [])
    const tagCounts = allTags.reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1
      return acc
    }, {})
    const commonTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag)

    // Find most contacted agent
    const agentCounts = (chats as any[])
      .filter((chat: any) => chat.agent)
      .reduce<Record<string, { name: string; count: number }>>((acc, chat: any) => {
        if (chat.agent) {
          const agentId = chat.agent.id
          if (!acc[agentId]) {
            acc[agentId] = { name: chat.agent.name, count: 0 }
          }
          acc[agentId].count++
        }
        return acc
      }, {})

    const mostContactedAgent = Object.values(agentCounts).sort((a, b) => b.count - a.count)[0]

    // Transform chats to include additional metadata
    const chatsWithMetrics = (chats as any[]).map((chat: any) => {
      // Mock topic based on tags or generate a random one
      const topics = ['Billing Issue', 'Technical Support', 'General Inquiry', 'Account Access', 'Product Information']
      const topic = chat.tags && chat.tags.length > 0
        ? chat.tags[0].charAt(0).toUpperCase() + chat.tags[0].slice(1)
        : topics[Math.floor(Math.random() * topics.length)]

      // Mock priority based on tags or status
      let priority = 'medium'
      if (chat.tags?.includes('urgent')) {
        priority = 'urgent'
      } else if (chat.tags?.includes('high')) {
        priority = 'high'
      } else if (chat.tags?.includes('low')) {
        priority = 'low'
      }

      // Get message preview (last 3 messages)
      const messagePreview: MessagePreview[] = (chat.messages as any[])
        .slice(0, 3)
        .reverse() // Show oldest to newest in preview
        .map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          incoming: msg.incoming,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
        }))

      // Calculate response times
      const messagesForResponseTime = (chat.messages as any[])
        .map((msg: any) => ({
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
          sender: msg.incoming ? 'customer' : 'agent' as 'customer' | 'agent' | 'bot'
        }))
        .reverse() // Oldest first for response time calculation

      const responseTimes = calculateChatResponseTimes(messagesForResponseTime)

      const firstResponseTimeMs = responseTimes.firstResponseTimeMs
      const avgResponseTimeMs = responseTimes.avgResponseTimeMs
      const responseTimeIndicator = firstResponseTimeMs
        ? getResponseTimeIndicator(firstResponseTimeMs)
        : null

      return {
        id: chat.id,
        b2chatId: chat.b2chatId,
        status: chat.status,
        alias: chat.alias,
        tags: chat.tags || [],
        priority,
        topic,
        agent: chat.agent?.name || 'Unassigned',
        agentId: chat.agent?.id || null,
        messages: chat._count.messages,
        duration: chat.duration,
        createdAt: chat.createdAt,
        closedAt: chat.closedAt,
        lastModifiedAt: chat.lastModifiedAt || chat.createdAt,
        // Enhanced fields (Feature 010)
        messagePreview,
        firstResponseTimeMs,
        avgResponseTimeMs,
        responseTimeIndicator
      }
    })

    // Apply sorting
    const sortedChats = [...chatsWithMetrics].sort((a, b) => {
      let compareValue = 0

      switch (sortBy) {
        case 'createdAt':
          compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'responseTime':
          // Sort by first response time, nulls last
          const aTime = a.firstResponseTimeMs ?? Infinity
          const bTime = b.firstResponseTimeMs ?? Infinity
          compareValue = aTime - bTime
          break
        case 'messageCount':
          compareValue = a.messages - b.messages
          break
        case 'duration':
          // Sort by duration, nulls last
          const aDuration = a.duration ?? Infinity
          const bDuration = b.duration ?? Infinity
          compareValue = aDuration - bDuration
          break
        default:
          compareValue = 0
      }

      return sortOrder === 'asc' ? compareValue : -compareValue
    })

    // Create timeline data
    const timeline = sortedChats.map(chat => ({
      date: chat.createdAt,
      chat: {
        id: chat.id,
        b2chatId: chat.b2chatId,
        topic: chat.topic,
        status: chat.status,
        agent: chat.agent,
        messages: chat.messages,
        duration: chat.duration
      }
    }))

    return NextResponse.json({
      contact: {
        id: contact.id,
        name: contact.fullName,
        email: contact.email,
        mobile: contact.mobile,
        phone: contact.phoneNumber,
        company: contact.company
      },
      chats: sortedChats,
      stats: {
        totalChats,
        openChats,
        closedChats,
        pendingChats,
        avgResolutionTime: Math.round(avgResolutionTime / 60), // Convert to minutes
        commonTags,
        mostContactedAgent: mostContactedAgent || null
      },
      timeline
    })
  } catch (error) {
    logger.error('Error fetching contact history', {
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch contact history' },
      { status: 500 }
    )
  }
}