/**
 * User Management Utilities
 *
 * Provides utilities for managing users, including system user creation
 * and user synchronization from Clerk.
 */

import { prisma } from './prisma';
import { logger } from './logger';
import { currentUser } from '@clerk/nextjs/server';

export interface CreateUserData {
  id: string;
  email: string;
  name?: string | null;
  role: 'Admin' | 'Manager';
}

/**
 * Ensure system user exists for automated operations
 */
export async function ensureSystemUserExists(): Promise<string> {
  const SYSTEM_USER_ID = 'system';
  
  try {
    // Check if system user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: SYSTEM_USER_ID }
    });

    if (existingUser) {
      return SYSTEM_USER_ID;
    }

    // Create system user
    await prisma.user.create({
      data: {
        id: SYSTEM_USER_ID,
        email: 'system@internal',
        name: 'System',
        role: 'Admin',
      },
    });

    logger.info('System user created successfully', { userId: SYSTEM_USER_ID });
    return SYSTEM_USER_ID;
  } catch (error) {
    logger.error('Failed to ensure system user exists', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Ensure current Clerk user exists in local database
 */
export async function ensureCurrentUserExists(): Promise<string | null> {
  try {
    const user = await currentUser();
    
    if (!user) {
      return null;
    }

    const email = user.emailAddresses?.[0]?.emailAddress;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;

    if (!email) {
      logger.warn('Current user has no email address', { userId: user.id });
      return null;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (existingUser) {
      return user.id;
    }

    // Create user in database
    const role = determineUserRole(email);
    
    await prisma.user.create({
      data: {
        id: user.id,
        email,
        name,
        role,
      },
    });

    logger.info('Current user created in database', {
      userId: user.id,
      email,
      name,
      role
    });

    return user.id;
  } catch (error) {
    logger.error('Failed to ensure current user exists', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Create or update user in database
 */
export async function upsertUser(userData: CreateUserData): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { id: userData.id },
      update: {
        email: userData.email,
        name: userData.name,
        updatedAt: new Date(),
      },
      create: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
    });

    logger.info('User upserted successfully', {
      userId: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    });
  } catch (error) {
    logger.error('Failed to upsert user', {
      userId: userData.id,
      email: userData.email,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get user context for operations (current user or system user)
 */
export async function getUserContext(): Promise<{ userId: string; isSystem: boolean }> {
  try {
    // First try to get current user
    const currentUserId = await ensureCurrentUserExists();
    
    if (currentUserId) {
      return { userId: currentUserId, isSystem: false };
    }

    // Fall back to system user
    const systemUserId = await ensureSystemUserExists();
    return { userId: systemUserId, isSystem: true };
  } catch (error) {
    logger.error('Failed to get user context', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Last resort - return system user ID without verification
    return { userId: 'system', isSystem: true };
  }
}

/**
 * Determine user role based on email or other criteria
 */
export function determineUserRole(email: string): 'Admin' | 'Manager' {
  // You can customize this logic based on your requirements
  
  // Example: Admin emails
  const adminEmails = [
    'admin@company.com',
    'pedro@company.com', // Add your email here
  ];
  
  // Example: Admin domains
  const adminDomains = [
    '@company.com',
    '@admin.company.com',
  ];

  if (adminEmails.includes(email.toLowerCase())) {
    return 'Admin';
  }

  if (adminDomains.some(domain => email.toLowerCase().endsWith(domain))) {
    return 'Admin';
  }

  // Default to Manager role
  return 'Manager';
}

/**
 * Initialize user management system
 * Call this during application startup
 */
export async function initializeUserManagement(): Promise<void> {
  try {
    // Ensure system user exists
    await ensureSystemUserExists();
    
    // Try to ensure current user exists (if in authenticated context)
    await ensureCurrentUserExists();
    
    logger.info('User management system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize user management system', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Don't throw - this shouldn't break the application
  }
}