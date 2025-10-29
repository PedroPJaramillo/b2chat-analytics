#!/usr/bin/env tsx
/**
 * Chat Data Health Evaluation Script
 *
 * Comprehensive health checks for chat data including:
 * - Data integrity (orphaned records, duplicates, missing fields)
 * - Sync health (raw data processing, failed syncs, stale data)
 * - Data consistency (timestamps, status, SLA metrics)
 * - Chat completeness (empty chats, single-message chats)
 *
 * Usage:
 *   npm run health:check
 *   npm run health:check -- --format=json
 *   npm run health:check -- --check=empty-chats
 *   npm run health:check -- --severity=error
 *   npm run health:check -- --output=health-report.json
 */

import { prisma } from '../src/lib/prisma'
import { logger } from '../src/lib/logger'

interface HealthIssue {
  checkName: string
  severity: 'error' | 'warning' | 'info'
  affectedRecords: number
  message: string
  details?: any
  recommendation?: string
}

interface HealthCheckResult {
  category: string
  checks: HealthIssue[]
  totalIssues: number
  errors: number
  warnings: number
  infos: number
}

interface HealthReport {
  timestamp: Date
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  summary: {
    totalIssues: number
    errors: number
    warnings: number
    infos: number
  }
  statistics: {
    totalChats: number
    totalMessages: number
    totalContacts: number
    totalAgents: number
    emptyChats: number
    singleMessageChats: number
    chatsWithoutContact: number
    chatsWithoutAgent: number
  }
  categories: HealthCheckResult[]
}

interface CliOptions {
  format: 'console' | 'json'
  check?: string
  severity?: 'error' | 'warning' | 'info'
  output?: string
}

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

/**
 * Parse command-line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const options: CliOptions = {
    format: 'console',
  }

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1]
      if (format === 'json' || format === 'console') {
        options.format = format
      }
    } else if (arg.startsWith('--check=')) {
      options.check = arg.split('=')[1]
    } else if (arg.startsWith('--severity=')) {
      const severity = arg.split('=')[1]
      if (severity === 'error' || severity === 'warning' || severity === 'info') {
        options.severity = severity
      }
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1]
    }
  }

  return options
}

/**
 * Data Integrity Checks
 */
class DataIntegrityChecker {
  async runAllChecks(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    issues.push(...(await this.checkOrphanedMessages()))
    issues.push(...(await this.checkOrphanedChats()))
    issues.push(...(await this.checkDuplicateB2ChatIds()))
    issues.push(...(await this.checkMissingCriticalFields()))
    issues.push(...(await this.checkReferentialIntegrity()))

    return issues
  }

