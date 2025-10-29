/**
 * Feature 002: Contact Field Mapping Fixes - Data Backfill Script
 *
 * This script backfills the new contact fields (tags, merchantId, b2chatCreatedAt,
 * b2chatUpdatedAt, phoneNumber) for existing contacts from the raw_contacts staging table.
 *
 * Usage:
 *   npm run ts-node scripts/backfill-contact-fields.ts
 *   npm run ts-node scripts/backfill-contact-fields.ts --dry-run
 *   npm run ts-node scripts/backfill-contact-fields.ts --batch-size=50
 *
 * Options:
 *   --dry-run: Preview changes without applying them
 *   --batch-size=N: Process N contacts at a time (default: 100)
 *   --contact-id=ID: Backfill only a specific contact
 */

import { prisma } from '../src/lib/prisma'
import { logger } from '../src/lib/logger'

interface BackfillStats {
  totalContacts: number
  contactsUpdated: number
  contactsSkipped: number
  contactsFailed: number
  fieldsBackfilled: {
    tags: number
    merchantId: number
    phoneNumber: number
    b2chatCreatedAt: number
    b2chatUpdatedAt: number
  }
}

interface ScriptOptions {
  dryRun: boolean
  batchSize: number
  contactId?: string
}

/**
 * Parse B2Chat timestamp to Date
 */
function parseB2ChatTimestamp(dateString: string | null | undefined): Date | undefined {
  if (!dateString) return undefined
  try {
    const parsed = new Date(dateString)
    return isNaN(parsed.getTime()) ? undefined : parsed
  } catch {
    return undefined
  }
}

/**
 * Get the most recent raw contact data for a b2chatId
 */
async function getMostRecentRawContact(b2chatId: string) {
  return await prisma.rawContact.findFirst({
    where: {
      rawData: {
        path: ['contact_id'],
        equals: b2chatId,
      },
      processingStatus: 'processed',
    },
    orderBy: {
      fetchedAt: 'desc',
    },
  })
}

/**
 * Backfill missing fields for a single contact
 */
