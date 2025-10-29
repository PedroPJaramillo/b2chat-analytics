/**
 * GET /api/customer-analysis/:analysisId - Get analysis status
 * DELETE /api/customer-analysis/:analysisId - Delete analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAnalysisPermission } from '@/lib/customer-analysis/auth'
import { invalidateAnalysisCache } from '@/lib/customer-analysis/cache'
import type { AnalysisStatusResponse } from '@/types/customer-analysis'

interface RouteContext {
  params: Promise<{ analysisId: string }>
}

/**
 * GET /api/customer-analysis/:analysisId
 * Retrieves analysis status for polling
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { analysisId } = await context.params

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
        filters: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        triggeredBy: true,
        totalChatsAnalyzed: true,
        totalMessagesAnalyzed: true,
        aiAnalysisCount: true,
        processingTimeMs: true,
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

    // Check if user has access (Managers can only see their own analyses)
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

    // Calculate progress if processing
    let progress
    if (analysis.status === 'PROCESSING') {
      const filters = analysis.filters as any
      const totalChats = analysis.totalChatsAnalyzed || 0
      const estimatedTotal = filters.estimatedChats || totalChats || 1

      progress = {
        chatsProcessed: totalChats,
        totalChats: estimatedTotal,
        percentComplete: Math.min(
          Math.floor((totalChats / estimatedTotal) * 100),
          99
        ),
      }
    }

    const response: AnalysisStatusResponse = {
      id: analysis.id,
      status: analysis.status,
      progress,
      startedAt: analysis.startedAt?.toISOString(),
      completedAt: analysis.completedAt?.toISOString(),
      errorMessage: analysis.errorMessage || undefined,
      totalChatsAnalyzed: analysis.totalChatsAnalyzed || undefined,
      totalMessagesAnalyzed: analysis.totalMessagesAnalyzed || undefined,
      aiAnalysisCount: analysis.aiAnalysisCount || undefined,
      processingTimeMs: analysis.processingTimeMs || undefined,
      filters: analysis.filters as any,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Error fetching analysis status:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch analysis status',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customer-analysis/:analysisId
 * Deletes an analysis and all related data
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { analysisId } = await context.params

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

    // Fetch analysis to check ownership
    const analysis = await prisma.customerAnalysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        triggeredBy: true,
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

    // Check authorization (Managers can only delete their own analyses)
    if (userRole === 'Manager' && analysis.triggeredBy !== userId) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You can only delete your own analyses',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      )
    }

    // Count related records before deletion
    const [categorizationsCount, kpisCount, exportsCount] = await Promise.all([
      prisma.customerCategorization.count({ where: { analysisId } }),
      prisma.analysisKPI.count({ where: { analysisId } }),
      prisma.analysisExport.count({ where: { analysisId } }),
    ])

    // TODO: Delete blob files for exports before deleting records
    const exports = await prisma.analysisExport.findMany({
      where: { analysisId },
      select: { blobKey: true },
    })

    // Delete the analysis (cascade will delete related records)
    await prisma.customerAnalysis.delete({
      where: { id: analysisId },
    })

    // Invalidate cache
    invalidateAnalysisCache(analysisId)

    // TODO: Delete blob files from Vercel Blob storage
    // for (const exp of exports) {
    //   if (exp.blobKey) {
    //     await del(exp.blobKey)
    //   }
    // }

    return NextResponse.json(
      {
        message: 'Analysis deleted successfully',
        deletedRecords: {
          categorizations: categorizationsCount,
          kpis: kpisCount,
          exports: exportsCount,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting analysis:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete analysis',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}