  private async checkOrphanedMessages(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check for messages where chatId doesn't exist in chats table
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM messages m
        WHERE NOT EXISTS (
          SELECT 1 FROM chats c WHERE c.id = m.chat_id
        )
      `

      const orphanedMessages = Number(result[0]?.count || 0)

      if (orphanedMessages > 0) {
        issues.push({
          checkName: 'orphaned_messages',
          severity: 'error',
          affectedRecords: orphanedMessages,
          message: 'Messages exist without associated chat records',
          recommendation: 'Delete orphaned messages or investigate data sync issues',
        })
      }
    } catch (error) {
      logger.error('Failed to check orphaned messages', { error: error instanceof Error ? error : new Error(String(error)) })
    }

    return issues
  }

  private async checkOrphanedChats(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const chatsWithoutContact = await prisma.chat.count({
        where: {
          contactId: null,
        },
      })

      if (chatsWithoutContact > 0) {
        issues.push({
          checkName: 'chats_without_contact',
          severity: 'warning',
          affectedRecords: chatsWithoutContact,
          message: 'Chats exist without associated contact records',
          recommendation: 'Review sync logic to ensure contact data is properly linked',
        })
      }

      const chatsWithoutAgent = await prisma.chat.count({
        where: {
          agentId: null,
          status: { in: ['PICKED_UP', 'RESPONDED_BY_AGENT', 'CLOSED', 'COMPLETING_POLL', 'COMPLETED_POLL', 'ABANDONED_POLL'] },
        },
      })

      if (chatsWithoutAgent > 0) {
        issues.push({
          checkName: 'handled_chats_without_agent',
          severity: 'warning',
          affectedRecords: chatsWithoutAgent,
          message: 'Handled chats exist without associated agent records',
          recommendation: 'Verify agent assignment logic in chat processing',
        })
      }
    } catch (error) {
      logger.error('Failed to check orphaned chats', { error })
    }

    return issues
  }

  private async checkDuplicateB2ChatIds(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check duplicate chat IDs
      const duplicateChats = await prisma.$queryRaw<Array<{ b2chat_id: string; count: number }>>`
        SELECT b2chat_id, COUNT(*) as count
        FROM chats
        GROUP BY b2chat_id
        HAVING COUNT(*) > 1
      `

      if (duplicateChats.length > 0) {
        issues.push({
          checkName: 'duplicate_chat_b2chat_ids',
          severity: 'error',
          affectedRecords: duplicateChats.length,
          message: 'Duplicate b2chatId values found in chats table',
          details: {
            samples: duplicateChats.slice(0, 5),
          },
          recommendation: 'Remove duplicate records keeping the most recent version',
        })
      }

      // Check duplicate message IDs
      const duplicateMessages = await prisma.$queryRaw<Array<{ b2chat_message_id: string; count: number }>>`
        SELECT b2chat_message_id, COUNT(*) as count
        FROM messages
        WHERE b2chat_message_id IS NOT NULL
        GROUP BY b2chat_message_id
        HAVING COUNT(*) > 1
      `

      if (duplicateMessages.length > 0) {
        issues.push({
          checkName: 'duplicate_message_b2chat_ids',
          severity: 'error',
          affectedRecords: duplicateMessages.length,
          message: 'Duplicate b2chatMessageId values found in messages table',
          details: {
            samples: duplicateMessages.slice(0, 5),
          },
          recommendation: 'Remove duplicate message records',
        })
      }
    } catch (error) {
      logger.error('Failed to check duplicate IDs', { error })
    }

    return issues
  }

  private async checkMissingCriticalFields(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check for empty b2chatId strings (null is not possible due to schema constraints)
      const chatsWithEmptyB2ChatId = await prisma.chat.count({
        where: {
          b2chatId: '',
        },
      })

      if (chatsWithEmptyB2ChatId > 0) {
        issues.push({
          checkName: 'chats_with_empty_b2chat_id',
          severity: 'error',
          affectedRecords: chatsWithEmptyB2ChatId,
          message: 'Chats exist with empty b2chatId',
          recommendation: 'These records are likely corrupt and should be investigated',
        })
      }

      // Check for messages without text or media
      const messagesWithoutContent = await prisma.message.count({
        where: {
          OR: [
            {
              AND: [
                { text: null },
                { imageUrl: null },
                { fileUrl: null },
              ],
            },
            {
              AND: [
                { text: '' },
                { imageUrl: null },
                { fileUrl: null },
              ],
            },
          ],
        },
      })

      if (messagesWithoutContent > 0) {
        issues.push({
          checkName: 'messages_without_content',
          severity: 'warning',
          affectedRecords: messagesWithoutContent,
          message: 'Messages exist with no text or media content',
          recommendation: 'Review message data quality and sync logic',
        })
      }
    } catch (error) {
      logger.error('Failed to check missing critical fields', { error })
    }

    return issues
  }

  private async checkReferentialIntegrity(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check for invalid contact references
      const invalidContactRefs = await prisma.chat.count({
        where: {
          contactId: { not: null },
          contact: null,
        },
      })

      if (invalidContactRefs > 0) {
        issues.push({
          checkName: 'invalid_contact_references',
          severity: 'error',
          affectedRecords: invalidContactRefs,
          message: 'Chats reference non-existent contacts',
          recommendation: 'Sync contact data or set contactId to null',
        })
      }

      // Check for invalid agent references
      const invalidAgentRefs = await prisma.chat.count({
        where: {
          agentId: { not: null },
          agent: { is: null },
        },
      })

      if (invalidAgentRefs > 0) {
        issues.push({
          checkName: 'invalid_agent_references',
          severity: 'error',
          affectedRecords: invalidAgentRefs,
          message: 'Chats reference non-existent agents',
          recommendation: 'Sync agent data or set agentId to null',
        })
      }

      // Check for invalid department references
      const invalidDeptRefs = await prisma.chat.count({
        where: {
          departmentId: { not: null },
          department: null,
        },
      })

      if (invalidDeptRefs > 0) {
        issues.push({
          checkName: 'invalid_department_references',
          severity: 'warning',
          affectedRecords: invalidDeptRefs,
          message: 'Chats reference non-existent departments',
          recommendation: 'Sync department data or set departmentId to null',
        })
      }
    } catch (error) {
      logger.error('Failed to check referential integrity', { error })
    }

    return issues
  }
}

/**
 * Sync Health Checks
 */
class SyncHealthChecker {
  async runAllChecks(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    issues.push(...(await this.checkUnprocessedRawData()))
    issues.push(...(await this.checkFailedSyncs()))
    issues.push(...(await this.checkStaleData()))
    issues.push(...(await this.checkSyncGaps()))

    return issues
  }

  private async checkUnprocessedRawData(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const pendingRawChats = await prisma.rawChat.count({
        where: {
          processingStatus: 'pending',
        },
      })

      if (pendingRawChats > 0) {
        issues.push({
          checkName: 'unprocessed_raw_chats',
          severity: 'warning',
          affectedRecords: pendingRawChats,
          message: 'Raw chat data waiting to be processed',
          recommendation: 'Run transform operation to process pending raw data',
        })
      }

      const failedRawChats = await prisma.rawChat.count({
        where: {
          processingStatus: 'failed',
        },
      })

      if (failedRawChats > 0) {
        issues.push({
          checkName: 'failed_raw_chats',
          severity: 'error',
          affectedRecords: failedRawChats,
          message: 'Raw chat data failed to process',
          recommendation: 'Review processing errors and retry transform operation',
        })
      }

      const pendingRawContacts = await prisma.rawContact.count({
        where: {
          processingStatus: 'pending',
        },
      })

      if (pendingRawContacts > 0) {
        issues.push({
          checkName: 'unprocessed_raw_contacts',
          severity: 'warning',
          affectedRecords: pendingRawContacts,
          message: 'Raw contact data waiting to be processed',
          recommendation: 'Run transform operation to process pending raw data',
        })
      }

      const failedRawContacts = await prisma.rawContact.count({
        where: {
          processingStatus: 'failed',
        },
      })

      if (failedRawContacts > 0) {
        issues.push({
          checkName: 'failed_raw_contacts',
          severity: 'error',
          affectedRecords: failedRawContacts,
          message: 'Raw contact data failed to process',
          recommendation: 'Review processing errors and retry transform operation',
        })
      }
    } catch (error) {
      logger.error('Failed to check unprocessed raw data', { error })
    }

    return issues
  }

  private async checkFailedSyncs(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const failedExtracts = await prisma.extractLog.count({
        where: {
          status: 'failed',
        },
      })

      if (failedExtracts > 0) {
        const recentFailed = await prisma.extractLog.findFirst({
          where: { status: 'failed' },
          orderBy: { startedAt: 'desc' },
          select: {
            entityType: true,
            errorMessage: true,
            startedAt: true,
          },
        })

        issues.push({
          checkName: 'failed_extract_operations',
          severity: 'error',
          affectedRecords: failedExtracts,
          message: 'Extract operations have failed',
          details: {
            mostRecentFailure: recentFailed,
          },
          recommendation: 'Check error logs and B2Chat API connectivity',
        })
      }

      const failedTransforms = await prisma.transformLog.count({
        where: {
          status: 'failed',
        },
      })

      if (failedTransforms > 0) {
        const recentFailed = await prisma.transformLog.findFirst({
          where: { status: 'failed' },
          orderBy: { startedAt: 'desc' },
          select: {
            entityType: true,
            errorMessage: true,
            startedAt: true,
          },
        })

        issues.push({
          checkName: 'failed_transform_operations',
          severity: 'error',
          affectedRecords: failedTransforms,
          message: 'Transform operations have failed',
          details: {
            mostRecentFailure: recentFailed,
          },
          recommendation: 'Review validation errors and data transformation logic',
        })
      }
    } catch (error) {
      logger.error('Failed to check failed syncs', { error })
    }

    return issues
  }

  private async checkStaleData(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const staleChats = await prisma.chat.count({
        where: {
          lastSyncAt: { lt: sevenDaysAgo },
          isDeleted: false,
        },
      })

      if (staleChats > 0) {
        issues.push({
          checkName: 'stale_chat_data',
          severity: 'info',
          affectedRecords: staleChats,
          message: 'Chats have not been synced in over 7 days',
          recommendation: 'Run a full sync to update stale records',
        })
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const veryStaleChats = await prisma.chat.count({
        where: {
          lastSyncAt: { lt: thirtyDaysAgo },
          isDeleted: false,
        },
      })

      if (veryStaleChats > 0) {
        issues.push({
          checkName: 'very_stale_chat_data',
          severity: 'warning',
          affectedRecords: veryStaleChats,
          message: 'Chats have not been synced in over 30 days',
          recommendation: 'Run a full sync to update very stale records',
        })
      }
    } catch (error) {
      logger.error('Failed to check stale data', { error })
    }

    return issues
  }

  private async checkSyncGaps(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const syncStates = await prisma.syncState.findMany({
        select: {
          entityType: true,
          lastSyncTimestamp: true,
        },
      })

      const now = new Date()
      const oneDayMs = 24 * 60 * 60 * 1000

      for (const state of syncStates) {
        if (state.lastSyncTimestamp) {
          const gapMs = now.getTime() - state.lastSyncTimestamp.getTime()
          const gapDays = Math.floor(gapMs / oneDayMs)

          if (gapDays > 7) {
            issues.push({
              checkName: `sync_gap_${state.entityType}`,
              severity: gapDays > 30 ? 'error' : 'warning',
              affectedRecords: 1,
              message: `${state.entityType} has not been synced in ${gapDays} days`,
              details: {
                lastSync: state.lastSyncTimestamp,
                gapDays,
              },
              recommendation: `Trigger a sync for ${state.entityType}`,
            })
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check sync gaps', { error })
    }

    return issues
  }
}

/**
 * Data Consistency Checks
 */
class DataConsistencyChecker {
  async runAllChecks(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    issues.push(...(await this.checkTimestampLogic()))
    issues.push(...(await this.checkStatusConsistency()))
    issues.push(...(await this.checkSLAMetrics()))
    issues.push(...(await this.checkMessageIntegrity()))

    return issues
  }

  private async checkTimestampLogic(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check for chats where openedAt is before createdAt
      const invalidTimeline = await prisma.$queryRaw<
        Array<{
          id: string
          b2chat_id: string
          created_at: Date
          opened_at: Date
        }>
      >`
        SELECT id, b2chat_id, created_at, opened_at
        FROM chats
        WHERE opened_at IS NOT NULL
          AND opened_at < created_at
        LIMIT 5
      `

      if (invalidTimeline.length > 0) {
        const totalCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM chats
          WHERE opened_at IS NOT NULL
            AND opened_at < created_at
        `

        issues.push({
          checkName: 'invalid_timestamp_sequence',
          severity: 'error',
          affectedRecords: Number(totalCount[0]?.count || 0),
          message: 'Chats have openedAt before createdAt',
          details: {
            samples: invalidTimeline.map((chat) => ({
              id: chat.id,
              b2chatId: chat.b2chat_id,
              createdAt: chat.created_at,
              openedAt: chat.opened_at,
            })),
          },
          recommendation: 'Correct timestamp logic in sync process',
        })
      }

