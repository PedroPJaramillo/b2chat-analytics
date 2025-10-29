/**
 * Sync Cancellation Manager
 *
 * Provides centralized management of sync operation cancellation using AbortController.
 * Allows graceful shutdown of long-running sync operations with proper cleanup.
 */

import { logger } from '@/lib/logger';

export class SyncCancelledError extends Error {
  constructor(
    public readonly syncId: string,
    public readonly phase?: string,
    public readonly progress?: {
      processed: number;
      total?: number;
    }
  ) {
    super(`Sync operation cancelled: ${syncId}`);
    this.name = 'SyncCancelledError';
  }
}

/**
 * Manages AbortControllers for sync operations
 */
export class SyncCancellationManager {
  private controllers = new Map<string, AbortController>();
  private metadata = new Map<string, {
    startTime: Date;
    userId?: string;
    entityType: string;
  }>();

  /**
   * Create a new abort controller for a sync operation
   */
  createController(syncId: string, entityType: string, userId?: string): AbortSignal {
    // Clean up any existing controller for this sync ID
    if (this.controllers.has(syncId)) {
      logger.warn('Overwriting existing abort controller', { syncId });
      this.cleanup(syncId);
    }

    const controller = new AbortController();
    this.controllers.set(syncId, controller);
    this.metadata.set(syncId, {
      startTime: new Date(),
      userId,
      entityType
    });

    logger.debug('Created abort controller for sync', {
      syncId,
      entityType,
      userId
    });

    return controller.signal;
  }

  /**
   * Cancel a sync operation
   * @returns true if sync was cancelled, false if not found or already completed
   */
  cancelSync(syncId: string, reason?: string): boolean {
    const controller = this.controllers.get(syncId);

    if (!controller) {
      logger.warn('Attempt to cancel unknown sync', { syncId });
      return false;
    }

    if (controller.signal.aborted) {
      logger.info('Sync already cancelled', { syncId });
      return false;
    }

    const metadata = this.metadata.get(syncId);

    logger.info('Cancelling sync operation', {
      syncId,
      entityType: metadata?.entityType,
      userId: metadata?.userId,
      reason: reason || 'User requested',
      duration: metadata ? Date.now() - metadata.startTime.getTime() : undefined
    });

    controller.abort(reason || 'User requested cancellation');

    return true;
  }

  /**
   * Cancel all active syncs
   * @returns number of syncs cancelled
   */
  cancelAll(reason?: string): number {
    let cancelled = 0;

    for (const syncId of this.controllers.keys()) {
      if (this.cancelSync(syncId, reason)) {
        cancelled++;
      }
    }

    logger.info('Cancelled all active syncs', { count: cancelled, reason });

    return cancelled;
  }

  /**
   * Check if a sync is active (controller exists and not aborted)
   */
  isActive(syncId: string): boolean {
    const controller = this.controllers.get(syncId);
    return controller !== undefined && !controller.signal.aborted;
  }

  /**
   * Check if a sync was cancelled
   */
  isCancelled(syncId: string): boolean {
    const controller = this.controllers.get(syncId);
    return controller?.signal.aborted || false;
  }

  /**
   * Get abort signal for a sync (if exists)
   */
  getSignal(syncId: string): AbortSignal | undefined {
    return this.controllers.get(syncId)?.signal;
  }

  /**
   * Get metadata for a sync operation
   */
  getMetadata(syncId: string) {
    return this.metadata.get(syncId);
  }

  /**
   * Get all active sync IDs
   */
  getActiveSyncIds(): string[] {
    return Array.from(this.controllers.keys()).filter(syncId => this.isActive(syncId));
  }

  /**
   * Get count of active syncs
   */
  getActiveCount(): number {
    return this.getActiveSyncIds().length;
  }

  /**
   * Clean up a sync controller (should be called when sync completes or fails)
   */
  cleanup(syncId: string): void {
    const controller = this.controllers.get(syncId);

    if (controller) {
      this.controllers.delete(syncId);
      this.metadata.delete(syncId);

      logger.debug('Cleaned up abort controller', { syncId });
    }
  }

  /**
   * Clean up all controllers (for shutdown/testing)
   */
  cleanupAll(): void {
    const count = this.controllers.size;
    this.controllers.clear();
    this.metadata.clear();

    logger.debug('Cleaned up all abort controllers', { count });
  }

  /**
   * Check abort signal and throw if cancelled
   */
  checkCancellation(signal?: AbortSignal, syncId?: string, context?: string): void {
    if (signal?.aborted) {
      const message = context
        ? `Sync cancelled during ${context}`
        : 'Sync cancelled';

      logger.info(message, { syncId, context });

      throw new SyncCancelledError(
        syncId || 'unknown',
        context
      );
    }
  }
}

// Export singleton instance
export const syncCancellationManager = new SyncCancellationManager();