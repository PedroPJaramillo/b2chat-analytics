import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SyncEngine } from '@/lib/sync/engine'
import { SyncStateManager } from '@/lib/sync/state'
import { logger } from '@/lib/logger'
import { validateRequestBody, SyncRequestSchema, createValidationError, isValidationError } from '@/lib/validation'
import { syncRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting for sync operations
    const rateLimitResponse = await syncRateLimit(req, userId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Validate request body
    const validationResult = await validateRequestBody(req, SyncRequestSchema)
    if (isValidationError(validationResult)) {
      return NextResponse.json(createValidationError(validationResult.details), { status: 400 })
    }

    const { entityType, options = {} } = validationResult

    const syncEngine = new SyncEngine()

    logger.info('Manual sync triggered', {
      userId,
      entityType,
      options
    })

    let result
    switch (entityType) {
      case 'contacts':
        result = await syncEngine.syncContacts(userId, options)
        break
      case 'chats':
        result = await syncEngine.syncChats(userId, options)
        break
      case 'all':
        result = await syncEngine.syncAll(userId, options)
        break
    }

    return NextResponse.json({
      success: result ? result.success !== false : true,
      message: `${entityType} sync completed`,
      result: result
    })

  } catch (error) {
    logger.error('Sync API error', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Sync operation failed', success: false },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get sync status for supported entities (contacts and chats only)
    const contactsSync = await SyncStateManager.getLastSync('contacts')
    const chatsSync = await SyncStateManager.getLastSync('chats')

    return NextResponse.json({
      contacts: contactsSync,
      chats: chatsSync,
    })

  } catch (error) {
    logger.error('Sync status API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}