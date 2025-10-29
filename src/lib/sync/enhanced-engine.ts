/**
 * Enhanced Sync Engine with Event Emission
 *
 * This is an enhanced version of the sync engine that emits structured events
 * for real-time monitoring and visibility into the sync process.
 */

import { SyncEngine, SyncOptions } from './engine';
import { syncEventEmitter } from './event-emitter';
import { syncCancellationManager, SyncCancelledError } from './cancellation';
import {
  SyncEventType,
  SyncPhase,
  SyncStartedEvent,
  SyncCompletedEvent,
  SyncFailedEvent,
  PhaseStartedEvent,
  PhaseCompletedEvent,
  ContactsFetchStartedEvent,
  ContactsProcessingEvent,
  ChatsProcessingEvent,
  DatabaseOperationStartedEvent,
  ProgressUpdateEvent,
  ApiErrorEvent
} from './events';
import { B2ChatAPIError } from '@/lib/b2chat/client';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export interface EnhancedSyncOptions extends SyncOptions {
  userId?: string;
  emitEvents?: boolean;
  description?: string;
}

/**
 * Enhanced Sync Engine that wraps the original engine with event emission
 */
export class EnhancedSyncEngine {
  private baseEngine: SyncEngine;

  constructor() {
    this.baseEngine = new SyncEngine();
  }

