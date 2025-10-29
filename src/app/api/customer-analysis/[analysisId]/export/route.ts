/**
 * API Route: POST /api/customer-analysis/:analysisId/export
 * Generate and export analysis report in PDF or CSV format
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAnalysisPermission } from '@/lib/customer-analysis/auth'
import { checkRateLimit } from '@/lib/customer-analysis/rate-limit'
import { aggregateAnalysisResults } from '@/lib/customer-analysis/results-aggregation'
import { generatePDF, generatePDFFilename } from '@/lib/customer-analysis/export-pdf'
import { generateCSV, generateCSVFilename, csvToBuffer } from '@/lib/customer-analysis/export-csv'
import { put } from '@vercel/blob'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

type RouteContext = {
  params: Promise<{ analysisId: string }>
}

/**
 * POST /api/customer-analysis/:analysisId/export
 * Generate export file (PDF or CSV)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Authentication & Authorization
    const authResult = await checkAnalysisPermission()
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.statusCode }
      )
    }

    const { userId, userRole } = authResult

    // Rate limiting (20 exports per day per user)
    const rateLimit = checkRateLimit(userId!, 'export')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many export requests. Try again in ${Math.ceil(
            rateLimit.retryAfterMs! / 1000 / 60
          )} minutes.`,
          retryAfterMs: rateLimit.retryAfterMs,
        },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { format } = body

    // Validate format
    if (!format || !['PDF', 'CSV'].includes(format)) {
      return NextResponse.json(
        { error: 'INVALID_FORMAT', message: 'Format must be PDF or CSV' },
        { status: 400 }
      )
    }

    // Get analysisId from params
    const { analysisId } = await context.params

    // Fetch analysis
    const analysis = await prisma.customerAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        triggeredByUser: {
          select: { id: true, role: true },
        },
      },
    })

    if (!analysis) {
      return NextResponse.json(
        { error: 'ANALYSIS_NOT_FOUND', message: 'Analysis not found' },
        { status: 404 }
      )
    }

    // Check if analysis is completed
    if (analysis.status !== 'COMPLETED' && analysis.status !== 'PARTIAL') {
      return NextResponse.json(
        {
          error: 'ANALYSIS_NOT_COMPLETED',
          message: 'Cannot export incomplete analysis',
          currentStatus: analysis.status,
        },
        { status: 400 }
      )
    }

    // Authorization: Only analysis owner or Admin can export
    if (userRole !== 'Admin' && analysis.triggeredBy !== userId) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'You do not have permission to export this analysis' },
        { status: 403 }
      )
    }

    // Fetch analysis data
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

    const resultsData: AnalysisResultsResponse = {
      analysisId,
      status: analysis.status as 'COMPLETED' | 'PARTIAL',
      summary: {
        totalChatsAnalyzed: analysis.totalChatsAnalyzed,
        totalMessagesAnalyzed: analysis.totalMessagesAnalyzed,
        aiAnalysisCount: analysis.aiAnalysisCount,
        dateRange: {
          start: (analysis.filters as any).dateStart,
          end: (analysis.filters as any).dateEnd,
        },
      },
      ...aggregated,
    }

    // Generate export based on format
    let fileName: string
    let fileBuffer: Buffer
    let blobUrl: string | null = null
    let blobKey: string | null = null

    if (format === 'PDF') {
      // Generate PDF
      fileName = generatePDFFilename(analysisId)
      fileBuffer = await generatePDF(resultsData)

      // Upload to Vercel Blob with 7-day expiry
      const uploadResult = await put(fileName, fileBuffer, {
        access: 'public',
        addRandomSuffix: true,
      })

      blobUrl = uploadResult.url
      blobKey = uploadResult.pathname // Store pathname for cleanup
    } else {
      // Generate CSV
      fileName = generateCSVFilename(analysisId)
      const csvString = generateCSV(resultsData)
      fileBuffer = csvToBuffer(csvString)

      // For CSV, we'll return as direct download (no blob storage needed)
      blobUrl = null
      blobKey = null
    }

    // Store export record in database
    const exportRecord = await prisma.analysisExport.create({
      data: {
        analysisId,
        format,
        fileName,
        blobUrl,
        blobKey,
        generatedBy: userId!,
        fileSizeBytes: fileBuffer.length,
        expiresAt: format === 'PDF' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, // 7 days for PDF
      },
    })

    // Return response
    if (format === 'PDF') {
      return NextResponse.json({
        exportId: exportRecord.id,
        format,
        fileName,
        downloadUrl: blobUrl!,
        expiresAt: exportRecord.expiresAt?.toISOString(),
        fileSizeBytes: fileBuffer.length,
      })
    } else {
      // For CSV, return the file directly as a download
      const responseBody = new Uint8Array(fileBuffer)
      return new NextResponse(responseBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      })
    }
  } catch (error) {
    console.error('Export generation error:', error)
    return NextResponse.json(
      {
        error: 'EXPORT_GENERATION_FAILED',
        message: 'Failed to generate export',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
