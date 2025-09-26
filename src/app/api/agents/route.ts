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

    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chats: true
          }
        }
      }
    })

    // Get real metrics for each agent
    const agentsWithMetrics = await Promise.all(
      agents.map(async (agent) => {
        // Count active (open) chats for this agent
        const activeChats = await prisma.chat.count({
          where: {
            agentId: agent.id,
            status: 'open'
          }
        })

        // Count total messages sent by this agent
        const totalMessages = await prisma.message.count({
          where: {
            chat: {
              agentId: agent.id
            },
            incoming: false // Messages sent by agent (outgoing)
          }
        })

        // Calculate average response time from recent chats
        const recentChats = await prisma.chat.findMany({
          where: {
            agentId: agent.id,
            pickedUpAt: { not: null },
            openedAt: { not: null }
          },
          select: {
            openedAt: true,
            pickedUpAt: true
          },
          take: 10 // Last 10 chats for average
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

        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          status: agent.isActive ? 'online' : 'offline',
          activeChats,
          totalChats: agent._count.chats,
          totalMessages,
          avgResponseTime: `${avgResponseTimeMinutes}m`,
          satisfaction: 0, // Will calculate this when we have rating data
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt
        }
      })
    )

    return NextResponse.json(agentsWithMetrics)
  } catch (error) {
    console.error('Error fetching agents:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}