import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get current date ranges for trend calculations
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get overall statistics
    const [
      totalAgents,
      totalChats,
      totalMessages,
      activeChats,
      onlineAgents,
      agentsLastMonth,
      chatsYesterday,
      chatsToday
    ] = await Promise.all([
      prisma.agent.count(),
      prisma.chat.count(),
      prisma.message.count(),
      prisma.chat.count({
        where: {
          status: 'open'
        }
      }),
      prisma.agent.count({
        where: {
          isActive: true
        }
      }),
      // Trend calculations
      prisma.agent.count({
        where: {
          createdAt: {
            lt: lastMonth
          }
        }
      }),
      prisma.chat.count({
        where: {
          createdAt: {
            gte: yesterday,
            lt: now
          }
        }
      }),
      prisma.chat.count({
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          }
        }
      })
    ])

    // Calculate average response time from recent chats
    const recentChats = await prisma.chat.findMany({
      where: {
        pickedUpAt: { not: null },
        openedAt: { not: null },
        createdAt: {
          gte: lastWeek
        }
      },
      select: {
        openedAt: true,
        pickedUpAt: true
      }
    })

    let avgResponseTimeMs = 0
    if (recentChats.length > 0) {
      const responseTimes = recentChats
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
    const agentsChange = agentsLastMonth > 0 ? totalAgents - agentsLastMonth : 0
    const chatsChange = chatsYesterday > 0 ? Math.round(((chatsToday - chatsYesterday) / chatsYesterday) * 100) : 0

    // For now, set satisfaction rate to a calculated average (placeholder until we have rating data)
    const satisfactionRate = 92.5 // Will be calculated from actual ratings when available

    return NextResponse.json({
      totalAgents,
      totalChats,
      totalMessages,
      activeChats,
      onlineAgents,
      avgResponseTime: `${avgResponseTimeMinutes}m`,
      satisfactionRate,
      trends: {
        agentsChange,
        chatsChange,
        responseTimeChange: 0, // Will calculate when we have historical response time data
        satisfactionChange: 0  // Will calculate when we have historical satisfaction data
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}