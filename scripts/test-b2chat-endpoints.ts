async function testB2ChatEndpoints() {
  console.log('🔗 Testing B2Chat API endpoints...')

  // Get authentication token
  const credentials = Buffer.from('92212402-1813-4784-bb3f-96ba2fda8eb9:3a6ecdf1-3237-4032-8390-a501a6abd0bd').toString('base64')

  try {
    // Authenticate
    console.log('\n1️⃣ Getting access token...')
    const authResponse = await fetch('https://api.b2chat.io/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials',
    })

    if (!authResponse.ok) {
      throw new Error(`Auth failed: ${authResponse.status}`)
    }

    const authData = await authResponse.json()
    const token = authData.access_token
    console.log('✅ Got access token:', token.substring(0, 20) + '...')

    // Test contacts export
    console.log('\n2️⃣ Testing /contacts/export endpoint...')
    const contactsResponse = await fetch('https://api.b2chat.io/contacts/export?limit=2&offset=0', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('📡 Contacts response status:', contactsResponse.status)

    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json()
      console.log('✅ Contacts data structure:', {
        total: contactsData.total,
        exported: contactsData.exported,
        hasContacts: !!contactsData.contacts,
        contactsCount: contactsData.contacts?.length || 0,
        traceId: contactsData.trace_id
      })

      if (contactsData.contacts && contactsData.contacts.length > 0) {
        console.log('📄 Sample contact fields:', Object.keys(contactsData.contacts[0]))
      }
    } else {
      const errorText = await contactsResponse.text()
      console.log('❌ Contacts endpoint error:', errorText)
    }

    // Test chats export
    console.log('\n3️⃣ Testing /chats/export endpoint...')
    const chatsResponse = await fetch('https://api.b2chat.io/chats/export?limit=2&offset=0', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('📡 Chats response status:', chatsResponse.status)

    if (chatsResponse.ok) {
      const chatsData = await chatsResponse.json()
      console.log('✅ Chats data structure:', {
        total: chatsData.total,
        exported: chatsData.exported,
        hasChats: !!chatsData.chats,
        chatsCount: chatsData.chats?.length || 0,
        traceId: chatsData.trace_id
      })

      if (chatsData.chats && chatsData.chats.length > 0) {
        console.log('📄 Sample chat fields:', Object.keys(chatsData.chats[0]))
      }
    } else {
      const errorText = await chatsResponse.text()
      console.log('❌ Chats endpoint error:', errorText)
    }

    console.log('\n🎉 B2Chat endpoint testing completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testB2ChatEndpoints()