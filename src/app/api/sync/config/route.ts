import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Sync configuration schema
const SyncConfigSchema = z.object({
  interval: z.number().min(1).max(1440), // 1 minute to 24 hours
  batchSize: z.number().min(10).max(1000), // 10 to 1000 records
  autoSync: z.boolean(),
  fullSync: z.boolean(),
  retryAttempts: z.number().min(0).max(10),
  retryDelay: z.number().min(100).max(60000), // 100ms to 60s
})

const DEFAULT_CONFIG = {
  interval: 1440, // minutes (24 hours)
  batchSize: 100,
  autoSync: true,
  fullSync: false,
  retryAttempts: 3,
  retryDelay: 1000, // milliseconds
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current sync configuration
    const configSettings = await prisma.systemSetting.findMany({
      where: {
        category: 'sync',
        OR: [
          { userId: userId },
          { isSystemSetting: true }
        ]
      }
    })

    // Build configuration object with defaults
    const config = { ...DEFAULT_CONFIG }

    configSettings.forEach(setting => {
      switch (setting.key) {
        case 'sync_interval':
          config.interval = parseInt(setting.value)
          break
        case 'sync_batch_size':
          config.batchSize = parseInt(setting.value)
          break
        case 'sync_auto_enabled':
          config.autoSync = setting.value === 'true'
          break
        case 'sync_full_enabled':
          config.fullSync = setting.value === 'true'
          break
        case 'sync_retry_attempts':
          config.retryAttempts = parseInt(setting.value)
          break
        case 'sync_retry_delay':
          config.retryDelay = parseInt(setting.value)
          break
      }
    })

    return NextResponse.json(config)

  } catch (error) {
    logger.error('Sync config GET error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Failed to get sync configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Validate configuration
    const result = SyncConfigSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid configuration',
          details: result.error.errors
        },
        { status: 400 }
      )
    }

    const config = result.data

    // Update configuration settings
    const configUpdates = [
      {
        key: 'sync_interval',
        value: config.interval.toString(),
        description: 'Sync interval in minutes'
      },
      {
        key: 'sync_batch_size',
        value: config.batchSize.toString(),
        description: 'Number of records to process per batch'
      },
      {
        key: 'sync_auto_enabled',
        value: config.autoSync.toString(),
        description: 'Enable automatic sync'
      },
      {
        key: 'sync_full_enabled',
        value: config.fullSync.toString(),
        description: 'Enable full sync (reimport all data)'
      },
      {
        key: 'sync_retry_attempts',
        value: config.retryAttempts.toString(),
        description: 'Number of retry attempts on failure'
      },
      {
        key: 'sync_retry_delay',
        value: config.retryDelay.toString(),
        description: 'Delay between retry attempts in milliseconds'
      }
    ]

    // Update each setting
    for (const update of configUpdates) {
      await prisma.systemSetting.upsert({
        where: {
          key: update.key
        },
        update: {
          value: update.value,
          updatedAt: new Date(),
        },
        create: {
          key: update.key,
          value: update.value,
          category: 'sync',
          description: update.description,
          isSystemSetting: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    logger.info('Sync configuration updated', {
      userId,
      config
    })

    return NextResponse.json({
      success: true,
      message: 'Sync configuration updated successfully',
      config
    })

  } catch (error) {
    logger.error('Sync config PUT error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Failed to update sync configuration' },
      { status: 500 }
    )
  }
}