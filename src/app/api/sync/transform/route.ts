import { NextRequest, NextResponse } from 'next/server'
import { TransformEngine } from '@/lib/sync/transform-engine'
import { logger } from '@/lib/logger'
import { auth } from '@clerk/nextjs/server'

/**
 * POST /api/sync/transform
 * Trigger transform operation (process raw data → model tables)
 */
export async function POST(request: NextRequest) {
  let userId: string | null | undefined = undefined
  let extractSyncId: string | undefined = undefined
  let entityType: string | undefined = undefined

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    extractSyncId = body.extractSyncId
    entityType = body.entityType
    const options = body.options || {}

    if (!entityType || !['contacts', 'chats', 'all'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entityType. Must be contacts, chats, or all' },
        { status: 400 }
      )
    }

    // If extractSyncId provided, verify it exists and is completed
    if (extractSyncId) {
      const { prisma } = await import('@/lib/prisma')
      const extractLog = await prisma.extractLog.findUnique({
        where: { syncId: extractSyncId },
      })

      if (!extractLog) {
        return NextResponse.json(
          { error: `Extract log not found for syncId: ${extractSyncId}` },
          { status: 404 }
        )
      }

      if (extractLog.status !== 'completed') {
        return NextResponse.json(
          { error: `Extract operation status is ${extractLog.status}, not completed` },
          { status: 400 }
        )
      }
    }

    logger.info('Transform operation triggered', {
      userId: userId ?? undefined,
      extractSyncId: extractSyncId ?? 'all-pending',
      entityType,
      options,
      mode: extractSyncId ? 'legacy' : 'batch-agnostic',
    })

    const engine = new TransformEngine()

    // Add userId and abort signal to options
    const transformOptions = {
      ...options,
      userId,
      abortSignal: request.signal, // Pass request abort signal to engine
    }

    let result

    if (entityType === 'all') {
      result = await engine.transformAll(extractSyncId, transformOptions)
    } else if (entityType === 'contacts') {
      const contactsResult = await engine.transformContacts(extractSyncId, transformOptions)
      result = { contacts: contactsResult }
    } else {
      const chatsResult = await engine.transformChats(extractSyncId, transformOptions)
      result = { chats: chatsResult }
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    // Handle abort/cancellation gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('Transform operation cancelled by client', { userId: userId ?? undefined, extractSyncId, entityType })
      return NextResponse.json(
        {
          success: false,
          error: 'Operation cancelled',
          message: 'Transform operation was cancelled by the user',
        },
        { status: 499 } // Client Closed Request
      )
    }

    logger.error('Transform operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Transform operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync/transform?extractSyncId=xxx
 * Get transform progress/result for a specific extract
 * Or GET /api/sync/transform (without extractSyncId) to get all transforms
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const extractSyncId = searchParams.get('extractSyncId')

    const { prisma } = await import('@/lib/prisma')

    const transformLogs = await prisma.transformLog.findMany({
      where: extractSyncId ? {
        extractSyncId,
      } : undefined,
      orderBy: {
        startedAt: 'desc',
      },
      take: 50, // Limit to last 50 transforms
    })

    return NextResponse.json({
      success: true,
      transforms: transformLogs,
    })
  } catch (error) {
    logger.error('Failed to fetch transform logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch transform logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
