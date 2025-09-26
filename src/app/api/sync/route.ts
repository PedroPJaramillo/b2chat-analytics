import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SyncEngine } from '@/lib/sync/engine'
import { SyncStateManager } from '@/lib/sync/state'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { entityType, options = {} } = body

    const syncEngine = new SyncEngine()

    logger.info('Manual sync triggered', {
      userId,
      entityType,
      options
    })

    switch (entityType) {
      case 'contacts':
        await syncEngine.syncContacts(options)
        break
      case 'chats':
        await syncEngine.syncChats(options)
        break
      case 'all':
        await syncEngine.syncAll(options)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid entity type. Supported: contacts, chats, all' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `${entityType} sync completed successfully`
    })

  } catch (error) {
    logger.error('Sync API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Sync operation failed' },
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