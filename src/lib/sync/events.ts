/**
 * Sync Event System - Type-safe event definitions for real-time sync monitoring
 *
 * This module defines all sync-related events with proper TypeScript types
 * for comprehensive visibility into the B2Chat synchronization process.
 */

export enum SyncEventType {
  // Sync Session Events
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  SYNC_CANCELLED = 'sync_cancelled',

  // Phase Events
  PHASE_STARTED = 'phase_started',
  PHASE_COMPLETED = 'phase_completed',
  PHASE_FAILED = 'phase_failed',

  // Data Processing Events
  CONTACTS_FETCH_STARTED = 'contacts_fetch_started',
  CONTACTS_FETCH_COMPLETED = 'contacts_fetch_completed',
  CONTACTS_PROCESSING = 'contacts_processing',
  CHATS_FETCH_STARTED = 'chats_fetch_started',
  CHATS_FETCH_COMPLETED = 'chats_fetch_completed',
  CHATS_PROCESSING = 'chats_processing',

  // Database Events
  DATABASE_OPERATION_STARTED = 'database_operation_started',
  DATABASE_OPERATION_COMPLETED = 'database_operation_completed',
  DATABASE_OPERATION_FAILED = 'database_operation_failed',

  // Error Events
  API_ERROR = 'api_error',
  DATABASE_ERROR = 'database_error',
  VALIDATION_ERROR = 'validation_error',

  // Progress Events
  PROGRESS_UPDATE = 'progress_update',
  ITEM_PROCESSED = 'item_processed',
  BATCH_COMPLETED = 'batch_completed',
}

export enum SyncPhase {
  INITIALIZATION = 'initialization',
  AUTHENTICATION = 'authentication',
  CONTACTS_SYNC = 'contacts_sync',
  CHATS_SYNC = 'chats_sync',
  AGENTS_EXTRACTION = 'agents_extraction',
  CLEANUP = 'cleanup',
}

export enum SyncStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Base event interface
export interface BaseSyncEvent {
  id: string;
  type: SyncEventType;
  timestamp: Date;
  syncId: string;
  userId?: string;
}

// Sync session events
export interface SyncStartedEvent extends BaseSyncEvent {
  type: SyncEventType.SYNC_STARTED;
  data: {
    totalPhases: number;
    estimatedDuration: number;
    configuration: {
      includeContacts: boolean;
      includeChats: boolean;
      dateRange?: {
        from: Date;
        to: Date;
      };
    };
  };
}

export interface SyncCompletedEvent extends BaseSyncEvent {
  type: SyncEventType.SYNC_COMPLETED;
  data: {
    duration: number;
    totalProcessed: number;
    summary: {
      contactsProcessed: number;
      chatsProcessed: number;
      agentsExtracted: number;
      errorsEncountered: number;
    };
  };
}

export interface SyncFailedEvent extends BaseSyncEvent {
  type: SyncEventType.SYNC_FAILED;
  data: {
    error: {
      code: string;
      message: string;
      details?: Record<string, any>;
    };
    phase: SyncPhase;
    progress: number;
  };
}

// Phase events
export interface PhaseStartedEvent extends BaseSyncEvent {
  type: SyncEventType.PHASE_STARTED;
  data: {
    phase: SyncPhase;
    estimatedItems: number;
    description: string;
  };
}

export interface PhaseCompletedEvent extends BaseSyncEvent {
  type: SyncEventType.PHASE_COMPLETED;
  data: {
    phase: SyncPhase;
    duration: number;
    itemsProcessed: number;
    success: boolean;
  };
}

// Data processing events
export interface ContactsFetchStartedEvent extends BaseSyncEvent {
  type: SyncEventType.CONTACTS_FETCH_STARTED;
  data: {
    expectedCount: number;
    filters?: Record<string, any>;
  };
}

export interface ContactsProcessingEvent extends BaseSyncEvent {
  type: SyncEventType.CONTACTS_PROCESSING;
  data: {
    processed: number;
    total: number;
    currentBatch: number;
    batchSize: number;
    rate: number; // items per second
  };
}

export interface ChatsProcessingEvent extends BaseSyncEvent {
  type: SyncEventType.CHATS_PROCESSING;
  data: {
    processed: number;
    total: number;
    currentBatch: number;
    batchSize: number;
    rate: number;
    agentsFound: number;
  };
}

// Database events
export interface DatabaseOperationStartedEvent extends BaseSyncEvent {
  type: SyncEventType.DATABASE_OPERATION_STARTED;
  data: {
    operation: 'upsert' | 'delete' | 'bulk_insert' | 'update';
    table: string;
    itemCount: number;
  };
}

export interface DatabaseOperationCompletedEvent extends BaseSyncEvent {
  type: SyncEventType.DATABASE_OPERATION_COMPLETED;
  data: {
    operation: 'upsert' | 'delete' | 'bulk_insert' | 'update';
    table: string;
    itemsAffected: number;
    duration: number;
  };
}

// Error events
export interface ApiErrorEvent extends BaseSyncEvent {
  type: SyncEventType.API_ERROR;
  data: {
    endpoint: string;
    statusCode?: number;
    error: {
      code: string;
      message: string;
      details?: Record<string, any>;
    };
    retryCount: number;
    willRetry: boolean;
  };
}

export interface ValidationErrorEvent extends BaseSyncEvent {
  type: SyncEventType.VALIDATION_ERROR;
  data: {
    itemType: 'contact' | 'chat' | 'agent';
    itemId?: string;
    errors: Array<{
      field: string;
      message: string;
      value: any;
    }>;
    action: 'skip' | 'fix' | 'retry';
  };
}

// Progress events
export interface ProgressUpdateEvent extends BaseSyncEvent {
  type: SyncEventType.PROGRESS_UPDATE;
  data: {
    phase: SyncPhase;
    progress: number; // 0-100
    currentItem: string;
    itemsRemaining: number;
    estimatedTimeRemaining: number;
    throughput: {
      current: number; // items per second
      average: number;
    };
  };
}

// Union type for all events
export type SyncEvent =
  | SyncStartedEvent
  | SyncCompletedEvent
  | SyncFailedEvent
  | PhaseStartedEvent
  | PhaseCompletedEvent
  | ContactsFetchStartedEvent
  | ContactsProcessingEvent
  | ChatsProcessingEvent
  | DatabaseOperationStartedEvent
  | DatabaseOperationCompletedEvent
  | ApiErrorEvent
  | ValidationErrorEvent
  | ProgressUpdateEvent;

// Event listener type
export type SyncEventListener = (event: SyncEvent) => void | Promise<void>;

// Event filter for SSE subscriptions
export interface SyncEventFilter {
  syncId?: string;
  types?: SyncEventType[];
  phases?: SyncPhase[];
  userId?: string;
}

// Sync state for real-time monitoring
export interface SyncState {
  id: string;
  status: SyncStatus;
  currentPhase?: SyncPhase;
  progress: number;
  startTime: Date;
  endTime?: Date;
  error?: {
    code: string;
    message: string;
    phase: SyncPhase;
  };
  statistics: {
    contactsProcessed: number;
    chatsProcessed: number;
    agentsExtracted: number;
    errorsEncountered: number;
    currentRate: number;
    averageRate: number;
  };
}

// Event emission utility types
export interface EventEmissionOptions {
  persist?: boolean; // Save to audit log
  broadcast?: boolean; // Send via SSE
  level?: 'info' | 'warn' | 'error';
}