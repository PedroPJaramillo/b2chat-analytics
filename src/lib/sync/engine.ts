import { B2ChatClient, B2ChatAPIError, B2ChatMessage } from '@/lib/b2chat/client'
import { rateLimitedQueue } from '@/lib/b2chat/queue'
import { SyncStateManager, EntityType } from './state'
import { getSyncConfig } from './config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { SyncLogger } from './logger'
import { syncEventEmitter } from './event-emitter'
import { SyncCancelledError } from './cancellation'
import {
  SyncEventType,
  SyncPhase,
  SyncStartedEvent,
  SyncCompletedEvent,
  SyncFailedEvent,
  PhaseStartedEvent,
  ContactsFetchStartedEvent,
  ContactsProcessingEvent,
  ChatsProcessingEvent,
  DatabaseOperationStartedEvent,
  ProgressUpdateEvent,
  ApiErrorEvent
} from './events'

export interface SyncOptions {
  batchSize?: number
  maxRetries?: number
  retryDelay?: number
  fullSync?: boolean
  userId?: string
  emitEvents?: boolean
  dateRange?: {
    startDate?: string
    endDate?: string
  }
  timeRangePreset?: '1d' | '7d' | '30d' | '90d' | 'custom' | 'full'
  abortSignal?: AbortSignal
  syncId?: string
}

export class SyncEngine {
  private client: B2ChatClient

  constructor() {
    this.client = new B2ChatClient()
  }

