"use client"

import { useQuery } from '@tanstack/react-query'

interface DashboardStats {
  totalAgents: number
  totalChats: number
  totalMessages: number
  activeChats: number
  onlineAgents: number
  avgResponseTime: string
  satisfactionRate: number | null
  trends: {
    agentsChange: number
    chatsChange: number
    responseTimeChange: number
    satisfactionChange: number
  }
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/dashboard/stats')

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats')
  }

  return response.json()
}

export function useDashboardStats() {
  const { data = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
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