"use client"

import { useQuery } from '@tanstack/react-query'

interface Agent {
  id: string
  name: string
  email: string
  status: string
  activeChats: number
  totalChats: number
  totalMessages: number
  avgResponseTime: string
  satisfaction: number | null
  createdAt: string
  updatedAt: string
}

async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch('/api/agents')

  if (!response.ok) {
    throw new Error('Failed to fetch agents')
  }

  return response.json()
}

export function useAgents() {
  const { data = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    staleTime: 30000, // 30 seconds - data is fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - cache time
    refetchOnWindowFocus: true,
    retry: 2
  })

  return {
    data,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  }
}