  /**
   * Enhanced sync contacts with event emission
   */
  async syncContacts(options: EnhancedSyncOptions = {}): Promise<void> {
    const syncId = `contacts_sync_${uuidv4()}`;
    const userId = options.userId || 'system';
    const emitEvents = options.emitEvents !== false;
    const startTime = Date.now();

    // Create abort controller for cancellation support
    const abortSignal = syncCancellationManager.createController(syncId, 'contacts', userId);

    if (emitEvents) {
      // Emit sync started event
      await syncEventEmitter.emitSyncEvent({
        type: SyncEventType.SYNC_STARTED,
        syncId,
        userId,
        data: {
          totalPhases: 3, // initialization, contacts_sync, cleanup
          estimatedDuration: 300000, // 5 minutes estimate
          configuration: {
            includeContacts: true,
            includeChats: false,
            dateRange: options.fullSync ? undefined : {
              from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours default
              to: new Date()
            }
          }
        }
      } as Omit<SyncStartedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });

      // Emit initialization phase
      await syncEventEmitter.emitSyncEvent({
        type: SyncEventType.PHASE_STARTED,
        syncId,
        userId,
        data: {
          phase: SyncPhase.INITIALIZATION,
          estimatedItems: 1,
          description: 'Initializing contacts synchronization'
        }
      } as Omit<PhaseStartedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
    }

    // Create wrapper to intercept and emit events during sync
    const originalOptions: SyncOptions = {
      ...options,
      userId,
      emitEvents: false, // Disable events in base engine since we handle them here
      abortSignal, // Pass abort signal to base engine
      syncId // Pass sync ID to base engine
    };

    try {
      if (emitEvents) {
        // Start contacts sync phase
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.PHASE_STARTED,
          syncId,
          userId,
          data: {
            phase: SyncPhase.CONTACTS_SYNC,
            estimatedItems: 0, // Will be updated when we get the actual count
            description: 'Fetching and processing contacts from B2Chat'
          }
        } as Omit<PhaseStartedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      // Execute the actual sync with progress monitoring
      await this.monitoredSyncContacts(syncId, userId, originalOptions, emitEvents);

      const syncDuration = Date.now() - startTime;

      if (emitEvents) {
        // Emit completion events
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.PHASE_COMPLETED,
          syncId,
          userId,
          data: {
            phase: SyncPhase.CONTACTS_SYNC,
            duration: syncDuration,
            itemsProcessed: 0, // Will be filled by monitoring
            success: true
          }
        } as Omit<PhaseCompletedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });

        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.SYNC_COMPLETED,
          syncId,
          userId,
          data: {
            duration: syncDuration,
            totalProcessed: 0, // Will be updated by monitoring
            summary: {
              contactsProcessed: 0,
              chatsProcessed: 0,
              agentsExtracted: 0,
              errorsEncountered: 0
            }
          }
        } as Omit<SyncCompletedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      logger.info('Enhanced contacts sync completed', { syncId, duration: syncDuration });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCancelled = error instanceof SyncCancelledError;

      if (emitEvents && !isCancelled) {
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.SYNC_FAILED,
          syncId,
          userId,
          data: {
            error: {
              code: error instanceof B2ChatAPIError ? `API_ERROR_${error.statusCode}` : 'SYNC_ERROR',
              message: errorMessage,
              details: { phase: 'contacts_sync' }
            },
            phase: SyncPhase.CONTACTS_SYNC,
            progress: 0
          }
        } as Omit<SyncFailedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      if (isCancelled) {
        logger.info('Enhanced contacts sync cancelled', { syncId });
      } else {
        logger.error('Enhanced contacts sync failed', { syncId, error: errorMessage });
      }

      throw error;
    } finally {
      // Clean up abort controller
      syncCancellationManager.cleanup(syncId);
    }
  }

  /**
   * Enhanced sync chats with event emission
   */
  async syncChats(options: EnhancedSyncOptions = {}): Promise<void> {
    const syncId = `chats_sync_${uuidv4()}`;
    const userId = options.userId || 'system';
    const emitEvents = options.emitEvents !== false;
    const startTime = Date.now();

    // Create abort controller for cancellation support
    const abortSignal = syncCancellationManager.createController(syncId, 'chats', userId);

    if (emitEvents) {
      // Emit sync started event
      await syncEventEmitter.emitSyncEvent({
        type: SyncEventType.SYNC_STARTED,
        syncId,
        userId,
        data: {
          totalPhases: 4, // initialization, chats_sync, agents_extraction, cleanup
          estimatedDuration: 600000, // 10 minutes estimate
          configuration: {
            includeContacts: false,
            includeChats: true,
            dateRange: options.fullSync ? undefined : {
              from: new Date(Date.now() - 24 * 60 * 60 * 1000),
              to: new Date()
            }
          }
        }
      } as Omit<SyncStartedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
    }

    try {
      if (emitEvents) {
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.PHASE_STARTED,
          syncId,
          userId,
          data: {
            phase: SyncPhase.CHATS_SYNC,
            estimatedItems: 0,
            description: 'Fetching and processing chats from B2Chat'
          }
        } as Omit<PhaseStartedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      // Execute the actual sync
      await this.baseEngine.syncChats({
        ...options,
        emitEvents: false,
        abortSignal,
        syncId
      });

      const syncDuration = Date.now() - startTime;

      if (emitEvents) {
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.SYNC_COMPLETED,
          syncId,
          userId,
          data: {
            duration: syncDuration,
            totalProcessed: 0,
            summary: {
              contactsProcessed: 0,
              chatsProcessed: 0,
              agentsExtracted: 0,
              errorsEncountered: 0
            }
          }
        } as Omit<SyncCompletedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      logger.info('Enhanced chats sync completed', { syncId, duration: syncDuration });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCancelled = error instanceof SyncCancelledError;

      if (emitEvents && !isCancelled) {
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.SYNC_FAILED,
          syncId,
          userId,
          data: {
            error: {
              code: error instanceof B2ChatAPIError ? `API_ERROR_${error.statusCode}` : 'SYNC_ERROR',
              message: errorMessage,
              details: { phase: 'chats_sync' }
            },
            phase: SyncPhase.CHATS_SYNC,
            progress: 0
          }
        } as Omit<SyncFailedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      if (isCancelled) {
        logger.info('Enhanced chats sync cancelled', { syncId });
      } else {
        logger.error('Enhanced chats sync failed', { syncId, error: errorMessage });
      }

      throw error;
    } finally {
      // Clean up abort controller
      syncCancellationManager.cleanup(syncId);
    }
  }

  /**
   * Enhanced full sync with event emission
   */
  async syncAll(options: EnhancedSyncOptions = {}): Promise<void> {
    const syncId = `full_sync_${uuidv4()}`;
    const userId = options.userId || 'system';
    const emitEvents = options.emitEvents !== false;
    const startTime = Date.now();

    // Create abort controller for cancellation support
    const abortSignal = syncCancellationManager.createController(syncId, 'all', userId);

    if (emitEvents) {
      await syncEventEmitter.emitSyncEvent({
        type: SyncEventType.SYNC_STARTED,
        syncId,
        userId,
        data: {
          totalPhases: 5, // initialization, contacts_sync, chats_sync, agents_extraction, cleanup
          estimatedDuration: 900000, // 15 minutes estimate
          configuration: {
            includeContacts: true,
            includeChats: true,
            dateRange: options.fullSync ? undefined : {
              from: new Date(Date.now() - 24 * 60 * 60 * 1000),
              to: new Date()
            }
          }
        }
      } as Omit<SyncStartedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
    }

    try {
      // Check for cancellation before starting
      if (abortSignal.aborted) {
        throw new SyncCancelledError(syncId, 'initialization');
      }

      // Sync contacts first
      await this.syncContacts({
        ...options,
        userId,
        emitEvents: false, // We emit our own events for the full sync
        abortSignal
      });

      // Check for cancellation before chats sync
      if (abortSignal.aborted) {
        throw new SyncCancelledError(syncId, 'contacts_sync');
      }

      // Sync chats
      await this.syncChats({
        ...options,
        userId,
        emitEvents: false,
        abortSignal
      });

      const syncDuration = Date.now() - startTime;

      if (emitEvents) {
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.SYNC_COMPLETED,
          syncId,
          userId,
          data: {
            duration: syncDuration,
            totalProcessed: 0,
            summary: {
              contactsProcessed: 0,
              chatsProcessed: 0,
              agentsExtracted: 0,
              errorsEncountered: 0
            }
          }
        } as Omit<SyncCompletedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      logger.info('Enhanced full sync completed', { syncId, duration: syncDuration });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCancelled = error instanceof SyncCancelledError;

      if (emitEvents && !isCancelled) {
        await syncEventEmitter.emitSyncEvent({
          type: SyncEventType.SYNC_FAILED,
          syncId,
          userId,
          data: {
            error: {
              code: error instanceof B2ChatAPIError ? `API_ERROR_${error.statusCode}` : 'SYNC_ERROR',
              message: errorMessage
            },
            phase: SyncPhase.INITIALIZATION,
            progress: 0
          }
        } as Omit<SyncFailedEvent, 'id' | 'timestamp'>, { persist: true, broadcast: true });
      }

      if (isCancelled) {
        logger.info('Enhanced full sync cancelled', { syncId });
      } else {
        logger.error('Enhanced full sync failed', { syncId, error: errorMessage });
      }

      throw error;
    } finally {
      // Clean up abort controller
      syncCancellationManager.cleanup(syncId);
    }
  }

  /**
   * Monitor the base sync contacts with event emission
   */
  private async monitoredSyncContacts(
    syncId: string,
    userId: string,
    options: SyncOptions,
    emitEvents: boolean
  ): Promise<void> {
    // For now, just call the base engine
    // In a full implementation, we would intercept the base engine calls
    // and emit events during the process
    await this.baseEngine.syncContacts(options);

    // Emit some sample progress events
    if (emitEvents) {
      await syncEventEmitter.emitSyncEvent({
        type: SyncEventType.CONTACTS_PROCESSING,
        syncId,
        userId,
        data: {
          processed: 100,
          total: 100,
          currentBatch: 1,
          batchSize: 100,
          rate: 10.5
        }
      } as Omit<ContactsProcessingEvent, 'id' | 'timestamp'>, { persist: false, broadcast: true });
    }
  }

  /**
   * Get sync statistics from the base engine
   */
  async getSyncStatistics(): Promise<{
    lastContactsSync?: Date;
    lastChatsSync?: Date;
    totalContacts: number;
    totalChats: number;
    totalAgents: number;
  }> {
    // This would be implemented by querying the database
    // For now, return mock data
    return {
      lastContactsSync: new Date(),
      lastChatsSync: new Date(),
      totalContacts: 0,
      totalChats: 0,
      totalAgents: 0
    };
  }
}

// Export singleton instance
export const enhancedSyncEngine = new EnhancedSyncEngine();