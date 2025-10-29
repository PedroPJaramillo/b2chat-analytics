import { prisma } from './prisma'
import { logger } from './logger-pino'
import { auditLogger } from './audit'

/**
 * Log Cleanup Service
 *
 * Handles automatic cleanup of old error logs and audit logs
 * based on retention policies defined in environment variables.
 */

export class LogCleanupService {
  private static instance: LogCleanupService
  private cleanupInterval: NodeJS.Timeout | null = null
  private retentionDays: number

  private constructor() {
    this.retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '90')
  }

  public static getInstance(): LogCleanupService {
    if (!LogCleanupService.instance) {
      LogCleanupService.instance = new LogCleanupService()
    }
    return LogCleanupService.instance
  }

  /**
   * Start automatic cleanup job
   * Runs daily at 2 AM
   */
  public start(): void {
    if (this.cleanupInterval) {
      logger.warn('Log cleanup service already running')
      return
    }

    logger.info('Starting log cleanup service', {
      retentionDays: this.retentionDays,
      source: 'log-cleanup'
    })

    // Run cleanup daily
    const oneDayMs = 24 * 60 * 60 * 1000
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        logger.error('Scheduled log cleanup failed', {
          error: error instanceof Error ? error.message : String(error),
          source: 'log-cleanup'
        })
      })
    }, oneDayMs)

    // Run initial cleanup
    this.runCleanup().catch(error => {
      logger.error('Initial log cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'log-cleanup'
      })
    })
  }

  /**
   * Stop automatic cleanup job
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      logger.info('Log cleanup service stopped', { source: 'log-cleanup' })
    }
  }

  /**
   * Run cleanup manually
   */
  public async runCleanup(): Promise<{
    errorLogsDeleted: number
    auditLogsDeleted: number
  }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays)

    logger.info('Running log cleanup', {
      cutoffDate: cutoffDate.toISOString(),
      retentionDays: this.retentionDays,
      source: 'log-cleanup'
    })

    try {
      // Cleanup error logs
      const errorLogsResult = await prisma.errorLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      })

      // Cleanup audit logs
      const auditLogsDeleted = await auditLogger.cleanupOldLogs(cutoffDate)

      logger.info('Log cleanup completed', {
        errorLogsDeleted: errorLogsResult.count,
        auditLogsDeleted,
        cutoffDate: cutoffDate.toISOString(),
        source: 'log-cleanup'
      })

      return {
        errorLogsDeleted: errorLogsResult.count,
        auditLogsDeleted
      }
    } catch (error) {
      logger.error('Log cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'log-cleanup'
      })
      throw error
    }
  }

  /**
   * Get cleanup statistics
   */
  public async getStats(): Promise<{
    totalErrorLogs: number
    totalAuditLogs: number
    oldestErrorLog?: Date
    oldestAuditLog?: Date
  }> {
    try {
      const [totalErrorLogs, totalAuditLogs, oldestError, oldestAudit] = await Promise.all([
        prisma.errorLog.count(),
        prisma.auditLog.count(),
        prisma.errorLog.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true }
        }),
        prisma.auditLog.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true }
        })
      ])

      return {
        totalErrorLogs,
        totalAuditLogs,
        oldestErrorLog: oldestError?.createdAt,
        oldestAuditLog: oldestAudit?.createdAt
      }
    } catch (error) {
      logger.error('Failed to get cleanup stats', {
        error: error instanceof Error ? error.message : String(error),
        source: 'log-cleanup'
      })
      return {
        totalErrorLogs: 0,
        totalAuditLogs: 0
      }
    }
  }
}

// Export singleton instance
export const logCleanupService = LogCleanupService.getInstance()
