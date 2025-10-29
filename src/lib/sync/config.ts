import { prisma } from '@/lib/prisma'

export interface SyncConfig {
  interval: number // minutes
  batchSize: number
  autoSync: boolean
  retryAttempts: number
  retryDelay: number // milliseconds
}

const DEFAULT_CONFIG: SyncConfig = {
  interval: 15,
  batchSize: 1000,
  autoSync: true,
  retryAttempts: 3,
  retryDelay: 1000,
}

export async function getSyncConfig(): Promise<SyncConfig> {
  try {
    // Get current sync configuration from database
    const configSettings = await prisma.systemSetting.findMany({
      where: {
        category: 'sync',
        isSystemSetting: true
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
        case 'sync_retry_attempts':
          config.retryAttempts = parseInt(setting.value)
          break
        case 'sync_retry_delay':
          config.retryDelay = parseInt(setting.value)
          break
      }
    })

    return config
  } catch (error) {
    console.error('Failed to get sync configuration:', error)
    return DEFAULT_CONFIG
  }
}