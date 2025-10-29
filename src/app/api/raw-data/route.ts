import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import type { ProcessingStatus } from '@/types/raw-data'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minute cache

export async function GET(request: NextRequest) {
  let userId: string | null = null

  try {
    // Authentication check (Pattern 16)
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add admin authorization check
    // For now, allow all authenticated users
    // In production, check: if (!isAdmin(userId)) return 403

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    // Entity type parameter
    const entityType = searchParams.get('entityType') || 'all' // 'contacts' | 'chats' | 'all'

    // Search parameter
    const search = searchParams.get('search') || undefined

    // Filter parameters
    const processingStatus = searchParams.get('processingStatus') as ProcessingStatus | undefined
    const syncId = searchParams.get('syncId') || undefined

    // Date filter parameters
    const fetchedAfter = searchParams.get('fetchedAfter') || undefined
    const fetchedBefore = searchParams.get('fetchedBefore') || undefined

    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'fetchedAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 })
    }
    if (isNaN(limit) || limit < 1 || limit > 200) {
      return NextResponse.json({ error: 'Invalid limit parameter (must be 1-200)' }, { status: 400 })
    }

    // Validate entity type
    if (!['contacts', 'chats', 'all'].includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType parameter' }, { status: 400 })
    }

    // Build WHERE clause for RawContact
    const buildContactWhere = (): Prisma.RawContactWhereInput => {
      const where: Prisma.RawContactWhereInput = {}

      // Search across IDs and JSON content (Feature 013)
      if (search) {
        where.OR = [
          // Existing: Scalar field searches
          { b2chatContactId: { contains: search, mode: 'insensitive' } },
          { syncId: { contains: search, mode: 'insensitive' } },

          // NEW: JSON content searches
          // Contact ID (rawData.contact_id or rawData.id)
          { rawData: { path: ['contact_id'], string_contains: search } },
          { rawData: { path: ['id'], string_contains: search } },

          // Contact name (rawData.fullname or rawData.name)
          { rawData: { path: ['fullname'], string_contains: search } },
          { rawData: { path: ['name'], string_contains: search } },

          // Mobile (rawData.mobile or rawData.mobile_number)
          { rawData: { path: ['mobile'], string_contains: search } },
          { rawData: { path: ['mobile_number'], string_contains: search } },
        ]
      }

      // Processing status filter
      if (processingStatus) {
        where.processingStatus = processingStatus
      }

      // Sync ID filter
      if (syncId) {
        where.syncId = syncId
      }

      // Date range filtering
      if (fetchedAfter) {
        where.fetchedAt = { ...where.fetchedAt as any, gte: new Date(fetchedAfter) }
      }
      if (fetchedBefore) {
        where.fetchedAt = { ...where.fetchedAt as any, lte: new Date(fetchedBefore) }
      }

      return where
    }

    // Build WHERE clause for RawChat
    const buildChatWhere = (): Prisma.RawChatWhereInput => {
      const where: Prisma.RawChatWhereInput = {}

      // Search across IDs and JSON content (Feature 013)
      if (search) {
        where.OR = [
          // Existing: Scalar field searches
          { b2chatChatId: { contains: search, mode: 'insensitive' } },
          { syncId: { contains: search, mode: 'insensitive' } },

          // NEW: JSON content searches
          // Chat ID (rawData.chat_id)
          { rawData: { path: ['chat_id'], string_contains: search } },

          // Contact ID (rawData.contact.id or rawData.contact.contact_id)
          { rawData: { path: ['contact', 'id'], string_contains: search } },
          { rawData: { path: ['contact', 'contact_id'], string_contains: search } },

          // Contact name (rawData.contact.fullname or rawData.contact.name)
          { rawData: { path: ['contact', 'fullname'], string_contains: search } },
          { rawData: { path: ['contact', 'name'], string_contains: search } },

          // Contact mobile (rawData.contact.mobile or rawData.contact.mobile_number)
          { rawData: { path: ['contact', 'mobile'], string_contains: search } },
          { rawData: { path: ['contact', 'mobile_number'], string_contains: search } },
        ]
      }

      // Processing status filter
      if (processingStatus) {
        where.processingStatus = processingStatus
      }

      // Sync ID filter
      if (syncId) {
        where.syncId = syncId
      }

      // Date range filtering
      if (fetchedAfter) {
        where.fetchedAt = { ...where.fetchedAt as any, gte: new Date(fetchedAfter) }
      }
      if (fetchedBefore) {
        where.fetchedAt = { ...where.fetchedAt as any, lte: new Date(fetchedBefore) }
      }

      return where
    }

    // Build ORDER BY clause
    const buildOrderBy = (table: 'contact' | 'chat'): any => {
      const orderBy: any = {}

      // Map sortBy to actual field names
      const sortableFields = ['fetchedAt', 'processedAt', 'processingStatus', 'apiPage', 'processingAttempt']

      if (sortableFields.includes(sortBy)) {
        orderBy[sortBy] = sortOrder
      } else {
        // Default sort
        orderBy.fetchedAt = sortOrder
      }

      return orderBy
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Fetch data based on entity type
    let records: any[] = []
    let total = 0
    let stats = {
      byStatus: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      }
    }

    if (entityType === 'contacts' || entityType === 'all') {
      const contactWhere = buildContactWhere()
      const contactOrderBy = buildOrderBy('contact')

      // Fetch contacts
      const contacts = await prisma.rawContact.findMany({
        where: contactWhere,
        select: {
          id: true,
          syncId: true,
          b2chatContactId: true,
          fetchedAt: true,
          processedAt: true,
          processingStatus: true,
          processingError: true,
          processingAttempt: true,
          apiPage: true,
          apiOffset: true,
          // Exclude rawData for performance
        },
        orderBy: contactOrderBy,
        skip: entityType === 'contacts' ? skip : undefined,
        take: entityType === 'contacts' ? limit : undefined,
      })

      // Transform to unified format
      const contactRecords = contacts.map(contact => ({
        id: contact.id,
        entityType: 'contact' as const,
        b2chatId: contact.b2chatContactId,
        syncId: contact.syncId,
        processingStatus: contact.processingStatus as ProcessingStatus,
        fetchedAt: contact.fetchedAt.toISOString(),
        processedAt: contact.processedAt ? contact.processedAt.toISOString() : null,
        apiPage: contact.apiPage,
        apiOffset: contact.apiOffset,
        processingError: contact.processingError,
        processingAttempt: contact.processingAttempt,
      }))

      records = [...records, ...contactRecords]

      // Get total count for contacts
      if (entityType === 'contacts') {
        total = await prisma.rawContact.count({ where: contactWhere })
      }

      // Get stats for contacts
      const contactStats = await prisma.rawContact.groupBy({
        by: ['processingStatus'],
        _count: true,
        where: syncId ? { syncId } : undefined,
      })

      contactStats.forEach(stat => {
        stats.byStatus[stat.processingStatus as ProcessingStatus] += stat._count
      })
    }

    if (entityType === 'chats' || entityType === 'all') {
      const chatWhere = buildChatWhere()
      const chatOrderBy = buildOrderBy('chat')

      // Fetch chats
      const chats = await prisma.rawChat.findMany({
        where: chatWhere,
        select: {
          id: true,
          syncId: true,
          b2chatChatId: true,
          fetchedAt: true,
          processedAt: true,
          processingStatus: true,
          processingError: true,
          processingAttempt: true,
          apiPage: true,
          apiOffset: true,
          // Exclude rawData for performance
        },
        orderBy: chatOrderBy,
        skip: entityType === 'chats' ? skip : undefined,
        take: entityType === 'chats' ? limit : undefined,
      })

      // Transform to unified format
      const chatRecords = chats.map(chat => ({
        id: chat.id,
        entityType: 'chat' as const,
        b2chatId: chat.b2chatChatId,
        syncId: chat.syncId,
        processingStatus: chat.processingStatus as ProcessingStatus,
        fetchedAt: chat.fetchedAt.toISOString(),
        processedAt: chat.processedAt ? chat.processedAt.toISOString() : null,
        apiPage: chat.apiPage,
        apiOffset: chat.apiOffset,
        processingError: chat.processingError,
        processingAttempt: chat.processingAttempt,
      }))

      records = [...records, ...chatRecords]

      // Get total count for chats
      if (entityType === 'chats') {
        total = await prisma.rawChat.count({ where: chatWhere })
      }

      // Get stats for chats
      const chatStats = await prisma.rawChat.groupBy({
        by: ['processingStatus'],
        _count: true,
        where: syncId ? { syncId } : undefined,
      })

      chatStats.forEach(stat => {
        stats.byStatus[stat.processingStatus as ProcessingStatus] += stat._count
      })
    }

    // For 'all' entity type, we need to sort and paginate the combined results
    if (entityType === 'all') {
      // Sort combined records
      records.sort((a, b) => {
        const aValue = a[sortBy as keyof typeof a]
        const bValue = b[sortBy as keyof typeof b]

        if (aValue === null) return 1
        if (bValue === null) return -1

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1
        } else {
          return aValue < bValue ? 1 : -1
        }
      })

      // Apply pagination to combined results
      total = records.length
      records = records.slice(skip, skip + limit)
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats,
    })
  } catch (error) {
    logger.error('Error fetching raw data list', {
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Failed to fetch raw data' },
      { status: 500 }
    )
  }
}