  /**
   * Detects chat direction based on first message and broadcast flag
   * @param messages Array of messages from B2Chat
   * @param tags Chat tags that might indicate broadcast
   * @returns ChatDirection enum value
   */
  private detectChatDirection(messages: B2ChatMessage[], tags: string[] = []): 'incoming' | 'outgoing' | 'outgoing_broadcast' {
    if (!messages || messages.length === 0) {
      // No messages, assume incoming (default)
      return 'incoming'
    }

    // Sort messages by timestamp to get the first one
    const sortedMessages = [...messages].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateA - dateB
    })

    const firstMessage = sortedMessages[0]

    // If customer sent first message, it's incoming
    if (firstMessage.incoming === true) {
      return 'incoming'
    }

    // Agent sent first message - check if it's broadcast or 1-to-1
    if (firstMessage.incoming === false) {
      // Check if message was broadcasted
      if (firstMessage.broadcasted === true) {
        return 'outgoing_broadcast'
      }

      // Check if chat has broadcast-related tags
      const broadcastTags = ['broadcast', 'campaign', 'mass_message', 'bulk']
      const hasBroadcastTag = tags.some(tag =>
        broadcastTags.some(bt => tag.toLowerCase().includes(bt))
      )

      if (hasBroadcastTag) {
        return 'outgoing_broadcast'
      }

      // Regular 1-to-1 outgoing message
      return 'outgoing'
    }

    // Fallback to incoming
    return 'incoming'
  }

  private convertPresetToDateRange(preset?: string): { startDate?: Date; endDate?: Date } | undefined {
    if (!preset || preset === 'full') return undefined

    const now = new Date()
    const endDate = now
    let startDate: Date

    switch (preset) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        return undefined
    }

    return { startDate, endDate }
  }

  private async getSyncOptions(overrides: SyncOptions = {}): Promise<Required<Omit<SyncOptions, 'dateRange' | 'timeRangePreset' | 'abortSignal' | 'syncId'>> & Pick<SyncOptions, 'dateRange' | 'timeRangePreset' | 'abortSignal' | 'syncId'>> {
    const config = await getSyncConfig()

    return {
      batchSize: overrides.batchSize ?? config.batchSize,
      maxRetries: overrides.maxRetries ?? config.retryAttempts,
      retryDelay: overrides.retryDelay ?? config.retryDelay,
      fullSync: overrides.fullSync ?? false,
      userId: overrides.userId ?? 'system',
      emitEvents: overrides.emitEvents ?? true,
      dateRange: overrides.dateRange,
      timeRangePreset: overrides.timeRangePreset,
      abortSignal: overrides.abortSignal,
      syncId: overrides.syncId,
    }
  }


  async syncContacts(options: SyncOptions = {}): Promise<void> {
    const opts = await this.getSyncOptions(options)
    // Use provided syncId or generate a new one
    const syncId = opts.syncId || `contacts_sync_${Date.now()}`
    const startTime = Date.now()

    // Get user context for logging (system user for automated operations)
    const userId = opts.userId || await SyncLogger.getSystemUserId()
    const syncLogger = await SyncLogger.createSyncLogger(syncId, userId, 'contacts', 'sync')

    let totalProcessed = 0
    let totalSuccessful = 0
    let totalFailed = 0
    let checkpoint: Awaited<ReturnType<typeof SyncStateManager.createCheckpoint>> | null = null

    try {
      await SyncStateManager.updateSyncState('contacts', {
        syncStatus: 'running',
        lastSyncTimestamp: new Date(),
      })

      checkpoint = await SyncStateManager.createCheckpoint(syncId, 'contacts')

      let page = 1
      let hasMorePages = true

      while (hasMorePages) {
        // Check for cancellation at the start of each page
        if (opts.abortSignal?.aborted) {
          throw new SyncCancelledError(syncId, 'contacts_sync', {
            processed: totalProcessed,
            total: undefined
          })
        }

        // Determine date range for sync
        let dateRange: { startDate?: Date; endDate?: Date } | undefined

        if (opts.timeRangePreset) {
          dateRange = this.convertPresetToDateRange(opts.timeRangePreset)
        } else if (opts.dateRange) {
          dateRange = {
            startDate: opts.dateRange.startDate ? new Date(opts.dateRange.startDate) : undefined,
            endDate: opts.dateRange.endDate ? new Date(opts.dateRange.endDate) : undefined
          }
        } else if (!opts.fullSync) {
          const lastSyncTime = await this.getLastSyncTime('contacts')
          if (lastSyncTime) {
            dateRange = { startDate: lastSyncTime, endDate: new Date() }
          }
        }

        const response = await rateLimitedQueue.add(() =>
          this.client.getContacts({
            page,
            limit: opts.batchSize,
            dateRange
          })
        )

        // Save raw API response for debugging and audit trail
        await this.saveApiResponse({
          syncId,
          endpoint: '/contacts/export',
          requestParams: { page, limit: opts.batchSize, dateRange },
          rawResponse: response,
          responseSize: JSON.stringify(response).length,
          recordCount: response.data.length
        })

        const { data: contacts, pagination } = response
        hasMorePages = pagination.hasNextPage || false

        // Check for cancellation after API fetch
        if (opts.abortSignal?.aborted) {
          throw new SyncCancelledError(syncId, 'contacts_sync', {
            processed: totalProcessed,
            total: undefined
          })
        }

        if (contacts.length === 0) {
          break
        }

        for (const contactData of contacts) {
          // Check for cancellation before processing each contact
          if (opts.abortSignal?.aborted) {
            throw new SyncCancelledError(syncId, 'contacts_sync', {
              processed: totalProcessed,
              total: undefined
            })
          }

          // Skip contacts without a valid contact_id
          if (!contactData.contact_id) {
            logger.warn('Skipping contact without contact_id', {
              contactData,
              hasFullname: !!contactData.fullname,
              hasName: !!contactData.name,
              hasMobile: !!contactData.mobile,
              hasEmail: !!contactData.email
            })
            totalFailed++
            totalProcessed++
            continue
          }

          try {
            await prisma.contact.upsert({
              where: { b2chatId: contactData.contact_id },
              update: {
                fullName: contactData.fullname || contactData.name || '',
                mobile: contactData.mobile || contactData.mobile_number || undefined,
                phoneNumber: contactData.phone_number || undefined,
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
                fullName: contactData.fullname || contactData.name || '',
                mobile: contactData.mobile || contactData.mobile_number || undefined,
                phoneNumber: contactData.phone_number || undefined,
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

      // Handle cancellation differently from failure
      if (error instanceof SyncCancelledError) {
        logger.info('Contacts sync cancelled', {
          syncId,
          totalProcessed,
          totalSuccessful,
          totalFailed
        })

        await SyncStateManager.updateSyncState('contacts', {
          syncStatus: 'cancelled',
          totalRecords: totalProcessed,
          successfulRecords: totalSuccessful,
          failedRecords: totalFailed,
        })

        if (checkpoint) {
          await SyncStateManager.updateCheckpoint(checkpoint.id, {
            status: 'failed',
            completedAt: new Date(),
          })
        }

        // Log cancellation
        await syncLogger.fail('Sync cancelled by user', totalProcessed, {
          successful: totalSuccessful,
          failed: totalFailed,
          cancelled: true
        })
      } else {
        await SyncStateManager.updateSyncState('contacts', {
          syncStatus: 'failed',
        })

        // Log sync failure
        await syncLogger.fail(errorMessage, totalProcessed, {
          successful: totalSuccessful,
          failed: totalFailed
        })
      }

      throw error
    }
  }

  async syncChats(options: SyncOptions = {}): Promise<void> {
    const opts = await this.getSyncOptions(options)
    // Use provided syncId or generate a new one
    const syncId = opts.syncId || `chats_sync_${Date.now()}`
    const startTime = Date.now()

    // Get user context for logging (system user for automated operations)
    const userId = opts.userId || await SyncLogger.getSystemUserId()
    const syncLogger = await SyncLogger.createSyncLogger(syncId, userId, 'chats', 'sync')

    let totalProcessed = 0
    let totalSuccessful = 0
    let totalFailed = 0
    let checkpoint: Awaited<ReturnType<typeof SyncStateManager.createCheckpoint>> | null = null

    try {
      await SyncStateManager.updateSyncState('chats', {
        syncStatus: 'running',
        lastSyncTimestamp: new Date(),
      })

      checkpoint = await SyncStateManager.createCheckpoint(syncId, 'chats')

      let page = 1
      let hasMorePages = true

      while (hasMorePages) {
        // Check for cancellation at the start of each page
        if (opts.abortSignal?.aborted) {
          throw new SyncCancelledError(syncId, 'chats_sync', {
            processed: totalProcessed,
            total: undefined
          })
        }

        // Determine date range for sync
        let dateRange: { startDate?: Date; endDate?: Date } | undefined

        if (opts.timeRangePreset) {
          dateRange = this.convertPresetToDateRange(opts.timeRangePreset)
        } else if (opts.dateRange) {
          dateRange = {
            startDate: opts.dateRange.startDate ? new Date(opts.dateRange.startDate) : undefined,
            endDate: opts.dateRange.endDate ? new Date(opts.dateRange.endDate) : undefined
          }
        } else if (!opts.fullSync) {
          const lastSyncTime = await this.getLastSyncTime('chats')
          if (lastSyncTime) {
            dateRange = { startDate: lastSyncTime, endDate: new Date() }
          }
        }

        const response = await rateLimitedQueue.add(() =>
          this.client.getChats({
            page,
            limit: opts.batchSize,
            dateRange
          })
        )

        // Save raw API response for debugging and audit trail
        await this.saveApiResponse({
          syncId,
          endpoint: '/chats/export',
          requestParams: { page, limit: opts.batchSize, dateRange },
          rawResponse: response,
          responseSize: JSON.stringify(response).length,
          recordCount: response.data.length
        })

        const { data: chats, pagination } = response
        hasMorePages = pagination.hasNextPage || false

        // Check for cancellation after API fetch
        if (opts.abortSignal?.aborted) {
          throw new SyncCancelledError(syncId, 'chats_sync', {
            processed: totalProcessed,
            total: undefined
          })
        }

        if (chats.length === 0) {
          break
        }

        for (const chatData of chats) {
          // Check for cancellation before processing each chat
          if (opts.abortSignal?.aborted) {
            throw new SyncCancelledError(syncId, 'chats_sync', {
              processed: totalProcessed,
              total: undefined
            })
          }


          try {
            // LOG: Raw chat data structure for debugging
            if (totalProcessed === 0) {
              logger.info('DEBUG: First chat data structure', {
                chatId: chatData.chat_id,
                hasAgent: !!chatData.agent,
                agentType: typeof chatData.agent,
                agentValue: chatData.agent,
                hasContact: !!chatData.contact,
                contactType: typeof chatData.contact,
                contactValue: chatData.contact,
                hasDepartment: !!chatData.department,
                departmentType: typeof chatData.department,
                departmentValue: chatData.department,
                allKeys: Object.keys(chatData)
              })
            }

            // Extract and upsert agent, contact, and department data if present
            let agentId: string | null = null
            let contactId: string | null = null
            let departmentId: string | null = null

            if (chatData.agent) {
              logger.info('DEBUG: Attempting agent extraction', {
                chatId: chatData.chat_id,
                agentData: chatData.agent,
                agentDataType: typeof chatData.agent
              })
              agentId = await this.extractAndUpsertAgent(chatData.agent)
              logger.info('DEBUG: Agent extraction result', {
                chatId: chatData.chat_id,
                extractedAgentId: agentId
              })
            }

            if (chatData.contact) {
              contactId = await this.extractAndUpsertContact(chatData.contact)
            }

            if (chatData.department) {
              departmentId = await this.extractAndUpsertDepartment(chatData.department)
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

            // Detect chat direction based on first message
            const detectedDirection = this.detectChatDirection(
              chatData.messages || [],
              chatData.tags || []
            )

            // Check if chat already exists to preserve originalDirection
            const existingChat = await prisma.chat.findUnique({
              where: { b2chatId: chatData.chat_id },
              select: { originalDirection: true, direction: true }
            })

            // Determine direction values for dual tracking
            let currentDirection = detectedDirection
            let originalDirection = existingChat?.originalDirection || detectedDirection

            // Conversion logic: if originally outgoing and now has customer replies, convert to incoming
            if (existingChat && existingChat.originalDirection !== 'incoming') {
              // Check if customer has replied (any incoming message exists)
              const hasCustomerReply = chatData.messages?.some(msg => msg.incoming === true)
              if (hasCustomerReply) {
                currentDirection = 'incoming' // Converted to support chat
                // Keep originalDirection as it was (outgoing or outgoing_broadcast)
              }
            }

            const chat = await prisma.chat.upsert({
              where: { b2chatId: chatData.chat_id },
              update: {
                agentId,
                contactId,
                departmentId,
                provider: provider as any,
                status: status as any,
                isAgentAvailable: chatData.is_agent_available,
                alias: chatData.alias || null,
                tags: chatData.tags || [],
                direction: currentDirection, // Update current direction (can change on conversion)
                // originalDirection is NOT updated - it's immutable after creation
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
                departmentId,
                provider: provider as any,
                status: status as any,
                isAgentAvailable: chatData.is_agent_available,
                alias: chatData.alias || null,
                tags: chatData.tags || [],
                direction: detectedDirection, // Set initial direction
                originalDirection: detectedDirection, // Set original direction (immutable)
                createdAt: chatData.created_at ? new Date(chatData.created_at) : new Date(),
                openedAt: chatData.opened_at ? new Date(chatData.opened_at) : null,
                pickedUpAt: chatData.picked_up_at ? new Date(chatData.picked_up_at) : null,
                responseAt: chatData.responded_at ? new Date(chatData.responded_at) : null,
                closedAt: chatData.closed_at ? new Date(chatData.closed_at) : null,
                duration: durationInSeconds,
                lastSyncAt: new Date(),
              },
            })

            // NEW: Process messages from the chat response
            if (chatData.messages && Array.isArray(chatData.messages)) {
              await this.processMessagesForChat(chat.id, chatData.messages)
            }
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

      // Handle cancellation differently from failure
      if (error instanceof SyncCancelledError) {
        logger.info('Chats sync cancelled', {
          syncId,
          totalProcessed,
          totalSuccessful,
          totalFailed
        })

        await SyncStateManager.updateSyncState('chats', {
          syncStatus: 'cancelled',
          totalRecords: totalProcessed,
          successfulRecords: totalSuccessful,
          failedRecords: totalFailed,
        })

        if (checkpoint) {
          await SyncStateManager.updateCheckpoint(checkpoint.id, {
            status: 'failed',
            completedAt: new Date(),
          })
        }

        // Log cancellation
        await syncLogger.fail('Sync cancelled by user', totalProcessed, {
          successful: totalSuccessful,
          failed: totalFailed,
          cancelled: true
        })
      } else {
        await SyncStateManager.updateSyncState('chats', {
          syncStatus: 'failed',
        })

        // Log sync failure
        await syncLogger.fail(errorMessage, totalProcessed, {
          successful: totalSuccessful,
          failed: totalFailed
        })
      }

      throw error
    }
  }

  async syncAll(options: SyncOptions = {}): Promise<void> {
    const syncId = `full_sync_${Date.now()}`

    // Get user context for logging (system user for automated operations)
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
   * Save raw API response for debugging and audit trail
   * Failures in this method do not block the sync process
   */
  private async saveApiResponse(data: {
    syncId: string
    endpoint: string
    requestParams: any
    rawResponse: any
    responseSize: number
    recordCount: number
  }): Promise<void> {
    try {
      await prisma.apiResponseLog.create({
        data: {
          id: `api_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          syncId: data.syncId,
          endpoint: data.endpoint,
          requestParams: data.requestParams,
          rawResponse: data.rawResponse,
          responseSize: data.responseSize,
          recordCount: data.recordCount,
          apiTimestamp: new Date()
        }
      })
      logger.debug('Saved API response log', {
        syncId: data.syncId,
        endpoint: data.endpoint,
        recordCount: data.recordCount
      })
    } catch (error) {
      // Don't fail sync if logging fails
      logger.error('Failed to save API response log', {
        syncId: data.syncId,
        endpoint: data.endpoint,
        error: error instanceof Error ? error.message : 'Unknown'
      })
    }
  }

  /**
   * Extract agent data from chat response and upsert to database
   * Returns the agent ID for linking to chat
   */
  private async extractAndUpsertAgent(agentData: any): Promise<string | null> {
    if (!agentData) {
      logger.info('DEBUG extractAndUpsertAgent: agentData is falsy', { agentData })
      return null
    }

    try {
      logger.info('DEBUG extractAndUpsertAgent: Received agent data', {
        agentData,
        dataType: typeof agentData,
        isObject: typeof agentData === 'object',
        keys: typeof agentData === 'object' ? Object.keys(agentData) : null
      })

      // Extract agent fields from B2Chat response
      // Based on API docs: agent.name, agent.username, agent.email
      const name = agentData.name || agentData.full_name || null
      const username = agentData.username || null
      const email = agentData.email || null

      logger.info('DEBUG extractAndUpsertAgent: Extracted fields', {
        name,
        username,
        email
      })

      // Skip if we don't have enough data to identify the agent
      if (!name && !username && !email) {
        logger.warn('DEBUG extractAndUpsertAgent: Insufficient data to identify agent', {
          agentData,
          name,
          username,
          email
        })
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
      const mobile = contactData.mobile_number || contactData.mobile || null
      const phoneNumber = contactData.phone_number || null
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
          phoneNumber,
          identification,
          lastSyncAt: new Date(),
        },
        create: {
          id: contactId,
          b2chatId,
          fullName: name || 'Unknown Contact',
          email,
          mobile,
          phoneNumber,
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

  /**
   * Extract department data from chat response and upsert to database
   * Returns the department ID for linking to chat
   */
  private async extractAndUpsertDepartment(departmentData: any): Promise<string | null> {
    if (!departmentData) return null

    try {
      // Department can be either a string (name) or an object
      let name: string
      let b2chatCode: string

      if (typeof departmentData === 'string') {
        name = departmentData
        b2chatCode = departmentData
      } else if (typeof departmentData === 'object') {
        name = departmentData.name || departmentData.department_name || 'Unknown Department'
        b2chatCode = departmentData.code || departmentData.department_code || departmentData.id || name
      } else {
        return null
      }

      // Skip if we don't have a name
      if (!name) {
        return null
      }

      // Create a unique identifier for this department
      const departmentId = `dept_${b2chatCode.replace(/[^a-zA-Z0-9]/g, '_')}`

      // Upsert department record
      const department = await prisma.department.upsert({
        where: {
          b2chatCode
        },
        update: {
          name,
          isActive: true,
          lastSyncAt: new Date(),
        },
        create: {
          id: departmentId,
          b2chatCode,
          name,
          isActive: true,
          isLeaf: true, // Assume leaf until we have hierarchy data
          lastSyncAt: new Date(),
        }
      })

      return department.id

    } catch (error) {
      logger.error('Failed to extract department from chat data', {
        departmentData,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Process and store messages for a chat
   */
  private async processMessagesForChat(chatId: string, messages: B2ChatMessage[]): Promise<void> {
    try {
      for (const messageData of messages) {
        // Skip if message data is invalid
        if (!messageData || !messageData.created_at) {
          continue
        }

        // Create a unique identifier for the message based on chat + timestamp + content
        const messageKey = `${chatId}_${messageData.created_at}_${messageData.body?.substring(0, 50) || ''}`
        const messageId = `msg_${Buffer.from(messageKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`

        // Map message type to our enum
        let messageType: 'text' | 'image' | 'file' = 'text'
        if (messageData.type) {
          const type = messageData.type.toLowerCase()
          if (['image', 'file'].includes(type)) {
            messageType = type as 'image' | 'file'
          }
        }

        // Use upsert to handle duplicates gracefully
        await prisma.message.upsert({
          where: {
            id: messageId
          },
          update: {
            // Update last sync time if message exists
            lastSyncAt: new Date(),
          },
          create: {
            id: messageId,
            chatId,
            text: messageData.body || null,
            type: messageType,
            incoming: messageData.incoming === true,
            timestamp: new Date(messageData.created_at),
            caption: messageData.caption || null,
            // Handle media URLs (if type is image or file, body contains the URL)
            imageUrl: messageType === 'image' ? messageData.body : null,
            fileUrl: messageType === 'file' ? messageData.body : null,
            lastSyncAt: new Date(),
          }
        })
      }
    } catch (error) {
      logger.error('Failed to process messages for chat', {
        chatId,
        messageCount: messages.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Don't throw the error - we want to continue chat processing even if messages fail
    }
  }
}