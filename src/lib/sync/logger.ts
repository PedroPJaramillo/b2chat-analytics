import { prisma } from '@/lib/prisma'
import { logger as consoleLogger } from '@/lib/logger'

export class SyncLogger {
  private syncId: string
  private userId: string
  private entityType: string
  private operation: string
  private startTime: Date

  constructor(syncId: string, userId: string, entityType: string, operation: string) {
    this.syncId = syncId
    this.userId = userId
    this.entityType = entityType
    this.operation = operation
    this.startTime = new Date()
  }

  static async createSyncLogger(syncId: string, userId: string, entityType: string, operation: string): Promise<SyncLogger> {
    const syncLogger = new SyncLogger(syncId, userId, entityType, operation)

    // Create initial SyncLog entry
    await prisma.syncLog.create({
      data: {
        id: syncId,
        userId,
        entityType,
        operation,
        recordCount: 0,
        status: 'started',
        startedAt: syncLogger.startTime,
        metadata: {
          operation_id: syncId
        }
      }
    })

    consoleLogger.info(`Starting ${operation} for ${entityType}`, {
      syncId,
      userId,
      entityType,
      operation
    })

    return syncLogger
  }

  async updateProgress(recordCount: number, metadata?: any): Promise<void> {
    await prisma.syncLog.update({
      where: { id: this.syncId },
      data: {
        recordCount,
        status: 'running',
        metadata: {
          operation_id: this.syncId,
          progress: metadata?.progress,
          processed: metadata?.processed,
          successful: metadata?.successful,
          failed: metadata?.failed,
          ...metadata
        }
      }
    })

    consoleLogger.info(`${this.operation} progress for ${this.entityType}`, {
      syncId: this.syncId,
      recordCount,
      ...metadata
    })
  }

  async complete(recordCount: number, metadata?: any): Promise<void> {
    const completedAt = new Date()

    await prisma.syncLog.update({
      where: { id: this.syncId },
      data: {
        recordCount,
        status: 'completed',
        completedAt,
        metadata: {
          operation_id: this.syncId,
          duration: completedAt.getTime() - this.startTime.getTime(),
          ...metadata
        }
      }
    })

    consoleLogger.info(`${this.operation} completed for ${this.entityType}`, {
      syncId: this.syncId,
      recordCount,
      duration: completedAt.getTime() - this.startTime.getTime(),
      ...metadata
    })
  }

  async fail(errorMessage: string, recordCount: number = 0, metadata?: any): Promise<void> {
    const completedAt = new Date()

    await prisma.syncLog.update({
      where: { id: this.syncId },
      data: {
        recordCount,
        status: 'failed',
        completedAt,
        errorMessage,
        metadata: {
          operation_id: this.syncId,
          duration: completedAt.getTime() - this.startTime.getTime(),
          error: errorMessage,
          ...metadata
        }
      }
    })

    consoleLogger.error(`${this.operation} failed for ${this.entityType}`, {
      syncId: this.syncId,
      error: errorMessage,
      recordCount,
      duration: completedAt.getTime() - this.startTime.getTime(),
      ...metadata
    })
  }

  // Static method to get a default user ID for system operations
  static async getSystemUserId(): Promise<string> {
    // Try to find an admin user, or create a system user entry
    const adminUser = await prisma.user.findFirst({
      where: { role: 'Admin' }
    })

    if (adminUser) {
      return adminUser.id
    }

    // If no admin user exists, we could create a system user
    // For now, we'll use a default system ID
    return 'system'
  }
}