import { B2ChatClient } from '@/lib/b2chat/client'
import { rateLimitedQueue } from '@/lib/b2chat/queue'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export interface ExtractOptions {
  batchSize?: number
  fullSync?: boolean
  dateRange?: {
    startDate?: Date
    endDate?: Date
  }
  timeRangePreset?: '1d' | '7d' | '30d' | '90d' | 'custom' | 'full'
  maxPages?: number // Limit total pages to prevent infinite loops (default: unlimited for full sync, 100 for date-filtered)
  abortSignal?: AbortSignal
  userId?: string
  contactFilter?: {
    mobile?: string
    b2chatId?: string
  }
}

export interface ExtractResult {
  syncId: string
  entityType: string
  status: 'completed' | 'failed' | 'cancelled'
  recordsFetched: number
  totalPages: number
  apiCallCount: number
  errorMessage?: string
  duration: number
}

export class ExtractEngine {
  private client: B2ChatClient

  constructor() {
    this.client = new B2ChatClient()
  }

  /**
   * Convert preset to date range
   */
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

  /**
   * Extract contacts from B2Chat API → store in RawContact staging table
   */
  async extractContacts(options: ExtractOptions = {}): Promise<ExtractResult> {
    const syncId = `extract_contacts_${Date.now()}`
    const startTime = Date.now()
    const batchSize = options.batchSize || 1000

    let recordsFetched = 0
    let totalPages = 0
    let apiCallCount = 0

    // Determine date range
    let dateRange: { startDate?: Date; endDate?: Date } | undefined
    if (options.timeRangePreset) {
      dateRange = this.convertPresetToDateRange(options.timeRangePreset)
    } else if (options.dateRange) {
      dateRange = options.dateRange
    }

    // Determine max pages (default: 100 for date-filtered, unlimited for full sync)
    const maxPages = options.maxPages || (options.fullSync ? Number.MAX_SAFE_INTEGER : 100)

    // Create extract log
    await prisma.extractLog.create({
      data: {
        id: `extract_log_${syncId}`,
        syncId,
        entityType: 'contacts',
        operation: options.fullSync ? 'full' : 'incremental',
        startedAt: new Date(),
        status: 'running',
        dateRangeFrom: dateRange?.startDate,
        dateRangeTo: dateRange?.endDate,
        timeRangePreset: options.timeRangePreset || (options.fullSync ? 'full' : undefined),
        userId: options.userId,
        batchSize,
        contactFilterMobile: options.contactFilter?.mobile,
        metadata: options.contactFilter ? {
          contactFilter: options.contactFilter
        } : undefined,
      },
    })

    // Initialize stats tracking
    const stats = {
      withMobile: 0,
      withEmail: 0,
      withIdentification: 0,
      withCustomAttributes: 0,
      earliestDate: null as Date | null,
      latestDate: null as Date | null,
      apiResponseTimes: [] as number[],
    }

    try {
      let page = 1
      let hasMorePages = true

      while (hasMorePages && page <= maxPages) {
        // Check for cancellation
        if (options.abortSignal?.aborted) {
          await prisma.extractLog.update({
            where: { syncId },
            data: {
              status: 'cancelled',
              completedAt: new Date(),
              recordsFetched,
              totalPages,
              apiCallCount,
            },
          })

          return {
            syncId,
            entityType: 'contacts',
            status: 'cancelled',
            recordsFetched,
            totalPages,
            apiCallCount,
            duration: Date.now() - startTime,
          }
        }

        // Fetch from API and track response time
        const apiStartTime = Date.now()
        const response = await rateLimitedQueue.add(() =>
          this.client.getContacts({
            page,
            limit: batchSize,
            dateRange,
          })
        )
        stats.apiResponseTimes.push(Date.now() - apiStartTime)

        apiCallCount++
        const { data: contacts, pagination } = response
        hasMorePages = pagination.hasNextPage || false

        // Collect statistics from fetched contacts
        contacts.forEach((contact: any) => {
          // Count fields with data
          if (contact.mobile || contact.mobile_number) stats.withMobile++
          if (contact.email) stats.withEmail++
          if (contact.identification) stats.withIdentification++
          if (contact.custom_attributes) stats.withCustomAttributes++

          // Track date range (using updated field if available)
          const dateField = contact.updated || contact.created
          if (dateField) {
            const contactDate = new Date(dateField)
            if (!stats.earliestDate || contactDate < stats.earliestDate) {
              stats.earliestDate = contactDate
            }
            if (!stats.latestDate || contactDate > stats.latestDate) {
              stats.latestDate = contactDate
            }
          }
        })

        // Store raw contacts in staging table
        const offset = (page - 1) * batchSize
        const rawContactRecords = contacts.map((contact) => ({
          id: `raw_contact_${syncId}_${contact.contact_id || Date.now()}`,
          syncId,
          b2chatContactId: String(contact.contact_id || contact.id || contact.mobile || 'unknown'),
          rawData: contact as any, // Store full raw JSON
          apiPage: page,
          apiOffset: offset,
          fetchedAt: new Date(),
          processingStatus: 'pending',
        }))

        // Batch insert raw contacts
        if (rawContactRecords.length > 0) {
          await prisma.rawContact.createMany({
            data: rawContactRecords,
            skipDuplicates: true,
          })
        }

        recordsFetched += contacts.length
        totalPages = page

        // Update extract log progress
        await prisma.extractLog.update({
          where: { syncId },
          data: {
            recordsFetched,
            currentPage: page,
            totalPages: page,
            apiCallCount,
          },
        })

        logger.info('Extract contacts progress', {
          syncId,
          page,
          recordsFetched,
          batchSize: contacts.length,
        })

        page++

        if (contacts.length === 0) {
          break
        }
      }

      // Calculate summary statistics
      const avgApiResponseTime = stats.apiResponseTimes.length > 0
        ? stats.apiResponseTimes.reduce((a, b) => a + b, 0) / stats.apiResponseTimes.length
        : 0
      const duration = Date.now() - startTime
      const recordsPerSecond = duration > 0 ? (recordsFetched / (duration / 1000)).toFixed(1) : 0

      // Build metadata with statistics
      const metadata = {
        ...(options.contactFilter ? { contactFilter: options.contactFilter } : {}),
        summary: {
          totalContacts: recordsFetched,
          withMobile: stats.withMobile,
          withEmail: stats.withEmail,
          withIdentification: stats.withIdentification,
          withCustomAttributes: stats.withCustomAttributes,
          dateRange: {
            requested: {
              from: dateRange?.startDate?.toISOString().split('T')[0] || null,
              to: dateRange?.endDate?.toISOString().split('T')[0] || null,
            },
            actual: {
              earliest: stats.earliestDate?.toISOString().split('T')[0] || null,
              latest: stats.latestDate?.toISOString().split('T')[0] || null,
            },
          },
          performance: {
            avgApiResponseTimeMs: Math.round(avgApiResponseTime),
            totalDurationMs: duration,
            recordsPerSecond: parseFloat(recordsPerSecond as string),
          },
        },
      }

      // Mark extract as completed
      await prisma.extractLog.update({
        where: { syncId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          recordsFetched,
          totalPages,
          apiCallCount,
          metadata,
        },
      })

      // Log diagnostic summary
      logger.info('Extract contacts completed - Summary', {
        syncId,
        totalContacts: recordsFetched,
        pages: totalPages,
        duration: `${(duration / 1000).toFixed(1)}s`,
        dataQuality: {
          withMobile: `${((stats.withMobile / recordsFetched) * 100).toFixed(1)}% (${stats.withMobile}/${recordsFetched})`,
          withEmail: `${((stats.withEmail / recordsFetched) * 100).toFixed(1)}% (${stats.withEmail}/${recordsFetched})`,
          withIdentification: `${((stats.withIdentification / recordsFetched) * 100).toFixed(1)}% (${stats.withIdentification}/${recordsFetched})`,
          withCustomAttributes: `${((stats.withCustomAttributes / recordsFetched) * 100).toFixed(1)}% (${stats.withCustomAttributes}/${recordsFetched})`,
        },
        dateRange: metadata.summary.dateRange,
        performance: {
          avgApiResponseTime: `${avgApiResponseTime.toFixed(0)}ms`,
          recordsPerSecond: recordsPerSecond,
        },
      })

      return {
        syncId,
        entityType: 'contacts',
        status: 'completed',
        recordsFetched,
        totalPages,
        apiCallCount,
        duration,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Collect detailed error information for B2ChatAPIError
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
        errorDetails.timestamp = new Date().toISOString()
      }

      // Mark extract as failed with detailed error metadata
      await prisma.extractLog.update({
        where: { syncId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
          recordsFetched,
          totalPages,
          apiCallCount,
          metadata: Object.keys(errorDetails).length > 0 ? { error: errorDetails } : undefined,
        },
      })

      logger.error('Extract contacts failed', {
        syncId,
        error: errorMessage,
        recordsFetched,
        errorDetails,
      })

      return {
        syncId,
        entityType: 'contacts',
        status: 'failed',
        recordsFetched,
        totalPages,
        apiCallCount,
        errorMessage,
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * Extract chats from B2Chat API → store in RawChat staging table
   */
  async extractChats(options: ExtractOptions = {}): Promise<ExtractResult> {
    const syncId = `extract_chats_${Date.now()}`
    const startTime = Date.now()
    const batchSize = options.batchSize || 1000

    let recordsFetched = 0
    let totalPages = 0
    let apiCallCount = 0

    // Determine date range
    let dateRange: { startDate?: Date; endDate?: Date } | undefined
    if (options.timeRangePreset) {
      dateRange = this.convertPresetToDateRange(options.timeRangePreset)
    } else if (options.dateRange) {
      dateRange = options.dateRange
    }

    // Determine max pages (default: 100 for date-filtered, unlimited for full sync)
    const maxPages = options.maxPages || (options.fullSync ? Number.MAX_SAFE_INTEGER : 100)

    // Create extract log
    await prisma.extractLog.create({
      data: {
        id: `extract_log_${syncId}`,
        syncId,
        entityType: 'chats',
        operation: options.fullSync ? 'full' : 'incremental',
        startedAt: new Date(),
        status: 'running',
        dateRangeFrom: dateRange?.startDate,
        dateRangeTo: dateRange?.endDate,
        timeRangePreset: options.timeRangePreset || (options.fullSync ? 'full' : undefined),
        userId: options.userId,
        batchSize,
        contactFilterMobile: options.contactFilter?.mobile,
        metadata: options.contactFilter ? {
          contactFilter: options.contactFilter
        } : undefined,
      },
    })

    // Initialize stats tracking
    const stats = {
      withAgent: 0,
      withContact: 0,
      withDepartment: 0,
      withMessages: 0,
      emptyMessages: 0,
      byProvider: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      earliestDate: null as Date | null,
      latestDate: null as Date | null,
      messageCount: 0,
      apiResponseTimes: [] as number[],
    }

    try {
      let page = 1
      let hasMorePages = true

      while (hasMorePages && page <= maxPages) {
        // Check for cancellation
        if (options.abortSignal?.aborted) {
          await prisma.extractLog.update({
            where: { syncId },
            data: {
              status: 'cancelled',
              completedAt: new Date(),
              recordsFetched,
              totalPages,
              apiCallCount,
            },
          })

          return {
            syncId,
            entityType: 'chats',
            status: 'cancelled',
            recordsFetched,
            totalPages,
            apiCallCount,
            duration: Date.now() - startTime,
          }
        }

        // Fetch from API and track response time
        const apiStartTime = Date.now()
        const response = await rateLimitedQueue.add(() =>
          this.client.getChats({
            page,
            limit: batchSize,
            dateRange,
          })
        )
        stats.apiResponseTimes.push(Date.now() - apiStartTime)

        apiCallCount++
        const { data: chats, pagination } = response
        hasMorePages = pagination.hasNextPage || false

        // Collect statistics from fetched chats
        chats.forEach((chat: any) => {
          // Count relationships
          if (chat.agent) stats.withAgent++
          if (chat.contact) stats.withContact++
          if (chat.department) stats.withDepartment++

          // Count messages
          const messages = chat.messages || []
          if (messages.length > 0) {
            stats.withMessages++
            stats.messageCount += messages.length
          } else {
            stats.emptyMessages++
          }

          // Track by provider
          const provider = chat.provider || 'unknown'
          stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1

          // Track by status
          const status = chat.status || 'unknown'
          stats.byStatus[status] = (stats.byStatus[status] || 0) + 1

          // Track date range
          if (chat.created_at) {
            const chatDate = new Date(chat.created_at)
            if (!stats.earliestDate || chatDate < stats.earliestDate) {
              stats.earliestDate = chatDate
            }
            if (!stats.latestDate || chatDate > stats.latestDate) {
              stats.latestDate = chatDate
            }
          }
        })

        // Store raw chats in staging table
        const offset = (page - 1) * batchSize
        const rawChatRecords = chats.map((chat) => ({
          id: `raw_chat_${syncId}_${chat.chat_id}`,
          syncId,
          b2chatChatId: String(chat.chat_id),
          rawData: chat as any, // Store full raw JSON including messages
          apiPage: page,
          apiOffset: offset,
          fetchedAt: new Date(),
          processingStatus: 'pending',
        }))

        // Batch insert raw chats
        if (rawChatRecords.length > 0) {
          await prisma.rawChat.createMany({
            data: rawChatRecords,
            skipDuplicates: true,
          })
        }

        recordsFetched += chats.length
        totalPages = page

        // Update extract log progress
        await prisma.extractLog.update({
          where: { syncId },
          data: {
            recordsFetched,
            currentPage: page,
            totalPages: page,
            apiCallCount,
          },
        })

        logger.info('Extract chats progress', {
          syncId,
          page,
          recordsFetched,
          batchSize: chats.length,
        })

        page++

        if (chats.length === 0) {
          break
        }
      }

      // Calculate summary statistics
      const avgMessagesPerChat = recordsFetched > 0 ? stats.messageCount / recordsFetched : 0
      const avgApiResponseTime = stats.apiResponseTimes.length > 0
        ? stats.apiResponseTimes.reduce((a, b) => a + b, 0) / stats.apiResponseTimes.length
        : 0
      const duration = Date.now() - startTime
      const recordsPerSecond = duration > 0 ? (recordsFetched / (duration / 1000)).toFixed(1) : 0

      // Build metadata with statistics
      const metadata = {
        ...(options.contactFilter ? { contactFilter: options.contactFilter } : {}),
        summary: {
          totalChats: recordsFetched,
          withAgent: stats.withAgent,
          withContact: stats.withContact,
          withDepartment: stats.withDepartment,
          withMessages: stats.withMessages,
          emptyMessages: stats.emptyMessages,
          avgMessagesPerChat: parseFloat(avgMessagesPerChat.toFixed(1)),
          byProvider: stats.byProvider,
          byStatus: stats.byStatus,
          dateRange: {
            requested: {
              from: dateRange?.startDate?.toISOString().split('T')[0] || null,
              to: dateRange?.endDate?.toISOString().split('T')[0] || null,
            },
            actual: {
              earliest: stats.earliestDate?.toISOString().split('T')[0] || null,
              latest: stats.latestDate?.toISOString().split('T')[0] || null,
            },
          },
          performance: {
            avgApiResponseTimeMs: Math.round(avgApiResponseTime),
            totalDurationMs: duration,
            recordsPerSecond: parseFloat(recordsPerSecond as string),
          },
        },
      }

      // Mark extract as completed
      await prisma.extractLog.update({
        where: { syncId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          recordsFetched,
          totalPages,
          apiCallCount,
          metadata,
        },
      })

      // Log diagnostic summary
      logger.info('Extract chats completed - Summary', {
        syncId,
        totalChats: recordsFetched,
        pages: totalPages,
        duration: `${(duration / 1000).toFixed(1)}s`,
        dataQuality: {
          withAgent: `${((stats.withAgent / recordsFetched) * 100).toFixed(1)}% (${stats.withAgent}/${recordsFetched})`,
          withContact: `${((stats.withContact / recordsFetched) * 100).toFixed(1)}% (${stats.withContact}/${recordsFetched})`,
          withDepartment: `${((stats.withDepartment / recordsFetched) * 100).toFixed(1)}% (${stats.withDepartment}/${recordsFetched})`,
          withMessages: `${((stats.withMessages / recordsFetched) * 100).toFixed(1)}% (${stats.withMessages}/${recordsFetched})`,
          avgMessagesPerChat: avgMessagesPerChat.toFixed(1),
        },
        dateRange: metadata.summary.dateRange,
        providers: stats.byProvider,
        statuses: stats.byStatus,
        performance: {
          avgApiResponseTime: `${avgApiResponseTime.toFixed(0)}ms`,
          recordsPerSecond: recordsPerSecond,
        },
      })

      return {
        syncId,
        entityType: 'chats',
        status: 'completed',
        recordsFetched,
        totalPages,
        apiCallCount,
        duration,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Collect detailed error information for B2ChatAPIError
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
        errorDetails.timestamp = new Date().toISOString()
      }

      // Mark extract as failed with detailed error metadata
      await prisma.extractLog.update({
        where: { syncId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
          recordsFetched,
          totalPages,
          apiCallCount,
          metadata: Object.keys(errorDetails).length > 0 ? { error: errorDetails } : undefined,
        },
      })

      logger.error('Extract chats failed', {
        syncId,
        error: errorMessage,
        recordsFetched,
        errorDetails,
      })

      return {
        syncId,
        entityType: 'chats',
        status: 'failed',
        recordsFetched,
        totalPages,
        apiCallCount,
        errorMessage,
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * Extract all entities (contacts + chats)
   */
  async extractAll(options: ExtractOptions = {}): Promise<{
    contacts: ExtractResult
    chats: ExtractResult
  }> {
    const contactsResult = await this.extractContacts(options)
    const chatsResult = await this.extractChats(options)

    return {
      contacts: contactsResult,
      chats: chatsResult,
    }
  }
}
