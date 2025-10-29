/**
 * Outgoing Chat Analytics API
 * Provides message-level metrics for agent-initiated and broadcast campaigns
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import {
  calculateOutgoingMessageMetrics,
  calculateAgentOutgoingMetrics,
  calculateBroadcastMetrics,
  formatTime,
  type ChatWithMessages
} from '@/lib/analytics/message-metrics'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(req: NextRequest) {
  let userId: string | null = null

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'all' // all, 1-to-1, broadcast
    const timeRange = parseInt(searchParams.get('days') || '30') // days to look back

    // Calculate date range
    const startDate = subDays(new Date(), timeRange)

    // Build direction filter
    let directionFilter: any = {}
    if (type === '1-to-1') {
      directionFilter.direction = 'outgoing'
    } else if (type === 'broadcast') {
      directionFilter.direction = 'outgoing_broadcast'
    } else {
      // all outgoing
      directionFilter.direction = { in: ['outgoing', 'outgoing_broadcast'] }
    }

    // Fetch outgoing chats with messages
    const chats = await prisma.chat.findMany({
      where: {
        createdAt: { gte: startDate },
        isDeleted: false,
        ...directionFilter
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        },
        agent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }) as unknown as ChatWithMessages[]

    // Calculate overall metrics
    const overallMetrics = calculateOutgoingMessageMetrics(chats)

    // Get agent list for agent metrics calculation
    const agents = await prisma.agent.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true
      }
    })

    // Calculate per-agent metrics
    const agentMetrics = calculateAgentOutgoingMetrics(chats, agents)

    // Calculate broadcast-specific metrics if applicable
    const broadcastChats = chats.filter(chat => chat.direction === 'outgoing_broadcast')
    const broadcastMetrics = broadcastChats.length > 0
      ? calculateBroadcastMetrics(broadcastChats)
      : null

    // Calculate conversion funnel
    const conversionFunnel = {
      totalOutgoing: chats.length,
      withReply: overallMetrics.chatsWithReply,
      convertedToSupport: overallMetrics.convertedToSupport,
      replyRate: overallMetrics.replyRate,
      conversionRate: overallMetrics.conversionRate
    }

    // Format hourly distribution for charts
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: overallMetrics.messagesByHour[hour.toString()] || 0
    }))

    // Format daily distribution for charts
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dailyDistribution = daysOfWeek.map(day => ({
      name: day,
      value: overallMetrics.messagesByDayOfWeek[day] || 0
    }))

    // Top performing agents (top 10)
    const topAgents = agentMetrics.slice(0, 10).map(agent => ({
      name: agent.agentName || agent.agentId,
      messagesSent: agent.messagesSent,
      chatsInitiated: agent.chatsInitiated,
      replyRate: Math.round(agent.replyRate),
      conversions: agent.conversions,
      score: agent.productivityScore
    }))

    // Response structure
    const response = {
      timeRange: {
        days: timeRange,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      },
      type,

      // Overview metrics
      overview: {
        totalChats: overallMetrics.totalChats,
        totalMessagesSent: overallMetrics.totalMessagesSent,
        averageMessagesPerChat: Number(overallMetrics.averageMessagesPerChat.toFixed(2)),
        replyRate: Number(overallMetrics.replyRate.toFixed(2)),
        conversionRate: Number(overallMetrics.conversionRate.toFixed(2)),
        averageTimeToReply: formatTime(overallMetrics.averageTimeToReply)
      },

      // Message type breakdown
      messageTypes: {
        text: overallMetrics.messagesByType.text,
        image: overallMetrics.messagesByType.image,
        file: overallMetrics.messagesByType.file,
        total: overallMetrics.totalMessagesSent
      },

      // Conversion funnel
      conversionFunnel,

      // Time patterns
      timePatterns: {
        hourly: hourlyDistribution,
        daily: dailyDistribution
      },

      // Agent performance
      agentPerformance: {
        totalAgents: agentMetrics.length,
        topPerformers: topAgents,
        allAgents: agentMetrics.length <= 20 ? agentMetrics : undefined // Only include all if <= 20
      },

      // Broadcast metrics (if applicable)
      broadcast: broadcastMetrics ? {
        totalRecipients: broadcastMetrics.totalRecipients,
        messagesDelivered: broadcastMetrics.messagesDelivered,
        deliveryRate: Number(broadcastMetrics.deliveryRate.toFixed(2)),
        replyRate: Number(broadcastMetrics.replyRate.toFixed(2)),
        averageEngagement: Number(broadcastMetrics.averageEngagement.toFixed(2))
      } : null
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching outgoing analytics:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch outgoing analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
