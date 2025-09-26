import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('⚠️  WARNING: This seed script creates test data only!')
  console.log('   For production, use B2Chat sync instead of seed data.')
  console.log('   Run: npm run clean-seed-data to remove seed data.')
  console.log('🌱 Starting database seed...')

  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: 'admin@b2chat.com' },
    update: {},
    create: {
      id: 'user_test_admin',
      email: 'admin@b2chat.com',
      name: 'B2Chat Admin',
      role: 'Admin',
    },
  })

  console.log('✓ Created test user:', testUser.email)

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { b2chatCode: 'SALES' },
      update: {},
      create: {
        id: 'dept_sales',
        b2chatCode: 'SALES',
        name: 'Sales Department',
        path: '/sales/',
        level: 0,
        isLeaf: false,
      },
    }),
    prisma.department.upsert({
      where: { b2chatCode: 'SUPPORT' },
      update: {},
      create: {
        id: 'dept_support',
        b2chatCode: 'SUPPORT',
        name: 'Customer Support',
        path: '/support/',
        level: 0,
        isLeaf: false,
      },
    }),
  ])

  console.log('✓ Created departments:', departments.map(d => d.name))

  // Create sample agents
  const agents = await Promise.all([
    prisma.agent.upsert({
      where: { b2chatId: 'agent_001' },
      update: {},
      create: {
        id: 'agent_sarah',
        b2chatId: 'agent_001',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@company.com',
        username: 'sarah.johnson',
        departmentId: departments[1].id, // Support
      },
    }),
    prisma.agent.upsert({
      where: { b2chatId: 'agent_002' },
      update: {},
      create: {
        id: 'agent_mike',
        b2chatId: 'agent_002',
        name: 'Mike Chen',
        email: 'mike.chen@company.com',
        username: 'mike.chen',
        departmentId: departments[1].id, // Support
      },
    }),
    prisma.agent.upsert({
      where: { b2chatId: 'agent_003' },
      update: {},
      create: {
        id: 'agent_lisa',
        b2chatId: 'agent_003',
        name: 'Lisa Wong',
        email: 'lisa.wong@company.com',
        username: 'lisa.wong',
        departmentId: departments[0].id, // Sales
      },
    }),
    prisma.agent.upsert({
      where: { b2chatId: 'agent_004' },
      update: {},
      create: {
        id: 'agent_david',
        b2chatId: 'agent_004',
        name: 'David Smith',
        email: 'david.smith@company.com',
        username: 'david.smith',
        departmentId: departments[0].id, // Sales
        isActive: false,
      },
    }),
  ])

  console.log('✓ Created agents:', agents.map(a => a.name))

  // Create sample contacts
  const contacts = await Promise.all([
    prisma.contact.upsert({
      where: { b2chatId: 'contact_001' },
      update: {},
      create: {
        id: 'contact_john',
        b2chatId: 'contact_001',
        fullName: 'John Doe',
        email: 'john.doe@customer.com',
        mobile: '+1234567890',
        company: 'Acme Corp',
      },
    }),
    prisma.contact.upsert({
      where: { b2chatId: 'contact_002' },
      update: {},
      create: {
        id: 'contact_jane',
        b2chatId: 'contact_002',
        fullName: 'Jane Smith',
        email: 'jane.smith@techstart.com',
        mobile: '+1234567891',
        company: 'TechStart Inc',
      },
    }),
    prisma.contact.upsert({
      where: { b2chatId: 'contact_003' },
      update: {},
      create: {
        id: 'contact_bob',
        b2chatId: 'contact_003',
        fullName: 'Bob Wilson',
        email: 'bob.wilson@enterprise.com',
        mobile: '+1234567892',
        company: 'Enterprise Solutions',
      },
    }),
  ])

  console.log('✓ Created contacts:', contacts.map(c => c.fullName))

  // Create sample chats
  const chats = await Promise.all([
    prisma.chat.create({
      data: {
        id: 'chat_001',
        b2chatId: 'b2chat_001',
        agentId: agents[0].id,
        contactId: contacts[0].id,
        departmentId: departments[1].id,
        provider: 'whatsapp',
        status: 'open',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        openedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        pickedUpAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000), // 30 seconds later
      },
    }),
    prisma.chat.create({
      data: {
        id: 'chat_002',
        b2chatId: 'b2chat_002',
        agentId: agents[1].id,
        contactId: contacts[1].id,
        departmentId: departments[1].id,
        provider: 'livechat',
        status: 'closed',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        pickedUpAt: new Date(Date.now() - 4 * 60 * 60 * 1000 + 60000), // 1 minute later
        closedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        duration: 3600, // 1 hour
      },
    }),
    prisma.chat.create({
      data: {
        id: 'chat_003',
        b2chatId: 'b2chat_003',
        agentId: agents[2].id,
        contactId: contacts[2].id,
        departmentId: departments[0].id,
        provider: 'facebook',
        status: 'pending',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        openedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    }),
  ])

  console.log('✓ Created chats:', chats.length)

  // Create sample messages
  const messages = await Promise.all([
    // Messages for chat_001
    prisma.message.create({
      data: {
        id: 'msg_001',
        chatId: chats[0].id,
        text: 'Hello, I need help with my account',
        type: 'text',
        incoming: true,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    }),
    prisma.message.create({
      data: {
        id: 'msg_002',
        chatId: chats[0].id,
        text: 'Hi! I\'d be happy to help you with your account. What specific issue are you experiencing?',
        type: 'text',
        incoming: false,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60000),
      },
    }),
    // Messages for chat_002
    prisma.message.create({
      data: {
        id: 'msg_003',
        chatId: chats[1].id,
        text: 'I can\'t access my dashboard',
        type: 'text',
        incoming: true,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
    }),
    prisma.message.create({
      data: {
        id: 'msg_004',
        chatId: chats[1].id,
        text: 'Let me check your account settings. Can you try refreshing your browser?',
        type: 'text',
        incoming: false,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000 + 120000),
      },
    }),
    prisma.message.create({
      data: {
        id: 'msg_005',
        chatId: chats[1].id,
        text: 'That worked! Thank you so much!',
        type: 'text',
        incoming: true,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000 + 300000),
      },
    }),
  ])

  console.log('✓ Created messages:', messages.length)

  // Create sync state records
  await prisma.syncState.create({
    data: {
      id: 'sync_agents',
      entityType: 'agents',
      syncStatus: 'completed',
      lastSyncTimestamp: new Date(),
    },
  })

  await prisma.syncState.create({
    data: {
      id: 'sync_chats',
      entityType: 'chats',
      syncStatus: 'completed',
      lastSyncTimestamp: new Date(),
    },
  })

  console.log('✓ Created sync state records')

  console.log('🎉 Database seeding completed successfully!')
  console.log(`
📊 Summary:
- Users: 1
- Departments: ${departments.length}
- Agents: ${agents.length}
- Contacts: ${contacts.length}
- Chats: ${chats.length}
- Messages: ${messages.length}
  `)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })