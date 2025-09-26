import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { withCache, generateCacheKey, invalidateRelatedCache } from '@/lib/cache'
import { dashboardRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting
    const rateLimitResponse = await dashboardRateLimit(request, userId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Use caching for dashboard stats
    const cacheKey = generateCacheKey(userId, 'dashboard-stats')

    const dashboardStats = await withCache(
      'dashboard',
      cacheKey,
      async () => {
        // Get current date ranges for trend calculations
        const now = new Date()
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        return await calculateDashboardStats(now, lastMonth, lastWeek, yesterday)
      }
    )

    return NextResponse.json(dashboardStats)
  } catch (error) {
    logger.error('Error fetching dashboard stats', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}

// Optimized dashboard stats calculation with better queries
async function calculateDashboardStats(
  now: Date,
  lastMonth: Date,
  lastWeek: Date,
  yesterday: Date
) {

  // Optimize with fewer database calls and better indexing
  const [
    agentStats,
    chatStats,
    messageCount,
    recentChatsForResponseTime
  ] = await Promise.all([
    // Single query for agent statistics
    prisma.agent.aggregate({
      _count: {
        id: true
      },
      where: {
        isDeleted: false
      }
    }).then(async (totalAgents) => {
      const [activeAgents, historicalAgents] = await Promise.all([
        prisma.agent.count({
          where: {
            isActive: true,
            isDeleted: false
          }
        }),
        prisma.agent.count({
          where: {
            createdAt: { lt: lastMonth },
            isDeleted: false
          }
        })
      ])
      return {
        total: totalAgents._count.id,
        active: activeAgents,
        historical: historicalAgents
      }
    }),

    // Single query for chat statistics with aggregation
    prisma.chat.groupBy({
      by: ['status'],
      _count: {
        id: true
      },
      where: {
        isDeleted: false
      }
    }).then(async (statusGroups) => {
      const [yesterdayChats, todayChats] = await Promise.all([
        prisma.chat.count({
          where: {
            createdAt: {
              gte: yesterday,
              lt: now
            },
            isDeleted: false
          }
        }),
        prisma.chat.count({
          where: {
            createdAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            },
            isDeleted: false
          }
        })
      ])

      const statusMap = statusGroups.reduce((acc, group) => {
        acc[group.status] = group._count.id
        return acc
      }, {} as Record<string, number>)

      return {
        total: statusGroups.reduce((sum, group) => sum + group._count.id, 0),
        active: statusMap.open || 0,
        closed: statusMap.closed || 0,
        pending: statusMap.pending || 0,
        yesterday: yesterdayChats,
        today: todayChats
      }
    }),

    // Message count
    prisma.message.count(),

    // Optimized response time calculation
    prisma.chat.findMany({
      where: {
        pickedUpAt: { not: null },
        openedAt: { not: null },
        createdAt: { gte: lastWeek },
        isDeleted: false
      },
      select: {
        openedAt: true,
        pickedUpAt: true
      },
      take: 1000, // Limit for performance
      orderBy: { createdAt: 'desc' }
    })
  ])

  // Calculate average response time
  let avgResponseTimeMs = 0
  if (recentChatsForResponseTime.length > 0) {
    const responseTimes = recentChatsForResponseTime
      .filter(chat => chat.openedAt && chat.pickedUpAt)
      .map(chat => {
        const opened = new Date(chat.openedAt!).getTime()
        const pickedUp = new Date(chat.pickedUpAt!).getTime()
        return pickedUp - opened
      })

    if (responseTimes.length > 0) {
      avgResponseTimeMs = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    }
  }

  const avgResponseTimeMinutes = avgResponseTimeMs > 0 ? (avgResponseTimeMs / (1000 * 60)).toFixed(1) : '0'

  // Calculate trends
  const agentsChange = agentStats.historical > 0 ? agentStats.total - agentStats.historical : 0
  const chatsChange = chatStats.yesterday > 0
    ? Math.round(((chatStats.today - chatStats.yesterday) / chatStats.yesterday) * 100)
    : 0

    // Calculate satisfaction rate based on chat duration and response times
    // This is a simplified metric based on available data until we have actual ratings
    let satisfactionRate = 0
  if (chatStats.total > 0) {
    // Base satisfaction on response time efficiency
    const avgResponseMinutes = parseFloat(avgResponseTimeMinutes)
    if (avgResponseMinutes === 0) {
      satisfactionRate = 95 // No data yet, default to good rating
    } else if (avgResponseMinutes < 2) {
      satisfactionRate = 95 // Excellent response time
    } else if (avgResponseMinutes < 5) {
      satisfactionRate = 90 // Good response time
    } else if (avgResponseMinutes < 10) {
      satisfactionRate = 85 // Acceptable response time
    } else if (avgResponseMinutes < 15) {
      satisfactionRate = 75 // Needs improvement
    } else {
      satisfactionRate = 65 // Poor response time
    }

    // Adjust based on active vs total agents ratio (agent availability)
    const agentAvailability = agentStats.total > 0 ? (agentStats.active / agentStats.total) : 0
    if (agentAvailability > 0.8) {
      satisfactionRate = Math.min(100, satisfactionRate + 5) // Bonus for high availability
    } else if (agentAvailability < 0.3) {
      satisfactionRate = Math.max(0, satisfactionRate - 10) // Penalty for low availability
    }
  } else {
    // No chats yet, show neutral satisfaction
    satisfactionRate = 85
  }

  return {
    totalAgents: agentStats.total,
    totalChats: chatStats.total,
    totalMessages: messageCount,
    activeChats: chatStats.active,
    onlineAgents: agentStats.active,
    avgResponseTime: `${avgResponseTimeMinutes}m`,
    satisfactionRate,
    trends: {
      agentsChange,
      chatsChange,
      responseTimeChange: 0, // Will calculate when we have historical response time data
      satisfactionChange: 0  // Will calculate when we have historical satisfaction data
    }
  }
}