/**
 * Export Cleanup Job
 * Deletes expired export files from Vercel Blob storage and database
 */

import { prisma } from '@/lib/prisma'
import { del } from '@vercel/blob'

export interface CleanupResult {
  deletedCount: number
  failedDeletes: Array<{ id: string; error: string }>
  blobsDeleted: number
}

/**
 * Clean up expired export files
 * Should be run as a cron job (daily recommended)
 */
export async function cleanupExpiredExports(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    failedDeletes: [],
    blobsDeleted: 0,
  }

  try {
    // Find expired exports
    const expiredExports = await prisma.analysisExport.findMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
        blobKey: true,
        fileName: true,
      },
    })

    console.log(`Found ${expiredExports.length} expired exports to clean up`)

    // Delete from Vercel Blob first
    for (const exportRecord of expiredExports) {
      if (exportRecord.blobKey) {
        try {
          await del(exportRecord.blobKey)
          result.blobsDeleted++
          console.log(`Deleted blob: ${exportRecord.blobKey}`)
        } catch (error) {
          console.error(`Failed to delete blob ${exportRecord.blobKey}:`, error)
          result.failedDeletes.push({
            id: exportRecord.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          // Continue to delete database record even if blob deletion fails
        }
      }
    }

    // Delete database records
    if (expiredExports.length > 0) {
      const deleteResult = await prisma.analysisExport.deleteMany({
        where: {
          id: {
            in: expiredExports.map((e) => e.id),
          },
        },
      })
      result.deletedCount = deleteResult.count
      console.log(`Deleted ${deleteResult.count} export records from database`)
    }

    return result
  } catch (error) {
    console.error('Export cleanup job failed:', error)
    throw error
  }
}

/**
 * Clean up old exports for a specific analysis
 * Called when an analysis is deleted to clean up associated exports
 */
export async function cleanupAnalysisExports(analysisId: string): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    failedDeletes: [],
    blobsDeleted: 0,
  }

  try {
    // Find all exports for this analysis
    const exports = await prisma.analysisExport.findMany({
      where: { analysisId },
      select: {
        id: true,
        blobKey: true,
        fileName: true,
      },
    })

    console.log(`Found ${exports.length} exports to clean up for analysis ${analysisId}`)

    // Delete from Vercel Blob
    for (const exportRecord of exports) {
      if (exportRecord.blobKey) {
        try {
          await del(exportRecord.blobKey)
          result.blobsDeleted++
          console.log(`Deleted blob: ${exportRecord.blobKey}`)
        } catch (error) {
          console.error(`Failed to delete blob ${exportRecord.blobKey}:`, error)
          result.failedDeletes.push({
            id: exportRecord.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    // Database records will be deleted via CASCADE when analysis is deleted
    // So we just return the counts here
    result.deletedCount = exports.length

    return result
  } catch (error) {
    console.error('Analysis exports cleanup failed:', error)
    throw error
  }
}

/**
 * Get statistics about current exports
 */
export async function getExportStatistics() {
  const [totalExports, expiredCount, totalSize] = await Promise.all([
    prisma.analysisExport.count(),
    prisma.analysisExport.count({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    }),
    prisma.analysisExport.aggregate({
      _sum: {
        fileSizeBytes: true,
      },
    }),
  ])

  return {
    totalExports,
    expiredCount,
    totalSizeBytes: totalSize._sum.fileSizeBytes || 0,
    totalSizeMB: Math.round((totalSize._sum.fileSizeBytes || 0) / 1024 / 1024),
  }
}
