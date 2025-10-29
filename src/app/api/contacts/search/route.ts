import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/contacts/search
 * Search for contacts by mobile number or name
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mobile = searchParams.get('mobile')
    const name = searchParams.get('name')
    const b2chatId = searchParams.get('b2chatId')

    if (!mobile && !name && !b2chatId) {
      return NextResponse.json(
        { error: 'At least one search parameter (mobile, name, or b2chatId) is required' },
        { status: 400 }
      )
    }

    const { prisma } = await import('@/lib/prisma')

    // Build search query
    const where: any = {
      isDeleted: false, // Only search active contacts
    }

    if (b2chatId) {
      where.b2chatId = b2chatId
    } else if (mobile) {
      // Search by mobile number (exact match or partial)
      where.mobile = {
        contains: mobile,
        mode: 'insensitive',
      }
    } else if (name) {
      // Search by name (partial match)
      where.fullName = {
        contains: name,
        mode: 'insensitive',
      }
    }

    const contacts = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        b2chatId: true,
        fullName: true,
        mobile: true,
        phoneNumber: true,
        email: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 10, // Limit results
      orderBy: {
        updatedAt: 'desc',
      },
    })

    logger.info('Contact search completed', {
      userId: userId ?? undefined,
      searchParams: { mobile, name, b2chatId },
      resultsCount: contacts.length,
    })

    return NextResponse.json({
      success: true,
      contacts,
      count: contacts.length,
    })
  } catch (error) {
    logger.error('Contact search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Contact search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
