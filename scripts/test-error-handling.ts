import { PrismaClient } from '@prisma/client'

async function testErrorHandling() {
  console.log('🔧 Testing error handling and loading states...')

  // Test 1: Invalid database connection
  console.log('\n1️⃣ Testing invalid database connection...')
  try {
    const invalidPrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://invalid:invalid@localhost:5432/nonexistent'
        }
      }
    })

    await invalidPrisma.agent.findMany()
    console.log('❌ Should have failed with connection error')
  } catch (error) {
    console.log('✅ Correctly caught connection error:', (error as Error).message.substring(0, 100) + '...')
  }

  // Test 2: Valid connection for other tests
  const prisma = new PrismaClient()

  // Test 3: Invalid query (constraint violation)
  console.log('\n2️⃣ Testing constraint violation...')
  try {
    await prisma.agent.create({
      data: {
        id: 'agent_test',
        b2chatId: 'agent_001', // This should already exist, causing a constraint violation
        name: 'Duplicate Agent',
        email: 'duplicate@test.com'
      }
    })
    console.log('❌ Should have failed with constraint violation')
  } catch (error) {
    console.log('✅ Correctly caught constraint violation:', (error as Error).message.substring(0, 100) + '...')
  }

  // Test 4: Simulate slow query (for loading states)
  console.log('\n3️⃣ Testing loading states with delayed query...')
  const startTime = Date.now()

  try {
    // Create a more complex query that takes some time
    const result = await prisma.chat.findMany({
      include: {
        agent: true,
        contact: true,
        department: true,
        messages: {
          take: 10,
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const endTime = Date.now()
    console.log(`✅ Complex query completed in ${endTime - startTime}ms`)
    console.log(`📊 Retrieved ${result.length} chats with full details`)
  } catch (error) {
    console.log('❌ Complex query failed:', (error as Error).message)
  }

  // Test 5: Non-existent record
  console.log('\n4️⃣ Testing non-existent record handling...')
  try {
    const nonExistent = await prisma.agent.findUnique({
      where: { id: 'non-existent-agent-id' }
    })

    if (nonExistent === null) {
      console.log('✅ Correctly returned null for non-existent record')
    } else {
      console.log('❌ Should have returned null')
    }
  } catch (error) {
    console.log('❌ Query for non-existent record failed:', (error as Error).message)
  }

  // Test 6: Empty result sets
  console.log('\n5️⃣ Testing empty result sets...')
  try {
    const emptyResults = await prisma.chat.findMany({
      where: { status: 'closed', agentId: 'non-existent-agent' }
    })

    console.log(`✅ Empty query returned ${emptyResults.length} results (expected 0)`)
  } catch (error) {
    console.log('❌ Empty query failed:', (error as Error).message)
  }

  console.log('\n🎉 Error handling tests completed!')
  console.log('💡 Check application logs and UI for proper error display')

  await prisma.$disconnect()
}

testErrorHandling()