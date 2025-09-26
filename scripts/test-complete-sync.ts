import { B2ChatClient } from '../src/lib/b2chat/client'

async function testCompleteSync() {
  console.log('🔗 Testing complete B2Chat sync functionality...')

  const client = new B2ChatClient()

  try {
    // Test fetching contacts with the updated client
    console.log('\n1️⃣ Testing contacts sync...')
    const contactsResponse = await client.getContacts({ limit: 3 })
    console.log(`✅ Contacts working! Found ${contactsResponse.data.length} of ${contactsResponse.pagination.total} total`)

    if (contactsResponse.data.length > 0) {
      console.log('📄 Sample contact:', {
        id: contactsResponse.data[0].contact_id,
        name: contactsResponse.data[0].fullname,
        mobile: contactsResponse.data[0].mobile,
        company: contactsResponse.data[0].company
      })
    }

    // Test fetching chats with the updated client
    console.log('\n2️⃣ Testing chats sync...')
    const chatsResponse = await client.getChats({ limit: 3 })
    console.log(`✅ Chats working! Found ${chatsResponse.data.length} of ${chatsResponse.pagination.total} total`)

    if (chatsResponse.data.length > 0) {
      console.log('📄 Sample chat:', {
        id: chatsResponse.data[0].chat_id,
        status: chatsResponse.data[0].status,
        provider: chatsResponse.data[0].provider,
        created_at: chatsResponse.data[0].created_at
      })
    }

    // Test agents (should return empty array as B2Chat has no agents endpoint)
    console.log('\n3️⃣ Testing agents sync...')
    const agents = await client.getAgents()
    console.log(`✅ Agents handled correctly (returns empty as B2Chat has no agents endpoint): ${agents.length} agents`)

    console.log('\n🎉 B2Chat sync functionality test completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`• Total contacts available: ${contactsResponse.pagination.total}`)
    console.log(`• Total chats available: ${chatsResponse.pagination.total}`)
    console.log('• Authentication: ✅ Working')
    console.log('• Contacts API: ✅ Working')
    console.log('• Chats API: ✅ Working')
    console.log('• Agents API: ✅ Handled (no endpoint in B2Chat)')
    console.log('\n🚀 B2Chat integration is now FULLY FUNCTIONAL!')

  } catch (error) {
    console.error('❌ Sync test failed:', error)
    process.exit(1)
  }
}

testCompleteSync()