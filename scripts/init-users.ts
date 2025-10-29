#!/usr/bin/env tsx
/**
 * User Initialization Script
 *
 * Creates the system user and ensures proper user management setup.
 * Run this script after database migrations to initialize the user system.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initializeUsers() {
  console.log('🚀 Initializing user management system...');

  try {
    // Create system user for automated operations
    const systemUser = await prisma.user.upsert({
      where: { id: 'system' },
      update: {
        email: 'system@internal',
        name: 'System',
        role: 'Admin',
        updatedAt: new Date(),
      },
      create: {
        id: 'system',
        email: 'system@internal',
        name: 'System',
        role: 'Admin',
      },
    });

    console.log('✅ System user created/updated:', {
      id: systemUser.id,
      email: systemUser.email,
      name: systemUser.name,
      role: systemUser.role
    });

    // Check if there are any existing users
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);

    if (userCount === 1) {
      console.log('ℹ️  Only system user exists. Users will be automatically created when they sign in via Clerk.');
    }

    console.log('🎉 User management system initialized successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Configure Clerk webhook endpoint: /api/webhook/clerk');
    console.log('2. Set CLERK_WEBHOOK_SECRET in your environment variables');
    console.log('3. Users will be automatically synced when they sign in');

  } catch (error) {
    console.error('❌ Failed to initialize user management system:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeUsers().catch((error) => {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
});