import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSLAConfig, getOfficeHoursConfig } from '@/lib/config/sla-config';
import { calculateAllSLAMetricsWithBusinessHours } from '@/lib/sla/sla-calculator-full';
import type { ChatData, EnabledMetrics } from '@/lib/sla/sla-calculator';
import { slaLogger } from '@/lib/sla/sla-logger';
import { auditLogger, AuditSeverity, AuditEventType } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';

// Rate limit configuration for recalculation (5 per hour per user)
const recalculateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Too many SLA recalculation requests. Please wait before trying again.',
});

/**
 * Fetches enabled metrics configuration from system settings
 * Defaults to pickup and firstResponse enabled if not configured
 */
async function getEnabledMetrics(): Promise<EnabledMetrics> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'sla.enabledMetrics' },
    });

    if (setting) {
      return JSON.parse(setting.value);
    }
  } catch (error) {
    console.error('Error fetching enabled metrics, using defaults:', error);
  }

  // Default: pickup and firstResponse enabled
  return {
    pickup: true,
    firstResponse: true,
    avgResponse: false,
    resolution: false,
  };
}

/**
 * POST /api/sla/recalculate
 *
 * Batch recalculates SLA metrics for chats using cursor-based pagination
 * Useful after configuration changes or for historical data corrections
 *
 * Query Parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - chatId: Specific chat ID to recalculate (optional)
 * - batchSize: Number of chats to process per batch (default: 500, max: 2000)
 *
 * Note: No hard limit on total chats - uses cursor pagination to handle any volume
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authentication check - Use getCurrentUser() (correct pattern per auth.ts)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Authorization check - Admin only
    if (user.role !== 'Admin') {
      // Log unauthorized access attempt (non-blocking)
      try {
        await auditLogger.log({
          eventType: AuditEventType.UNAUTHORIZED_ACCESS,
          userId: user.id,
          severity: AuditSeverity.MEDIUM,
          resource: 'sla_recalculation',
          action: 'recalculate',
          details: { reason: 'Non-admin user attempted recalculation', userRole: user.role },
          success: false,
          errorMessage: 'Admin role required',
        });
      } catch (auditError) {
        // Audit logging failure should not block the response
        console.error('Failed to log unauthorized access:', auditError);
      }

      return NextResponse.json(
        { error: 'Forbidden: Admin role required for SLA recalculation' },
        { status: 403 }
      );
    }

    // 3. Rate limiting check
    const rateLimitResult = await recalculateRateLimit(request, user.id);
    if (rateLimitResult) {
      // Rate limit exceeded, return the response
      return rateLimitResult;
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const chatId = searchParams.get('chatId');
    const batchSizeParam = searchParams.get('batchSize');

    // 4. Parameter validation
    const batchSize = batchSizeParam ? Math.min(parseInt(batchSizeParam), 2000) : 500;

    if (batchSizeParam && (isNaN(batchSize) || batchSize < 1 || batchSize > 2000)) {
      return NextResponse.json(
        { error: 'Invalid batchSize parameter. Must be between 1 and 2000.' },
        { status: 400 }
      );
    }

    // Validate date range
    if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);

      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start date format' },
          { status: 400 }
        );
      }

      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid end date format' },
          { status: 400 }
        );
      }

      if (startDate >= endDate) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        );
      }

      // Check date range not too large (max 1 year)
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return NextResponse.json(
          { error: 'Date range cannot exceed 1 year (365 days)' },
          { status: 400 }
        );
      }

      // Check end date not in future
      if (endDate > new Date()) {
        return NextResponse.json(
          { error: 'End date cannot be in the future' },
          { status: 400 }
        );
      }
    }

    // 5. Audit log - START (non-blocking)
    try {
      await auditLogger.log({
        eventType: AuditEventType.SETTINGS_CHANGED,
        userId: user.id,
        severity: AuditSeverity.MEDIUM,
        resource: 'sla_metrics',
        action: 'recalculate_started',
        details: {
          startDate: startDateParam,
          endDate: endDateParam,
          chatId,
          batchSize,
        },
        success: true,
      });
    } catch (auditError) {
      // Audit logging failure should not block recalculation
      console.error('Failed to log recalculation start:', auditError);
    }

    // Get configuration
    const [slaConfig, officeHoursConfig, enabledMetrics] = await Promise.all([
      getSLAConfig(),
      getOfficeHoursConfig(),
      getEnabledMetrics(),
    ]);

    // Log enabled metrics for audit trail
    console.log('SLA Recalculation - Enabled Metrics:', enabledMetrics);

    // Define where clause for chats to process
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const whereClause = chatId
      ? { id: chatId }
      : {
          openedAt: {
            gte: startDate,
            lte: endDate,
          },
        };

    // Get total count for progress tracking
    const totalChats = await prisma.chat.count({ where: whereClause });
    console.log(`SLA Recalculation: Processing ${totalChats} chats in batches of ${batchSize}`);

    let processedCount = 0;
    let failedCount = 0;
    const errors: Array<{ chatId: string; error: string }> = [];
    let cursor: string | undefined = undefined;
    let batchNumber = 0;

    // Process chats using cursor-based pagination
    while (true) {
      batchNumber++;
      const batchStartTime = Date.now();

      // Fetch next batch of chats
      const chats: Array<{
        id: string;
        agentId: string | null;
        openedAt: Date | null;
        closedAt: Date | null;
        messages: Array<{ incoming: boolean; timestamp: Date }>;
      }> = await prisma.chat.findMany({
        where: whereClause,
        include: {
          messages: {
            orderBy: {
              timestamp: 'asc',
            },
          },
        },
        take: batchSize,
        ...(cursor && {
          skip: 1, // Skip the cursor
          cursor: { id: cursor },
        }),
        orderBy: { id: 'asc' },
      });

      // No more chats to process
      if (chats.length === 0) {
        break;
      }

      // Process batch in parallel
      const updatePromises = chats.map(async (chat) => {
        try {
          // Find first agent assignment
          const firstAgentAssignedAt = chat.agentId
            ? chat.openedAt // Simplified: assuming assignment at open time if agent exists
            : null;

          // Prepare chat data
          const chatData: ChatData = {
            openedAt: chat.openedAt!,
            firstAgentAssignedAt,
            closedAt: chat.closedAt,
            messages: chat.messages.map((msg: any) => ({
              role: msg.incoming ? 'customer' : 'agent',
              createdAt: msg.timestamp,
            })),
          };

          // Calculate metrics with enabled metrics configuration
          const metrics = calculateAllSLAMetricsWithBusinessHours(
            chatData,
            slaConfig,
            officeHoursConfig,
            enabledMetrics
          );

          // Update database
          await prisma.chat.update({
            where: { id: chat.id },
            data: {
              // Wall clock metrics
              timeToPickup: metrics.timeToPickup,
              firstResponseTime: metrics.firstResponseTime,
              avgResponseTime: metrics.avgResponseTime,
              resolutionTime: metrics.resolutionTime,
              pickupSLA: metrics.pickupSLA,
              firstResponseSLA: metrics.firstResponseSLA,
              avgResponseSLA: metrics.avgResponseSLA,
              resolutionSLA: metrics.resolutionSLA,
              overallSLA: metrics.overallSLA,
              // Business hours metrics
              timeToPickupBH: metrics.timeToPickupBH,
              firstResponseTimeBH: metrics.firstResponseTimeBH,
              avgResponseTimeBH: metrics.avgResponseTimeBH,
              resolutionTimeBH: metrics.resolutionTimeBH,
              pickupSLABH: metrics.pickupSLABH,
              firstResponseSLABH: metrics.firstResponseSLABH,
              avgResponseSLABH: metrics.avgResponseSLABH,
              resolutionSLABH: metrics.resolutionSLABH,
              overallSLABH: metrics.overallSLABH,
            },
          });

          // Log calculation
          await slaLogger.logCalculation(chat.id, metrics, 'config_change');

          processedCount++;
        } catch (error) {
          console.error(`Error processing chat ${chat.id}:`, error);
          failedCount++;
          errors.push({
            chatId: chat.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(updatePromises);

      const batchDuration = Date.now() - batchStartTime;
      const progress = ((processedCount + failedCount) / totalChats * 100).toFixed(1);
      console.log(
        `Batch ${batchNumber} complete: ${chats.length} chats in ${batchDuration}ms ` +
        `(${progress}% total, ${processedCount} success, ${failedCount} failed)`
      );

      // Update cursor for next batch
      cursor = chats[chats.length - 1].id;

      // If we got fewer chats than requested, we're done
      if (chats.length < batchSize) {
        break;
      }
    }

    const duration = Date.now() - startTime;

    // Log API call metrics
    await slaLogger.logAPICall(
      '/api/sla/recalculate',
      'POST',
      200,
      undefined,
      {
        processed: processedCount,
        failed: failedCount,
        duration,
        enabledMetrics,
        totalChats,
        batches: batchNumber,
      }
    );

    // Audit log - COMPLETION (non-blocking)
    try {
      await auditLogger.log({
        eventType: AuditEventType.SYNC_COMPLETED,
        userId: user.id,
        severity: failedCount > 0 ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        resource: 'sla_metrics',
        action: 'recalculate_completed',
        details: {
          totalChats,
          processed: processedCount,
          failed: failedCount,
          batches: batchNumber,
          duration,
          avgChatsPerSecond: Math.round((processedCount / duration) * 1000),
          startDate: startDateParam,
          endDate: endDateParam,
        },
        success: failedCount === 0,
        errorMessage: failedCount > 0 ? `${failedCount} chats failed to process` : undefined,
      });
    } catch (auditError) {
      console.error('Failed to log recalculation completion:', auditError);
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      failed: failedCount,
      total: totalChats,
      duration,
      enabledMetrics,
      batches: batchNumber,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error('Error recalculating SLA metrics:', error);

    await slaLogger.logAPICall(
      '/api/sla/recalculate',
      'POST',
      500,
      undefined,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
