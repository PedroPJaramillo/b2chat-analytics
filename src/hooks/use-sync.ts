"use client"

import { useState, useEffect } from 'react'
import { useSyncConfig } from './use-sync-config'

interface SyncStatus {
  lastSync: string
  status: 'completed' | 'running' | 'failed' | 'pending'
  nextSync: string
  totalRecords: number
  progress: number
}

interface ModuleStatus {
  name: string
  status: 'completed' | 'running' | 'failed' | 'pending'
  lastSync: string
  records: number
  duration: string
}

export function useSync() {
  const { config: syncConfig } = useSyncConfig()
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [modules, setModules] = useState<ModuleStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync')
      if (!response.ok) {
        throw new Error('Failed to fetch sync status')
      }

      const data = await response.json()

      // Transform the data to match our UI format
      const now = new Date()
      const lastSync = data.contacts?.lastSyncTimestamp || data.chats?.lastSyncTimestamp || now.toISOString()

      // Determine overall status from contacts and chats
      const contactsStatus = data.contacts?.syncStatus || 'pending'
      const chatsStatus = data.chats?.syncStatus || 'pending'
      const overallStatus = contactsStatus === 'running' || chatsStatus === 'running' ? 'running' :
                           contactsStatus === 'completed' && chatsStatus === 'completed' ? 'completed' :
                           contactsStatus === 'failed' || chatsStatus === 'failed' ? 'failed' : 'pending'

      const totalRecords = (data.contacts?.totalRecords || 0) + (data.chats?.totalRecords || 0)

      setSyncStatus({
        lastSync,
        status: overallStatus,
        nextSync: new Date(now.getTime() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
        totalRecords,
        progress: overallStatus === 'completed' ? 100 : overallStatus === 'running' ? 50 : 0
      })

      // Format duration helper
      const formatDuration = (durationMs?: number) => {
        if (!durationMs) return '0s'
        const seconds = Math.floor(durationMs / 1000)
        if (seconds < 60) return `${seconds}s`
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}m ${remainingSeconds}s`
      }

      // Set module statuses (contacts and chats only)
      const moduleData: ModuleStatus[] = [
        {
          name: 'Contacts',
          status: data.contacts?.syncStatus || 'pending',
          lastSync: data.contacts?.lastSyncTimestamp || now.toISOString(),
          records: data.contacts?.totalRecords || 0,
          duration: formatDuration(data.contacts?.syncDuration)
        },
        {
          name: 'Chats',
          status: data.chats?.syncStatus || 'pending',
          lastSync: data.chats?.lastSyncTimestamp || now.toISOString(),
          records: data.chats?.totalRecords || 0,
          duration: formatDuration(data.chats?.syncDuration)
        }
      ]

      setModules(moduleData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync status')
    } finally {
      setLoading(false)
    }
  }

  const triggerSync = async (
    entityType: 'contacts' | 'chats' | 'all' = 'all',
    fullSync?: boolean,
    timeRangePreset?: '1d' | '7d' | '30d' | '90d' | 'custom' | 'full',
    dateRange?: { startDate?: string; endDate?: string }
  ) => {
    try {
      setSyncing(true)
      setError(null)

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType,
          options: {
            batchSize: syncConfig.batchSize,
            fullSync: fullSync ?? false,
            timeRangePreset,
            dateRange
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sync failed')
      }

      const result = await response.json()

      // Refresh sync status after successful sync
      await fetchSyncStatus()

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync operation failed'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchSyncStatus()

    // Poll for updates every 30 seconds when syncing
    const interval = setInterval(() => {
      if (syncing) {
        fetchSyncStatus()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [syncing])

  return {
    syncStatus,
    modules,
    loading,
    error,
    syncing,
    triggerSync,
    refetch: fetchSyncStatus
  }
}