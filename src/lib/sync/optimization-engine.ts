import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export interface OptimizationReport {
  syncId: string
  transformId?: string
  operationsPerformed: string[]
  tableStatisticsUpdated: string[]
  indexesAnalyzed: boolean
  vacuumPerformed: boolean
  duration: number
  createdAt: Date
}

export class OptimizationEngine {
  /**
   * Run all optimization tasks after transform completes
   */
  async optimize(transformId: string): Promise<OptimizationReport> {
    const syncId = `optimization_${transformId}_${Date.now()}`
    const startTime = Date.now()
    const operationsPerformed: string[] = []
    const tableStatisticsUpdated: string[] = []

    logger.info('Starting optimization', { syncId, transformId })

    try {
      // 1. Update table statistics
      const tables = await this.updateTableStatistics()
      tableStatisticsUpdated.push(...tables)
      operationsPerformed.push('update_table_statistics')

      // 2. Analyze index usage (optional, can be expensive)
      // const indexReport = await this.analyzeIndexUsage()
      // operationsPerformed.push('analyze_index_usage')

      // 3. Vacuum (optional - only if configured and needed)
      // This is typically done by a separate maintenance job
      // await this.vacuumTables()
      // operationsPerformed.push('vacuum_tables')

      const report: OptimizationReport = {
        syncId,
        transformId,
        operationsPerformed,
        tableStatisticsUpdated,
        indexesAnalyzed: false, // Set to true if index analysis is enabled
        vacuumPerformed: false, // Set to true if vacuum is enabled
        duration: Date.now() - startTime,
        createdAt: new Date(),
      }

      logger.info('Optimization completed', {
        syncId,
        operationsPerformed: report.operationsPerformed.length,
        duration: report.duration,
      })

      return report
    } catch (error) {
      logger.error('Optimization failed', {
        syncId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Update table statistics for query planner
   * Runs ANALYZE on key tables
   */
  private async updateTableStatistics(): Promise<string[]> {
    const tables = ['chats', 'messages', 'contacts', 'agents', 'departments']
    const updated: string[] = []

    try {
      for (const table of tables) {
        await prisma.$executeRawUnsafe(`ANALYZE ${table}`)
        updated.push(table)
        logger.debug(`Updated statistics for table: ${table}`)
      }

      logger.info('Table statistics updated', { tables: updated })
    } catch (error) {
      logger.error('Failed to update table statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    return updated
  }

  /**
   * Analyze index usage and report unused/underutilized indexes
   * This queries pg_stat_user_indexes
   */
  private async analyzeIndexUsage(): Promise<{
    unusedIndexes: Array<{ table: string; index: string }>
    underutilizedIndexes: Array<{ table: string; index: string; scans: number }>
  }> {
    try {
      // Find indexes that have never been used
      const unusedIndexes = await prisma.$queryRaw<
        Array<{ relname: string; indexrelname: string }>
      >`
        SELECT
          schemaname,
          relname,
          indexrelname
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
          AND schemaname = 'public'
          AND relname IN ('chats', 'messages', 'contacts', 'agents', 'departments')
        ORDER BY relname, indexrelname
      `

      // Find indexes with very low usage (< 10 scans)
      const underutilizedIndexes = await prisma.$queryRaw<
        Array<{ relname: string; indexrelname: string; idx_scan: bigint }>
      >`
        SELECT
          relname,
          indexrelname,
          idx_scan
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0 AND idx_scan < 10
          AND schemaname = 'public'
          AND relname IN ('chats', 'messages', 'contacts', 'agents', 'departments')
        ORDER BY idx_scan ASC
      `

      const result = {
        unusedIndexes: unusedIndexes.map((row) => ({
          table: row.relname,
          index: row.indexrelname,
        })),
        underutilizedIndexes: underutilizedIndexes.map((row) => ({
          table: row.relname,
          index: row.indexrelname,
          scans: Number(row.idx_scan),
        })),
      }

      if (result.unusedIndexes.length > 0) {
        logger.warn('Unused indexes detected', {
          count: result.unusedIndexes.length,
          indexes: result.unusedIndexes,
        })
      }

      if (result.underutilizedIndexes.length > 0) {
        logger.warn('Underutilized indexes detected', {
          count: result.underutilizedIndexes.length,
          indexes: result.underutilizedIndexes,
        })
      }

      return result
    } catch (error) {
      logger.error('Failed to analyze index usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        unusedIndexes: [],
        underutilizedIndexes: [],
      }
    }
  }

  /**
   * Run VACUUM on tables with high update churn
   * WARNING: This can be expensive and should typically be done during maintenance windows
   */
  private async vacuumTables(): Promise<void> {
    const tables = ['chats', 'messages', 'contacts']

    try {
      for (const table of tables) {
        // Check if table has significant dead tuples before vacuuming
        const stats = await prisma.$queryRaw<
          Array<{ n_dead_tup: bigint; n_live_tup: bigint }>
        >`
          SELECT n_dead_tup, n_live_tup
          FROM pg_stat_user_tables
          WHERE relname = ${table}
        `

        if (stats.length > 0) {
          const deadTuples = Number(stats[0].n_dead_tup)
          const liveTuples = Number(stats[0].n_live_tup)
          const deadRatio = liveTuples > 0 ? deadTuples / liveTuples : 0

          // Only vacuum if dead tuples exceed 10% of live tuples
          if (deadRatio > 0.1) {
            logger.info(`Vacuuming table ${table}`, {
              deadTuples,
              liveTuples,
              deadRatio: `${(deadRatio * 100).toFixed(2)}%`,
            })

            await prisma.$executeRawUnsafe(`VACUUM ANALYZE ${table}`)
          }
        }
      }
    } catch (error) {
      logger.error('Failed to vacuum tables', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get database size and table sizes
   */
  async getDatabaseStats(): Promise<{
    databaseSize: string
    tableSizes: Array<{ table: string; size: string; rowCount: number }>
  }> {
    try {
      // Get database size
      const dbSize = await prisma.$queryRaw<Array<{ pg_database_size: bigint }>>`
        SELECT pg_database_size(current_database()) as pg_database_size
      `

      // Get table sizes
      const tableSizes = await prisma.$queryRaw<
        Array<{ tablename: string; size: string }>
      >`
        SELECT
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('chats', 'messages', 'contacts', 'agents', 'departments', 'raw_chats', 'raw_contacts')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `

      const tableSizesWithCounts = await Promise.all(
        tableSizes.map(async (row) => {
          const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*)::bigint as count FROM "${row.tablename}"`
          )
          return {
            table: row.tablename,
            size: row.size,
            rowCount: Number(countResult[0]?.count ?? 0),
          }
        })
      )

      return {
        databaseSize: this.formatBytes(Number(dbSize[0].pg_database_size)),
        tableSizes: tableSizesWithCounts,
      }
    } catch (error) {
      logger.error('Failed to get database stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        databaseSize: 'unknown',
        tableSizes: [],
      }
    }
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }
}
