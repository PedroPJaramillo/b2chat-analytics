import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SyncEngine } from '@/lib/sync/engine'
import { enhancedSyncEngine } from '@/lib/sync/enhanced-engine'
import { SyncStateManager } from '@/lib/sync/state'
import { logger } from '@/lib/logger'
import { validateRequestBody, SyncRequestSchema, createValidationError, isValidationError } from '@/lib/validation'
import { syncRateLimit } from '@/lib/rate-limit'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/audit'
import { B2ChatAPIError } from '@/lib/b2chat/client'
import { canPerformSync } from '@/lib/startup-validation'
import { ensureCurrentUserExists } from '@/lib/user-management'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  let entityType: string = 'unknown';

  try {
    // Check authentication
    const authResult = await auth()
    const clerkUserId = authResult.userId
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user exists in local database
    userId = await ensureCurrentUserExists();
    if (!userId) {
      logger.error('Failed to initialize user context for sync operation', { clerkUserId });
      return NextResponse.json(
        { error: 'Failed to initialize user context' },
        { status: 500 }
      );
    }

    // Apply rate limiting for sync operations
    const rateLimitResponse = await syncRateLimit(req, userId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Validate request body
    const validationResult = await validateRequestBody(req, SyncRequestSchema)
    if (isValidationError(validationResult)) {
      return NextResponse.json(createValidationError(validationResult.details), { status: 400 })
    }

    const { entityType: validatedEntityType, options = {} } = validationResult;
    entityType = validatedEntityType;

    // Check if sync operations are possible
    const syncCheck = canPerformSync();
    if (!syncCheck.canSync) {
      logger.warn('Sync operation blocked due to configuration issues', {
        userId: userId ?? undefined,
        entityType,
        reason: syncCheck.reason
      });

      return NextResponse.json(
        {
          error: syncCheck.reason,
          code: 'CONFIGURATION_ERROR',
          success: false
        },
        { status: 503 } // Service Unavailable
      );
    }

    // Log sync request
    await auditLogger.log({
      userId: userId ?? undefined,
      eventType: AuditEventType.SYNC_STARTED,
      severity: AuditSeverity.MEDIUM,
      success: true,
      resource: `sync_${entityType}`,
      details: {
        entityType,
        options,
        trigger: 'manual_api'
      }
    })

    logger.info('Manual sync triggered with events', {
      userId: userId ?? undefined,
      entityType,
      options
    })

    let result
    const enhancedOptions = {
      ...options,
      userId: userId ?? undefined,
      emitEvents: true, // Enable real-time events
      description: `Manual ${entityType} sync triggered by user`
    }

    switch (entityType) {
      case 'contacts':
        await enhancedSyncEngine.syncContacts(enhancedOptions)
        result = { success: true }
        break
      case 'chats':
        await enhancedSyncEngine.syncChats(enhancedOptions)
        result = { success: true }
        break
      case 'all':
        await enhancedSyncEngine.syncAll(enhancedOptions)
        result = { success: true }
        break
    }

    return NextResponse.json({
      success: result ? result.success !== false : true,
      message: `${entityType} sync completed`,
      result: result
    })

  } catch (error) {
    // Enhanced error logging with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Sync API error', {
      userId: userId ?? undefined,
      entityType,
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });

    // Log to audit system
    if (userId) {
      await auditLogger.log({
        userId: userId ?? undefined,
        eventType: AuditEventType.SYNC_FAILED,
        severity: AuditSeverity.HIGH,
        success: false,
        resource: 'sync_api',
        errorMessage: errorMessage,
        details: {
          entityType,
          error: errorMessage,
          stack: errorStack
        }
      }).catch(console.error);
    }

    // Determine specific error type and status code
    let statusCode = 500;
    let errorCode = 'SYNC_ERROR';
    let userMessage = 'Sync operation failed';

    // Handle specific error types
    if (error instanceof B2ChatAPIError) {
      errorCode = 'B2CHAT_API_ERROR';
      userMessage = error.getUserFriendlyMessage();
      statusCode = error.isAuthenticationError() ? 401 : 502;
    } else if (error instanceof Error) {
      // Authentication errors
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
        errorCode = 'AUTH_ERROR';
        userMessage = 'Authentication failed. Please check your credentials.';
        statusCode = 401;
      }
      // Database errors
      else if (errorMessage.includes('Database') || errorMessage.includes('Prisma')) {
        errorCode = 'DATABASE_ERROR';
        userMessage = 'Database connection error. Please try again later.';
        statusCode = 503; // Service Unavailable
      }
      // Rate limiting
      else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
        errorCode = 'RATE_LIMIT_ERROR';
        userMessage = 'Too many requests. Please wait before trying again.';
        statusCode = 429;
      }
      // Validation errors
      else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        errorCode = 'VALIDATION_ERROR';
        userMessage = 'Invalid request parameters.';
        statusCode = 400;
      }
      // Network/connection errors
      else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        errorCode = 'NETWORK_ERROR';
        userMessage = 'Network connection error. Please check your internet connection.';
        statusCode = 503;
      }
      // Generic B2Chat API errors (fallback)
      else if (errorMessage.includes('B2Chat') || errorMessage.includes('API')) {
        errorCode = 'B2CHAT_API_ERROR';
        userMessage = 'Unable to connect to B2Chat API. Please check your API credentials and network connection.';
        statusCode = 502; // Bad Gateway
      }
    }

    return NextResponse.json(
      {
        error: userMessage,
        code: errorCode,
        success: false,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            originalError: errorMessage,
            stack: errorStack
          }
        })
      },
      { status: statusCode }
    );
  }
}

export async function GET(req: NextRequest) {
  let userId: string | null = null;

  try {
    // Check authentication
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get sync status for supported entities (contacts and chats only)
    const contactsSync = await SyncStateManager.getLastSync('contacts')
    const chatsSync = await SyncStateManager.getLastSync('chats')

    return NextResponse.json({
      contacts: contactsSync,
      chats: chatsSync,
    })

  } catch (error) {
    logger.error('Sync status API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}