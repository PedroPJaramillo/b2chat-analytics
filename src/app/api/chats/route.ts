import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const chats = await prisma.chat.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        lastModifiedAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Transform data to include additional fields
    const chatsWithMetrics = chats.map(chat => ({
      id: chat.id,
      customer: chat.contact?.fullName || 'Unknown Customer',
      agent: chat.agent?.name || 'Unassigned',
      status: chat.status,
      priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)], // Mock priority
      topic: ['Billing Issue', 'Technical Support', 'General Inquiry', 'Account Access', 'Product Information'][Math.floor(Math.random() * 5)], // Mock topic
      messages: chat._count.messages,
      startTime: chat.createdAt,
      lastMessage: chat.lastModifiedAt || chat.createdAt,
      createdAt: chat.createdAt,
      updatedAt: chat.lastModifiedAt || chat.createdAt
    }))

    return NextResponse.json(chatsWithMetrics)
  } catch (error) {
    console.error('Error fetching chats:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}