async function backfillContact(
  contact: any,
  stats: BackfillStats,
  options: ScriptOptions
): Promise<boolean> {
  try {
    // Find the most recent raw contact data
    const rawContact = await getMostRecentRawContact(contact.b2chatId)

    if (!rawContact) {
      logger.warn('No raw contact data found', { contactId: contact.id, b2chatId: contact.b2chatId })
      stats.contactsSkipped++
      return false
    }

    const rawData = rawContact.rawData as any
    const updates: any = {}
    let hasUpdates = false

    // Backfill tags if missing
    if (!contact.tags && rawData.tags) {
      updates.tags = rawData.tags
      stats.fieldsBackfilled.tags++
      hasUpdates = true
      logger.debug('Backfilling tags', {
        contactId: contact.id,
        tagCount: rawData.tags.length,
      })
    }

    // Backfill merchantId if missing
    if (!contact.merchantId && rawData.merchant_id) {
      updates.merchantId = String(rawData.merchant_id)
      stats.fieldsBackfilled.merchantId++
      hasUpdates = true
      logger.debug('Backfilling merchantId', {
        contactId: contact.id,
        merchantId: updates.merchantId,
      })
    }

    // Backfill phoneNumber (landline) if missing
    if (!contact.phoneNumber && rawData.landline) {
      updates.phoneNumber = rawData.landline
      stats.fieldsBackfilled.phoneNumber++
      hasUpdates = true
      logger.debug('Backfilling phoneNumber (landline)', {
        contactId: contact.id,
        phoneNumber: updates.phoneNumber,
      })
    }

    // Backfill b2chatCreatedAt if missing
    if (!contact.b2chatCreatedAt && rawData.created) {
      const parsed = parseB2ChatTimestamp(rawData.created)
      if (parsed) {
        updates.b2chatCreatedAt = parsed
        stats.fieldsBackfilled.b2chatCreatedAt++
        hasUpdates = true
        logger.debug('Backfilling b2chatCreatedAt', {
          contactId: contact.id,
          date: parsed.toISOString(),
        })
      }
    }

    // Backfill b2chatUpdatedAt if missing
    if (!contact.b2chatUpdatedAt && rawData.updated) {
      const parsed = parseB2ChatTimestamp(rawData.updated)
      if (parsed) {
        updates.b2chatUpdatedAt = parsed
        stats.fieldsBackfilled.b2chatUpdatedAt++
        hasUpdates = true
        logger.debug('Backfilling b2chatUpdatedAt', {
          contactId: contact.id,
          date: parsed.toISOString(),
        })
      }
    }

    if (!hasUpdates) {
      stats.contactsSkipped++
      return false
    }

    // Log planned updates
    logger.info('Backfill updates for contact', {
      contactId: contact.id,
      b2chatId: contact.b2chatId,
      updates: Object.keys(updates),
      dryRun: options.dryRun,
    })

    // Apply updates if not dry run
    if (!options.dryRun) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      })

      logger.info('Contact backfilled successfully', {
        contactId: contact.id,
        fieldsUpdated: Object.keys(updates),
      })
    }

    stats.contactsUpdated++
    return true
  } catch (error) {
    stats.contactsFailed++
    logger.error('Failed to backfill contact', {
      contactId: contact.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

/**
 * Main backfill function
 */
async function backfillContactFields(options: ScriptOptions) {
  const stats: BackfillStats = {
    totalContacts: 0,
    contactsUpdated: 0,
    contactsSkipped: 0,
    contactsFailed: 0,
    fieldsBackfilled: {
      tags: 0,
      merchantId: 0,
      phoneNumber: 0,
      b2chatCreatedAt: 0,
      b2chatUpdatedAt: 0,
    },
  }

  logger.info('Starting contact fields backfill', {
    dryRun: options.dryRun,
    batchSize: options.batchSize,
    contactId: options.contactId,
  })

  try {
    // Build where clause
    const whereClause: any = {
      isDeleted: false,
    }

    // If specific contact ID provided, only backfill that contact
    if (options.contactId) {
      whereClause.OR = [
        { id: options.contactId },
        { b2chatId: options.contactId },
      ]
    } else {
      // Only backfill contacts that are missing at least one new field
      whereClause.OR = [
        { tags: null },
        { merchantId: null },
        { phoneNumber: null },
        { b2chatCreatedAt: null },
        { b2chatUpdatedAt: null },
      ]
    }

    // Get total count
    const totalCount = await prisma.contact.count({ where: whereClause })
    stats.totalContacts = totalCount

    logger.info('Found contacts to backfill', {
      totalContacts: totalCount,
      batchSize: options.batchSize,
    })

    if (totalCount === 0) {
      logger.info('No contacts need backfilling')
      return stats
    }

    // Process in batches
    let processed = 0
    while (processed < totalCount) {
      const contacts = await prisma.contact.findMany({
        where: whereClause,
        take: options.batchSize,
        skip: processed,
        orderBy: { createdAt: 'asc' },
      })

      logger.info('Processing batch', {
        batchNumber: Math.floor(processed / options.batchSize) + 1,
        batchSize: contacts.length,
        processed,
        total: totalCount,
      })

      // Process each contact in the batch
      for (const contact of contacts) {
        await backfillContact(contact, stats, options)
      }

      processed += contacts.length

      // Log progress
      logger.info('Batch completed', {
        processed,
        total: totalCount,
        progress: `${((processed / totalCount) * 100).toFixed(1)}%`,
      })
    }

    // Log final stats
    logger.info('Backfill completed', {
      totalContacts: stats.totalContacts,
      contactsUpdated: stats.contactsUpdated,
      contactsSkipped: stats.contactsSkipped,
      contactsFailed: stats.contactsFailed,
      fieldsBackfilled: stats.fieldsBackfilled,
      dryRun: options.dryRun,
    })

    return stats
  } catch (error) {
    logger.error('Backfill failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2)
  const options: ScriptOptions = {
    dryRun: false,
    batchSize: 100,
  }

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10)
    } else if (arg.startsWith('--contact-id=')) {
      options.contactId = arg.split('=')[1]
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run ts-node scripts/backfill-contact-fields.ts [OPTIONS]

Options:
  --dry-run              Preview changes without applying them
  --batch-size=N         Process N contacts at a time (default: 100)
  --contact-id=ID        Backfill only a specific contact
  --help, -h             Show this help message

Examples:
  # Preview what would be backfilled
  npm run ts-node scripts/backfill-contact-fields.ts --dry-run

  # Backfill all contacts in batches of 50
  npm run ts-node scripts/backfill-contact-fields.ts --batch-size=50

  # Backfill a specific contact
  npm run ts-node scripts/backfill-contact-fields.ts --contact-id=contact_123
      `)
      process.exit(0)
    }
  }

  return options
}

/**
 * Run the script
 */
if (require.main === module) {
  const options = parseArgs()

  backfillContactFields(options)
    .then((stats) => {
      console.log('\n✅ Backfill completed successfully!')
      console.log('───────────────────────────────────')
      console.log(`Total contacts: ${stats.totalContacts}`)
      console.log(`Contacts updated: ${stats.contactsUpdated}`)
      console.log(`Contacts skipped: ${stats.contactsSkipped}`)
      console.log(`Contacts failed: ${stats.contactsFailed}`)
      console.log('\nFields backfilled:')
      console.log(`  • Tags: ${stats.fieldsBackfilled.tags}`)
      console.log(`  • Merchant ID: ${stats.fieldsBackfilled.merchantId}`)
      console.log(`  • Phone Number (landline): ${stats.fieldsBackfilled.phoneNumber}`)
      console.log(`  • B2Chat Created At: ${stats.fieldsBackfilled.b2chatCreatedAt}`)
      console.log(`  • B2Chat Updated At: ${stats.fieldsBackfilled.b2chatUpdatedAt}`)
      console.log('───────────────────────────────────')
      if (options.dryRun) {
        console.log('\n⚠️  DRY RUN: No changes were applied')
      }
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Backfill failed:', error.message)
      process.exit(1)
    })
}

// Note: This is a standalone script, not a module.
// Run with: npm run backfill:contacts
