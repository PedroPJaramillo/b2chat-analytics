"use client"

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface SyncConfig {
  interval: number // minutes
  batchSize: number
  autoSync: boolean
  fullSync: boolean
  retryAttempts: number
  retryDelay: number // milliseconds
}

const DEFAULT_CONFIG: SyncConfig = {
  interval: 1440,
  batchSize: 100,
  autoSync: true,
  fullSync: false,
  retryAttempts: 3,
  retryDelay: 1000,
}

const fetchSyncConfig = async (): Promise<SyncConfig> => {
  const response = await fetch('/api/sync/config')
  if (!response.ok) {
    throw new Error('Failed to fetch sync configuration')
  }
  return response.json()
}

const saveSyncConfig = async (config: SyncConfig): Promise<SyncConfig> => {
  const response = await fetch('/api/sync/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to save configuration')
  }

  const result = await response.json()
  return result.config
}

export function useSyncConfig() {
  const queryClient = useQueryClient()

  const {
    data: config = DEFAULT_CONFIG,
    isLoading: loading,
    error,
    refetch
  } = useQuery({
    queryKey: ['sync-config'],
    queryFn: fetchSyncConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  })

  const mutation = useMutation({
    mutationFn: saveSyncConfig,
    onSuccess: (savedConfig) => {
      // Update the cache with the saved configuration
      queryClient.setQueryData(['sync-config'], savedConfig)
      // Invalidate related queries that might be affected
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
    },
    onError: (error) => {
      console.error('Failed to save sync configuration:', error)
    },
  })

  const saveConfig = (newConfig: SyncConfig) => {
    return mutation.mutateAsync(newConfig)
  }

  return {
    config,
    loading,
    error: error?.message || mutation.error?.message || null,
    saving: mutation.isPending,
    saveConfig,
    refetch
  }
}