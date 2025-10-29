import { NextRequest, NextResponse } from 'next/server'
import { ExtractEngine } from '@/lib/sync/extract-engine'
import { logger } from '@/lib/logger'
import { auth } from '@clerk/nextjs/server'

/**
 * POST /api/sync/extract
 * Trigger extract operation (fetch data from B2Chat → raw tables)
 */
export async function POST(request: NextRequest) {
  let userId: string | null | undefined = undefined
  let entityType: string | undefined = undefined

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    entityType = body.entityType
    const options = body.options || {}

    if (!entityType || !['contacts', 'chats', 'all'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entityType. Must be contacts, chats, or all' },
        { status: 400 }
      )
    }

    logger.info('Extract operation triggered', {
      userId: userId ?? undefined,
      entityType,
      options,
    })

    const engine = new ExtractEngine()

    // Add userId and abort signal to options
    const extractOptions = {
      ...options,
      userId,
      abortSignal: request.signal, // Pass request abort signal to engine
    }

    let result

    if (entityType === 'all') {
      result = await engine.extractAll(extractOptions)
    } else if (entityType === 'contacts') {
      const contactsResult = await engine.extractContacts(extractOptions)
      result = { contacts: contactsResult }
    } else {
      const chatsResult = await engine.extractChats(extractOptions)
      result = { chats: chatsResult }
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    // Handle abort/cancellation gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('Extract operation cancelled by client', { userId: userId ?? undefined, entityType })
      return NextResponse.json(
        {
          success: false,
          error: 'Operation cancelled',
          message: 'Extract operation was cancelled by the user',
        },
        { status: 499 } // Client Closed Request
      )
    }

    // Collect detailed error information
    const errorDetails: any = {}
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const apiError = error as {
        statusCode: number
        response?: unknown
        endpoint?: string
        requestUrl?: string
      }
      errorDetails.statusCode = apiError.statusCode
      errorDetails.endpoint = apiError.endpoint
      errorDetails.requestUrl = apiError.requestUrl
      errorDetails.rawResponse = apiError.response
    }

    logger.error('Extract operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorDetails,
    })

    return NextResponse.json(
      {
        error: 'Extract operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: Object.keys(errorDetails).length > 0 ? errorDetails : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync/extract?entityType=contacts
 * Get list of available extract batches
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')

    const { prisma } = await import('@/lib/prisma')

    const where = entityType ? { entityType } : {}

    const extractLogs = await prisma.extractLog.findMany({
      where,
      orderBy: {
        startedAt: 'desc',
      },
      take: 20, // Last 20 extracts
    })

    return NextResponse.json({
      success: true,
      batches: extractLogs,
    })
  } catch (error) {
    logger.error('Failed to fetch extract batches', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch extract batches',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
