import { prisma } from '@/lib/prisma'
import { SyncState } from '@prisma/client'

export type EntityType = 'agents' | 'contacts' | 'chats' | 'messages'

export class SyncStateManager {
  static async getLastSync(entityType: EntityType): Promise<SyncState | null> {
    return await prisma.syncState.findUnique({
      where: { entityType }
    })
  }

  static async updateSyncState(
    entityType: EntityType,
    data: {
      lastSyncTimestamp?: Date
      lastSyncedId?: string
      lastSyncOffset?: number
      syncStatus?: string
    }
  ): Promise<void> {
    await prisma.syncState.upsert({
      where: { entityType },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        id: `sync_state_${entityType}`,
        entityType,
        syncStatus: data.syncStatus || 'pending',
        lastSyncTimestamp: data.lastSyncTimestamp,
        lastSyncedId: data.lastSyncedId,
        lastSyncOffset: data.lastSyncOffset,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  static async createCheckpoint(
    syncId: string,
    entityType: EntityType,
    totalRecords?: number
  ) {
    return await prisma.syncCheckpoint.create({
      data: {
        id: `checkpoint_${syncId}_${Date.now()}`,
        syncId,
        entityType,
        totalRecords,
        status: 'running',
      },
    })
  }

  static async updateCheckpoint(
    checkpointId: string,
    data: {
      totalRecords?: number
      processedRecords?: number
      successfulRecords?: number
      failedRecords?: number
      failureDetails?: any
      checkpoint?: string
      status?: 'running' | 'completed' | 'failed' | 'partial'
      completedAt?: Date
    }
  ) {
    await prisma.syncCheckpoint.update({
      where: { id: checkpointId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })
  }
}