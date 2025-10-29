/**
 * Sync Event Emitter - Central event management for sync operations
 *
 * Provides type-safe event emission and subscription with persistence,
 * broadcasting, and audit logging capabilities.
 */

import { EventEmitter } from 'events';
import {
  SyncEvent,
  SyncEventListener,
  SyncEventType,
  SyncEventFilter,
  EventEmissionOptions,
  SyncState,
  SyncStatus,
  SyncPhase
} from './events';
import { auditLogger, AuditEventType } from '../audit';
import { v4 as uuidv4 } from 'uuid';

class SyncEventEmitter extends EventEmitter {
  private syncStates = new Map<string, SyncState>();
  private eventHistory: SyncEvent[] = [];
  private maxHistorySize = 1000;
  private sseClients = new Set<{
    response: Response;
    controller: ReadableStreamDefaultController;
    filter?: SyncEventFilter;
  }>();

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many SSE connections
  }

  /**
   * Emit a sync event with optional persistence and broadcasting
   */
  async emitSyncEvent(
    event: Omit<SyncEvent, 'id' | 'timestamp'>,
    options: EventEmissionOptions = {}
  ): Promise<void> {
    const fullEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
    } as SyncEvent;

    // Update sync state
    this.updateSyncState(fullEvent);

    // Add to history
    this.addToHistory(fullEvent);

    // Emit to Node.js event listeners
    this.emit(event.type, fullEvent);
    this.emit('*', fullEvent);

    // Persist to audit log if requested
    if (options.persist !== false) {
      await this.persistEvent(fullEvent, options.level);
    }

    // Broadcast to SSE clients if requested
    if (options.broadcast !== false) {
      this.broadcastToSSE(fullEvent);
    }
  }

  /**
   * Subscribe to specific event types
   */
  onSyncEvent(
    eventTypes: SyncEventType | SyncEventType[] | '*',
    listener: SyncEventListener
  ): () => void {
    const types = eventTypes === '*' ? ['*'] : Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    types.forEach(type => {
      this.on(type, listener);
    });

    // Return unsubscribe function
    return () => {
      types.forEach(type => {
        this.off(type, listener);
      });
    };
  }

  /**
   * Get current sync state
   */
  getSyncState(syncId: string): SyncState | undefined {
    return this.syncStates.get(syncId);
  }

  /**
   * Get all active sync states
   */
  getAllSyncStates(): SyncState[] {
    return Array.from(this.syncStates.values());
  }

  /**
   * Get event history with optional filtering
   */
  getEventHistory(filter?: {
    syncId?: string;
    types?: SyncEventType[];
    since?: Date;
    limit?: number;
  }): SyncEvent[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.syncId) {
        events = events.filter(e => e.syncId === filter.syncId);
      }
      if (filter.types) {
        events = events.filter(e => filter.types!.includes(e.type));
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!);
      }
      if (filter.limit) {
        events = events.slice(-filter.limit);
      }
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Add SSE client for real-time events
   */
  addSSEClient(
    controller: ReadableStreamDefaultController,
    filter?: SyncEventFilter
  ): () => void {
    const client = {
      response: new Response(),
      controller,
      filter
    };

    this.sseClients.add(client);

    // Send current sync states to new client
    const states = this.getAllSyncStates();
    if (states.length > 0) {
      const stateEvent = {
        type: 'sync_states',
        data: states,
        timestamp: new Date().toISOString()
      };

      try {
        controller.enqueue(`data: ${JSON.stringify(stateEvent)}\n\n`);
      } catch (error) {
        console.warn('Failed to send initial state to SSE client:', error);
        this.sseClients.delete(client);
      }
    }

    // Return cleanup function
    return () => {
      this.sseClients.delete(client);
    };
  }

  /**
   * Clear sync state (when sync completes or fails)
   */
  clearSyncState(syncId: string): void {
    this.syncStates.delete(syncId);
  }

  /**
   * Get statistics for all syncs
   */
  getGlobalStatistics(): {
    activeSyncs: number;
    totalEventsEmitted: number;
    connectedClients: number;
    recentErrors: number;
  } {
    const recentErrors = this.eventHistory
      .filter(e =>
        e.type.includes('error') || e.type.includes('failed')
      )
      .filter(e =>
        Date.now() - e.timestamp.getTime() < 60 * 60 * 1000 // Last hour
      ).length;

    return {
      activeSyncs: this.syncStates.size,
      totalEventsEmitted: this.eventHistory.length,
      connectedClients: this.sseClients.size,
      recentErrors
    };
  }

  private updateSyncState(event: SyncEvent): void {
    const { syncId } = event;
    let state = this.syncStates.get(syncId);

    if (!state) {
      state = {
        id: syncId,
        status: SyncStatus.IDLE,
        progress: 0,
        startTime: new Date(),
        statistics: {
          contactsProcessed: 0,
          chatsProcessed: 0,
          agentsExtracted: 0,
          errorsEncountered: 0,
          currentRate: 0,
          averageRate: 0
        }
      };
    }

    // Update state based on event type
    switch (event.type) {
      case SyncEventType.SYNC_STARTED:
        state.status = SyncStatus.RUNNING;
        state.progress = 0;
        state.startTime = event.timestamp;
        break;

      case SyncEventType.SYNC_COMPLETED:
        state.status = SyncStatus.COMPLETED;
        state.progress = 100;
        state.endTime = event.timestamp;
        if ('data' in event && event.data.summary) {
          Object.assign(state.statistics, event.data.summary);
        }
        break;

      case SyncEventType.SYNC_FAILED:
        state.status = SyncStatus.FAILED;
        state.endTime = event.timestamp;
        if ('data' in event) {
          state.error = {
            ...event.data.error,
            phase: ('phase' in event.data.error) ? event.data.error.phase as SyncPhase : SyncPhase.INITIALIZATION
          };
          state.currentPhase = event.data.phase;
          state.progress = event.data.progress;
        }
        break;

      case SyncEventType.PHASE_STARTED:
        if ('data' in event) {
          state.currentPhase = event.data.phase;
        }
        break;

      case SyncEventType.PROGRESS_UPDATE:
        if ('data' in event) {
          state.progress = event.data.progress;
          state.currentPhase = event.data.phase;
          state.statistics.currentRate = event.data.throughput.current;
          state.statistics.averageRate = event.data.throughput.average;
        }
        break;

      case SyncEventType.CONTACTS_PROCESSING:
      case SyncEventType.CHATS_PROCESSING:
        if ('data' in event) {
          if (event.type === SyncEventType.CONTACTS_PROCESSING) {
            state.statistics.contactsProcessed = event.data.processed;
          } else {
            state.statistics.chatsProcessed = event.data.processed;
            if ('agentsFound' in event.data) {
              state.statistics.agentsExtracted = event.data.agentsFound;
            }
          }
          state.statistics.currentRate = event.data.rate;
        }
        break;

      case SyncEventType.API_ERROR:
      case SyncEventType.VALIDATION_ERROR:
        state.statistics.errorsEncountered++;
        break;
    }

    this.syncStates.set(syncId, state);
  }

  private addToHistory(event: SyncEvent): void {
    this.eventHistory.push(event);

    // Trim history if it gets too long
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private async persistEvent(event: SyncEvent, level?: string): Promise<void> {
    try {
      await auditLogger.logSyncEvent(
        event.userId || 'system',
        AuditEventType.SYNC_STARTED, // Convert to audit event type
        { syncId: event.syncId, eventType: event.type, ...(('data' in event) ? event.data : {}) },
        true
      );
    } catch (error) {
      console.error('Failed to persist sync event:', error);
    }
  }

  private broadcastToSSE(event: SyncEvent): void {
    const eventData = {
      id: event.id,
      type: event.type,
      syncId: event.syncId,
      timestamp: event.timestamp.toISOString(),
      data: 'data' in event ? event.data : null
    };

    // Remove disconnected clients and broadcast to active ones
    const disconnectedClients = new Set<{
      response: Response;
      controller: ReadableStreamDefaultController;
      filter?: SyncEventFilter;
    }>();

    this.sseClients.forEach(client => {
      try {
        // Apply filter if present
        if (client.filter) {
          if (client.filter.syncId && client.filter.syncId !== event.syncId) {
            return;
          }
          if (client.filter.types && !client.filter.types.includes(event.type)) {
            return;
          }
          if (client.filter.userId && client.filter.userId !== event.userId) {
            return;
          }
        }

        client.controller.enqueue(`data: ${JSON.stringify(eventData)}\n\n`);
      } catch (error) {
        console.warn('Failed to send SSE event, removing client:', error);
        disconnectedClients.add(client);
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach(client => {
      this.sseClients.delete(client);
    });
  }
}

// Export singleton instance
export const syncEventEmitter = new SyncEventEmitter();