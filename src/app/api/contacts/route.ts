import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { isVIPContact } from '@/lib/chat-utils'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // 1 minute cache

export async function GET(request: NextRequest) {
  let userId: string | null = null

  try {
    // Authentication check (Pattern 16)
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    // Search parameter
    const search = searchParams.get('search') || undefined

    // Filter parameters
    const tagsParam = searchParams.get('tags') || undefined
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined
    const isVIPParam = searchParams.get('isVIP')
    const isVIP = isVIPParam === 'true' ? true : isVIPParam === 'false' ? false : undefined
    const contactType = searchParams.get('contactType') || undefined // 'first-time' | 'repeat' | 'vip'
    const merchantId = searchParams.get('merchantId') || undefined

    // Date filter parameters
    const createdAfter = searchParams.get('createdAfter') || undefined
    const createdBefore = searchParams.get('createdBefore') || undefined
    const updatedAfter = searchParams.get('updatedAfter') || undefined
    const updatedBefore = searchParams.get('updatedBefore') || undefined

    // Chat-based filter parameters (Feature 010)
    const chatStatusParam = searchParams.get('chatStatus') || undefined
    const chatStatus = chatStatusParam ? chatStatusParam.split(',').map(s => s.trim()) : undefined
    const chatDateFrom = searchParams.get('chatDateFrom') || undefined
    const chatDateTo = searchParams.get('chatDateTo') || undefined

    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 })
    }
    if (isNaN(limit) || limit < 1 || limit > 200) {
      return NextResponse.json({ error: 'Invalid limit parameter (must be 1-200)' }, { status: 400 })
    }

    // Build WHERE clause
    const where: Prisma.ContactWhereInput = {
      isDeleted: false
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Tag filtering - check if tags JSON array contains any of the specified tags
    if (tags && tags.length > 0) {
      // For JSON field, we need to use Prisma's json filtering
      // We'll filter by checking if any tag name matches
      where.tags = {
        path: '$[*].name',
        array_contains: tags
      } as any
    }

    // Merchant ID filtering
    if (merchantId) {
      where.merchantId = merchantId
    }

    // Date range filtering
    if (createdAfter) {
      where.createdAt = { ...where.createdAt as any, gte: new Date(createdAfter) }
    }
    if (createdBefore) {
      where.createdAt = { ...where.createdAt as any, lte: new Date(createdBefore) }
    }
    if (updatedAfter) {
      where.updatedAt = { ...where.updatedAt as any, gte: new Date(updatedAfter) }
    }
    if (updatedBefore) {
      where.updatedAt = { ...where.updatedAt as any, lte: new Date(updatedBefore) }
    }

    // Chat-based filtering (Feature 010)
    // Filter contacts that have at least one chat matching the criteria
    if (chatStatus || chatDateFrom || chatDateTo) {
      const chatWhere: Prisma.ChatWhereInput = {
        isDeleted: false
      }

      if (chatStatus && chatStatus.length > 0) {
        chatWhere.status = { in: chatStatus as any }
      }

      if (chatDateFrom) {
        chatWhere.createdAt = { ...chatWhere.createdAt as any, gte: new Date(chatDateFrom) }
      }

      if (chatDateTo) {
        chatWhere.createdAt = { ...chatWhere.createdAt as any, lte: new Date(chatDateTo) }
      }

      // Only show contacts that have at least one chat matching the criteria
      where.chats = {
        some: chatWhere
      }
    }

    // Build ORDER BY clause
    const orderBy: Prisma.ContactOrderByWithRelationInput = {}

    // Map sortBy to actual field names
    const sortableFields = ['fullName', 'email', 'mobile', 'company', 'createdAt', 'updatedAt', 'merchantId']
    if (sortableFields.includes(sortBy)) {
      orderBy[sortBy as keyof typeof orderBy] = sortOrder
    } else if (sortBy === 'chatCount') {
      // For aggregated fields, we'll sort after fetching
      orderBy.createdAt = sortOrder
    } else {
      // Default sort
      orderBy.createdAt = sortOrder
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Fetch total count
    const total = await prisma.contact.count({ where })

    // Fetch contacts with chats for aggregation
    const contacts = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        b2chatId: true,
        fullName: true,
        email: true,
        mobile: true,
        phoneNumber: true,
        company: true,
        tags: true,
        merchantId: true,
        customAttributes: true,
        createdAt: true,
        updatedAt: true,
        chats: {
          where: {
            isDeleted: false
          },
          select: {
            id: true,
            lastModifiedAt: true,
            createdAt: true
          }
        }
      },
      orderBy,
      skip,
      take: limit
    })

    // Transform contacts with aggregated data
    let contactsWithStats = contacts.map(contact => {
      const chatCount = contact.chats.length

      // Calculate last contact date (most recent chat)
      const lastContactDate = contact.chats.length > 0
        ? contact.chats.reduce((latest, chat) => {
            const chatDate = chat.lastModifiedAt || chat.createdAt
            return chatDate > latest ? chatDate : latest
          }, contact.chats[0].lastModifiedAt || contact.chats[0].createdAt)
        : null

      return {
        id: contact.id,
        b2chatId: contact.b2chatId,
        fullName: contact.fullName,
        email: contact.email,
        mobile: contact.mobile,
        phoneNumber: contact.phoneNumber,
        company: contact.company,
        tags: contact.tags,
        merchantId: contact.merchantId,
        customAttributes: contact.customAttributes,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
        // Aggregated fields
        chatCount,
        lastContactDate: lastContactDate ? lastContactDate.toISOString() : null,
        isVIP: isVIPContact(contact.customAttributes)
      }
    })

    // Apply post-fetch filters (for fields that need aggregation)

    // Filter by VIP status if specified
    if (isVIP !== undefined) {
      contactsWithStats = contactsWithStats.filter(contact => contact.isVIP === isVIP)
    }

    // Filter by contact type if specified
    if (contactType === 'first-time') {
      contactsWithStats = contactsWithStats.filter(contact => contact.chatCount === 1)
    } else if (contactType === 'repeat') {
      contactsWithStats = contactsWithStats.filter(contact => contact.chatCount > 1 && !contact.isVIP)
    } else if (contactType === 'vip') {
      contactsWithStats = contactsWithStats.filter(contact => contact.isVIP)
    }

    // Sort by aggregated fields if needed
    if (sortBy === 'chatCount') {
      contactsWithStats.sort((a, b) => {
        return sortOrder === 'asc'
          ? a.chatCount - b.chatCount
          : b.chatCount - a.chatCount
      })
    } else if (sortBy === 'lastContactDate') {
      contactsWithStats.sort((a, b) => {
        const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0
        const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      contacts: contactsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    logger.error('Error fetching contacts list', {
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}
