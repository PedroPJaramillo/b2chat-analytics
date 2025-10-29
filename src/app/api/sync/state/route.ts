/**
 * Sync State API - Get current sync states and statistics
 *
 * Provides REST endpoints for retrieving sync state information
 * without requiring SSE connections.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncEventEmitter } from '@/lib/sync/event-emitter';
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let userId: string | null = null;

  try {
    // Authenticate user
    const authResult = await auth()
    userId = authResult.userId;
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyLimit = parseInt(searchParams.get('historyLimit') || '50');

    // Log access
    await auditLogger.log({
      userId,
      eventType: AuditEventType.DATA_VIEWED,
      severity: AuditSeverity.LOW,
      success: true,
      resource: 'sync_state',
      details: {
        syncId,
        includeHistory,
        historyLimit
      }
    });

    if (syncId) {
      // Get specific sync state
      const state = syncEventEmitter.getSyncState(syncId);

      if (!state) {
        return Response.json(
          { error: 'Sync not found' },
          { status: 404 }
        );
      }

      const response: any = { state };

      if (includeHistory) {
        response.history = syncEventEmitter.getEventHistory({
          syncId,
          limit: historyLimit
        });
      }

      return Response.json(response);
    } else {
      // Get all sync states and global statistics
      const states = syncEventEmitter.getAllSyncStates();
      const statistics = syncEventEmitter.getGlobalStatistics();

      const response: any = {
        states,
        statistics
      };

      if (includeHistory) {
        response.recentHistory = syncEventEmitter.getEventHistory({
          limit: historyLimit
        });
      }

      return Response.json(response);
    }

  } catch (error) {
    console.error('Sync state API error:', error);

    const authResult = await auth()
    userId = authResult.userId;
    if (userId) {
      await auditLogger.log({
        userId,
        eventType: AuditEventType.API_ERROR,
        severity: AuditSeverity.HIGH,
        success: false,
        resource: 'sync_state_api',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(console.error);
    }

    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  let userId: string | null = null;

  try {
    // Authenticate user
    const authResult = await auth()
    userId = authResult.userId;
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');

    if (!syncId) {
      return Response.json(
        { error: 'syncId parameter required' },
        { status: 400 }
      );
    }

    // Clear sync state
    syncEventEmitter.clearSyncState(syncId);

    // Log action
    await auditLogger.log({
      userId,
      eventType: AuditEventType.DATA_EXPORTED,
      severity: AuditSeverity.MEDIUM,
      success: true,
      resource: 'sync_state',
      details: { syncId }
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('Sync state delete error:', error);

    const authResult = await auth()
    userId = authResult.userId;
    if (userId) {
      await auditLogger.log({
        userId,
        eventType: AuditEventType.API_ERROR,
        severity: AuditSeverity.HIGH,
        success: false,
        resource: 'sync_state_delete',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(console.error);
    }

    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}