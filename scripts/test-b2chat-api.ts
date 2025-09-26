import { B2ChatClient } from '../src/lib/b2chat/client'

async function testB2ChatAPI() {
  console.log('🔗 Testing B2Chat API connectivity...')

  const client = new B2ChatClient()

  try {
    // Test fetching agents directly (authentication happens automatically)
    console.log('🔐 Testing authentication and agents endpoint...')

    const agents = await client.getAgents()
    console.log(`✅ Authentication successful! Found ${agents.length} agents`)
    if (agents.length > 0) {
      console.log('📄 Sample agent:', {
        id: agents[0].id,
        name: agents[0].name,
        email: agents[0].email
      })
    }

    // Test fetching contacts
    console.log('📞 Testing contacts endpoint...')
    const contactsResponse = await client.getContacts({ limit: 5 })
    console.log(`✅ Found ${contactsResponse.data.length} contacts`)
    if (contactsResponse.data.length > 0) {
      console.log('📄 Sample contact:', {
        id: contactsResponse.data[0].id,
        name: contactsResponse.data[0].full_name,
        mobile: contactsResponse.data[0].mobile
      })
    }

    // Test fetching chats
    console.log('💬 Testing chats endpoint...')
    const chatsResponse = await client.getChats({ limit: 5 })
    console.log(`✅ Found ${chatsResponse.data.length} chats`)
    if (chatsResponse.data.length > 0) {
      console.log('📄 Sample chat:', {
        id: chatsResponse.data[0].id,
        status: chatsResponse.data[0].status,
        created_at: chatsResponse.data[0].created_at
      })
    }

    console.log('🎉 B2Chat API connectivity test completed successfully!')

  } catch (error) {
    console.error('❌ B2Chat API test failed:', error)
    process.exit(1)
  }
}

testB2ChatAPI()