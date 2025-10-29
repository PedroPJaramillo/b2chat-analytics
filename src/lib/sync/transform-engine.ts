import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  detectContactChanges,
  detectAgentChanges,
  detectDepartmentChanges,
  detectChatChanges,
  detectNewMessages,
  createChangesSummary,
} from './change-detector'
import { ChatStatus } from '@prisma/client'
import { calculateAllSLAMetricsWithBusinessHours } from '@/lib/sla/sla-calculator-full'
import { getSLAConfig, getOfficeHoursConfig } from '@/lib/config/sla-config'
import { slaLogger } from '@/lib/sla/sla-logger'
import type { ChatData } from '@/lib/sla/sla-calculator'
import { createHash } from 'crypto'

/**
 * Parse B2Chat timestamp string to Date object
 * B2Chat format: "2020-11-09 19:10:23"
 */
function parseB2ChatTimestamp(dateString: string | null | undefined): Date | undefined {
  if (!dateString) return undefined

  try {
    // B2Chat format: "2020-11-09 19:10:23"
    const parsed = new Date(dateString)

    // Validate parsed date
    if (isNaN(parsed.getTime())) {
      logger.warn('Invalid B2Chat timestamp', { dateString })
      return undefined
    }

    return parsed
  } catch (error) {
    logger.error('Failed to parse B2Chat timestamp', {
      dateString,
      error: error instanceof Error ? error.message : String(error)
    })
    return undefined
  }
}

export interface TransformOptions {
  batchSize?: number
  abortSignal?: AbortSignal
  userId?: string
}

export interface TransformResult {
  syncId: string
  extractSyncId: string | null
  entityType: string
  status: 'completed' | 'failed' | 'cancelled'
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  recordsFailed: number
  validationWarnings: number
  changesSummary: any
  errorMessage?: string
  duration: number
}

export class TransformEngine {
  /**
   * Get completed extract sync IDs for a given entity type
   * Only returns extracts with status='completed' for safety
   */
  private async getCompletedExtractIds(
    entityType: 'contacts' | 'chats' | 'all'
  ): Promise<string[]> {
    const extracts = await prisma.extractLog.findMany({
      where: {
        status: 'completed',
        OR: [
          { entityType },
          { entityType: 'all' }, // 'all' entity type extracts work for any transformation
        ],
      },
      select: { syncId: true },
    })

    logger.debug('Found completed extracts', {
      entityType,
      count: extracts.length,
      syncIds: extracts.map(e => e.syncId),
    })

    return extracts.map(e => e.syncId)
  }

