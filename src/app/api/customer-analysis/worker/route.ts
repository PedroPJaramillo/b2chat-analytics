/**
 * POST /api/customer-analysis/worker
 * Internal endpoint for background job processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { processAnalysis } from '@/lib/customer-analysis/worker'
import type { AnalysisWorkerRequest } from '@/types/customer-analysis'

/**
 * POST /api/customer-analysis/worker
 * Processes an analysis job in the background
 *
 * NOTE: This endpoint should be protected in production (e.g., via API key or internal-only access)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalysisWorkerRequest

    if (!body.analysisId) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_ANALYSIS_ID',
            message: 'analysisId is required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      )
    }

    // Process the analysis asynchronously
    // In production, this should be queued to a job processing system
    // For now, we'll process it directly but not wait for completion
    processAnalysis(body.analysisId).catch((error) => {
      console.error(`Worker failed for analysis ${body.analysisId}:`, error)
    })

    return NextResponse.json(
      {
        message: 'Analysis job started',
        analysisId: body.analysisId,
      },
      { status: 202 } // 202 Accepted
    )
  } catch (error) {
    console.error('Worker endpoint error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start analysis worker',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Maximum execution time for this serverless function
 * Vercel Pro: 60 seconds
 */
export const maxDuration = 60
