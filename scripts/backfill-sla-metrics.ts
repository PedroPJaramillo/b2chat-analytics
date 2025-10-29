/**
 * Feature 004: SLA Calculation Integration - Data Backfill Script
 *
 * This script backfills SLA metrics for existing chats by calling the
 * /api/sla/recalculate endpoint. Use this after integrating SLA calculation
 * into the transform engine to populate historical data.
 *
 * Usage:
 *   npm run backfill:sla
 *   npm run backfill:sla -- --days=90
 *   npm run backfill:sla -- --all
 *   npm run backfill:sla -- --chat-id=chat_abc123
 *
 * Options:
 *   --days=N: Backfill last N days (default: 30)
 *   --all: Backfill all chats (ignores --days)
 *   --chat-id=ID: Backfill only a specific chat
 *   --limit=N: Maximum chats to process (default: 10000)
 *   --start-date=YYYY-MM-DD: Custom start date
 *   --end-date=YYYY-MM-DD: Custom end date (default: today)
 */

import { prisma } from '../src/lib/prisma'
import { logger } from '../src/lib/logger'

interface BackfillOptions {
  days?: number
  all?: boolean
  chatId?: string
  limit?: number
  startDate?: string
  endDate?: string
}

interface BackfillResult {
  success: boolean
  processed: number
  failed: number
  total: number
  duration: number
  errors?: Array<{ chatId: string; error: string }>
}

/**
 * Parse command-line arguments
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2)
  const options: BackfillOptions = {}

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1], 10)
    } else if (arg === '--all') {
      options.all = true
    } else if (arg.startsWith('--chat-id=')) {
      options.chatId = arg.split('=')[1]
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10)
    } else if (arg.startsWith('--start-date=')) {
      options.startDate = arg.split('=')[1]
    } else if (arg.startsWith('--end-date=')) {
      options.endDate = arg.split('=')[1]
    }
  }

  return options
}

/**
 * Check database statistics before backfill
 */
async function getPreBackfillStats() {
  const totalChats = await prisma.chat.count()
  const chatsWithSLA = await prisma.chat.count({
    where: {
      overallSLA: { not: null },
    },
  })
  const chatsWithoutSLA = totalChats - chatsWithSLA

  return {
    totalChats,
    chatsWithSLA,
    chatsWithoutSLA,
    coveragePercent: totalChats > 0 ? ((chatsWithSLA / totalChats) * 100).toFixed(2) : '0.00',
  }
}

/**
 * Call the SLA recalculate API endpoint
 */
async function callRecalculateEndpoint(options: BackfillOptions): Promise<BackfillResult> {
  // Build URL with query parameters
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const url = new URL(`${baseUrl}/api/sla/recalculate`)

  if (options.chatId) {
    url.searchParams.set('chatId', options.chatId)
  } else {
    // Calculate date range
    const endDate = options.endDate || new Date().toISOString()
    url.searchParams.set('endDate', endDate)

    if (options.all) {
      // Set very old start date to get all chats
      url.searchParams.set('startDate', '2020-01-01T00:00:00.000Z')
    } else if (options.startDate) {
      url.searchParams.set('startDate', new Date(options.startDate).toISOString())
    } else {
      // Default: last N days
      const days = options.days || 30
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      url.searchParams.set('startDate', startDate.toISOString())
    }

    // Set limit
    const limit = Math.min(options.limit || 10000, 10000)
    url.searchParams.set('limit', limit.toString())
  }

  logger.info('Calling SLA recalculate endpoint', { url: url.toString() })

  // Call the endpoint
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  return result
}

/**
 * Main backfill function
 */
async function main() {
  console.log('🚀 Starting SLA Metrics Backfill\n')

  try {
    // Parse options
    const options = parseArgs()
    console.log('Options:', JSON.stringify(options, null, 2), '\n')

    // Check pre-backfill statistics
    console.log('📊 Checking current SLA coverage...')
    const preStats = await getPreBackfillStats()
    console.log(`Total chats: ${preStats.totalChats}`)
    console.log(`Chats with SLA: ${preStats.chatsWithSLA} (${preStats.coveragePercent}%)`)
    console.log(`Chats without SLA: ${preStats.chatsWithoutSLA}\n`)

    if (preStats.chatsWithoutSLA === 0) {
      console.log('✅ All chats already have SLA metrics. Nothing to do!')
      return
    }

    // Confirm with user
    if (!options.chatId && preStats.chatsWithoutSLA > 100) {
      console.log(`⚠️  About to backfill ${preStats.chatsWithoutSLA} chats`)
      console.log('Press Ctrl+C within 3 seconds to cancel...\n')
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    // Call recalculate endpoint
    console.log('🔄 Starting SLA calculation...')
    const startTime = Date.now()
    const result = await callRecalculateEndpoint(options)
    const totalTime = Date.now() - startTime

    // Display results
    console.log('\n✅ Backfill completed!')
    console.log(`Processed: ${result.processed}`)
    console.log(`Failed: ${result.failed}`)
    console.log(`Total: ${result.total}`)
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`)
    console.log(`Total time (including setup): ${(totalTime / 1000).toFixed(2)}s`)

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:')
      result.errors.slice(0, 10).forEach((err) => {
        console.log(`  - Chat ${err.chatId}: ${err.error}`)
      })
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`)
      }
    }

    // Check post-backfill statistics
    console.log('\n📊 Checking updated SLA coverage...')
    const postStats = await getPreBackfillStats()
    console.log(`Total chats: ${postStats.totalChats}`)
    console.log(`Chats with SLA: ${postStats.chatsWithSLA} (${postStats.coveragePercent}%)`)
    console.log(`Chats without SLA: ${postStats.chatsWithoutSLA}`)

    const improvement = postStats.chatsWithSLA - preStats.chatsWithSLA
    console.log(`\n📈 Improvement: +${improvement} chats with SLA metrics`)

    if (postStats.chatsWithoutSLA > 0) {
      console.log(
        `\n💡 Tip: ${postStats.chatsWithoutSLA} chats still missing SLA. Run with --all to backfill everything.`
      )
    }
  } catch (error) {
    console.error('\n❌ Backfill failed:', error)
    logger.error('SLA backfill failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
main()
