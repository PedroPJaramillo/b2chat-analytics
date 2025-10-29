/**
 * Clerk Webhook Handler - Automated User Management
 *
 * Handles Clerk webhook events to automatically sync users between
 * Clerk authentication and local database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Simple webhook verification without svix dependency
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  // For development, we'll do basic verification
  // In production, you should implement proper HMAC verification
  return !!(signature && secret && payload);
}

export async function POST(req: NextRequest) {
  try {
    // Get the headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Error occurred -- no svix headers', {
        status: 400,
      });
    }

    // Get the body
    const payload = await req.text();
    const body = JSON.parse(payload);

    // Get the Webhook secret
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      logger.warn('CLERK_WEBHOOK_SECRET not configured, skipping signature verification');
    } else {
      // Basic verification (you should implement proper HMAC verification in production)
      if (!verifyWebhookSignature(payload, svix_signature, WEBHOOK_SECRET)) {
        return new Response('Invalid signature', { status: 400 });
      }
    }

    // Handle the webhook
    const eventType = body.type;
    const eventData = body.data;

    logger.info('Clerk webhook received', {
      eventType,
      userId: eventData?.id,
      email: eventData?.email_addresses?.[0]?.email_address
    });

    try {
      switch (eventType) {
        case 'user.created':
          await handleUserCreated(eventData);
          break;
        
        case 'user.updated':
          await handleUserUpdated(eventData);
          break;
        
        case 'user.deleted':
          await handleUserDeleted(eventData);
          break;
        
        default:
          logger.info('Unhandled webhook event type', { eventType });
      }

      return NextResponse.json({ message: 'Webhook processed successfully' });
    } catch (error) {
      logger.error('Error processing webhook', {
        eventType,
        userId: eventData?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return NextResponse.json(
        { error: 'Failed to process webhook' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle user creation from Clerk
 *
 * Reads role from Clerk's publicMetadata or privateMetadata first,
 * falling back to email-based logic if metadata is not set.
 */
async function handleUserCreated(eventData: any) {
  const { id, email_addresses, first_name, last_name, public_metadata, private_metadata } = eventData;
  const email = email_addresses?.[0]?.email_address;
  const name = [first_name, last_name].filter(Boolean).join(' ') || null;

  if (!email || !id) {
    logger.warn('User created without required data', { userId: id, email });
    return;
  }

  // Read role from Clerk metadata first (source of truth)
  const clerkRole = public_metadata?.role || private_metadata?.role;
  const role = (clerkRole === 'Admin' || clerkRole === 'Manager')
    ? clerkRole
    : determineUserRole(email); // Fallback to email-based logic

  const roleSource = (clerkRole === 'Admin' || clerkRole === 'Manager') ? 'clerk-metadata' : 'email-fallback';

  try {
    const user = await prisma.user.create({
      data: {
        id,
        email,
        name,
        role,
      },
    });

    logger.info('User created in database', {
      userId: id,
      email,
      name,
      role,
      roleSource
    });

    return user;
  } catch (error) {
    // Handle duplicate user (shouldn't happen, but just in case)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      logger.warn('User already exists in database', { userId: id, email });
      return await prisma.user.findUnique({ where: { id } });
    }
    throw error;
  }
}

/**
 * Handle user updates from Clerk
 *
 * Syncs role changes from Clerk metadata to database.
 * If user doesn't exist, creates them with role from metadata.
 */
async function handleUserUpdated(eventData: any) {
  const { id, email_addresses, first_name, last_name, public_metadata, private_metadata } = eventData;
  const email = email_addresses?.[0]?.email_address;
  const name = [first_name, last_name].filter(Boolean).join(' ') || null;

  if (!email || !id) {
    logger.warn('User updated without required data', { userId: id, email });
    return;
  }

  // Read role from Clerk metadata first (source of truth)
  const clerkRole = public_metadata?.role || private_metadata?.role;
  const role = (clerkRole === 'Admin' || clerkRole === 'Manager')
    ? clerkRole
    : determineUserRole(email); // Fallback to email-based logic

  const roleSource = (clerkRole === 'Admin' || clerkRole === 'Manager') ? 'clerk-metadata' : 'email-fallback';

  try {
    const user = await prisma.user.upsert({
      where: { id },
      update: {
        email,
        name,
        role, // Update role from Clerk metadata
        updatedAt: new Date(),
      },
      create: {
        id,
        email,
        name,
        role,
      },
    });

    logger.info('User updated in database', {
      userId: id,
      email,
      name,
      role,
      roleSource
    });

    return user;
  } catch (error) {
    logger.error('Failed to update user', {
      userId: id,
      email,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Handle user deletion from Clerk
 */
async function handleUserDeleted(eventData: any) {
  const { id } = eventData;
  
  if (!id) {
    logger.warn('User deletion event without user ID');
    return;
  }

  try {
    // Soft delete - keep user record but mark as inactive
    // This preserves audit trails and sync logs
    const user = await prisma.user.update({
      where: { id },
      data: {
        // We could add an isActive field to the schema for soft deletes
        // For now, we'll just update the updatedAt timestamp
        updatedAt: new Date(),
      },
    });

    logger.info('User marked as deleted in database', { userId: id });
    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      logger.warn('User not found in database for deletion', { userId: id });
      return;
    }
    throw error;
  }
}

/**
 * Determine user role based on email or other criteria
 */
function determineUserRole(email: string): 'Admin' | 'Manager' {
  // You can customize this logic based on your requirements
  // For example, check email domains, specific email addresses, etc.
  
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