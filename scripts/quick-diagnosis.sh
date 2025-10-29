#!/bin/bash

echo "🔍 B2Chat Analytics - Quick Diagnosis"
echo "====================================="
echo ""

# Check if we can connect to database
echo "1️⃣  Checking database connection..."
npx prisma db execute --stdin <<< "SELECT 1" &> /dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ Database connected"
else
    echo "   ❌ Database connection failed"
    exit 1
fi

echo ""
echo "2️⃣  Running database diagnostic..."
npx tsx scripts/diagnose-agent-issue.ts

echo ""
echo "3️⃣  Inspecting chat data..."
npx tsx scripts/inspect-chat-data.ts

echo ""
echo "4️⃣  Testing B2Chat API authentication..."
npx tsx <<'EOF'
import { B2ChatClient } from './src/lib/b2chat/client.ts'

async function testAuth() {
  try {
    const client = new B2ChatClient()
    const result = await client.getTotalCounts()
    console.log('   ✅ B2Chat API authentication successful')
    console.log(`   📊 Total chats available: ${result.chats}`)
    console.log(`   📊 Total contacts available: ${result.contacts}`)
  } catch (error: any) {
    console.log('   ❌ B2Chat API authentication failed')
    console.log(`   Error: ${error.message}`)
    console.log('')
    console.log('   💡 Fix: Update credentials in .env file:')
    console.log('      B2CHAT_USERNAME="..."')
    console.log('      B2CHAT_PASSWORD="..."')
    console.log('      B2CHAT_API_URL="https://api.b2chat.io"')
  }
}

testAuth()
EOF

echo ""
echo "====================================="
echo "📋 Summary"
echo "====================================="
echo ""
echo "If B2Chat API auth is working, run:"
echo "  npx tsx scripts/test-sync-debug.ts"
echo ""
echo "This will show the actual structure of agent/contact/department"
echo "data returned by the B2Chat API."
echo ""