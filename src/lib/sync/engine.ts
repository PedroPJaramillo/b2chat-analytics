import { B2ChatClient, B2ChatAPIError } from '@/lib/b2chat/client'
import { rateLimitedQueue } from '@/lib/b2chat/queue'
import { SyncStateManager, EntityType } from './state'
import { getSyncConfig } from './config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { SyncLogger } from './logger'

export interface SyncOptions {
  batchSize?: number
  maxRetries?: number
  retryDelay?: number
  fullSync?: boolean
}

export class SyncEngine {
  private client: B2ChatClient

  constructor() {
    this.client = new B2ChatClient()
  }

  private async getSyncOptions(overrides: SyncOptions = {}): Promise<Required<SyncOptions>> {
    const config = await getSyncConfig()

    return {
      batchSize: overrides.batchSize ?? config.batchSize,
      maxRetries: overrides.maxRetries ?? config.retryAttempts,
      retryDelay: overrides.retryDelay ?? config.retryDelay,
      fullSync: overrides.fullSync ?? false,
    }
  }


  async syncContacts(options: SyncOptions = {}): Promise<void> {
    const opts = await this.getSyncOptions(options)
    const syncId = `contacts_sync_${Date.now()}`
    const startTime = Date.now()

    // Get system user ID for logging
    const userId = await SyncLogger.getSystemUserId()
    const syncLogger = await SyncLogger.createSyncLogger(syncId, userId, 'contacts', 'sync')

    let totalProcessed = 0
    let totalSuccessful = 0
    let totalFailed = 0

    try {
      await SyncStateManager.updateSyncState('contacts', {
        syncStatus: 'running',
        lastSyncTimestamp: new Date(),
      })

      const checkpoint = await SyncStateManager.createCheckpoint(syncId, 'contacts')

      let page = 1
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
              where: { b2chatId: contactData.contact_id },
              update: {
                fullName: contactData.fullname || '',
                mobile: contactData.mobile || undefined,
                email: contactData.email || undefined,
                identification: contactData.identification || undefined,
                address: contactData.address || undefined,
                city: contactData.city || undefined,
                country: contactData.country || undefined,
                company: contactData.company || undefined,
                customAttributes: contactData.custom_attributes || undefined,
                lastSyncAt: new Date(),
                updatedAt: new Date(),
              },
              create: {
                id: `contact_${contactData.contact_id}`,
                b2chatId: contactData.contact_id,
                fullName: contactData.fullname || '',
                mobile: contactData.mobile || undefined,
                email: contactData.email || undefined,
                identification: contactData.identification || undefined,
                address: contactData.address || undefined,
                city: contactData.city || undefined,
                country: contactData.country || undefined,
                company: contactData.company || undefined,
                customAttributes: contactData.custom_attributes || undefined,
                lastSyncAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            })
            totalSuccessful++
          } catch (error) {
            logger.error('Failed to sync contact', {
              contactId: contactData.contact_id,
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

        // Update sync log progress
        await syncLogger.updateProgress(totalProcessed, {
          page,
          successful: totalSuccessful,
          failed: totalFailed,
          progress: `${page} pages processed`
        })

        page++
      }

      // Complete the sync
      await SyncStateManager.updateCheckpoint(checkpoint.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
      })

      const endTime = Date.now()
      const syncDuration = endTime - startTime

      await SyncStateManager.updateSyncState('contacts', {
        syncStatus: 'completed',
        lastSyncTimestamp: new Date(),
        totalRecords: totalProcessed,
        successfulRecords: totalSuccessful,
        failedRecords: totalFailed,
        syncDuration,
      })

      // Complete sync log
      await syncLogger.complete(totalProcessed, {
        successful: totalSuccessful,
        failed: totalFailed,
        duration: syncDuration
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await SyncStateManager.updateSyncState('contacts', {
        syncStatus: 'failed',
      })

      // Log sync failure
      await syncLogger.fail(errorMessage, totalProcessed, {
        successful: totalSuccessful,
        failed: totalFailed
      })

      throw error
    }
  }

  async syncChats(options: SyncOptions = {}): Promise<void> {
    const opts = await this.getSyncOptions(options)
    const syncId = `chats_sync_${Date.now()}`
    const startTime = Date.now()

    // Get system user ID for logging
    const userId = await SyncLogger.getSystemUserId()
    const syncLogger = await SyncLogger.createSyncLogger(syncId, userId, 'chats', 'sync')

    let totalProcessed = 0
    let totalSuccessful = 0
    let totalFailed = 0

    try {
      await SyncStateManager.updateSyncState('chats', {
        syncStatus: 'running',
        lastSyncTimestamp: new Date(),
      })

      const checkpoint = await SyncStateManager.createCheckpoint(syncId, 'chats')

      let page = 1
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
            // Extract and upsert agent data if present
            let agentId: string | null = null
            let contactId: string | null = null

            if (chatData.agent) {
              agentId = await this.extractAndUpsertAgent(chatData.agent)
            }

            if (chatData.contact) {
              contactId = await this.extractAndUpsertContact(chatData.contact)
            }

            // Map provider to our enum values
            let provider = chatData.provider?.toLowerCase() || 'livechat'
            if (!['whatsapp', 'facebook', 'telegram', 'livechat', 'b2cbotapi'].includes(provider)) {
              provider = 'livechat' // Default fallback
            }

            // Map status to our enum values
            let status = chatData.status?.toLowerCase() || 'pending'
            if (!['open', 'closed', 'pending'].includes(status)) {
              status = 'pending' // Default fallback
            }

            // Convert duration string to seconds
            let durationInSeconds: number | null = null
            if (chatData.duration && typeof chatData.duration === 'string') {
              try {
                // Parse "HH:MM:SS:MS" format to seconds
                const parts = chatData.duration.split(':').map(p => parseInt(p) || 0)
                if (parts.length >= 3) {
                  const [hours, minutes, seconds] = parts
                  durationInSeconds = hours * 3600 + minutes * 60 + seconds
                }
              } catch {
                // If parsing fails, leave as null
              }
            } else if (typeof chatData.duration === 'number') {
              durationInSeconds = chatData.duration
            }

            await prisma.chat.upsert({
              where: { b2chatId: chatData.chat_id },
              update: {
                agentId,
                contactId,
                provider: provider as any,
                status: status as any,
                isAgentAvailable: chatData.is_agent_available,
                createdAt: chatData.created_at ? new Date(chatData.created_at) : new Date(),
                openedAt: chatData.opened_at ? new Date(chatData.opened_at) : null,
                pickedUpAt: chatData.picked_up_at ? new Date(chatData.picked_up_at) : null,
                responseAt: chatData.responded_at ? new Date(chatData.responded_at) : null,
                closedAt: chatData.closed_at ? new Date(chatData.closed_at) : null,
                duration: durationInSeconds,
                lastSyncAt: new Date(),
              },
              create: {
                id: `chat_${chatData.chat_id}`,
                b2chatId: chatData.chat_id,
                agentId,
                contactId,
                provider: provider as any,
                status: status as any,
                isAgentAvailable: chatData.is_agent_available,
                createdAt: chatData.created_at ? new Date(chatData.created_at) : new Date(),
                openedAt: chatData.opened_at ? new Date(chatData.opened_at) : null,
                pickedUpAt: chatData.picked_up_at ? new Date(chatData.picked_up_at) : null,
                responseAt: chatData.responded_at ? new Date(chatData.responded_at) : null,
                closedAt: chatData.closed_at ? new Date(chatData.closed_at) : null,
                duration: durationInSeconds,
                lastSyncAt: new Date(),
              },
            })
            totalSuccessful++
          } catch (error) {
            logger.error('Failed to sync chat', {
              chatId: chatData.chat_id,
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

        // Update sync log progress
        await syncLogger.updateProgress(totalProcessed, {
          page,
          successful: totalSuccessful,
          failed: totalFailed,
          progress: `${page} pages processed`
        })

        page++
      }

      // Complete the sync
      await SyncStateManager.updateCheckpoint(checkpoint.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
      })

      const endTime = Date.now()
      const syncDuration = endTime - startTime

      await SyncStateManager.updateSyncState('chats', {
        syncStatus: 'completed',
        lastSyncTimestamp: new Date(),
        totalRecords: totalProcessed,
        successfulRecords: totalSuccessful,
        failedRecords: totalFailed,
        syncDuration,
      })

      // Complete sync log
      await syncLogger.complete(totalProcessed, {
        successful: totalSuccessful,
        failed: totalFailed,
        duration: syncDuration
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await SyncStateManager.updateSyncState('chats', {
        syncStatus: 'failed',
      })

      // Log sync failure
      await syncLogger.fail(errorMessage, totalProcessed, {
        successful: totalSuccessful,
        failed: totalFailed
      })

      throw error
    }
  }

  async syncAll(options: SyncOptions = {}): Promise<void> {
    const syncId = `full_sync_${Date.now()}`

    // Get system user ID for logging
    const userId = await SyncLogger.getSystemUserId()
    const syncLogger = await SyncLogger.createSyncLogger(syncId, userId, 'all', 'full_sync')

    try {
      // Sync contacts and chats (agents not supported by B2Chat API)
      await this.syncContacts(options)
      await this.syncChats(options)

      await syncLogger.complete(0, {
        contacts_synced: true,
        chats_synced: true,
        operation: 'full_sync'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await syncLogger.fail(errorMessage, 0, {
        operation: 'full_sync'
      })

      throw error
    }
  }

  private async getLastSyncTime(entityType: EntityType): Promise<Date | undefined> {
    const syncState = await SyncStateManager.getLastSync(entityType)
    return syncState?.lastSyncTimestamp || undefined
  }

  /**
   * Extract agent data from chat response and upsert to database
   * Returns the agent ID for linking to chat
   */
  private async extractAndUpsertAgent(agentData: any): Promise<string | null> {
    if (!agentData) return null

    try {
      // Extract agent fields from B2Chat response
      // Based on API docs: agent.name, agent.username, agent.email
      const name = agentData.name || agentData.full_name || null
      const username = agentData.username || null
      const email = agentData.email || null

      // Skip if we don't have enough data to identify the agent
      if (!name && !username && !email) {
        return null
      }

      // Create a unique identifier for this agent
      // Use username if available, otherwise use email, otherwise generate from name
      let agentId: string
      let b2chatId: string

      if (username) {
        agentId = `agent_${username.replace(/[^a-zA-Z0-9]/g, '_')}`
        b2chatId = username
      } else if (email) {
        agentId = `agent_${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`
        b2chatId = email
      } else {
        agentId = `agent_${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
        b2chatId = name
      }

      // Upsert agent record
      const agent = await prisma.agent.upsert({
        where: {
          username: username || `extracted_${b2chatId}`
        },
        update: {
          name: name || 'Unknown Agent',
          email: email,
          isActive: true, // Assume active if they're handling chats
          lastSyncAt: new Date(),
        },
        create: {
          id: agentId,
          b2chatId,
          name: name || 'Unknown Agent',
          username: username || `extracted_${b2chatId}`,
          email,
          isActive: true,
          lastSyncAt: new Date(),
        }
      })

      return agent.id

    } catch (error) {
      logger.error('Failed to extract agent from chat data', {
        agentData,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Extract contact data from chat response and upsert to database
   * Returns the contact ID for linking to chat
   */
  private async extractAndUpsertContact(contactData: any): Promise<string | null> {
    if (!contactData) return null

    try {
      // Extract contact fields from B2Chat response
      const name = contactData.name || contactData.full_name || contactData.fullname || null
      const email = contactData.email || null
      const mobile = contactData.mobile_number || contactData.mobile || contactData.phone_number || null
      const identification = contactData.identification || null

      // Skip if we don't have enough data to identify the contact
      if (!name && !email && !mobile) {
        return null
      }

      // Create a unique identifier for this contact
      let contactId: string
      let b2chatId: string

      if (identification) {
        contactId = `contact_${identification.replace(/[^a-zA-Z0-9]/g, '_')}`
        b2chatId = identification
      } else if (mobile) {
        contactId = `contact_${mobile.replace(/[^a-zA-Z0-9]/g, '_')}`
        b2chatId = mobile
      } else if (email) {
        contactId = `contact_${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`
        b2chatId = email
      } else {
        contactId = `contact_${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
        b2chatId = name
      }

      // Upsert contact record
      const contact = await prisma.contact.upsert({
        where: {
          b2chatId
        },
        update: {
          fullName: name || 'Unknown Contact',
          email,
          mobile,
          identification,
          lastSyncAt: new Date(),
        },
        create: {
          id: contactId,
          b2chatId,
          fullName: name || 'Unknown Contact',
          email,
          mobile,
          identification,
          lastSyncAt: new Date(),
        }
      })

      return contact.id

    } catch (error) {
      logger.error('Failed to extract contact from chat data', {
        contactData,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }
}