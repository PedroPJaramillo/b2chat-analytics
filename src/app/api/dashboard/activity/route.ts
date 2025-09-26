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

    // Get recent activities from multiple sources
    const [recentChats, recentMessages, recentSyncLogs] = await Promise.all([
      // Recent completed chats
      prisma.chat.findMany({
        where: {
          status: 'closed',
          closedAt: { not: null }
        },
        select: {
          id: true,
          closedAt: true,
          agent: {
            select: {
              name: true
            }
          },
          contact: {
            select: {
              fullName: true,
              b2chatId: true
            }
          }
        },
        orderBy: {
          closedAt: 'desc'
        },
        take: 5
      }),

      // Recent new messages
      prisma.message.findMany({
        where: {
          incoming: true, // Customer messages
        },
        select: {
          id: true,
          timestamp: true,
          chat: {
            select: {
              contact: {
                select: {
                  fullName: true
                }
              }
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 3
      }),

      // Recent sync activities
      prisma.syncState.findMany({
        where: {
          syncStatus: 'completed',
          lastSyncTimestamp: { not: null }
        },
        select: {
          entityType: true,
          lastSyncTimestamp: true
        },
        orderBy: {
          lastSyncTimestamp: 'desc'
        },
        take: 2
      })
    ])

    // Combine and format activities
    const activities: Array<{
      id: string
      type: string
      title: string
      subtitle: string
      timestamp: Date
      color: string
    }> = []

    // Add completed chats
    recentChats.forEach(chat => {
      if (chat.closedAt) {
        activities.push({
          id: `chat_${chat.id}`,
          type: 'chat_completed',
          title: `${chat.agent?.name || 'Agent'} completed chat with ${chat.contact?.fullName || 'customer'}`,
          subtitle: `Customer #${chat.contact?.b2chatId || 'unknown'}`,
          timestamp: chat.closedAt,
          color: 'bg-green-500'
        })
      }
    })

    // Add new customer inquiries
    recentMessages.forEach(message => {
      activities.push({
        id: `message_${message.id}`,
        type: 'new_inquiry',
        title: `New customer inquiry from ${message.chat?.contact?.fullName || 'customer'}`,
        subtitle: 'Waiting for agent response',
        timestamp: message.timestamp,
        color: 'bg-blue-500'
      })
    })

    // Add sync completions
    recentSyncLogs.forEach(sync => {
      if (sync.lastSyncTimestamp) {
        activities.push({
          id: `sync_${sync.entityType}`,
          type: 'sync_completed',
          title: `${sync.entityType} sync completed successfully`,
          subtitle: 'Data updated from B2Chat',
          timestamp: sync.lastSyncTimestamp,
          color: 'bg-orange-500'
        })
      }
    })

    // Sort by timestamp and take the most recent 6
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6)
      .map(activity => ({
        ...activity,
        timeAgo: getTimeAgo(new Date(activity.timestamp))
      }))

    return NextResponse.json(sortedActivities)
  } catch (error) {
    console.error('Error fetching dashboard activity:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  } else {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }
}