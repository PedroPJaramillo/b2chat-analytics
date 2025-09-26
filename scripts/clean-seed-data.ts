import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanSeedData() {
  console.log('🧹 Starting seed data cleanup...')

  try {
    // Get counts before deletion
    const beforeCounts = {
      users: await prisma.user.count(),
      departments: await prisma.department.count(),
      agents: await prisma.agent.count(),
      contacts: await prisma.contact.count(),
      chats: await prisma.chat.count(),
      messages: await prisma.message.count(),
      syncStates: await prisma.syncState.count()
    }

    console.log('📊 Current data counts:')
    Object.entries(beforeCounts).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`)
    })

    // Delete in order to respect foreign key constraints
    console.log('\n🗑️  Deleting seed data...')

    // Delete messages first (they reference chats)
    const deletedMessages = await prisma.message.deleteMany({
      where: {
        chat: {
          b2chatId: {
            in: ['b2chat_001', 'b2chat_002', 'b2chat_003']
          }
        }
      }
    })
    console.log(`✓ Deleted ${deletedMessages.count} seed messages`)

    // Delete chats (they reference agents and contacts)
    const deletedChats = await prisma.chat.deleteMany({
      where: {
        b2chatId: {
          in: ['b2chat_001', 'b2chat_002', 'b2chat_003']
        }
      }
    })
    console.log(`✓ Deleted ${deletedChats.count} seed chats`)

    // Delete contacts
    const deletedContacts = await prisma.contact.deleteMany({
      where: {
        b2chatId: {
          in: ['contact_001', 'contact_002', 'contact_003']
        }
      }
    })
    console.log(`✓ Deleted ${deletedContacts.count} seed contacts`)

    // Delete agents
    const deletedAgents = await prisma.agent.deleteMany({
      where: {
        b2chatId: {
          in: ['agent_001', 'agent_002', 'agent_003', 'agent_004']
        }
      }
    })
    console.log(`✓ Deleted ${deletedAgents.count} seed agents`)

    // Delete departments (keep them as they might be real)
    const deletedDepartments = await prisma.department.deleteMany({
      where: {
        b2chatCode: {
          in: ['SALES', 'SUPPORT']
        }
      }
    })
    console.log(`✓ Deleted ${deletedDepartments.count} seed departments`)

    // Keep the test user but mark it clearly
    await prisma.user.updateMany({
      where: {
        email: 'admin@b2chat.com'
      },
      data: {
        name: 'Test Admin (Development Only)'
      }
    })
    console.log(`✓ Updated test user to be clearly marked`)

    // Reset sync states to initial state
    await prisma.syncState.deleteMany({
      where: {
        entityType: {
          in: ['agents', 'contacts', 'chats']
        }
      }
    })
    console.log(`✓ Reset sync states`)

    // Get counts after deletion
    const afterCounts = {
      users: await prisma.user.count(),
      departments: await prisma.department.count(),
      agents: await prisma.agent.count(),
      contacts: await prisma.contact.count(),
      chats: await prisma.chat.count(),
      messages: await prisma.message.count(),
      syncStates: await prisma.syncState.count()
    }

    console.log('\n📊 Final data counts:')
    Object.entries(afterCounts).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`)
    })

    console.log('\n🎉 Seed data cleanup completed successfully!')
    console.log('\n💡 Next steps:')
    console.log('  1. Run the B2Chat sync to populate with real data')
    console.log('  2. Agents will be automatically extracted from chat data')
    console.log('  3. Dashboard will show real metrics from your B2Chat instance')

  } catch (error) {
    console.error('❌ Error during seed data cleanup:', error)
    throw error
  }
}

cleanSeedData()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })