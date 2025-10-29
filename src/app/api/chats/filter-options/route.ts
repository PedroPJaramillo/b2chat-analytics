// API route for fetching available filter options

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active agents
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        isDeleted: false
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Fetch all unique tags from chats
    const chatsWithTags = await prisma.chat.findMany({
      where: {
        isDeleted: false,
        tags: {
          isEmpty: false
        }
      },
      select: {
        tags: true
      }
    })

    // Extract and deduplicate tags
    const tagsSet = new Set<string>()
    chatsWithTags.forEach(chat => {
      if (Array.isArray(chat.tags)) {
        chat.tags.forEach(tag => tagsSet.add(tag))
      }
    })

    const tags = Array.from(tagsSet).sort()

    // Return filter options
    return NextResponse.json({
      agents: agents.map(agent => ({
        value: agent.id,
        label: agent.name || agent.email || 'Unknown Agent'
      })),
      tags
    })
  } catch (error) {
    logger.error('Error fetching filter options', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    // Return minimal fallback options
    return NextResponse.json({
      agents: [],
      tags: []
    })
  }
}
