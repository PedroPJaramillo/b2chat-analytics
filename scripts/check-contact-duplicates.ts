#!/usr/bin/env tsx

/**
 * Contact Duplication Check
 *
 * This script checks for duplicate contacts in both raw and processed data:
 * - Duplicate b2chatId (should not exist due to unique constraint)
 * - Duplicate mobile numbers (potential real duplicates)
 * - Duplicate email addresses (potential real duplicates)
 * - Duplicate identification numbers (potential real duplicates)
 * - Duplicate contacts in RawContact staging table
 */

import { prisma } from '../src/lib/prisma'

interface DuplicateResult {
  value: string
  count: bigint
}

async function main() {
  console.log('🔍 Contact Duplication Check')
  console.log('='.repeat(80))
  console.log()

  try {
    // Database Information
    console.log('🗄️  Database Information:')
    console.log('-'.repeat(80))
    const dbUrl = process.env.DATABASE_URL || ''
    const dbUrlMatch = dbUrl.match(/\/([^/?]+)(\?|$)/)
    const dbName = dbUrlMatch ? dbUrlMatch[1] : 'Unknown'
    const hostMatch = dbUrl.match(/@([^:/]+)/)
    const dbHost = hostMatch ? hostMatch[1] : 'Unknown'
    console.log(`Database: ${dbName}`)
    console.log(`Host: ${dbHost}`)
    console.log()

    // Total counts
    const totalContacts = await prisma.contact.count()
    const totalRawContacts = await prisma.rawContact.count()

    // Fix 006: Count by sync source
    const [stubContacts, fullContacts, upgradedContacts] = await Promise.all([
      prisma.contact.count({ where: { syncSource: 'chat_embedded' } }),
      prisma.contact.count({ where: { syncSource: 'contacts_api' } }),
      prisma.contact.count({ where: { syncSource: 'upgraded' } }),
    ])

    console.log('📊 Summary:')
    console.log('-'.repeat(80))
    console.log(`Total Contacts (processed): ${totalContacts}`)
    console.log(`Total Raw Contacts (staging): ${totalRawContacts}`)
    console.log()
    console.log('Fix 006 - Contact Source Breakdown:')
    console.log(`  Stub contacts (chat_embedded): ${stubContacts}`)
    console.log(`  Full contacts (contacts_api): ${fullContacts}`)
    console.log(`  Upgraded contacts (upgraded): ${upgradedContacts}`)
    console.log()

    // 1. Check for duplicate b2chatId (should never happen due to unique constraint)
    console.log('1️⃣  B2Chat ID Duplicates (processed table):')
    console.log('-'.repeat(80))
    const duplicateB2ChatIds = await prisma.$queryRaw<DuplicateResult[]>`
      SELECT b2chat_id as value, COUNT(*) as count
      FROM contacts
      WHERE b2chat_id IS NOT NULL
      GROUP BY b2chat_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `

    if (duplicateB2ChatIds.length > 0) {
      console.log(`❌ Found ${duplicateB2ChatIds.length} duplicate B2Chat IDs (THIS SHOULD NOT HAPPEN!)`)
      duplicateB2ChatIds.slice(0, 10).forEach(dup => {
        console.log(`  ${dup.value}: ${dup.count} copies`)
      })

      // Fix 006: Show details for first duplicate including syncSource
      if (duplicateB2ChatIds.length > 0) {
        const firstDupId = duplicateB2ChatIds[0].value
        console.log()
        console.log(`📋 Details for duplicate B2Chat ID "${firstDupId}":`)
        const contacts = await prisma.contact.findMany({
          where: { b2chatId: firstDupId },
          select: {
            id: true,
            b2chatId: true,
            fullName: true,
            mobile: true,
            email: true,
            syncSource: true,
            needsFullSync: true,
            createdAt: true,
          },
        })
        contacts.forEach((contact, idx) => {
          console.log(`   ${idx + 1}. ${contact.fullName}`)
          console.log(`      Internal ID: ${contact.id}`)
          console.log(`      Mobile: ${contact.mobile || 'N/A'}`)
          console.log(`      Email: ${contact.email || 'N/A'}`)
          console.log(`      Source: ${contact.syncSource} (needsFullSync: ${contact.needsFullSync})`)
          console.log(`      Created: ${contact.createdAt.toISOString()}`)
        })
      }
    } else {
      console.log('✅ No duplicate B2Chat IDs found')
    }
    console.log()

    // 2. Check for duplicate mobile numbers
    console.log('2️⃣  Mobile Number Duplicates:')
    console.log('-'.repeat(80))
    const duplicateMobiles = await prisma.$queryRaw<DuplicateResult[]>`
      SELECT mobile as value, COUNT(*) as count
      FROM contacts
      WHERE mobile IS NOT NULL AND mobile != ''
      GROUP BY mobile
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `

    if (duplicateMobiles.length > 0) {
      console.log(`⚠️  Found ${duplicateMobiles.length} duplicate mobile numbers`)
      const totalDuplicateMobileRecords = duplicateMobiles.reduce((sum, dup) => sum + Number(dup.count), 0)
      console.log(`   Total contacts with duplicate mobiles: ${totalDuplicateMobileRecords}`)
      console.log()
      console.log('Top duplicates:')
      duplicateMobiles.slice(0, 10).forEach(dup => {
        console.log(`  ${dup.value}: ${dup.count} contacts`)
      })

      // Show details for the first duplicate
      if (duplicateMobiles.length > 0) {
        const firstDuplicate = duplicateMobiles[0].value
        console.log()
        console.log(`📋 Details for mobile "${firstDuplicate}":`)
        const contacts = await prisma.contact.findMany({
          where: { mobile: firstDuplicate },
          select: {
            id: true,
            b2chatId: true,
            fullName: true,
            email: true,
            mobile: true,
            identification: true,
            syncSource: true,
            needsFullSync: true,
            createdAt: true,
          },
        })
        contacts.forEach((contact, idx) => {
          console.log(`   ${idx + 1}. ${contact.fullName} (B2Chat ID: ${contact.b2chatId})`)
          console.log(`      Email: ${contact.email || 'N/A'}`)
          console.log(`      Identification: ${contact.identification || 'N/A'}`)
          console.log(`      Source: ${contact.syncSource} (needsFullSync: ${contact.needsFullSync})`)
          console.log(`      Created: ${contact.createdAt.toISOString()}`)
        })
      }
    } else {
      console.log('✅ No duplicate mobile numbers found')
    }
    console.log()

    // 3. Check for duplicate emails
    console.log('3️⃣  Email Address Duplicates:')
    console.log('-'.repeat(80))
    const duplicateEmails = await prisma.$queryRaw<DuplicateResult[]>`
      SELECT email as value, COUNT(*) as count
      FROM contacts
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `

    if (duplicateEmails.length > 0) {
      console.log(`⚠️  Found ${duplicateEmails.length} duplicate email addresses`)
      const totalDuplicateEmailRecords = duplicateEmails.reduce((sum, dup) => sum + Number(dup.count), 0)
      console.log(`   Total contacts with duplicate emails: ${totalDuplicateEmailRecords}`)
      console.log()
      console.log('Top duplicates:')
      duplicateEmails.slice(0, 10).forEach(dup => {
        console.log(`  ${dup.value}: ${dup.count} contacts`)
      })
    } else {
      console.log('✅ No duplicate email addresses found')
    }
    console.log()

    // 4. Check for duplicate identification numbers
    console.log('4️⃣  Identification Number Duplicates:')
    console.log('-'.repeat(80))
    const duplicateIdentifications = await prisma.$queryRaw<DuplicateResult[]>`
      SELECT identification as value, COUNT(*) as count
      FROM contacts
      WHERE identification IS NOT NULL AND identification != ''
      GROUP BY identification
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `

    if (duplicateIdentifications.length > 0) {
      console.log(`⚠️  Found ${duplicateIdentifications.length} duplicate identification numbers`)
      const totalDuplicateIdRecords = duplicateIdentifications.reduce((sum, dup) => sum + Number(dup.count), 0)
      console.log(`   Total contacts with duplicate IDs: ${totalDuplicateIdRecords}`)
      console.log()
      console.log('Top duplicates:')
      duplicateIdentifications.slice(0, 10).forEach(dup => {
        console.log(`  ${dup.value}: ${dup.count} contacts`)
      })
    } else {
      console.log('✅ No duplicate identification numbers found')
    }
    console.log()

    // 5. Check for duplicate contacts in RawContact staging table
    console.log('5️⃣  Raw Contact B2Chat ID Duplicates (staging table):')
    console.log('-'.repeat(80))
    const duplicateRawContacts = await prisma.$queryRaw<DuplicateResult[]>`
      SELECT b2chat_contact_id as value, COUNT(*) as count
      FROM raw_contacts
      GROUP BY b2chat_contact_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `

    const uniqueRawContacts = await prisma.$queryRaw<Array<{ unique_count: bigint }>>`
      SELECT COUNT(DISTINCT b2chat_contact_id) as unique_count
      FROM raw_contacts
    `

    const uniqueCount = Number(uniqueRawContacts[0]?.unique_count || 0)
    const duplicateCount = duplicateRawContacts.length

    console.log(`Unique B2Chat IDs: ${uniqueCount}`)
    console.log(`Duplicate B2Chat IDs: ${duplicateCount}`)

    if (duplicateCount > 0) {
      const totalDuplicateRecords = duplicateRawContacts.reduce((sum, dup) => sum + Number(dup.count) - 1, 0)
      console.log(`Total duplicate raw records: ${totalDuplicateRecords}`)
      console.log()
      console.log('Top duplicates:')
      duplicateRawContacts.slice(0, 10).forEach(dup => {
        console.log(`  ${dup.value}: ${dup.count} copies`)
      })
    } else {
      console.log('✅ No duplicates found in raw contacts')
    }
    console.log()

    // 6. Fix 006: Verify Smart Stub Logic
    console.log('6️⃣  Fix 006: Smart Stub Logic Verification:')
    console.log('-'.repeat(80))

    // Check for contacts that should have been upgraded but weren't
    const staleStubs = await prisma.contact.findMany({
      where: {
        needsFullSync: true,
        syncSource: 'chat_embedded',
      },
      select: {
        b2chatId: true,
        fullName: true,
        lastSyncAt: true,
      },
      take: 10,
    })

    console.log(`Stub contacts needing upgrade: ${staleStubs.length}`)
    if (staleStubs.length > 0) {
      console.log('⚠️  These stubs need full sync from contacts API:')
      staleStubs.forEach((stub, idx) => {
        const daysSinceSync = stub.lastSyncAt
          ? Math.floor((Date.now() - stub.lastSyncAt.getTime()) / (24 * 60 * 60 * 1000))
          : 'N/A'
        console.log(`   ${idx + 1}. ${stub.fullName} (${stub.b2chatId}) - Last sync: ${daysSinceSync} days ago`)
      })
      console.log('   Action: Run contact extraction and transformation to upgrade stubs.')
    }
    console.log()

    // Check if same b2chatId exists with different syncSources (potential issue)
    const duplicateSourceCheck = await prisma.$queryRaw<Array<{ b2chatId: string; sources: string; count: bigint }>>`
      SELECT
        b2chat_id as "b2chatId",
        string_agg(DISTINCT sync_source::text, ', ') as sources,
        COUNT(*) as count
      FROM contacts
      WHERE b2chat_id IS NOT NULL
      GROUP BY b2chat_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `

    if (duplicateSourceCheck.length > 0) {
      console.log('❌ CRITICAL: Same B2Chat ID with different sync sources (duplicates not prevented!):')
      duplicateSourceCheck.forEach((dup, idx) => {
        console.log(`   ${idx + 1}. B2Chat ID: ${dup.b2chatId}`)
        console.log(`      Count: ${dup.count} records`)
        console.log(`      Sources: ${dup.sources}`)
      })
      console.log()
      console.log('   This indicates Fix 006 is NOT working correctly!')
      console.log('   The smart stub logic should prevent creating multiple contacts with same b2chatId.')
    } else {
      console.log('✅ Smart stub logic is working: No b2chatId duplicates with different sources')
    }
    console.log()

    // 7. Summary and recommendations
    console.log('📝 Summary & Recommendations:')
    console.log('='.repeat(80))

    const hasDuplicates =
      duplicateB2ChatIds.length > 0 ||
      duplicateMobiles.length > 0 ||
      duplicateEmails.length > 0 ||
      duplicateIdentifications.length > 0 ||
      duplicateRawContacts.length > 0 ||
      duplicateSourceCheck.length > 0

    if (!hasDuplicates) {
      console.log('✅ No duplicates found! Your contact data is clean.')
    } else {
      console.log('⚠️  Duplicates detected. Recommendations:')
      console.log()

      if (duplicateB2ChatIds.length > 0) {
        console.log('❌ B2Chat ID duplicates:')
        console.log('   This violates the unique constraint and needs immediate attention.')
        console.log('   Action: Investigate database integrity.')
      }

      if (duplicateMobiles.length > 0) {
        console.log('⚠️  Mobile number duplicates:')
        console.log('   Multiple contacts sharing the same mobile number.')
        console.log('   Action: Review if these are legitimate separate contacts or should be merged.')
      }

      if (duplicateEmails.length > 0) {
        console.log('⚠️  Email duplicates:')
        console.log('   Multiple contacts sharing the same email address.')
        console.log('   Action: Review if these are legitimate separate contacts or should be merged.')
      }

      if (duplicateIdentifications.length > 0) {
        console.log('⚠️  Identification number duplicates:')
        console.log('   Multiple contacts with same identification number.')
        console.log('   Action: These likely represent the same person and should be merged.')
      }

      if (duplicateRawContacts.length > 0) {
        console.log('⚠️  Raw staging table duplicates:')
        console.log('   Same contact extracted multiple times from B2Chat API.')
        console.log('   Action: Normal during multiple syncs. Transform process will deduplicate.')
      }

      if (duplicateSourceCheck.length > 0) {
        console.log('❌ Fix 006 FAILURE - Multiple contacts with same B2Chat ID:')
        console.log('   The smart stub logic should prevent this!')
        console.log('   Action: Check if you regenerated Prisma client after migration.')
        console.log('   Action: Verify transform-engine.ts has the latest Fix 006 code.')
        console.log('   Action: Check server was restarted after code changes.')
      }

      if (staleStubs.length > 0) {
        console.log('⚠️  Stub contacts need upgrade:')
        console.log('   Run contact extraction and transformation to upgrade stubs to full contacts.')
      }
    }
    console.log()

  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
