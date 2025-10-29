#!/usr/bin/env tsx

/**
 * Check Raw Data Status
 *
 * this script checks the raw staging tables to see what data was extracted.
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('📦 Raw Data Status Check')
  console.log('='.repeat(80))
  console.log()

  try {
    // Database Information
    console.log('🗄️  Database Information:')
    console.log('-'.repeat(80))

    // Get database name from connection
    const dbUrl = process.env.DATABASE_URL || ''
    const dbUrlMatch = dbUrl.match(/\/([^/?]+)(\?|$)/)
    const dbName = dbUrlMatch ? dbUrlMatch[1] : 'Unknown'

    // Get host from connection
    const hostMatch = dbUrl.match(/@([^:/]+)/)
    const dbHost = hostMatch ? hostMatch[1] : 'Unknown'

    // Get PostgreSQL version
    const dbVersion = await prisma.$queryRaw<[{ version: string }]>`SELECT version()`
    const versionString = dbVersion[0]?.version || 'Unknown'
    const versionMatch = versionString.match(/PostgreSQL ([\d.]+)/)
    const pgVersion = versionMatch ? versionMatch[1] : versionString.substring(0, 50)

    console.log(`Database: ${dbName}`)
    console.log(`Host: ${dbHost}`)
    console.log(`PostgreSQL Version: ${pgVersion}`)
    console.log(`Connection: ✅ Active`)
    console.log()

    // Check raw contacts
    console.log('1️⃣  Raw Contacts:')
    console.log('-'.repeat(80))
    const totalRawContacts = await prisma.rawContact.count()
    const pendingContacts = await prisma.rawContact.count({ where: { processingStatus: 'pending' } })
    const processedContacts = await prisma.rawContact.count({ where: { processingStatus: 'processed' } })

    console.log(`Total: ${totalRawContacts}`)
    console.log(`Pending: ${pendingContacts}`)
    console.log(`Processed: ${processedContacts}`)

    // Check raw chats
    console.log('\n\n2️⃣  Raw Chats:')
    console.log('-'.repeat(80))
    const totalRawChats = await prisma.rawChat.count()
    const pendingChats = await prisma.rawChat.count({ where: { processingStatus: 'pending' } })
    const processedChats = await prisma.rawChat.count({ where: { processingStatus: 'processed' } })

    console.log(`Total: ${totalRawChats}`)
    console.log(`Pending: ${pendingChats}`)
    console.log(`Processed: ${processedChats}`)

    // Check for duplicates
    const duplicateChats = await prisma.$queryRaw<Array<{ b2chatChatId: string; count: bigint }>>`
      SELECT b2chat_chat_id as "b2chatChatId", COUNT(*) as count
      FROM raw_chats
      GROUP BY b2chat_chat_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `

    const uniqueChats = await prisma.$queryRaw<Array<{ unique_count: bigint }>>`
      SELECT COUNT(DISTINCT b2chat_chat_id) as unique_count
      FROM raw_chats
    `

    const uniqueCount = Number(uniqueChats[0]?.unique_count || 0)
    const duplicateCount = duplicateChats.length

    console.log(`\n🔍 Duplicate Check:`)
    console.log(`Unique B2Chat IDs: ${uniqueCount}`)
    console.log(`Duplicate B2Chat IDs: ${duplicateCount}`)

    if (duplicateCount > 0) {
      const totalDuplicateRecords = duplicateChats.reduce((sum, dup) => sum + Number(dup.count) - 1, 0)
      console.log(`Total duplicate records: ${totalDuplicateRecords}`)
      console.log(`\nTop duplicates:`)
      duplicateChats.slice(0, 5).forEach(dup => {
        console.log(`  ${dup.b2chatChatId}: ${dup.count} copies`)
      })
    } else {
      console.log(`✅ No duplicates found`)
    }

    // Analyze message distribution in raw chats
    if (totalRawChats > 0) {
      console.log(`\n📊 Message Distribution in Raw Data:`)

      // Get the most recent sync ID
      const latestChat = await prisma.rawChat.findFirst({
        orderBy: { fetchedAt: 'desc' },
        select: { syncId: true }
      })

      if (latestChat) {
        // Get all chats from the last sync
        const rawChats = await prisma.rawChat.findMany({
          where: { syncId: latestChat.syncId },
          orderBy: { fetchedAt: 'desc' }
        })

        const messageStats = {
          0: 0,
          1: 0,
          2: 0,
          '3-5': 0,
          '6-10': 0,
          '10+': 0,
        }

        let totalMessages = 0
        rawChats.forEach(chat => {
          const data = chat.rawData as any
          const messages = data.messages || []
          const count = messages.length
          totalMessages += count

          if (count === 0) messageStats[0]++
          else if (count === 1) messageStats[1]++
          else if (count === 2) messageStats[2]++
          else if (count <= 5) messageStats['3-5']++
          else if (count <= 10) messageStats['6-10']++
          else messageStats['10+']++
        })

        const totalChatsInSync = rawChats.length

        console.log(`\nMessages per chat (last data sync - ${totalChatsInSync} chats):`)
        console.log(`  0 messages:    ${messageStats[0]} chats (${((messageStats[0] / totalChatsInSync) * 100).toFixed(1)}%)`)
        console.log(`  1 message:     ${messageStats[1]} chats (${((messageStats[1] / totalChatsInSync) * 100).toFixed(1)}%)`)
        console.log(`  2 messages:    ${messageStats[2]} chats (${((messageStats[2] / totalChatsInSync) * 100).toFixed(1)}%)`)
        console.log(`  3-5 messages:  ${messageStats['3-5']} chats (${((messageStats['3-5'] / totalChatsInSync) * 100).toFixed(1)}%)`)
        console.log(`  6-10 messages: ${messageStats['6-10']} chats (${((messageStats['6-10'] / totalChatsInSync) * 100).toFixed(1)}%)`)
        console.log(`  10+ messages:  ${messageStats['10+']} chats (${((messageStats['10+'] / totalChatsInSync) * 100).toFixed(1)}%)`)
        console.log(`\nAverage messages/chat: ${(totalMessages / rawChats.length).toFixed(1)}`)
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
