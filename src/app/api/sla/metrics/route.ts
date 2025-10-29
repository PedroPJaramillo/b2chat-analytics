import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSLAConfig } from '@/lib/config/sla-config';
import { slaLogger } from '@/lib/sla/sla-logger';

/**
 * GET /api/sla/metrics
 *
 * Returns aggregated SLA metrics for the specified date range and filters
 *
 * Query Parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - agentId: Filter by agent ID (comma-separated for multiple)
 * - provider: Filter by messaging provider (whatsapp, facebook, telegram, livechat, b2cbotapi)
 * - includeTrend: Include trend comparison (true/false)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const agentIdParam = searchParams.get('agentId');
    const providerParam = searchParams.get('provider');
    const includeTrend = searchParams.get('includeTrend') === 'true';

    // Validate and parse dates
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for startDate' },
        { status: 400 }
      );
    }

    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for endDate' },
        { status: 400 }
      );
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date cannot be before start date' },
        { status: 400 }
      );
    }

    // Build filters
    const filters: any = {
      openedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (agentIdParam) {
      const agentIds = agentIdParam.split(',').map(id => id.trim());
      filters.agentId = agentIds.length === 1 ? agentIds[0] : { in: agentIds };
    }

    if (providerParam) {
      filters.provider = providerParam;
    }

    // Fetch chats with SLA data
    const chats = await prisma.chat.findMany({
      where: filters,
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        agentId: true,
        provider: true,
        // Wall clock metrics
        timeToPickup: true,
        firstResponseTime: true,
        avgResponseTime: true,
        resolutionTime: true,
        pickupSLA: true,
        firstResponseSLA: true,
        avgResponseSLA: true,
        resolutionSLA: true,
        overallSLA: true,
        // Business hours metrics
        timeToPickupBH: true,
        firstResponseTimeBH: true,
        avgResponseTimeBH: true,
        resolutionTimeBH: true,
        pickupSLABH: true,
        firstResponseSLABH: true,
        avgResponseSLABH: true,
        resolutionSLABH: true,
        overallSLABH: true,
      },
    });

    // Get SLA configuration
    const slaConfig = await getSLAConfig();

    // Calculate aggregated metrics
    const totalChats = chats.length;

    // Wall clock metrics
    const wallClockMetrics = calculateMetrics(chats, false);

    // Business hours metrics
    const businessHoursMetrics = calculateMetrics(chats, true);

    // Prepare response
    const response = {
      metrics: {
        wallClock: wallClockMetrics,
        businessHours: businessHoursMetrics,
      },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      filters: {
        ...(agentIdParam && { agentId: agentIdParam }),
        ...(providerParam && { provider: providerParam }),
      },
      targets: slaConfig,
      totalChats,
    };

    // Add trend data if requested
    if (includeTrend) {
      const trendData = await calculateTrendComparison(
        startDate,
        endDate,
        filters
      );
      (response as any).trend = trendData;
    }

    // Log API call
    await slaLogger.logAPICall(
      '/api/sla/metrics',
      'GET',
      200,
      undefined,
      {
        totalChats,
        duration: Date.now() - startTime,
      }
    );

    // Return with cache headers (5 minutes)
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching SLA metrics:', error);

    await slaLogger.logAPICall(
      '/api/sla/metrics',
      'GET',
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

/**
 * Calculates aggregated metrics from chat data
 */
