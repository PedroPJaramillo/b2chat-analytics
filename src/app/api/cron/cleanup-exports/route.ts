/**
 * Cron Job: Cleanup expired export files
 * This endpoint should be triggered daily by a cron service (Vercel Cron or external)
 */

import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredExports, getExportStatistics } from '@/lib/customer-analysis/export-cleanup'

/**
 * GET /api/cron/cleanup-exports
 * Cleans up expired export files from blob storage and database
 *
 * Security: In production, this should be protected by:
 * 1. Vercel Cron Secret header verification
 * 2. IP allowlist
 * 3. API key authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for Vercel Cron)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid cron secret' },
        { status: 401 }
      )
    }

    console.log('Starting export cleanup job...')

    // Get current statistics before cleanup
    const statsBefore = await getExportStatistics()
    console.log('Export statistics before cleanup:', statsBefore)

    // Run cleanup
    const cleanupResult = await cleanupExpiredExports()

    // Get statistics after cleanup
    const statsAfter = await getExportStatistics()
    console.log('Export statistics after cleanup:', statsAfter)

    // Return result
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cleanupResult,
      statistics: {
        before: statsBefore,
        after: statsAfter,
        freedSpaceMB: statsBefore.totalSizeMB - statsAfter.totalSizeMB,
      },
    })
  } catch (error) {
    console.error('Export cleanup cron job failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
