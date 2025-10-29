/**
 * GET /api/customer-analysis/:analysisId/results - Get analysis results
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAnalysisPermission } from '@/lib/customer-analysis/auth'
import { aggregateAnalysisResults } from '@/lib/customer-analysis/results-aggregation'
import { cache, CACHE_TTL, getResultsCacheKey } from '@/lib/customer-analysis/cache'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

interface RouteContext {
  params: Promise<{ analysisId: string }>
}

/**
 * GET /api/customer-analysis/:analysisId/results
 * Retrieves complete analysis results with all metrics and visualizations
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { analysisId } = await context.params

    // Check cache first
    const cacheKey = getResultsCacheKey(analysisId)
    const cached = cache.get<AnalysisResultsResponse>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          'X-Cache': 'HIT',
        },
      })
    }

    // Check authentication and authorization
    const authResult = await checkAnalysisPermission()
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN_ROLE',
            message: authResult.error,
            timestamp: new Date().toISOString(),
          },
        },
        { status: authResult.statusCode }
      )
    }

    const { userId, userRole } = authResult

    // Fetch analysis
    const analysis = await prisma.customerAnalysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        status: true,
        triggeredBy: true,
        filters: true,
        totalChatsAnalyzed: true,
        totalMessagesAnalyzed: true,
        aiAnalysisCount: true,
      },
    })

    if (!analysis) {
      return NextResponse.json(
        {
          error: {
            code: 'ANALYSIS_NOT_FOUND',
            message: 'Analysis not found',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      )
    }

    // Check if user has access
    if (userRole === 'Manager' && analysis.triggeredBy !== userId) {
      return NextResponse.json(
        {
          error: {
            code: 'ANALYSIS_NOT_FOUND',
            message: 'Analysis not found',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      )
    }

    // Check if analysis is complete
    if (analysis.status !== 'COMPLETED' && analysis.status !== 'PARTIAL') {
      return NextResponse.json(
        {
          error: {
            code: 'ANALYSIS_NOT_COMPLETED',
            message: `Analysis is ${analysis.status.toLowerCase()}. Results not available yet.`,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      )
    }

    // Fetch categorizations and KPIs
    const [categorizations, kpis] = await Promise.all([
      prisma.customerCategorization.findMany({
        where: { analysisId },
      }),
      prisma.analysisKPI.findMany({
        where: { analysisId },
      }),
    ])

    // Aggregate results
    const aggregated = aggregateAnalysisResults(categorizations, kpis)

    // Build response
    const filters = analysis.filters as any
    const response: AnalysisResultsResponse = {
      analysisId: analysis.id,
      status: analysis.status,
      summary: {
        totalChatsAnalyzed: analysis.totalChatsAnalyzed,
        totalMessagesAnalyzed: analysis.totalMessagesAnalyzed,
        aiAnalysisCount: analysis.aiAnalysisCount,
        dateRange: {
          start: filters.dateStart,
          end: filters.dateEnd,
        },
      },
      ...aggregated,
    }

    // Cache the results for 24 hours
    cache.set(cacheKey, response, CACHE_TTL.RESULTS)

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Error fetching analysis results:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch analysis results',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}
