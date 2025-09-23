import { B2ChatClient, B2ChatAPIError } from '@/lib/b2chat/client'
import { rateLimitedQueue } from '@/lib/b2chat/queue'
import { SyncStateManager, EntityType } from './state'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export interface SyncOptions {
  batchSize?: number
  maxRetries?: number
  retryDelay?: number
  fullSync?: boolean
}

export class SyncEngine {
  private client: B2ChatClient
  private defaultOptions: Required<SyncOptions> = {
    batchSize: 100,
    maxRetries: 3,
    retryDelay: 1000,
    fullSync: false,
  }

  constructor() {
    this.client = new B2ChatClient()
  }

  async syncAgents(options: SyncOptions = {}): Promise<void> {
    const opts = { ...this.defaultOptions, ...options }
    const syncId = `agents_sync_${Date.now()}`

    logger.info('Starting agents sync', { syncId, options: opts })

    try {
      await SyncStateManager.updateSyncState('agents', {
        syncStatus: 'running',
        lastSyncTimestamp: new Date(),
      })

      const checkpoint = await SyncStateManager.createCheckpoint(syncId, 'agents')

      // Get agents from B2Chat API
      const agents = await rateLimitedQueue.add(() => this.client.getAgents())

      await SyncStateManager.updateCheckpoint(checkpoint.id, {
        totalRecords: agents.length,
      })

      let processed = 0
      let successful = 0
      let failed = 0

      // Process agents in batches
      for (let i = 0; i < agents.length; i += opts.batchSize) {
        const batch = agents.slice(i, i + opts.batchSize)

        for (const agentData of batch) {
          try {
            await prisma.agent.upsert({
              where: { b2chatId: agentData.id },
              update: {
                name: agentData.name,
                email: agentData.email,
                username: agentData.username,
                isActive: agentData.active,
                lastSyncAt: new Date(),
                updatedAt: new Date(),
              },
              create: {
                id: `agent_${agentData.id}`,
                b2chatId: agentData.id,
                name: agentData.name,
                email: agentData.email,
                username: agentData.username,
                isActive: agentData.active,
                lastSyncAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            })
            successful++
          } catch (error) {
            logger.error('Failed to sync agent', {
              agentId: agentData.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            failed++
          }
          processed++
        }

        // Update checkpoint progress
        await SyncStateManager.updateCheckpoint(checkpoint.id, {
          processedRecords: processed,
          successfulRecords: successful,
          failedRecords: failed,
        })

        logger.info('Agents sync progress', {
          syncId,
          processed,
          successful,
          failed,
          total: agents.length
        })
      }

      // Complete the sync
      await SyncStateManager.updateCheckpoint(checkpoint.id, {
        status: failed > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
      })

      await SyncStateManager.updateSyncState('agents', {
        syncStatus: 'completed',
        lastSyncTimestamp: new Date(),
      })

      logger.info('Agents sync completed', {
        syncId,
        total: agents.length,
        successful,
        failed
      })

    } catch (error) {
      logger.error('Agents sync failed', {
        syncId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      await SyncStateManager.updateSyncState('agents', {
        syncStatus: 'failed',
      })

      throw error
    }
  }

  async syncContacts(options: SyncOptions = {}): Promise<void> {
    const opts = { ...this.defaultOptions, ...options }
    const syncId = `contacts_sync_${Date.now()}`

    logger.info('Starting contacts sync', { syncId, options: opts })

    try {
      await SyncStateManager.updateSyncState('contacts', {
        syncStatus: 'running',
        lastSyncTimestamp: new Date(),
      })

      const checkpoint = await SyncStateManager.createCheckpoint(syncId, 'contacts')

      let page = 1
      let totalProcessed = 0
      let totalSuccessful = 0
      let totalFailed = 0
      let hasMorePages = true

      while (hasMorePages) {
        const lastSyncTime = opts.fullSync ? undefined : await this.getLastSyncTime('contacts')
        const response = await rateLimitedQueue.add(() =>
          this.client.getContacts({
            page,
            limit: opts.batchSize,
            updated_since: lastSyncTime
          })
        )

        const { data: contacts, pagination } = response
        hasMorePages = pagination.hasNextPage || false

        if (contacts.length === 0) {
          break
        }

        for (const contactData of contacts) {
          try {
            await prisma.contact.upsert({
              where: { b2chatId: contactData.id },
              update: {
                fullName: contactData.full_name,
                mobile: contactData.mobile,
                email: contactData.email,
                identification: contactData.identification,
                address: contactData.address,
                city: contactData.city,
                country: contactData.country,
                company: contactData.company,
                customAttributes: contactData.custom_attributes,
                lastSyncAt: new Date(),
                updatedAt: new Date(),
              },
              create: {
                id: `contact_${contactData.id}`,
                b2chatId: contactData.id,
                fullName: contactData.full_name,
                mobile: contactData.mobile,
                email: contactData.email,
                identification: contactData.identification,
                address: contactData.address,
                city: contactData.city,
                country: contactData.country,
                company: contactData.company,
                customAttributes: contactData.custom_attributes,
                lastSyncAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            })
            totalSuccessful++
          } catch (error) {
            logger.error('Failed to sync contact', {
              contactId: contactData.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            totalFailed++
          }
          totalProcessed++
        }

        // Update checkpoint progress
        await SyncStateManager.updateCheckpoint(checkpoint.id, {
          processedRecords: totalProcessed,
          successfulRecords: totalSuccessful,
          failedRecords: totalFailed,
        })

        logger.info('Contacts sync progress', {
          syncId,
          page,
          processed: totalProcessed,
          successful: totalSuccessful,
          failed: totalFailed
        })

        page++
      }

      // Complete the sync
      await SyncStateManager.updateCheckpoint(checkpoint.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
      })

      await SyncStateManager.updateSyncState('contacts', {
        syncStatus: 'completed',
        lastSyncTimestamp: new Date(),
      })

      logger.info('Contacts sync completed', {
        syncId,
        total: totalProcessed,
        successful: totalSuccessful,
        failed: totalFailed
      })

    } catch (error) {
      logger.error('Contacts sync failed', {
        syncId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      await SyncStateManager.updateSyncState('contacts', {
        syncStatus: 'failed',
      })

      throw error
    }
  }

  async syncChats(options: SyncOptions = {}): Promise<void> {
    const opts = { ...this.defaultOptions, ...options }
    const syncId = `chats_sync_${Date.now()}`

    logger.info('Starting chats sync', { syncId, options: opts })

    try {
      await SyncStateManager.updateSyncState('chats', {
        syncStatus: 'running',
        lastSyncTimestamp: new Date(),
      })

      const checkpoint = await SyncStateManager.createCheckpoint(syncId, 'chats')

      let page = 1
      let totalProcessed = 0
      let totalSuccessful = 0
      let totalFailed = 0
      let hasMorePages = true

      while (hasMorePages) {
        const lastSyncTime = opts.fullSync ? undefined : await this.getLastSyncTime('chats')
        const response = await rateLimitedQueue.add(() =>
          this.client.getChats({
            page,
            limit: opts.batchSize,
            updated_since: lastSyncTime
          })
        )

        const { data: chats, pagination } = response
        hasMorePages = pagination.hasNextPage || false

        if (chats.length === 0) {
          break
        }

        for (const chatData of chats) {
          try {
            await prisma.chat.upsert({
              where: { b2chatId: chatData.id },
              update: {
                agentId: chatData.agent_id ? `agent_${chatData.agent_id}` : null,
                contactId: chatData.contact_id ? `contact_${chatData.contact_id}` : null,
                provider: chatData.provider,
                status: chatData.status,
                isAgentAvailable: chatData.is_agent_available,
                createdAt: new Date(chatData.created_at),
                openedAt: chatData.opened_at ? new Date(chatData.opened_at) : null,
                pickedUpAt: chatData.picked_up_at ? new Date(chatData.picked_up_at) : null,
                responseAt: chatData.response_at ? new Date(chatData.response_at) : null,
                closedAt: chatData.closed_at ? new Date(chatData.closed_at) : null,
                duration: chatData.duration,
                lastSyncAt: new Date(),
              },
              create: {
                id: `chat_${chatData.id}`,
                b2chatId: chatData.id,
                agentId: chatData.agent_id ? `agent_${chatData.agent_id}` : null,
                contactId: chatData.contact_id ? `contact_${chatData.contact_id}` : null,
                provider: chatData.provider,
                status: chatData.status,
                isAgentAvailable: chatData.is_agent_available,
                createdAt: new Date(chatData.created_at),
                openedAt: chatData.opened_at ? new Date(chatData.opened_at) : null,
                pickedUpAt: chatData.picked_up_at ? new Date(chatData.picked_up_at) : null,
                responseAt: chatData.response_at ? new Date(chatData.response_at) : null,
                closedAt: chatData.closed_at ? new Date(chatData.closed_at) : null,
                duration: chatData.duration,
                lastSyncAt: new Date(),
              },
            })
            totalSuccessful++
          } catch (error) {
            logger.error('Failed to sync chat', {
              chatId: chatData.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            totalFailed++
          }
          totalProcessed++
        }

        // Update checkpoint progress
        await SyncStateManager.updateCheckpoint(checkpoint.id, {
          processedRecords: totalProcessed,
          successfulRecords: totalSuccessful,
          failedRecords: totalFailed,
        })

        logger.info('Chats sync progress', {
          syncId,
          page,
          processed: totalProcessed,
          successful: totalSuccessful,
          failed: totalFailed
        })

        page++
      }

      // Complete the sync
      await SyncStateManager.updateCheckpoint(checkpoint.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
      })

      await SyncStateManager.updateSyncState('chats', {
        syncStatus: 'completed',
        lastSyncTimestamp: new Date(),
      })

      logger.info('Chats sync completed', {
        syncId,
        total: totalProcessed,
        successful: totalSuccessful,
        failed: totalFailed
      })

    } catch (error) {
      logger.error('Chats sync failed', {
        syncId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      await SyncStateManager.updateSyncState('chats', {
        syncStatus: 'failed',
      })

      throw error
    }
  }

  async syncAll(options: SyncOptions = {}): Promise<void> {
    logger.info('Starting full sync of all entities', { options })

    try {
      // Sync in order: agents -> contacts -> chats
      await this.syncAgents(options)
      await this.syncContacts(options)
      await this.syncChats(options)

      logger.info('Full sync completed successfully')
    } catch (error) {
      logger.error('Full sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private async getLastSyncTime(entityType: EntityType): Promise<Date | undefined> {
    const syncState = await SyncStateManager.getLastSync(entityType)
    return syncState?.lastSyncTimestamp || undefined
  }
}