  /**
   * Transform raw contacts from staging table → Contact model table
   */
  async transformContacts(
    extractSyncId?: string,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    const syncId = `transform_contacts_${Date.now()}`
    const startTime = Date.now()

    let recordsProcessed = 0
    let recordsCreated = 0
    let recordsUpdated = 0
    let recordsSkipped = 0
    let recordsFailed = 0

    // Create transform log
    await prisma.transformLog.create({
      data: {
        id: `transform_log_${syncId}`,
        syncId,
        extractSyncId: extractSyncId || null,
        entityType: 'contacts',
        startedAt: new Date(),
        status: 'running',
        userId: options.userId,
      },
    })

    try {
      // Build where clause based on whether extractSyncId provided
      // Legacy mode: specific extract batch (backward compatibility)
      // New mode: all pending from completed extracts (batch-agnostic)
      const whereClause = extractSyncId
        ? {
            syncId: extractSyncId,
            processingStatus: 'pending' as const,
          }
        : {
            processingStatus: 'pending' as const,
            syncId: {
              in: await this.getCompletedExtractIds('contacts'),
            },
          }

      // Fetch all pending raw contacts
      const rawContacts = await prisma.rawContact.findMany({
        where: whereClause,
        orderBy: {
          fetchedAt: 'asc',
        },
      })

      logger.info('Starting contact transform', {
        syncId,
        extractSyncId: extractSyncId || 'all-pending',
        totalRecords: rawContacts.length,
        mode: extractSyncId ? 'legacy' : 'batch-agnostic',
      })

      for (const rawContact of rawContacts) {
        // Check for cancellation
        if (options.abortSignal?.aborted) {
          await prisma.transformLog.update({
            where: { syncId },
            data: {
              status: 'cancelled',
              completedAt: new Date(),
              recordsProcessed,
              recordsCreated,
              recordsUpdated,
              recordsSkipped,
              recordsFailed,
            },
          })

          return {
            syncId,
            extractSyncId: extractSyncId || null,
            entityType: 'contacts',
            status: 'cancelled',
            recordsProcessed,
            recordsCreated,
            recordsUpdated,
            recordsSkipped,
            recordsFailed,
            validationWarnings: 0,
            changesSummary: null,
            duration: Date.now() - startTime,
          }
        }

        try {
          const rawData = rawContact.rawData as any

          // Skip contacts without valid ID
          if (!rawData.contact_id && !rawData.id && !rawData.mobile) {
            await prisma.rawContact.update({
              where: { id: rawContact.id },
              data: {
                processingStatus: 'failed',
                processingError: 'No valid contact identifier found',
                processingAttempt: rawContact.processingAttempt + 1,
              },
            })
            recordsFailed++
            recordsProcessed++
            continue
          }

          // Generate contact ID
          const b2chatId = String(
            rawData.contact_id || rawData.id || rawData.mobile || 'unknown'
          )

          // Check if contact already exists
          const existingContact = await prisma.contact.findUnique({
            where: { b2chatId },
          })

          if (existingContact) {
            // Fix 006: Check if this is a stub contact that needs upgrading
            const isStubContact = existingContact.syncSource === 'chat_embedded'

            if (isStubContact) {
              // UPGRADE stub to full contact with complete API data
              logger.info('Upgrading stub contact to full contact', {
                b2chatId,
                previousSyncSource: existingContact.syncSource,
              })

              await prisma.contact.update({
                where: { b2chatId },
                data: {
                  // Merge: API data wins, preserve existing if API returns null
                  fullName: rawData.fullname || rawData.name || existingContact.fullName,
                  mobile: rawData.mobile || rawData.mobile_number || existingContact.mobile,
                  phoneNumber: rawData.landline || existingContact.phoneNumber,
                  email: rawData.email || existingContact.email,
                  identification: rawData.identification || existingContact.identification,
                  address: rawData.address || existingContact.address,
                  city: rawData.city || existingContact.city,
                  country: rawData.country || existingContact.country,
                  company: rawData.company || existingContact.company,
                  customAttributes: rawData.custom_attributes || existingContact.customAttributes,

                  // Feature 002: New fields for complete B2Chat data capture
                  tags: rawData.tags || existingContact.tags,
                  merchantId: rawData.merchant_id
                    ? String(rawData.merchant_id)
                    : existingContact.merchantId,
                  b2chatCreatedAt: parseB2ChatTimestamp(rawData.created) || existingContact.b2chatCreatedAt,
                  b2chatUpdatedAt: parseB2ChatTimestamp(rawData.updated) || existingContact.b2chatUpdatedAt,

                  // Fix 006: Update tracking fields
                  syncSource: 'upgraded', // Mark as upgraded from stub
                  needsFullSync: false, // No longer needs full sync

                  lastSyncAt: new Date(),
                  updatedAt: new Date(),
                },
              })

              logger.debug('Contact upgraded from stub', {
                b2chatId,
                hasTags: !!rawData.tags,
                tagCount: rawData.tags?.length || 0,
                merchantId: rawData.merchant_id,
              })

              recordsUpdated++
            } else {
              // Normal update for full contacts (contacts_api or upgraded)
              const changes = detectContactChanges(existingContact, rawData)

              if (changes && changes.hasChanges) {
                // Update contact
                await prisma.contact.update({
                  where: { b2chatId },
                  data: {
                    fullName: rawData.fullname || rawData.name || '',
                    mobile: rawData.mobile || rawData.mobile_number || undefined,
                    phoneNumber: rawData.landline || undefined, // FIXED: was rawData.phone_number
                    email: rawData.email || undefined,
                    identification: rawData.identification || undefined,
                    address: rawData.address || undefined,
                    city: rawData.city || undefined,
                    country: rawData.country || undefined,
                    company: rawData.company || undefined,
                    customAttributes: rawData.custom_attributes || undefined,

                    // Feature 002: New fields for complete B2Chat data capture
                    tags: rawData.tags || undefined,
                    merchantId: rawData.merchant_id ? String(rawData.merchant_id) : undefined,
                    b2chatCreatedAt: parseB2ChatTimestamp(rawData.created),
                    b2chatUpdatedAt: parseB2ChatTimestamp(rawData.updated),

                    lastSyncAt: new Date(),
                    updatedAt: new Date(),
                    // syncSource remains unchanged (contacts_api or upgraded)
                  },
                })

                logger.debug('Contact updated', {
                  b2chatId,
                  changedFields: changes.changedFields,
                  hasTags: !!rawData.tags,
                  tagCount: rawData.tags?.length || 0,
                  merchantId: rawData.merchant_id,
                  b2chatCreatedDate: rawData.created,
                })

                recordsUpdated++
              } else {
                // No changes, skip
                recordsSkipped++
              }
            }
          } else {
            // Fix 006: Create new full contact from API
            await prisma.contact.create({
              data: {
                id: `contact_${b2chatId.replace(/[^a-zA-Z0-9]/g, '_')}`,
                b2chatId,
                fullName: rawData.fullname || rawData.name || '',
                mobile: rawData.mobile || rawData.mobile_number || undefined,
                phoneNumber: rawData.landline || undefined, // FIXED: was rawData.phone_number
                email: rawData.email || undefined,
                identification: rawData.identification || undefined,
                address: rawData.address || undefined,
                city: rawData.city || undefined,
                country: rawData.country || undefined,
                company: rawData.company || undefined,
                customAttributes: rawData.custom_attributes || undefined,

                // Feature 002: New fields for complete B2Chat data capture
                tags: rawData.tags || undefined,
                merchantId: rawData.merchant_id ? String(rawData.merchant_id) : undefined,
                b2chatCreatedAt: parseB2ChatTimestamp(rawData.created),
                b2chatUpdatedAt: parseB2ChatTimestamp(rawData.updated),

                // Fix 006: Mark as full contact from API
                syncSource: 'contacts_api', // From dedicated contacts API
                needsFullSync: false, // Already has full data

                lastSyncAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            })

            logger.debug('Contact created from API', {
              b2chatId,
              hasTags: !!rawData.tags,
              tagCount: rawData.tags?.length || 0,
              merchantId: rawData.merchant_id,
            })
            recordsCreated++
          }

          // Mark raw contact as processed
          await prisma.rawContact.update({
            where: { id: rawContact.id },
            data: {
              processingStatus: 'processed',
              processedAt: new Date(),
              processingAttempt: rawContact.processingAttempt + 1,
            },
          })

          recordsProcessed++
        } catch (error) {
          // Mark as failed but continue processing
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          await prisma.rawContact.update({
            where: { id: rawContact.id },
            data: {
              processingStatus: 'failed',
              processingError: errorMessage,
              processingAttempt: rawContact.processingAttempt + 1,
            },
          })

          logger.error('Failed to transform contact', {
            rawContactId: rawContact.id,
            error: errorMessage,
          })

          recordsFailed++
          recordsProcessed++
        }
      }

      // Create changes summary
      const changesSummary = createChangesSummary({
        contacts: {
          created: recordsCreated,
          updated: recordsUpdated,
          unchanged: recordsSkipped,
        },
      })

      // Mark transform as completed
      await prisma.transformLog.update({
        where: { syncId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          recordsProcessed,
          recordsCreated,
          recordsUpdated,
          recordsSkipped,
          recordsFailed,
          changesSummary,
        },
      })

      logger.info('Contact transform completed', {
        syncId,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
      })

      return {
        syncId,
        extractSyncId: extractSyncId || null,
        entityType: 'contacts',
        status: 'completed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
        validationWarnings: 0,
        changesSummary,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.transformLog.update({
        where: { syncId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
          recordsProcessed,
          recordsCreated,
          recordsUpdated,
          recordsSkipped,
          recordsFailed,
        },
      })

      logger.error('Contact transform failed', {
        syncId,
        error: errorMessage,
      })

      return {
        syncId,
        extractSyncId: extractSyncId || null,
        entityType: 'contacts',
        status: 'failed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
        validationWarnings: 0,
        changesSummary: null,
        errorMessage,
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * Transform raw chats from staging table → Chat + Message model tables
   * Also extracts and upserts agents, contacts, and departments
   */
  async transformChats(
    extractSyncId?: string,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    const syncId = `transform_chats_${Date.now()}`
    const startTime = Date.now()

    let recordsProcessed = 0
    let recordsCreated = 0
    let recordsUpdated = 0
    let recordsSkipped = 0
    let recordsFailed = 0
    let statusChangesDetected = 0
    let messagesCreated = 0

    // Create transform log
    await prisma.transformLog.create({
      data: {
        id: `transform_log_${syncId}`,
        syncId,
        extractSyncId: extractSyncId || null,
        entityType: 'chats',
        startedAt: new Date(),
        status: 'running',
        userId: options.userId,
      },
    })

    try {
      // Build where clause based on whether extractSyncId provided
      // Legacy mode: specific extract batch (backward compatibility)
      // New mode: all pending from completed extracts (batch-agnostic)
      const whereClause = extractSyncId
        ? {
            syncId: extractSyncId,
            processingStatus: 'pending' as const,
          }
        : {
            processingStatus: 'pending' as const,
            syncId: {
              in: await this.getCompletedExtractIds('chats'),
            },
          }

      // Fetch all pending raw chats
      const rawChats = await prisma.rawChat.findMany({
        where: whereClause,
        orderBy: {
          fetchedAt: 'asc',
        },
      })

      logger.info('Starting chat transform', {
        syncId,
        extractSyncId: extractSyncId || 'all-pending',
        totalRecords: rawChats.length,
        mode: extractSyncId ? 'legacy' : 'batch-agnostic',
      })

      for (const rawChat of rawChats) {
        // Check for cancellation
        if (options.abortSignal?.aborted) {
          await prisma.transformLog.update({
            where: { syncId },
            data: {
              status: 'cancelled',
              completedAt: new Date(),
              recordsProcessed,
              recordsCreated,
              recordsUpdated,
              recordsSkipped,
              recordsFailed,
            },
          })

          return {
            syncId,
            extractSyncId: extractSyncId || null,
            entityType: 'chats',
            status: 'cancelled',
            recordsProcessed,
            recordsCreated,
            recordsUpdated,
            recordsSkipped,
            recordsFailed,
            validationWarnings: 0,
            changesSummary: null,
            duration: Date.now() - startTime,
          }
        }

        try {
          const rawData = rawChat.rawData as any

          // Extract nested entities (agent, contact, department)
          let agentId: string | null = null
          let contactId: string | null = null
          let departmentId: string | null = null

          if (rawData.agent) {
            agentId = await this.extractAndUpsertAgent(rawData.agent)
          }

          if (rawData.contact) {
            contactId = await this.extractAndUpsertContact(rawData.contact)
          }

          if (rawData.department) {
            departmentId = await this.extractAndUpsertDepartment(rawData.department)
          }

          // Map provider (status is already normalized by B2ChatClient)
          let provider = rawData.provider?.toLowerCase() || 'livechat'
          if (!['whatsapp', 'facebook', 'telegram', 'livechat', 'b2cbotapi'].includes(provider)) {
            provider = 'livechat'
          }

          // Status is already normalized and validated by B2ChatClient schema
          const status = rawData.status || 'OPENED'

          // Extract survey-related timestamps from raw data (Feature 001)
          const pollStartedAt = rawData.poll_started_at
            ? new Date(rawData.poll_started_at)
            : null

          const pollCompletedAt = rawData.poll_completed_at && rawData.status === 'COMPLETED_POLL'
            ? new Date(rawData.poll_completed_at)
            : null

          const pollAbandonedAt = rawData.poll_abandoned_at && rawData.status === 'ABANDONED_POLL'
            ? new Date(rawData.poll_abandoned_at)
            : null

          const pollResponse = rawData.poll_response || null

          // Parse duration
          let durationInSeconds: number | null = null
          if (rawData.duration && typeof rawData.duration === 'string') {
            const parts = rawData.duration.split(':').map((p: string) => parseInt(p) || 0)
            if (parts.length >= 3) {
              const [hours, minutes, seconds] = parts
              durationInSeconds = hours * 3600 + minutes * 60 + seconds
            }
          } else if (typeof rawData.duration === 'number') {
            durationInSeconds = rawData.duration
          }

          // Check if chat exists
          const existingChat = await prisma.chat.findUnique({
            where: { b2chatId: rawData.chat_id },
            include: {
              messages: {
                select: { timestamp: true },
              },
            },
          })

          if (existingChat) {
            // Detect changes
            const changes = detectChatChanges(existingChat, rawData)

            if (changes && changes.hasChanges) {
              // Calculate SLA metrics for updated chat
              const chatTimestamps = {
                openedAt: rawData.opened_at ? new Date(rawData.opened_at) : existingChat.openedAt,
                pickedUpAt: rawData.picked_up_at ? new Date(rawData.picked_up_at) : existingChat.pickedUpAt,
                responseAt: rawData.responded_at ? new Date(rawData.responded_at) : existingChat.responseAt,
                closedAt: rawData.closed_at ? new Date(rawData.closed_at) : existingChat.closedAt,
              }

              const messages = (rawData.messages || []).map((msg: any) => ({
                incoming: msg.incoming === true,
                timestamp: new Date(msg.created_at),
              }))

              const slaMetrics = await this.calculateSLAMetrics(
                existingChat.id,
                chatTimestamps.openedAt,
                chatTimestamps.pickedUpAt,
                chatTimestamps.responseAt,
                chatTimestamps.closedAt,
                messages
              )

              // Update chat
              await prisma.chat.update({
                where: { b2chatId: rawData.chat_id },
                data: {
                  agentId,
                  contactId,
                  departmentId,
                  provider: provider as any,
                  status: status as any,
                  isAgentAvailable: rawData.is_agent_available,
                  alias: rawData.alias || null,
                  tags: rawData.tags || [],
                  openedAt: chatTimestamps.openedAt,
                  pickedUpAt: chatTimestamps.pickedUpAt,
                  responseAt: chatTimestamps.responseAt,
                  closedAt: chatTimestamps.closedAt,
                  duration: durationInSeconds,
                  // Survey fields (Feature 001: Full Status Support)
                  pollStartedAt,
                  pollCompletedAt,
                  pollAbandonedAt,
                  pollResponse,
                  // SLA metrics (Feature 004: SLA Calculation Integration)
                  ...(slaMetrics && {
                    // Wall clock metrics
                    timeToPickup: slaMetrics.timeToPickup,
                    firstResponseTime: slaMetrics.firstResponseTime,
                    avgResponseTime: slaMetrics.avgResponseTime,
                    resolutionTime: slaMetrics.resolutionTime,
                    pickupSLA: slaMetrics.pickupSLA,
                    firstResponseSLA: slaMetrics.firstResponseSLA,
                    avgResponseSLA: slaMetrics.avgResponseSLA,
                    resolutionSLA: slaMetrics.resolutionSLA,
                    overallSLA: slaMetrics.overallSLA,
                    // Business hours metrics
                    timeToPickupBH: slaMetrics.timeToPickupBH,
                    firstResponseTimeBH: slaMetrics.firstResponseTimeBH,
                    avgResponseTimeBH: slaMetrics.avgResponseTimeBH,
                    resolutionTimeBH: slaMetrics.resolutionTimeBH,
                    pickupSLABH: slaMetrics.pickupSLABH,
                    firstResponseSLABH: slaMetrics.firstResponseSLABH,
                    avgResponseSLABH: slaMetrics.avgResponseSLABH,
                    resolutionSLABH: slaMetrics.resolutionSLABH,
                    overallSLABH: slaMetrics.overallSLABH,
                  }),
                  lastSyncAt: new Date(),
                },
              })

              // If status changed, create history entry
              if (changes.statusChanged && changes.previousStatus && changes.newStatus) {
                await prisma.chatStatusHistory.create({
                  data: {
                    id: `status_history_${Date.now()}_${rawData.chat_id}`,
                    chatId: existingChat.id,
                    previousStatus: changes.previousStatus,
                    newStatus: changes.newStatus,
                    changedAt: new Date(),
                    syncId: extractSyncId,
                    transformId: syncId,
                  },
                })

                statusChangesDetected++
              }

              recordsUpdated++
            } else {
              recordsSkipped++
            }

            // Process messages (detect and insert only new ones)
            if (rawData.messages && Array.isArray(rawData.messages)) {
              const existingTimestamps = existingChat.messages.map((m) => m.timestamp)
              const newMessages = detectNewMessages(existingTimestamps, rawData.messages)

              for (let i = 0; i < newMessages.length; i++) {
                const messageIndex = existingTimestamps.length + i
                await this.insertMessage(existingChat.id, newMessages[i], messageIndex)
                messagesCreated++
              }
            }
          } else {
            // Calculate SLA metrics for new chat
            const chatTimestamps = {
              openedAt: rawData.opened_at ? new Date(rawData.opened_at) : null,
              pickedUpAt: rawData.picked_up_at ? new Date(rawData.picked_up_at) : null,
              responseAt: rawData.responded_at ? new Date(rawData.responded_at) : null,
              closedAt: rawData.closed_at ? new Date(rawData.closed_at) : null,
            }

            const messages = (rawData.messages || []).map((msg: any) => ({
              incoming: msg.incoming === true,
              timestamp: new Date(msg.created_at),
            }))

            const slaMetrics = await this.calculateSLAMetrics(
              `chat_${rawData.chat_id}`,
              chatTimestamps.openedAt,
              chatTimestamps.pickedUpAt,
              chatTimestamps.responseAt,
              chatTimestamps.closedAt,
              messages
            )

            // Create new chat
            const chat = await prisma.chat.create({
              data: {
                id: `chat_${rawData.chat_id}`,
                b2chatId: rawData.chat_id,
                agentId,
                contactId,
                departmentId,
                provider: provider as any,
                status: status as any,
                isAgentAvailable: rawData.is_agent_available,
                alias: rawData.alias || null,
                tags: rawData.tags || [],
                createdAt: rawData.created_at ? new Date(rawData.created_at) : new Date(),
                openedAt: chatTimestamps.openedAt,
                pickedUpAt: chatTimestamps.pickedUpAt,
                responseAt: chatTimestamps.responseAt,
                closedAt: chatTimestamps.closedAt,
                duration: durationInSeconds,
                // Survey fields (Feature 001: Full Status Support)
                pollStartedAt,
                pollCompletedAt,
                pollAbandonedAt,
                pollResponse,
                // SLA metrics (Feature 004: SLA Calculation Integration)
                ...(slaMetrics && {
                  // Wall clock metrics
                  timeToPickup: slaMetrics.timeToPickup,
                  firstResponseTime: slaMetrics.firstResponseTime,
                  avgResponseTime: slaMetrics.avgResponseTime,
                  resolutionTime: slaMetrics.resolutionTime,
                  pickupSLA: slaMetrics.pickupSLA,
                  firstResponseSLA: slaMetrics.firstResponseSLA,
                  avgResponseSLA: slaMetrics.avgResponseSLA,
                  resolutionSLA: slaMetrics.resolutionSLA,
                  overallSLA: slaMetrics.overallSLA,
                  // Business hours metrics
                  timeToPickupBH: slaMetrics.timeToPickupBH,
                  firstResponseTimeBH: slaMetrics.firstResponseTimeBH,
                  avgResponseTimeBH: slaMetrics.avgResponseTimeBH,
                  resolutionTimeBH: slaMetrics.resolutionTimeBH,
                  pickupSLABH: slaMetrics.pickupSLABH,
                  firstResponseSLABH: slaMetrics.firstResponseSLABH,
                  avgResponseSLABH: slaMetrics.avgResponseSLABH,
                  resolutionSLABH: slaMetrics.resolutionSLABH,
                  overallSLABH: slaMetrics.overallSLABH,
                }),
                lastSyncAt: new Date(),
              },
            })

            // Insert all messages for new chat
            if (rawData.messages && Array.isArray(rawData.messages)) {
              for (let i = 0; i < rawData.messages.length; i++) {
                await this.insertMessage(chat.id, rawData.messages[i], i)
                messagesCreated++
              }
            }

            recordsCreated++
          }

          // Mark raw chat as processed
          await prisma.rawChat.update({
            where: { id: rawChat.id },
            data: {
              processingStatus: 'processed',
              processedAt: new Date(),
              processingAttempt: rawChat.processingAttempt + 1,
            },
          })

          recordsProcessed++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          await prisma.rawChat.update({
            where: { id: rawChat.id },
            data: {
              processingStatus: 'failed',
              processingError: errorMessage,
              processingAttempt: rawChat.processingAttempt + 1,
            },
          })

          logger.error('Failed to transform chat', {
            rawChatId: rawChat.id,
            error: errorMessage,
          })

          recordsFailed++
          recordsProcessed++
        }
      }

      // Create changes summary
      const changesSummary = createChangesSummary({
        chats: {
          created: recordsCreated,
          updated: recordsUpdated,
          unchanged: recordsSkipped,
          statusChanged: statusChangesDetected,
        },
        messages: {
          created: messagesCreated,
        },
      })

      // Mark transform as completed
      await prisma.transformLog.update({
        where: { syncId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          recordsProcessed,
          recordsCreated,
          recordsUpdated,
          recordsSkipped,
          recordsFailed,
          changesSummary,
        },
      })

      logger.info('Chat transform completed', {
        syncId,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
        messagesCreated,
        statusChangesDetected,
      })

      return {
        syncId,
        extractSyncId: extractSyncId || null,
        entityType: 'chats',
        status: 'completed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
        validationWarnings: 0,
        changesSummary,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.transformLog.update({
        where: { syncId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
          recordsProcessed,
          recordsCreated,
          recordsUpdated,
          recordsSkipped,
          recordsFailed,
        },
      })

      logger.error('Chat transform failed', {
        syncId,
        error: errorMessage,
      })

      return {
        syncId,
        extractSyncId: extractSyncId || null,
        entityType: 'chats',
        status: 'failed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
        validationWarnings: 0,
        changesSummary: null,
        errorMessage,
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * Calculate SLA metrics for a chat
   * Returns SLA metrics object or null if calculation fails (errors are logged)
   */
  private async calculateSLAMetrics(
    chatId: string,
    openedAt: Date | null,
    pickedUpAt: Date | null,
    responseAt: Date | null,
    closedAt: Date | null,
    messages: Array<{ incoming: boolean; timestamp: Date }>
  ): Promise<any | null> {
    try {
      // Get SLA configuration
      const [slaConfig, officeHoursConfig] = await Promise.all([
        getSLAConfig(),
        getOfficeHoursConfig(),
      ])

      // Prepare chat data for calculator
      const chatData: ChatData = {
        openedAt: openedAt || new Date(),
        firstAgentAssignedAt: pickedUpAt, // Simplified: pickup = agent assignment
        closedAt: closedAt || null,
        messages: messages.map(msg => ({
          role: msg.incoming ? 'customer' : 'agent',
          createdAt: msg.timestamp,
        })),
      }

      // Calculate metrics
      const metrics = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        slaConfig,
        officeHoursConfig
      )

      // Log calculation
      await slaLogger.logCalculation(chatId, metrics, 'initial')

      return metrics
    } catch (error) {
      logger.error('Failed to calculate SLA metrics', {
        chatId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Extract and upsert agent from raw data
   */
  private async extractAndUpsertAgent(agentData: any): Promise<string | null> {
    if (!agentData) return null

    try {
      const name = agentData.name || agentData.full_name || null
      const username = agentData.username || null
      const email = agentData.email || null

      if (!name && !username && !email) return null

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

      // Check if agent exists
      const existingAgent = await prisma.agent.findUnique({
        where: { username: username || `extracted_${b2chatId}` },
      })

      if (existingAgent) {
        // Check for changes
        const changes = detectAgentChanges(existingAgent, agentData)
        if (changes && changes.hasChanges) {
          await prisma.agent.update({
            where: { username: username || `extracted_${b2chatId}` },
            data: {
              name: name || 'Unknown Agent',
              email,
              isActive: true,
              lastSyncAt: new Date(),
            },
          })
        }
        return existingAgent.id
      } else {
        // Create new agent
        const agent = await prisma.agent.create({
          data: {
            id: agentId,
            b2chatId,
            name: name || 'Unknown Agent',
            username: username || `extracted_${b2chatId}`,
            email,
            isActive: true,
            lastSyncAt: new Date(),
          },
        })
        return agent.id
      }
    } catch (error) {
      logger.error('Failed to extract agent', {
        agentData,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      return null
    }
  }

  /**
   * Extract and upsert contact from raw data (Fix 006: Smart Stub Strategy)
   *
   * Creates minimal "stub" contacts from chat data to maintain referential integrity.
   * Stubs are marked with syncSource='chat_embedded' and needsFullSync=true.
   * Full contacts from dedicated API are marked with syncSource='contacts_api'.
   * Stubs upgraded to full contacts are marked with syncSource='upgraded'.
   *
   * @param contactData - Raw contact data embedded in chat
   * @returns Contact ID if created/found, null if invalid data
   */
  private async extractAndUpsertContact(contactData: any): Promise<string | null> {
    if (!contactData) return null

    try {
      // Fix 006: Only use real B2Chat contact ID - do NOT infer from mobile/email
      const contactIdFromB2Chat = contactData.id || contactData.contact_id

      if (!contactIdFromB2Chat) {
        logger.debug('Skipping contact without B2Chat ID', { contactData })
        return null
      }

      const name = contactData.name || contactData.full_name || contactData.fullname || null
      const email = contactData.email || null
      const mobile = contactData.mobile_number || contactData.mobile || null
      const identification = contactData.identification || null

      // Use the real B2Chat contact ID
      const b2chatId = String(contactIdFromB2Chat)
      const contactId = `contact_${b2chatId}`

      // Check if contact exists
      const existingContact = await prisma.contact.findUnique({
        where: { b2chatId },
      })

      if (existingContact) {
        // Fix 006: Respect authoritative source - don't update full contacts
        if (
          existingContact.syncSource === 'contacts_api' ||
          existingContact.syncSource === 'upgraded'
        ) {
          // Contact has complete data from API - just link to it, don't update
          logger.debug('Linking chat to authoritative contact (no update)', {
            b2chatId,
            syncSource: existingContact.syncSource,
          })
          return existingContact.id
        }

        // Fix 006: Update existing stub with newer embedded data
        logger.debug('Updating stub contact with newer chat-embedded data', {
          b2chatId,
          syncSource: existingContact.syncSource,
        })

        const changes = detectContactChanges(existingContact, contactData)
        if (changes && changes.hasChanges) {
          await prisma.contact.update({
            where: { b2chatId },
            data: {
              fullName: name || existingContact.fullName,
              email: email || existingContact.email,
              mobile: mobile || existingContact.mobile,
              phoneNumber: contactData.phone_number || existingContact.phoneNumber,
              identification: identification || existingContact.identification,
              lastSyncAt: new Date(),
              // syncSource remains 'chat_embedded', needsFullSync remains true
            },
          })
        }
        return existingContact.id
      } else {
        // Fix 006: Create minimal stub contact
        logger.info('Creating stub contact from chat embedding', {
          b2chatId,
          hasName: !!name,
          hasMobile: !!mobile,
          hasEmail: !!email,
        })

        const contact = await prisma.contact.create({
          data: {
            id: contactId,
            b2chatId,
            fullName: name || 'Unknown Contact',
            email,
            mobile,
            phoneNumber: contactData.phone_number || undefined,
            identification,
            syncSource: 'chat_embedded', // Fix 006: Mark as stub from chat
            needsFullSync: true, // Fix 006: Flag for upgrade when API data arrives
            lastSyncAt: new Date(),
          },
        })
        return contact.id
      }
    } catch (error) {
      logger.error('Failed to extract contact', {
        contactData,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      return null
    }
  }

  /**
   * Extract and upsert department from raw data
   */
  private async extractAndUpsertDepartment(departmentData: any): Promise<string | null> {
    if (!departmentData) return null

    try {
      let name: string
      let b2chatCode: string

      if (typeof departmentData === 'string') {
        name = departmentData
        b2chatCode = departmentData
      } else if (typeof departmentData === 'object') {
        name = departmentData.name || departmentData.department_name || 'Unknown Department'
        b2chatCode =
          departmentData.code || departmentData.department_code || departmentData.id || name
      } else {
        return null
      }

      if (!name) return null

      const departmentId = `dept_${b2chatCode.replace(/[^a-zA-Z0-9]/g, '_')}`

      // Check if department exists
      const existingDepartment = await prisma.department.findUnique({
        where: { b2chatCode },
      })

      if (existingDepartment) {
        const changes = detectDepartmentChanges(existingDepartment, departmentData)
        if (changes && changes.hasChanges) {
          await prisma.department.update({
            where: { b2chatCode },
            data: {
              name,
              isActive: true,
              lastSyncAt: new Date(),
            },
          })
        }
        return existingDepartment.id
      } else {
        const department = await prisma.department.create({
          data: {
            id: departmentId,
            b2chatCode,
            name,
            isActive: true,
            isLeaf: true,
            lastSyncAt: new Date(),
          },
        })
        return department.id
      }
    } catch (error) {
      logger.error('Failed to extract department', {
        departmentData,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      return null
    }
  }

  /**
   * Insert a message for a chat
   */
  private async insertMessage(chatId: string, messageData: any, messageIndex: number): Promise<void> {
    if (!messageData || !messageData.created_at) return

    try {
      // Generate unique ID using SHA256 hash to prevent collisions
      // Fixed: Previous base64 + substring(40) caused ID collisions for messages in same chat
      const messageKey = `${chatId}_${messageData.created_at}_${messageIndex}`
      const hash = createHash('sha256').update(messageKey).digest('hex')
      const messageId = `msg_${hash.substring(0, 32)}` // 32 hex chars = 128 bits of uniqueness

      let messageType: 'text' | 'image' | 'file' = 'text'
      if (messageData.type) {
        const type = messageData.type.toLowerCase()
        if (['image', 'file'].includes(type)) {
          messageType = type as 'image' | 'file'
        }
      }

      await prisma.message.upsert({
        where: { id: messageId },
        update: {
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
          imageUrl: messageType === 'image' ? messageData.body : null,
          fileUrl: messageType === 'file' ? messageData.body : null,
          lastSyncAt: new Date(),
        },
      })
    } catch (error) {
      logger.error('Failed to insert message', {
        messageData,
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }
  }

  /**
   * Transform all entities (contacts + chats) for an extract
   */
  async transformAll(extractSyncId?: string, options: TransformOptions = {}): Promise<{
    contacts: TransformResult
    chats: TransformResult
  }> {
    const contactsResult = await this.transformContacts(extractSyncId, options)
    const chatsResult = await this.transformChats(extractSyncId, options)

    return {
      contacts: contactsResult,
      chats: chatsResult,
    }
  }
}
