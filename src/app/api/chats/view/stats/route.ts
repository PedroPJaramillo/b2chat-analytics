import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { ChatStatus, ChatPriority, ChatProvider } from '@/types/chat'
import type { ChatViewStats } from '@/types/chat-view'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // 1 minute cache

/**
 * GET /api/chats/view/stats
 * Returns aggregated statistics for filter options
 * Feature 011: Enhanced Chat View Filters
 */
export async function GET(request: NextRequest) {
  let userId: string | null = null

  try {
    // Authentication check
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build base WHERE clause (only non-deleted chats)
    const baseWhere: Prisma.ChatWhereInput = {
      isDeleted: false,
    }

    // Fetch all statuses counts
    const statusCounts = await prisma.chat.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
    })

    const byStatus: Record<ChatStatus, number> = statusCounts.reduce(
      (acc, item) => {
        acc[item.status as ChatStatus] = item._count
        return acc
      },
      {} as Record<ChatStatus, number>
    )

    // Fetch department counts
    const departmentCounts = await prisma.chat.groupBy({
      by: ['departmentId'],
      where: {
        ...baseWhere,
        departmentId: { not: null },
      },
      _count: true,
    })

    // Get department names
    const departmentIds = departmentCounts.map((d) => d.departmentId!).filter(Boolean)
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true },
    })

    const departmentMap = new Map(departments.map((d) => [d.id, d.name]))

    const byDepartment: Record<string, { name: string; count: number }> = {}
    for (const item of departmentCounts) {
      if (item.departmentId) {
        byDepartment[item.departmentId] = {
          name: departmentMap.get(item.departmentId) || item.departmentId,
          count: item._count,
        }
      }
    }

    // Fetch agent counts
    const agentCounts = await prisma.chat.groupBy({
      by: ['agentId'],
      where: {
        ...baseWhere,
        agentId: { not: null },
      },
      _count: true,
    })

    // Count unassigned chats
    const unassignedCount = await prisma.chat.count({
      where: {
        ...baseWhere,
        agentId: null,
      },
    })

    // Get agent names
    const agentIds = agentCounts.map((a) => a.agentId!).filter(Boolean)
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    })

    const agentMap = new Map(agents.map((a) => [a.id, a.name]))

    const byAgent: ChatViewStats['byAgent'] = {
      unassigned: unassignedCount,
    }
    for (const item of agentCounts) {
      if (item.agentId) {
        byAgent[item.agentId] = {
          name: agentMap.get(item.agentId) || item.agentId,
          count: item._count,
        }
      }
    }

    // Fetch priority counts
    const priorityCounts = await prisma.chat.groupBy({
      by: ['priority'],
      where: baseWhere,
      _count: true,
    })

    const byPriority: Record<ChatPriority, number> = priorityCounts.reduce(
      (acc, item) => {
        acc[item.priority as ChatPriority] = item._count
        return acc
      },
      {} as Record<ChatPriority, number>
    )

    // Fetch SLA status counts
    const slaWithinCount = await prisma.chat.count({
      where: {
        ...baseWhere,
        overallSLA: true,
      },
    })

    const slaBreachedCount = await prisma.chat.count({
      where: {
        ...baseWhere,
        overallSLA: false,
      },
    })

    const bySLA = {
      within: slaWithinCount,
      breached: slaBreachedCount,
    }

    // Fetch provider counts
    const providerCounts = await prisma.chat.groupBy({
      by: ['provider'],
      where: baseWhere,
      _count: true,
    })

    const byProvider: Record<ChatProvider, number> = providerCounts.reduce(
      (acc, item) => {
        acc[item.provider as ChatProvider] = item._count
        return acc
      },
      {} as Record<ChatProvider, number>
    )

    // Fetch message count ranges
    // This requires fetching all chats with message counts (application-level aggregation)
    const chatsWithMessageCounts = await prisma.chat.findMany({
      where: baseWhere,
      select: {
        id: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    const byMessageCount = {
      '0': 0,
      '1-5': 0,
      '6-10': 0,
      '11-20': 0,
      '20+': 0,
    }

    for (const chat of chatsWithMessageCounts) {
      const count = chat._count.messages
      if (count === 0) {
        byMessageCount['0']++
      } else if (count >= 1 && count <= 5) {
        byMessageCount['1-5']++
      } else if (count >= 6 && count <= 10) {
        byMessageCount['6-10']++
      } else if (count >= 11 && count <= 20) {
        byMessageCount['11-20']++
      } else {
        byMessageCount['20+']++
      }
    }

    const stats: ChatViewStats = {
      byStatus,
      byDepartment,
      byAgent,
      byPriority,
      bySLA,
      byProvider,
      byMessageCount,
    }

    return NextResponse.json(stats)
  } catch (error) {
    logger.error('Error fetching chat view stats', {
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Failed to fetch chat view stats' },
      { status: 500 }
    )
  }
}
