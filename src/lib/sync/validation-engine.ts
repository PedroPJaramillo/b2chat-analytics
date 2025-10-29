import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

export interface ValidationIssue {
  validationName: string
  severity: 'error' | 'warning' | 'info'
  affectedRecords: number
  details: any
}

export interface ValidationReport {
  syncId: string
  transformId?: string
  entityType: string
  totalIssues: number
  errors: number
  warnings: number
  infos: number
  issues: ValidationIssue[]
  createdAt: Date
}

export class ValidationEngine {
  /**
   * Run all validations for a transform operation
   */
  async validateTransform(
    transformId: string,
    entityType: 'contacts' | 'chats'
  ): Promise<ValidationReport> {
    const syncId = `validation_${transformId}_${Date.now()}`
    const issues: ValidationIssue[] = []

    logger.info('Starting validation', { syncId, transformId, entityType })

    try {
      if (entityType === 'chats') {
        // Chat-specific validations
        issues.push(...(await this.validateChatTimelines()))
        issues.push(...(await this.validateChatStatusConsistency()))
        issues.push(...(await this.validateMessageContinuity()))
        issues.push(...(await this.validateRelationshipIntegrity()))
        issues.push(...(await this.validateSurveyConsistency())) // Feature 001: Survey validation
      } else if (entityType === 'contacts') {
        // Contact-specific validations
        issues.push(...(await this.validateContactDataQuality()))
      }

      // Save validation results
      for (const issue of issues) {
        await prisma.syncValidationResult.create({
          data: {
            id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            syncId,
            transformId,
            entityType,
            validationName: issue.validationName,
            severity: issue.severity,
            affectedRecords: issue.affectedRecords,
            details: issue.details,
          },
        })
      }

      const report: ValidationReport = {
        syncId,
        transformId,
        entityType,
        totalIssues: issues.length,
        errors: issues.filter((i) => i.severity === 'error').length,
        warnings: issues.filter((i) => i.severity === 'warning').length,
        infos: issues.filter((i) => i.severity === 'info').length,
        issues,
        createdAt: new Date(),
      }

      logger.info('Validation completed', {
        syncId,
        totalIssues: report.totalIssues,
        errors: report.errors,
        warnings: report.warnings,
      })

      return report
    } catch (error) {
      logger.error('Validation failed', {
        syncId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Validate chat timeline consistency (Feature 001: Updated for 8-status lifecycle)
   *
   * Valid lifecycle:
   * createdAt <= openedAt <= pickedUpAt <= responseAt <= (closedAt | pollStartedAt)
   *
   * For survey chats:
   * pollStartedAt <= (pollCompletedAt | pollAbandonedAt)
   */
  private async validateChatTimelines(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []

    try {
      // Find chats with invalid timeline
      const invalidChats = await prisma.chat.findMany({
        where: {
          OR: [
            // openedAt before createdAt
            {
              AND: [
                { openedAt: { not: null } },
                { openedAt: { lt: prisma.chat.fields.createdAt } },
              ],
            },
            // closedAt without closed status (CLOSED, COMPLETED_POLL, ABANDONED_POLL)
            {
              AND: [
                { closedAt: { not: null } },
                { status: { notIn: ['CLOSED', 'COMPLETED_POLL', 'ABANDONED_POLL'] } },
              ],
            },
            // CLOSED status without closedAt (unless transitioning to survey)
            {
              AND: [
                { status: 'CLOSED' },
                { closedAt: null },
                { pollStartedAt: null },
              ],
            },
          ],
        },
        select: {
          id: true,
          b2chatId: true,
          status: true,
          createdAt: true,
          openedAt: true,
          pickedUpAt: true,
          responseAt: true,
          closedAt: true,
          pollStartedAt: true,
          pollCompletedAt: true,
          pollAbandonedAt: true,
        },
      })

      if (invalidChats.length > 0) {
        issues.push({
          validationName: 'chat_timeline_consistency',
          severity: 'error',
          affectedRecords: invalidChats.length,
          details: {
            message: 'Chats with inconsistent timeline timestamps (8-status lifecycle)',
            samples: invalidChats.slice(0, 5).map((chat) => ({
              chatId: chat.id,
              b2chatId: chat.b2chatId,
              status: chat.status,
              timestamps: {
                created: chat.createdAt,
                opened: chat.openedAt,
                pickedUp: chat.pickedUpAt,
                response: chat.responseAt,
                closed: chat.closedAt,
                pollStarted: chat.pollStartedAt,
                pollCompleted: chat.pollCompletedAt,
                pollAbandoned: chat.pollAbandonedAt,
              },
            })),
          },
        })
      }
    } catch (error) {
      logger.error('Failed to validate chat timelines', {
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }

    return issues
  }

  /**
   * Validate chat status consistency
   */
  private async validateChatStatusConsistency(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []

    try {
      // Find chats that are "open" but have closedAt timestamp
      const openWithClosedAt = await prisma.chat.count({
        where: {
          status: 'open',
          closedAt: { not: null },
        },
      })

      if (openWithClosedAt > 0) {
        issues.push({
          validationName: 'chat_status_open_with_closed_timestamp',
          severity: 'warning',
          affectedRecords: openWithClosedAt,
          details: {
            message: 'Chats marked as open but have closedAt timestamp',
          },
        })
      }

      // Find chats that are "closed" but no closedAt timestamp
      const closedWithoutTimestamp = await prisma.chat.count({
        where: {
          status: 'closed',
          closedAt: null,
        },
      })

      if (closedWithoutTimestamp > 0) {
        issues.push({
          validationName: 'chat_status_closed_without_timestamp',
          severity: 'error',
          affectedRecords: closedWithoutTimestamp,
          details: {
            message: 'Chats marked as closed but missing closedAt timestamp',
          },
        })
      }

      // Find long-running open chats (>7 days without messages)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const staleOpenChats = await prisma.chat.count({
        where: {
          status: 'open',
          createdAt: { lt: sevenDaysAgo },
          messages: {
            none: {
              timestamp: { gte: sevenDaysAgo },
            },
          },
        },
      })

      if (staleOpenChats > 0) {
        issues.push({
          validationName: 'chat_status_stale_open',
          severity: 'warning',
          affectedRecords: staleOpenChats,
          details: {
            message: 'Open chats with no messages in the last 7 days',
          },
        })
      }
    } catch (error) {
      logger.error('Failed to validate chat status consistency', {
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }

    return issues
  }

  /**
   * Validate message continuity within chats
   */
  private async validateMessageContinuity(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []

    try {
      // Find chats with large gaps between messages (>24h for open chats)
      const chatsWithGaps = await prisma.$queryRaw<
        Array<{ chat_id: string; max_gap_hours: number }>
      >`
        WITH message_gaps AS (
          SELECT
            chat_id,
            timestamp,
            LEAD(timestamp) OVER (PARTITION BY chat_id ORDER BY timestamp) as next_timestamp,
            EXTRACT(EPOCH FROM (LEAD(timestamp) OVER (PARTITION BY chat_id ORDER BY timestamp) - timestamp)) / 3600 as gap_hours
          FROM messages
        )
        SELECT
          chat_id,
          MAX(gap_hours) as max_gap_hours
        FROM message_gaps
        WHERE gap_hours > 24
        GROUP BY chat_id
        HAVING COUNT(*) > 0
      `

      if (chatsWithGaps.length > 0) {
        issues.push({
          validationName: 'message_continuity_gaps',
          severity: 'info',
          affectedRecords: chatsWithGaps.length,
          details: {
            message: 'Chats with message gaps exceeding 24 hours',
            maxGap: Math.max(...chatsWithGaps.map((c) => Number(c.max_gap_hours))),
          },
        })
      }
    } catch (error) {
      logger.error('Failed to validate message continuity', {
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }

    return issues
  }

  /**
   * Validate relationship integrity (foreign keys)
   */
  private async validateRelationshipIntegrity(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []

    try {
      // Find chats with invalid contactId
      const chatsWithInvalidContact = await prisma.chat.count({
        where: {
          contactId: { not: null },
          contact: null,
        },
      })

      if (chatsWithInvalidContact > 0) {
        issues.push({
          validationName: 'relationship_invalid_contact',
          severity: 'error',
          affectedRecords: chatsWithInvalidContact,
          details: {
            message: 'Chats reference non-existent contacts',
          },
        })
      }

      // Find chats with invalid agentId
      const chatsWithInvalidAgent = await prisma.chat.count({
        where: {
          agentId: { not: null },
          agent: { is: null },
        },
      })

      if (chatsWithInvalidAgent > 0) {
        issues.push({
          validationName: 'relationship_invalid_agent',
          severity: 'error',
          affectedRecords: chatsWithInvalidAgent,
          details: {
            message: 'Chats reference non-existent agents',
          },
        })
      }

      // Find messages with invalid chatId (orphaned messages)
      const orphanedMessagesResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "messages" m
        LEFT JOIN "chats" c ON c.id = m.chat_id
        WHERE c.id IS NULL
      `
      const orphanedMessages = Number(orphanedMessagesResult[0]?.count ?? 0)

      if (orphanedMessages > 0) {
        issues.push({
          validationName: 'relationship_orphaned_messages',
          severity: 'error',
          affectedRecords: orphanedMessages,
          details: {
            message: 'Messages reference non-existent chats',
          },
        })
      }
    } catch (error) {
      logger.error('Failed to validate relationship integrity', {
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }

    return issues
  }

  /**
   * Validate contact data quality
   */
  private async validateContactDataQuality(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []

    try {
      // Find contacts with no contact information (no mobile, email, or identification)
      const contactsWithNoInfo = await prisma.contact.count({
        where: {
          AND: [
            { mobile: null },
            { email: null },
            { identification: null },
          ],
        },
      })

      if (contactsWithNoInfo > 0) {
        issues.push({
          validationName: 'contact_missing_info',
          severity: 'warning',
          affectedRecords: contactsWithNoInfo,
          details: {
            message: 'Contacts with no mobile, email, or identification',
          },
        })
      }

      // Find contacts with invalid email format (simple check)
      const contactsWithInvalidEmail = await prisma.contact.count({
        where: {
          email: {
            not: null,
            notIn: [''],
          },
          NOT: {
            email: {
              contains: '@',
            },
          },
        },
      })

      if (contactsWithInvalidEmail > 0) {
        issues.push({
          validationName: 'contact_invalid_email',
          severity: 'warning',
          affectedRecords: contactsWithInvalidEmail,
          details: {
            message: 'Contacts with invalid email format',
          },
        })
      }
    } catch (error) {
      logger.error('Failed to validate contact data quality', {
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }

    return issues
  }

  /**
   * Validate survey field consistency (Feature 001: Full Status Support)
   *
   * Checks:
   * - COMPLETING_POLL status must have pollStartedAt
   * - COMPLETED_POLL status must have pollStartedAt and pollCompletedAt
   * - ABANDONED_POLL status must have pollStartedAt and pollAbandonedAt
   * - pollCompletedAt should not coexist with pollAbandonedAt
   * - pollResponse should only exist for COMPLETED_POLL status
   */
  private async validateSurveyConsistency(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []

    try {
      // COMPLETING_POLL without pollStartedAt
      const completingWithoutStart = await prisma.chat.count({
        where: {
          status: 'COMPLETING_POLL',
          pollStartedAt: null,
        },
      })

      if (completingWithoutStart > 0) {
        issues.push({
          validationName: 'survey_completing_without_start',
          severity: 'error',
          affectedRecords: completingWithoutStart,
          details: {
            message: 'Chats in COMPLETING_POLL status missing pollStartedAt timestamp',
          },
        })
      }

      // COMPLETED_POLL without required fields
      const completedWithoutFields = await prisma.chat.count({
        where: {
          status: 'COMPLETED_POLL',
          OR: [
            { pollStartedAt: null },
            { pollCompletedAt: null },
          ],
        },
      })

      if (completedWithoutFields > 0) {
        issues.push({
          validationName: 'survey_completed_missing_timestamps',
          severity: 'error',
          affectedRecords: completedWithoutFields,
          details: {
            message: 'Chats in COMPLETED_POLL status missing required timestamp fields',
          },
        })
      }

      // ABANDONED_POLL without required fields
      const abandonedWithoutFields = await prisma.chat.count({
        where: {
          status: 'ABANDONED_POLL',
          OR: [
            { pollStartedAt: null },
            { pollAbandonedAt: null },
          ],
        },
      })

      if (abandonedWithoutFields > 0) {
        issues.push({
          validationName: 'survey_abandoned_missing_timestamps',
          severity: 'error',
          affectedRecords: abandonedWithoutFields,
          details: {
            message: 'Chats in ABANDONED_POLL status missing required timestamp fields',
          },
        })
      }

      // Chats with both completed and abandoned timestamps (invalid state)
      const bothCompletedAndAbandoned = await prisma.chat.count({
        where: {
          pollCompletedAt: { not: null },
          pollAbandonedAt: { not: null },
        },
      })

      if (bothCompletedAndAbandoned > 0) {
        issues.push({
          validationName: 'survey_both_completed_and_abandoned',
          severity: 'error',
          affectedRecords: bothCompletedAndAbandoned,
          details: {
            message: 'Chats have both pollCompletedAt and pollAbandonedAt (invalid state)',
          },
        })
      }

      // pollResponse without COMPLETED_POLL status
      const responseWithoutCompletedStatus = await prisma.chat.count({
        where: {
          pollResponse: { not: Prisma.DbNull },
          status: { not: 'COMPLETED_POLL' },
        },
      })

      if (responseWithoutCompletedStatus > 0) {
        issues.push({
          validationName: 'survey_response_without_completed_status',
          severity: 'warning',
          affectedRecords: responseWithoutCompletedStatus,
          details: {
            message: 'Chats have pollResponse but are not in COMPLETED_POLL status',
          },
        })
      }

      // Survey timeout validation - COMPLETING_POLL for more than 24 hours
      const surveyTimeout = await prisma.chat.count({
        where: {
          status: 'COMPLETING_POLL',
          pollStartedAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      })

      if (surveyTimeout > 0) {
        issues.push({
          validationName: 'survey_timeout_not_marked_abandoned',
          severity: 'warning',
          affectedRecords: surveyTimeout,
          details: {
            message: 'Chats in COMPLETING_POLL for more than 24 hours (should be marked ABANDONED_POLL)',
          },
        })
      }
    } catch (error) {
      logger.error('Failed to validate survey consistency', {
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }

    return issues
  }
}