      // Check for closed chats without closedAt timestamp
      const closedWithoutTimestamp = await prisma.chat.count({
        where: {
          status: { in: ['CLOSED', 'COMPLETED_POLL', 'ABANDONED_POLL'] },
          closedAt: null,
        },
      })

      if (closedWithoutTimestamp > 0) {
        issues.push({
          checkName: 'closed_without_timestamp',
          severity: 'error',
          affectedRecords: closedWithoutTimestamp,
          message: 'Chats marked as closed without closedAt timestamp',
          recommendation: 'Set closedAt timestamp based on last message or status change',
        })
      }
    } catch (error) {
      logger.error('Failed to check timestamp logic', { error })
    }

    return issues
  }

  private async checkStatusConsistency(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check for PICKED_UP status without pickedUpAt
      const pickedUpWithoutTimestamp = await prisma.chat.count({
        where: {
          status: { in: ['PICKED_UP', 'RESPONDED_BY_AGENT', 'CLOSED', 'COMPLETING_POLL', 'COMPLETED_POLL', 'ABANDONED_POLL'] },
          pickedUpAt: null,
        },
      })

      if (pickedUpWithoutTimestamp > 0) {
        issues.push({
          checkName: 'picked_up_without_timestamp',
          severity: 'warning',
          affectedRecords: pickedUpWithoutTimestamp,
          message: 'Chats in handled state without pickedUpAt timestamp',
          recommendation: 'Set pickedUpAt based on first agent message timestamp',
        })
      }

      // Check for stale open chats
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const staleOpenChats = await prisma.chat.count({
        where: {
          status: { in: ['OPENED', 'PICKED_UP', 'BOT_CHATTING'] },
          createdAt: { lt: sevenDaysAgo },
        },
      })

      if (staleOpenChats > 0) {
        issues.push({
          checkName: 'stale_open_chats',
          severity: 'warning',
          affectedRecords: staleOpenChats,
          message: 'Open chats older than 7 days',
          recommendation: 'Review these chats for proper closure or status update',
        })
      }
    } catch (error) {
      logger.error('Failed to check status consistency', { error })
    }

    return issues
  }

  private async checkSLAMetrics(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check for closed chats without SLA metrics
      const closedChatsWithoutSLA = await prisma.chat.count({
        where: {
          status: { in: ['CLOSED', 'COMPLETED_POLL', 'ABANDONED_POLL'] },
          overallSLA: null,
        },
      })

      if (closedChatsWithoutSLA > 0) {
        issues.push({
          checkName: 'closed_chats_missing_sla',
          severity: 'warning',
          affectedRecords: closedChatsWithoutSLA,
          message: 'Closed chats without SLA metrics calculated',
          recommendation: 'Run SLA backfill script to calculate missing metrics',
        })
      }

      // Check for chats with SLA metrics but missing required timestamps
      const slaWithoutTimestamps = await prisma.chat.count({
        where: {
          overallSLA: { not: null },
          OR: [
            { openedAt: null },
            { closedAt: null },
          ],
        },
      })

      if (slaWithoutTimestamps > 0) {
        issues.push({
          checkName: 'sla_with_missing_timestamps',
          severity: 'error',
          affectedRecords: slaWithoutTimestamps,
          message: 'Chats have SLA metrics but missing required timestamps',
          recommendation: 'Recalculate SLA metrics or fix timestamp data',
        })
      }
    } catch (error) {
      logger.error('Failed to check SLA metrics', { error })
    }

    return issues
  }

  private async checkMessageIntegrity(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      // Check for messages with very old or future timestamps (data quality issue)
      const now = new Date()
      const tenYearsAgo = new Date()
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)
      const oneYearFuture = new Date()
      oneYearFuture.setFullYear(oneYearFuture.getFullYear() + 1)

      const messagesWithInvalidTimestamps = await prisma.message.count({
        where: {
          OR: [
            { timestamp: { lt: tenYearsAgo } },
            { timestamp: { gt: oneYearFuture } },
          ],
        },
      })

      if (messagesWithInvalidTimestamps > 0) {
        issues.push({
          checkName: 'messages_with_invalid_timestamps',
          severity: 'warning',
          affectedRecords: messagesWithInvalidTimestamps,
          message: 'Messages exist with suspicious timestamps (>10 years old or in future)',
          recommendation: 'Review message timestamp data quality',
        })
      }

      // Check for messages with broken media URLs
      const messagesWithBrokenMedia = await prisma.message.count({
        where: {
          OR: [
            {
              AND: [
                { imageUrl: { not: null } },
                { imageUrl: { not: { startsWith: 'http' } } },
              ],
            },
            {
              AND: [
                { fileUrl: { not: null } },
                { fileUrl: { not: { startsWith: 'http' } } },
              ],
            },
          ],
        },
      })

      if (messagesWithBrokenMedia > 0) {
        issues.push({
          checkName: 'messages_with_invalid_media_urls',
          severity: 'info',
          affectedRecords: messagesWithBrokenMedia,
          message: 'Messages have media URLs that do not start with http',
          recommendation: 'Review media URL format and storage',
        })
      }
    } catch (error) {
      logger.error('Failed to check message integrity', { error })
    }

    return issues
  }
}

