/**
 * Sync Analytics API - Performance metrics and historical data
 *
 * Provides analytics endpoints for sync performance monitoring,
 * historical trends, and operational insights.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { auditLogger, AuditEventType } from '@/lib/audit';
import { syncEventEmitter } from '@/lib/sync/event-emitter';

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
    const timeRange = searchParams.get('timeRange') || '7d'; // 24h, 7d, 30d
    const includeEvents = searchParams.get('includeEvents') === 'true';

    // Calculate date range
    const now = new Date();
    const timeRangeMap = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const startDate = new Date(now.getTime() - (timeRangeMap[timeRange as keyof typeof timeRangeMap] || timeRangeMap['7d']));

    // Log analytics access
    await auditLogger.log({
      userId,
      eventType: AuditEventType.DATA_VIEWED,
      severity: 'info' as any,
      success: true,
      resource: 'sync_analytics',
      details: {
        timeRange,
        includeEvents,
        dateRange: { start: startDate, end: now }
      }
    });

    // Get sync operations from sync logs
    const syncLogs = await prisma.syncLog.findMany({
      where: {
        startedAt: {
          gte: startDate
        }
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 100
    });

    // Get sync states from database
    const syncStates = await prisma.syncState.findMany({
      where: {
        lastSyncTimestamp: {
          gte: startDate
        }
      },
      orderBy: {
        lastSyncTimestamp: 'desc'
      }
    });

    // Calculate analytics
    const analytics = calculateSyncAnalytics(syncLogs, syncStates, startDate, now);

    // Include current sync statistics from event emitter
    const currentStats = syncEventEmitter.getGlobalStatistics();

    const response = {
      timeRange,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      analytics,
      currentStatistics: currentStats,
      ...(includeEvents && {
        recentEvents: syncEventEmitter.getEventHistory({
          limit: 50,
          since: startDate
        })
      })
    };

    return Response.json(response);

  } catch (error) {
    console.error('Sync analytics API error:', error);

    const authResult = await auth()
    userId = authResult.userId;
    if (userId) {
      await auditLogger.log({
        userId,
        eventType: AuditEventType.SYNC_FAILED,
        severity: 'error' as any,
        success: false,
        resource: 'sync_analytics_api',
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

function calculateSyncAnalytics(syncLogs: any[], syncStates: any[], startDate: Date, endDate: Date) {
  const totalSyncs = syncLogs.filter(log => log.action === 'sync_started').length;
  const completedSyncs = syncLogs.filter(log => log.action === 'sync_completed').length;
  const failedSyncs = syncLogs.filter(log => log.action === 'sync_failed').length;

  const successRate = totalSyncs > 0 ? (completedSyncs / totalSyncs) * 100 : 0;

  // Calculate average sync duration from completed syncs
  const completedSyncLogs = syncLogs.filter(log =>
    log.action === 'sync_completed' &&
    log.details?.duration
  );

  const avgDuration = completedSyncLogs.length > 0
    ? completedSyncLogs.reduce((sum, log) => sum + (log.details.duration || 0), 0) / completedSyncLogs.length
    : 0;

  // Calculate throughput metrics
  const totalRecordsProcessed = syncStates.reduce((sum, state) =>
    sum + (state.totalRecords || 0), 0
  );

  const totalDuration = completedSyncLogs.reduce((sum, log) =>
    sum + (log.details.duration || 0), 0
  );

  const avgThroughput = totalDuration > 0
    ? (totalRecordsProcessed / totalDuration) * 1000 // records per second
    : 0;

  // Time series data (simplified - group by day)
  const timeSeriesData = generateTimeSeries(syncLogs, startDate, endDate);

  // Entity-specific metrics
  const entityMetrics = {
    contacts: calculateEntityMetrics(syncStates, 'contacts'),
    chats: calculateEntityMetrics(syncStates, 'chats'),
    agents: calculateEntityMetrics(syncStates, 'agents')
  };

  return {
    summary: {
      totalSyncs,
      completedSyncs,
      failedSyncs,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      avgThroughput: Math.round(avgThroughput * 100) / 100,
      totalRecordsProcessed
    },
    timeSeries: timeSeriesData,
    entityMetrics,
    trends: {
      syncFrequency: calculateSyncFrequency(syncLogs, startDate, endDate),
      errorRate: Math.round((failedSyncs / Math.max(totalSyncs, 1)) * 10000) / 100,
      performanceTrend: calculatePerformanceTrend(completedSyncLogs)
    }
  };
}

function calculateEntityMetrics(syncStates: any[], entityType: string) {
  const entityStates = syncStates.filter(state =>
    state.entityType === entityType ||
    (entityType === 'agents' && state.entityType === 'chats') // Agents extracted from chats
  );

  const totalRecords = entityStates.reduce((sum, state) =>
    sum + (state.totalRecords || 0), 0
  );

  const successfulRecords = entityStates.reduce((sum, state) =>
    sum + (state.successfulRecords || 0), 0
  );

  const failedRecords = entityStates.reduce((sum, state) =>
    sum + (state.failedRecords || 0), 0
  );

  const lastSync = entityStates.length > 0
    ? entityStates.reduce((latest, state) =>
        (!latest || new Date(state.lastSyncTimestamp) > new Date(latest.lastSyncTimestamp))
          ? state
          : latest
      )
    : null;

  return {
    totalRecords,
    successfulRecords,
    failedRecords,
    successRate: totalRecords > 0 ? (successfulRecords / totalRecords) * 100 : 0,
    lastSync: lastSync?.lastSyncTimestamp || null,
    avgDuration: lastSync?.syncDuration || 0
  };
}

function generateTimeSeries(syncLogs: any[], startDate: Date, endDate: Date) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const series = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

    const dayLogs = syncLogs.filter(log => {
      const logDate = new Date(log.createdAt);
      return logDate >= date && logDate < nextDate;
    });

    const started = dayLogs.filter(log => log.action === 'sync_started').length;
    const completed = dayLogs.filter(log => log.action === 'sync_completed').length;
    const failed = dayLogs.filter(log => log.action === 'sync_failed').length;

    series.push({
      date: date.toISOString().split('T')[0],
      syncs: started,
      completed,
      failed,
      successRate: started > 0 ? (completed / started) * 100 : 0
    });
  }

  return series;
}

function calculateSyncFrequency(syncLogs: any[], startDate: Date, endDate: Date) {
  const totalHours = (endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000);
  const totalSyncs = syncLogs.filter(log => log.action === 'sync_started').length;

  return totalHours > 0 ? totalSyncs / totalHours : 0;
}

function calculatePerformanceTrend(completedSyncLogs: any[]) {
  if (completedSyncLogs.length < 2) return 0;

  // Simple trend calculation: compare first half vs second half
  const midpoint = Math.floor(completedSyncLogs.length / 2);
  const firstHalf = completedSyncLogs.slice(0, midpoint);
  const secondHalf = completedSyncLogs.slice(midpoint);

  const firstHalfAvg = firstHalf.reduce((sum, log) => sum + (log.details.duration || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, log) => sum + (log.details.duration || 0), 0) / secondHalf.length;

  // Return percentage change (negative = improvement, positive = degradation)
  return firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
}