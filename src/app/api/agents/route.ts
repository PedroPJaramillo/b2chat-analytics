import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

// Revalidate every 30 seconds for better performance
export const revalidate = 30

export async function POST(request: Request) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { name, email, b2chatId } = body

    if (!name || !email) {
      return new NextResponse('Name and email are required', { status: 400 })
    }

    if (!b2chatId) {
      return new NextResponse('b2chatId is required', { status: 400 })
    }

    const agent = await prisma.agent.create({
      data: {
        id: `agent_${uuidv4()}`,
        b2chatId,
        name,
        email,
        isActive: true
      }
    })

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Error creating agent:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function GET() {
  let userId: string | null = null;

  try {
    const authResult = await auth()
    userId = authResult.userId
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

    // Optimize: Get all metrics in parallel with aggregated queries
    const agentIds = agents.map(a => a.id)

    const [activeChatsResult, messagesResult, responseTimeChats] = await Promise.all([
      // Query 1: Count active chats per agent
      prisma.chat.groupBy({
        by: ['agentId'],
        where: {
          agentId: { in: agentIds },
          status: 'open'
        },
        _count: {
          id: true
        }
      }),

      // Query 2: Count messages per agent - avoid relation filter in groupBy
      (async () => {
        // First get all chat IDs for these agents
        const chats = await prisma.chat.findMany({
          where: { agentId: { in: agentIds } },
          select: { id: true, agentId: true }
        })

        const chatIdToAgent = new Map(chats.map(c => [c.id, c.agentId]))
        const chatIds = chats.map(c => c.id)

        if (chatIds.length === 0) {
          return new Map<string, number>()
        }

        // Now group messages by chatId without relation filter
        const result = await prisma.message.groupBy({
          by: ['chatId'],
          where: {
            chatId: { in: chatIds },
            incoming: false
          },
          _count: {
            chatId: true // Use chatId instead of id to avoid ambiguity
          }
        })

        // Group messages by agent
        const messagesByAgent = new Map<string, number>()
        result.forEach(msgCount => {
          const agentId = chatIdToAgent.get(msgCount.chatId)
          if (agentId) {
            messagesByAgent.set(
              agentId,
              (messagesByAgent.get(agentId) || 0) + msgCount._count.chatId
            )
          }
        })
        return messagesByAgent
      })(),

      // Query 3: Get recent chats for response time calculation
      prisma.chat.findMany({
        where: {
          agentId: { in: agentIds },
          pickedUpAt: { not: null },
          openedAt: { not: null }
        },
        select: {
          agentId: true,
          openedAt: true,
          pickedUpAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: agentIds.length * 10 // 10 chats per agent
      })
    ])

    // Create lookup maps for O(1) access
    const activeChatsMap = new Map(
      activeChatsResult.map(r => [r.agentId!, r._count.id])
    )

    // Calculate response times by agent
    const responseTimesByAgent = new Map<string, number[]>()
    responseTimeChats.forEach(chat => {
      if (!chat.agentId || !chat.openedAt || !chat.pickedUpAt) return

      const responseTime = new Date(chat.pickedUpAt).getTime() - new Date(chat.openedAt).getTime()
      if (responseTime >= 0) {
        if (!responseTimesByAgent.has(chat.agentId)) {
          responseTimesByAgent.set(chat.agentId, [])
        }
        const times = responseTimesByAgent.get(chat.agentId)!
        if (times.length < 10) { // Only keep last 10 per agent
          times.push(responseTime)
        }
      }
    })

    // Build final response
    const agentsWithMetrics = agents.map(agent => {
      const activeChats = activeChatsMap.get(agent.id) || 0
      const totalMessages = messagesResult.get(agent.id) || 0

      const responseTimes = responseTimesByAgent.get(agent.id) || []
      const avgResponseTimeMs = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0
      const avgResponseTimeMinutes = avgResponseTimeMs > 0
        ? (avgResponseTimeMs / (1000 * 60)).toFixed(1)
        : '0'

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        status: agent.isActive ? 'online' : 'offline',
        activeChats,
        totalChats: agent._count.chats,
        totalMessages,
        avgResponseTime: `${avgResponseTimeMinutes}m`,
        satisfaction: null,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt
      }
    })

    return NextResponse.json(agentsWithMetrics)
  } catch (error) {
    console.error('Error fetching agents:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}