function calculateMetrics(chats: any[], useBusinessHours: boolean) {
  const suffix = useBusinessHours ? 'BH' : '';

  const pickupKey = `timeToPickup${suffix}` as const;
  const firstResponseKey = `firstResponseTime${suffix}` as const;
  const avgResponseKey = `avgResponseTime${suffix}` as const;
  const resolutionKey = `resolutionTime${suffix}` as const;

  const pickupSLAKey = `pickupSLA${suffix}` as const;
  const firstResponseSLAKey = `firstResponseSLA${suffix}` as const;
  const avgResponseSLAKey = `avgResponseSLA${suffix}` as const;
  const resolutionSLAKey = `resolutionSLA${suffix}` as const;
  const overallSLAKey = `overallSLA${suffix}` as const;

  // Filter out chats with null overall SLA (incomplete)
  const completedChats = chats.filter(chat => chat[overallSLAKey] !== null);

  const totalCompleted = completedChats.length;
  const totalCompliant = completedChats.filter(chat => chat[overallSLAKey] === true).length;
  const totalBreached = completedChats.filter(chat => chat[overallSLAKey] === false).length;

  // Calculate individual metric compliance
  const pickupCompliant = chats.filter(chat => chat[pickupSLAKey] === true).length;
  const pickupTotal = chats.filter(chat => chat[pickupSLAKey] !== null).length;

  const firstResponseCompliant = chats.filter(chat => chat[firstResponseSLAKey] === true).length;
  const firstResponseTotal = chats.filter(chat => chat[firstResponseSLAKey] !== null).length;

  const avgResponseCompliant = chats.filter(chat => chat[avgResponseSLAKey] === true).length;
  const avgResponseTotal = chats.filter(chat => chat[avgResponseSLAKey] !== null).length;

  const resolutionCompliant = chats.filter(chat => chat[resolutionSLAKey] === true).length;
  const resolutionTotal = chats.filter(chat => chat[resolutionSLAKey] !== null).length;

  // Calculate average times
  const pickupTimes = chats.filter(chat => chat[pickupKey] !== null).map(chat => chat[pickupKey]);
  const firstResponseTimes = chats.filter(chat => chat[firstResponseKey] !== null).map(chat => chat[firstResponseKey]);
  const avgResponseTimes = chats.filter(chat => chat[avgResponseKey] !== null).map(chat => chat[avgResponseKey]);
  const resolutionTimes = chats.filter(chat => chat[resolutionKey] !== null).map(chat => chat[resolutionKey]);

  const avgPickupTime = pickupTimes.length > 0
    ? pickupTimes.reduce((sum, time) => sum + time, 0) / pickupTimes.length
    : null;

  const avgFirstResponseTime = firstResponseTimes.length > 0
    ? firstResponseTimes.reduce((sum, time) => sum + time, 0) / firstResponseTimes.length
    : null;

  const avgAvgResponseTime = avgResponseTimes.length > 0
    ? avgResponseTimes.reduce((sum, time) => sum + time, 0) / avgResponseTimes.length
    : null;

  const avgResolutionTime = resolutionTimes.length > 0
    ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
    : null;

  return {
    overallCompliance: {
      rate: totalCompleted > 0 ? (totalCompliant / totalCompleted) * 100 : 0,
      total: totalCompleted,
      compliant: totalCompliant,
      breached: totalBreached,
    },
    pickupCompliance: {
      rate: pickupTotal > 0 ? (pickupCompliant / pickupTotal) * 100 : 0,
      total: pickupTotal,
      compliant: pickupCompliant,
      breached: pickupTotal - pickupCompliant,
    },
    firstResponseCompliance: {
      rate: firstResponseTotal > 0 ? (firstResponseCompliant / firstResponseTotal) * 100 : 0,
      total: firstResponseTotal,
      compliant: firstResponseCompliant,
      breached: firstResponseTotal - firstResponseCompliant,
    },
    avgResponseCompliance: {
      rate: avgResponseTotal > 0 ? (avgResponseCompliant / avgResponseTotal) * 100 : 0,
      total: avgResponseTotal,
      compliant: avgResponseCompliant,
      breached: avgResponseTotal - avgResponseCompliant,
    },
    resolutionCompliance: {
      rate: resolutionTotal > 0 ? (resolutionCompliant / resolutionTotal) * 100 : 0,
      total: resolutionTotal,
      compliant: resolutionCompliant,
      breached: resolutionTotal - resolutionCompliant,
    },
    avgPickupTime,
    avgFirstResponseTime,
    avgAvgResponseTime,
    avgResolutionTime,
  };
}

/**
 * Calculates trend comparison with previous period
 */
async function calculateTrendComparison(
  startDate: Date,
  endDate: Date,
  filters: any
) {
  const periodDuration = endDate.getTime() - startDate.getTime();
  const previousStartDate = new Date(startDate.getTime() - periodDuration);
  const previousEndDate = new Date(startDate);

  const previousFilters = {
    ...filters,
    openedAt: {
      gte: previousStartDate,
      lte: previousEndDate,
    },
  };

  const previousChats = await prisma.chat.findMany({
    where: previousFilters,
    select: {
      overallSLA: true,
      overallSLABH: true,
    },
  });

  const previousCompleted = previousChats.filter(chat => chat.overallSLA !== null).length;
  const previousCompliant = previousChats.filter(chat => chat.overallSLA === true).length;
  const previousRate = previousCompleted > 0 ? (previousCompliant / previousCompleted) * 100 : 0;

  return {
    previousPeriod: {
      start: previousStartDate.toISOString(),
      end: previousEndDate.toISOString(),
      complianceRate: previousRate,
      total: previousCompleted,
      compliant: previousCompliant,
    },
    change: {
      // Will be calculated on client side by comparing with current metrics
      period: 'previous',
    },
  };
}
