import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { slaLogger } from '@/lib/sla/sla-logger';

/**
 * GET /api/sla/breaches
 *
 * Returns paginated list of SLA breaches with details
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50, max: 100)
 * - startDate: ISO date string for filtering
 * - endDate: ISO date string for filtering
 * - breachType: Filter by breach type (pickup, first_response, avg_response, resolution)
 * - agentId: Filter by agent ID
 * - provider: Filter by messaging provider (whatsapp, facebook, telegram, livechat, b2cbotapi)
 * - sortBy: Sort field (openedAt, closedAt, timeToPickup, firstResponseTime, resolutionTime)
 * - sortOrder: Sort order (asc, desc)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') || '50'),
      100 // Max page size
    );

    if (page < 1) {
      return NextResponse.json(
        { error: 'Page number must be greater than 0' },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: 'Page size must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Date range
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Filters
    const breachType = searchParams.get('breachType');
    const agentId = searchParams.get('agentId');
    const provider = searchParams.get('provider');

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'openedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Validate sort field
    const validSortFields = [
      'openedAt',
      'closedAt',
      'timeToPickup',
      'firstResponseTime',
      'avgResponseTime',
      'resolutionTime',
    ];

    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: `Invalid sort field. Must be one of: ${validSortFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      openedAt: {
        gte: startDate,
        lte: endDate,
      },
      overallSLA: false, // Only breaches
    };

    // Filter by breach type
    if (breachType) {
      switch (breachType) {
        case 'pickup':
          where.pickupSLA = false;
          break;
        case 'first_response':
          where.firstResponseSLA = false;
          break;
        case 'avg_response':
          where.avgResponseSLA = false;
          break;
        case 'resolution':
          where.resolutionSLA = false;
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid breach type. Must be one of: pickup, first_response, avg_response, resolution' },
            { status: 400 }
          );
      }
    }

    if (agentId) {
      where.agentId = agentId;
    }

    if (provider) {
      where.provider = provider;
    }

    // Count total matching breaches
    const total = await prisma.chat.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;

    // Fetch breaches
    const chats = await prisma.chat.findMany({
      where,
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        provider: true,
        agentId: true,
        contactId: true,
        // Wall clock metrics
        timeToPickup: true,
        firstResponseTime: true,
        avgResponseTime: true,
        resolutionTime: true,
        pickupSLA: true,
        firstResponseSLA: true,
        avgResponseSLA: true,
        resolutionSLA: true,
        // Business hours metrics
        timeToPickupBH: true,
        firstResponseTimeBH: true,
        avgResponseTimeBH: true,
        resolutionTimeBH: true,
        pickupSLABH: true,
        firstResponseSLABH: true,
        avgResponseSLABH: true,
        resolutionSLABH: true,
        // Relations
        contact: {
          select: {
            id: true,
            fullName: true,
            mobile: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder as 'asc' | 'desc',
      },
      skip,
      take: pageSize,
    });

    // Format response with breach details
    const breaches = chats.map(chat => {
      // Identify which metrics were breached
      const breachTypes: string[] = [];
      if (chat.pickupSLA === false) breachTypes.push('pickup');
      if (chat.firstResponseSLA === false) breachTypes.push('first_response');
      if (chat.avgResponseSLA === false) breachTypes.push('avg_response');
      if (chat.resolutionSLA === false) breachTypes.push('resolution');

      return {
        chatId: chat.id,
        openedAt: chat.openedAt,
        closedAt: chat.closedAt,
        provider: chat.provider,
        customer: chat.contact ? {
          id: chat.contact.id,
          name: chat.contact.fullName,
          phone: chat.contact.mobile,
        } : null,
        agent: chat.agent ? {
          id: chat.agent.id,
          name: chat.agent.name,
          email: chat.agent.email,
        } : null,
        breachTypes,
        metrics: {
          wallClock: {
            timeToPickup: chat.timeToPickup,
            firstResponseTime: chat.firstResponseTime,
            avgResponseTime: chat.avgResponseTime,
            resolutionTime: chat.resolutionTime,
            pickupSLA: chat.pickupSLA,
            firstResponseSLA: chat.firstResponseSLA,
            avgResponseSLA: chat.avgResponseSLA,
            resolutionSLA: chat.resolutionSLA,
          },
          businessHours: {
            timeToPickup: chat.timeToPickupBH,
            firstResponseTime: chat.firstResponseTimeBH,
            avgResponseTime: chat.avgResponseTimeBH,
            resolutionTime: chat.resolutionTimeBH,
            pickupSLA: chat.pickupSLABH,
            firstResponseSLA: chat.firstResponseSLABH,
            avgResponseSLA: chat.avgResponseSLABH,
            resolutionSLA: chat.resolutionSLABH,
          },
        },
      };
    });

    const queryTime = Date.now() - startTime;

    // Log API call
    await slaLogger.logAPICall(
      '/api/sla/breaches',
      'GET',
      200,
      undefined,
      {
        total,
        page,
        pageSize,
        queryTime,
      }
    );

    // Return response
    return NextResponse.json({
      breaches,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: {
        ...(startDateParam && { startDate: startDate.toISOString() }),
        ...(endDateParam && { endDate: endDate.toISOString() }),
        ...(breachType && { breachType }),
        ...(agentId && { agentId }),
        ...(provider && { provider }),
      },
      sort: {
        field: sortBy,
        order: sortOrder,
      },
      meta: {
        queryTime,
      },
    });
  } catch (error) {
    console.error('Error fetching SLA breaches:', error);

    await slaLogger.logAPICall(
      '/api/sla/breaches',
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