/**
 * Chat Completeness Checks
 */
class ChatCompletenessChecker {
  async runAllChecks(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    issues.push(...(await this.checkEmptyChats()))
    issues.push(...(await this.checkSingleMessageChats()))
    issues.push(...(await this.checkMessageDistribution()))

    return issues
  }

  private async checkEmptyChats(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const emptyChats = await prisma.chat.count({
        where: {
          messages: {
            none: {},
          },
        },
      })

      if (emptyChats > 0) {
        issues.push({
          checkName: 'empty_chats',
          severity: 'warning',
          affectedRecords: emptyChats,
          message: 'Chats exist with no messages',
          recommendation: 'Review sync logic or clean up empty chat records',
        })
      }
    } catch (error) {
      logger.error('Failed to check empty chats', { error })
    }

    return issues
  }

  private async checkSingleMessageChats(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const singleMessageChats = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT chat_id) as count
        FROM (
          SELECT chat_id, COUNT(*) as message_count
          FROM messages
          GROUP BY chat_id
          HAVING COUNT(*) = 1
        ) single_msg_chats
      `

      const count = Number(singleMessageChats[0]?.count || 0)

      if (count > 0) {
        issues.push({
          checkName: 'single_message_chats',
          severity: 'info',
          affectedRecords: count,
          message: 'Chats exist with only one message',
          recommendation: 'Review if these are incomplete conversations or valid single-message chats',
        })
      }
    } catch (error) {
      logger.error('Failed to check single message chats', { error })
    }

    return issues
  }

  private async checkMessageDistribution(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    try {
      const distribution = await prisma.$queryRaw<
        Array<{ bucket: string; count: bigint }>
      >`
        WITH chat_message_counts AS (
          SELECT c.id, COUNT(m.id) as message_count
          FROM chats c
          LEFT JOIN messages m ON c.id = m.chat_id
          GROUP BY c.id
        ),
        bucketed AS (
          SELECT
            CASE
              WHEN message_count = 0 THEN '0 messages'
              WHEN message_count = 1 THEN '1 message'
              WHEN message_count BETWEEN 2 AND 5 THEN '2-5 messages'
              WHEN message_count BETWEEN 6 AND 10 THEN '6-10 messages'
              WHEN message_count BETWEEN 11 AND 20 THEN '11-20 messages'
              WHEN message_count BETWEEN 21 AND 50 THEN '21-50 messages'
              ELSE '50+ messages'
            END as bucket,
            CASE
              WHEN message_count = 0 THEN 1
              WHEN message_count = 1 THEN 2
              WHEN message_count BETWEEN 2 AND 5 THEN 3
              WHEN message_count BETWEEN 6 AND 10 THEN 4
              WHEN message_count BETWEEN 11 AND 20 THEN 5
              WHEN message_count BETWEEN 21 AND 50 THEN 6
              ELSE 7
            END as sort_order
          FROM chat_message_counts
        )
        SELECT bucket, COUNT(*) as count
        FROM bucketed
        GROUP BY bucket, sort_order
        ORDER BY sort_order
      `

      issues.push({
        checkName: 'message_distribution',
        severity: 'info',
        affectedRecords: 0,
        message: 'Message count distribution across chats',
        details: {
          distribution: distribution.map((d) => ({
            bucket: d.bucket,
            count: Number(d.count),
          })),
        },
        recommendation: 'Informational - review distribution for data quality insights',
      })
    } catch (error) {
      logger.error('Failed to check message distribution', { error })
    }

    return issues
  }
}

/**
 * Collect overall database statistics
 */
async function collectStatistics() {
  const [
    totalChats,
    totalMessages,
    totalContacts,
    totalAgents,
    emptyChats,
    singleMessageResult,
    chatsWithoutContact,
    chatsWithoutAgent,
  ] = await Promise.all([
    prisma.chat.count(),
    prisma.message.count(),
    prisma.contact.count(),
    prisma.agent.count(),
    prisma.chat.count({
      where: {
        messages: {
          none: {},
        },
      },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT chat_id) as count
      FROM (
        SELECT chat_id, COUNT(*) as message_count
        FROM messages
        GROUP BY chat_id
        HAVING COUNT(*) = 1
      ) single_msg_chats
    `,
    prisma.chat.count({
      where: {
        contactId: null,
      },
    }),
    prisma.chat.count({
      where: {
        agentId: null,
      },
    }),
  ])

  return {
    totalChats,
    totalMessages,
    totalContacts,
    totalAgents,
    emptyChats,
    singleMessageChats: Number(singleMessageResult[0]?.count || 0),
    chatsWithoutContact,
    chatsWithoutAgent,
  }
}

