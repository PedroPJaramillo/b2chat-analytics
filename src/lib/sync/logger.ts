import { prisma } from '@/lib/prisma'
import { logger as consoleLogger } from '@/lib/logger'
import { ensureSystemUserExists, getUserContext } from '@/lib/user-management'

export class SyncLogger {
  private syncId: string
  private userId: string
  private entityType: string
  private operation: string
  private startTime: Date
  private correlationId?: string

  constructor(syncId: string, userId: string, entityType: string, operation: string, correlationId?: string) {
    this.syncId = syncId
    this.userId = userId
    this.entityType = entityType
    this.operation = operation
    this.startTime = new Date()
    this.correlationId = correlationId
  }

  static async createSyncLogger(syncId: string, userId: string, entityType: string, operation: string, correlationId?: string): Promise<SyncLogger> {
    const syncLogger = new SyncLogger(syncId, userId, entityType, operation, correlationId)

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
          operation_id: syncId,
          correlation_id: correlationId
        }
      }
    })

    consoleLogger.info(`Starting ${operation} for ${entityType}`, {
      syncId,
      userId,
      entityType,
      operation,
      correlationId,
      source: 'sync'
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
      correlationId: this.correlationId,
      source: 'sync',
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
      correlationId: this.correlationId,
      source: 'sync',
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
      correlationId: this.correlationId,
      source: 'sync',
      ...metadata
    })
  }

  // Static method to get a default user ID for system operations
  static async getSystemUserId(): Promise<string> {
    try {
      // Ensure system user exists and return its ID
      return await ensureSystemUserExists();
    } catch (error) {
      consoleLogger.error('Failed to get system user ID', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback to hardcoded system ID
      return 'system';
    }
  }

  // Static method to get user context (current user or system user)
  static async getUserContextId(): Promise<string> {
    try {
      const { userId } = await getUserContext();
      return userId;
    } catch (error) {
      consoleLogger.error('Failed to get user context', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback to system user
      return await SyncLogger.getSystemUserId();
    }
  }
}