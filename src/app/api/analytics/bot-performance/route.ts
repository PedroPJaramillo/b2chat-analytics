import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

// Revalidate every 30 seconds for bot analytics data
export const revalidate = 30

/**
 * Bot Performance Analytics API (Feature 001: Full Status Support)
 *
 * Tracks bot-related metrics:
 * - Total chats handled by bot
 * - Bot resolution rate (chats resolved without human)
 * - Average bot handling time
 * - Bot-to-human handoff metrics
 * - Bot performance trends
 */
export async function GET(req: NextRequest) {
  let userId: string | null = null

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get time range from query params (default: last 30 days)
    const { searchParams } = new URL(req.url)
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam) : 30

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Invalid days parameter (must be between 1 and 365)' },
        { status: 400 }
      )
    }

    const startDate = subDays(new Date(), days)

    // Query 1: Get all chats that went through BOT_CHATTING status
    const botChats = await prisma.chat.findMany({
      where: {
        createdAt: { gte: startDate },
        isDeleted: false,
        // Include chats that either are currently in BOT_CHATTING or have passed through it
        OR: [
          { status: 'BOT_CHATTING' },
          { status: { in: ['OPENED', 'PICKED_UP', 'RESPONDED_BY_AGENT', 'CLOSED', 'COMPLETING_POLL', 'COMPLETED_POLL', 'ABANDONED_POLL'] } },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        openedAt: true,
        pickedUpAt: true,
        responseAt: true,
        closedAt: true,
        provider: true,
        agentId: true,
      },
    })

    // Query 2: Check chat status history to identify bot interactions
    const botStatusHistory = await prisma.chatStatusHistory.findMany({
      where: {
        newStatus: 'BOT_CHATTING',
        changedAt: { gte: startDate },
      },
      select: {
        chatId: true,
        previousStatus: true,
        newStatus: true,
        changedAt: true,
      },
    })

    // Build set of chat IDs that went through bot
    const chatsThroughBot = new Set(botStatusHistory.map(h => h.chatId))

    // Separate bot chats from those that went to human agents
    const currentlyWithBot = botChats.filter(chat => chat.status === 'BOT_CHATTING')
    const handedOffToHuman = botChats.filter(
      chat => chat.status !== 'BOT_CHATTING' && chat.agentId !== null
    )
    const resolvedByBot = botChats.filter(
      chat => chat.status === 'CLOSED' && chat.agentId === null && chatsThroughBot.has(chat.id)
    )

    // Calculate metrics
    const totalBotInteractions = chatsThroughBot.size
    const totalResolvedByBot = resolvedByBot.length
    const totalHandedOffToHuman = handedOffToHuman.length

    // Bot resolution rate: chats resolved without human intervention
    const botResolutionRate =
      totalBotInteractions > 0
        ? (totalResolvedByBot / totalBotInteractions) * 100
        : 0

    // Average bot handling time (createdAt to openedAt for handed-off chats)
    const botHandlingTimes = handedOffToHuman
      .filter(chat => chat.createdAt && chat.openedAt)
      .map(chat => {
        const created = new Date(chat.createdAt).getTime()
        const opened = new Date(chat.openedAt!).getTime()
        return (opened - created) / 1000 // seconds
      })

    const avgBotHandlingTime =
      botHandlingTimes.length > 0
        ? botHandlingTimes.reduce((sum, time) => sum + time, 0) / botHandlingTimes.length
        : 0

    // Bot handoff time: time from bot chat to agent pickup
    const handoffTimes = handedOffToHuman
      .filter(chat => chat.openedAt && chat.pickedUpAt)
      .map(chat => {
        const opened = new Date(chat.openedAt!).getTime()
        const pickedUp = new Date(chat.pickedUpAt!).getTime()
        return (pickedUp - opened) / 1000 // seconds
      })

    const avgHandoffTime =
      handoffTimes.length > 0
        ? handoffTimes.reduce((sum, time) => sum + time, 0) / handoffTimes.length
        : 0

    // Calculate trends (compare first half vs second half of period)
    const midpoint = new Date(startDate.getTime() + (new Date().getTime() - startDate.getTime()) / 2)

    const firstHalfBotChats = botChats.filter(chat => new Date(chat.createdAt) < midpoint)
    const secondHalfBotChats = botChats.filter(chat => new Date(chat.createdAt) >= midpoint)

    const firstHalfResolved = firstHalfBotChats.filter(
      chat => chat.status === 'CLOSED' && chat.agentId === null
    ).length
    const secondHalfResolved = secondHalfBotChats.filter(
      chat => chat.status === 'CLOSED' && chat.agentId === null
    ).length

    const firstHalfRate = firstHalfBotChats.length > 0
      ? (firstHalfResolved / firstHalfBotChats.length) * 100
      : 0
    const secondHalfRate = secondHalfBotChats.length > 0
      ? (secondHalfResolved / secondHalfBotChats.length) * 100
      : 0

    const resolutionRateTrend = secondHalfRate - firstHalfRate

    // Breakdown by channel
    const byChannel = botChats.reduce((acc, chat) => {
      const channel = chat.provider
      if (!acc[channel]) {
        acc[channel] = {
          total: 0,
          resolvedByBot: 0,
          handedOff: 0,
        }
      }
      acc[channel].total++
      if (chat.status === 'CLOSED' && chat.agentId === null) {
        acc[channel].resolvedByBot++
      } else if (chat.agentId !== null) {
        acc[channel].handedOff++
      }
      return acc
    }, {} as Record<string, { total: number; resolvedByBot: number; handedOff: number }>)

    // Response data
    return NextResponse.json({
      timeRange: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      summary: {
        totalBotInteractions,
        currentlyWithBot: currentlyWithBot.length,
        resolvedByBot: totalResolvedByBot,
        handedOffToHuman: totalHandedOffToHuman,
        botResolutionRate: Math.round(botResolutionRate * 100) / 100, // 2 decimal places
        avgBotHandlingTimeSeconds: Math.round(avgBotHandlingTime),
        avgHandoffTimeSeconds: Math.round(avgHandoffTime),
      },
      trends: {
        resolutionRateChange: Math.round(resolutionRateTrend * 100) / 100,
        improving: resolutionRateTrend > 0,
      },
      byChannel: Object.entries(byChannel).map(([channel, stats]) => ({
        channel,
        total: stats.total,
        resolvedByBot: stats.resolvedByBot,
        handedOff: stats.handedOff,
        resolutionRate: stats.total > 0
          ? Math.round((stats.resolvedByBot / stats.total) * 10000) / 100
          : 0,
      })),
    })
  } catch (error) {
    console.error('Bot performance analytics error:', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
