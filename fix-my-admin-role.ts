/**
 * Quick script to set YOUR user as Admin
 * Run: npx tsx fix-my-admin-role.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔧 Fixing your admin role...\n')

  // Get your Clerk user ID from environment or prompt
  const clerkUserId = process.argv[2]

  if (!clerkUserId) {
    console.log('❌ Please provide your Clerk user ID:')
    console.log('   npx tsx fix-my-admin-role.ts user_XXXXX')
    console.log('\nHow to find your Clerk user ID:')
    console.log('  1. Go to https://dashboard.clerk.com')
    console.log('  2. Navigate to Users')
    console.log('  3. Click on your user')
    console.log('  4. Copy the User ID (starts with "user_")')
    console.log('\nOR: Open your browser console while logged in and run:')
    console.log('   document.cookie\n')
    process.exit(1)
  }

  try {
    // Try to update existing user or create new one
    const user = await prisma.user.upsert({
      where: { id: clerkUserId },
      update: {
        role: 'Admin',
      },
      create: {
        id: clerkUserId,
        email: 'admin@temp.com',  // Will be updated by webhook on next login
        role: 'Admin',
      },
    })

    console.log('✅ SUCCESS! Your user is now an Admin:')
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${user.role}`)
    console.log('\n🎉 Now refresh your app and try again!\n')

  } catch (error) {
    console.error('❌ Error:', error)
    console.error('\nTroubleshooting:')
    console.error('  1. Make sure your database is running')
    console.error('  2. Check your DATABASE_URL in .env')
    console.error('  3. Try using Prisma Studio instead: npx prisma studio\n')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