/**
 * Run all health checks and generate report
 */
async function runHealthCheck(options: CliOptions): Promise<HealthReport> {
  console.log(`${colors.bold}${colors.blue}🏥 Chat Data Health Check${colors.reset}\n`)

  const categories: HealthCheckResult[] = []

  // Data Integrity Checks
  if (!options.check || options.check === 'data-integrity') {
    const checker = new DataIntegrityChecker()
    const issues = await checker.runAllChecks()
    categories.push({
      category: 'Data Integrity',
      checks: issues,
      totalIssues: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      infos: issues.filter((i) => i.severity === 'info').length,
    })
  }

  // Sync Health Checks
  if (!options.check || options.check === 'sync-health') {
    const checker = new SyncHealthChecker()
    const issues = await checker.runAllChecks()
    categories.push({
      category: 'Sync Health',
      checks: issues,
      totalIssues: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      infos: issues.filter((i) => i.severity === 'info').length,
    })
  }

  // Data Consistency Checks
  if (!options.check || options.check === 'data-consistency') {
    const checker = new DataConsistencyChecker()
    const issues = await checker.runAllChecks()
    categories.push({
      category: 'Data Consistency',
      checks: issues,
      totalIssues: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      infos: issues.filter((i) => i.severity === 'info').length,
    })
  }

  // Chat Completeness Checks
  if (!options.check || options.check === 'chat-completeness') {
    const checker = new ChatCompletenessChecker()
    const issues = await checker.runAllChecks()
    categories.push({
      category: 'Chat Completeness',
      checks: issues,
      totalIssues: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      infos: issues.filter((i) => i.severity === 'info').length,
    })
  }

  // Collect statistics
  const statistics = await collectStatistics()

  // Calculate totals
  const totalIssues = categories.reduce((sum, cat) => sum + cat.totalIssues, 0)
  const totalErrors = categories.reduce((sum, cat) => sum + cat.errors, 0)
  const totalWarnings = categories.reduce((sum, cat) => sum + cat.warnings, 0)
  const totalInfos = categories.reduce((sum, cat) => sum + cat.infos, 0)

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  if (totalErrors > 0) {
    overallStatus = 'unhealthy'
  } else if (totalWarnings > 0) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'healthy'
  }

  const report: HealthReport = {
    timestamp: new Date(),
    overallStatus,
    summary: {
      totalIssues,
      errors: totalErrors,
      warnings: totalWarnings,
      infos: totalInfos,
    },
    statistics,
    categories,
  }

  return report
}

