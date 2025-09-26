import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testRealtimeUpdates() {
  console.log('🔄 Testing real-time data updates...')

  try {
    // Add a new contact
    const newContact = await prisma.contact.create({
      data: {
        id: 'contact_realtime_test',
        b2chatId: 'contact_realtime_001',
        fullName: 'Test Contact - Realtime',
        email: 'realtime.test@example.com',
        mobile: '+1234567999',
        company: 'Realtime Test Corp',
      },
    })
    console.log('✅ Added new contact:', newContact.fullName)

    // Add a new chat
    const agents = await prisma.agent.findMany({ take: 1 })
    const departments = await prisma.department.findMany({ take: 1 })

    if (agents.length > 0 && departments.length > 0) {
      const newChat = await prisma.chat.create({
        data: {
          id: 'chat_realtime_test',
          b2chatId: 'b2chat_realtime_001',
          agentId: agents[0].id,
          contactId: newContact.id,
          departmentId: departments[0].id,
          provider: 'whatsapp',
          status: 'open',
          createdAt: new Date(),
          openedAt: new Date(),
        },
      })
      console.log('✅ Added new chat:', newChat.id)

      // Add a message to the chat
      const newMessage = await prisma.message.create({
        data: {
          id: 'msg_realtime_test',
          chatId: newChat.id,
          text: 'This is a test message for real-time updates',
          type: 'text',
          incoming: true,
          timestamp: new Date(),
        },
      })
      console.log('✅ Added new message:', newMessage.text)
    }

    // Get updated stats
    const stats = await Promise.all([
      prisma.chat.count(),
      prisma.agent.count(),
      prisma.message.count(),
      prisma.agent.count({ where: { isActive: true } }),
      prisma.chat.count({ where: { status: 'open' } }),
    ])

    console.log('\n📊 Current stats:')
    console.log(`- Total chats: ${stats[0]}`)
    console.log(`- Total agents: ${stats[1]}`)
    console.log(`- Total messages: ${stats[2]}`)
    console.log(`- Active agents: ${stats[3]}`)
    console.log(`- Open chats: ${stats[4]}`)

    console.log('\n🎉 Real-time update test completed!')
    console.log('💡 Refresh the dashboard to see the new data')

  } catch (error) {
    console.error('❌ Real-time update test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testRealtimeUpdates()