/**
 * Format report for console output
 */
function formatConsoleReport(report: HealthReport, options: CliOptions) {
  const { statistics } = report

  // Overall Status
  const statusColor =
    report.overallStatus === 'healthy'
      ? colors.green
      : report.overallStatus === 'degraded'
      ? colors.yellow
      : colors.red

  console.log(`${colors.bold}Overall Status:${colors.reset} ${statusColor}${report.overallStatus.toUpperCase()}${colors.reset}\n`)

  // Statistics
  console.log(`${colors.bold}${colors.cyan}📊 Database Statistics${colors.reset}`)
  console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`)
  console.log(`Total Chats:              ${statistics.totalChats.toLocaleString()}`)
  console.log(`Total Messages:           ${statistics.totalMessages.toLocaleString()}`)
  console.log(`Total Contacts:           ${statistics.totalContacts.toLocaleString()}`)
  console.log(`Total Agents:             ${statistics.totalAgents.toLocaleString()}`)
  console.log(`Empty Chats:              ${statistics.emptyChats.toLocaleString()}`)
  console.log(`Single Message Chats:     ${statistics.singleMessageChats.toLocaleString()}`)
  console.log(`Chats without Contact:    ${statistics.chatsWithoutContact.toLocaleString()}`)
  console.log(`Chats without Agent:      ${statistics.chatsWithoutAgent.toLocaleString()}`)
  console.log()

  // Summary
  console.log(`${colors.bold}${colors.cyan}📋 Issue Summary${colors.reset}`)
  console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`)
  console.log(`${colors.red}Errors:${colors.reset}    ${report.summary.errors}`)
  console.log(`${colors.yellow}Warnings:${colors.reset}  ${report.summary.warnings}`)
  console.log(`${colors.blue}Info:${colors.reset}      ${report.summary.infos}`)
  console.log(`${colors.bold}Total:${colors.reset}     ${report.summary.totalIssues}`)
  console.log()

  // Category Details
  for (const category of report.categories) {
    if (category.totalIssues === 0) {
      console.log(`${colors.bold}${colors.green}✓ ${category.category}${colors.reset} - No issues found`)
      continue
    }

    console.log(`${colors.bold}${colors.cyan}${category.category}${colors.reset}`)
    console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`)

    for (const issue of category.checks) {
      // Skip if severity filter doesn't match
      if (options.severity && issue.severity !== options.severity) {
        continue
      }

      const severityColor =
        issue.severity === 'error'
          ? colors.red
          : issue.severity === 'warning'
          ? colors.yellow
          : colors.blue

      const icon =
        issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ'

      console.log(
        `${severityColor}${icon} [${issue.severity.toUpperCase()}]${colors.reset} ${issue.message}`
      )
      console.log(`  ${colors.gray}Affected Records: ${issue.affectedRecords.toLocaleString()}${colors.reset}`)

      if (issue.recommendation) {
        console.log(`  ${colors.gray}Recommendation: ${issue.recommendation}${colors.reset}`)
      }

      if (issue.details && Object.keys(issue.details).length > 0) {
        console.log(`  ${colors.gray}Details: ${JSON.stringify(issue.details, null, 2).split('\n').join('\n  ')}${colors.reset}`)
      }

      console.log()
    }
  }

  console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`)
  console.log(`Report generated at: ${report.timestamp.toISOString()}`)
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs()

  try {
    const report = await runHealthCheck(options)

    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2))
    } else {
      formatConsoleReport(report, options)
    }

    // Save to file if output option is provided
    if (options.output) {
      const fs = await import('fs/promises')
      await fs.writeFile(options.output, JSON.stringify(report, null, 2))
      console.log(`\n${colors.green}✓${colors.reset} Report saved to ${options.output}`)
    }

    await prisma.$disconnect()

    // Exit with error code if unhealthy
    process.exit(report.overallStatus === 'unhealthy' ? 1 : 0)
  } catch (error) {
    console.error(`${colors.red}Error running health check:${colors.reset}`, error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
