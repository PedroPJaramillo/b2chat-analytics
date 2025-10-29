"use client"

import { useQuery } from '@tanstack/react-query'
import type { OfficeHoursFilter, ChatDirectionFilter } from '@/types/filters'

interface ResponseTimeMetrics {
  avg: string
  p50: string
  p95: string
  p99: string
  min: string
  max: string
}

interface ResolutionTimeMetrics {
  avg: string
  p50: string
  p95: string
}

interface ChannelResponseTime {
  name: string
  avg: string
  p50: string
  p95: string
  count: number
}

interface HourlyResponseTime {
  hour: number
  avg: string
  count: number
}

interface AgentResponseTime {
  name: string
  avg: string
  p50: string
  p95: string
  chatCount: number
}

interface DepartmentResponseTime {
  name: string
  avg: string
  p50: string
  p95: string
  chatCount: number
}

interface AnalyticsData {
  totalConversations: number
  avgResponseTime: string
  satisfactionRate: number | null
  resolutionRate: number
  weeklyData: { name: string; value: number }[]
  agentPerformanceData: { name: string; value: number }[]
  responseTimeData: { name: string; value: number }[]
  trends: {
    conversationsTrend: number
    responseTimeTrend: number
    satisfactionTrend: number
    resolutionTrend: number
  }
  // New enhanced metrics
  responseTimeMetrics: ResponseTimeMetrics
  resolutionTimeMetrics: ResolutionTimeMetrics
  responseTimeByChannel: ChannelResponseTime[]
  hourlyResponseTimes: HourlyResponseTime[]
  agentResponseTimes: AgentResponseTime[]
  departmentResponseTimes: DepartmentResponseTime[]
  slaCompliance: number
  slaThreshold: string
}

async function fetchAnalytics(
  officeHoursFilter: OfficeHoursFilter,
  directionFilter: ChatDirectionFilter
): Promise<AnalyticsData> {
  const params = new URLSearchParams()
  if (officeHoursFilter !== 'all') {
    params.append('officeHoursFilter', officeHoursFilter)
  }
  if (directionFilter !== 'all') {
    params.append('direction', directionFilter)
  }
  const response = await fetch(`/api/analytics?${params.toString()}`)

  if (!response.ok) {
    throw new Error('Failed to fetch analytics data')
  }

  return response.json()
}

export function useAnalyticsData(
  officeHoursFilter: OfficeHoursFilter = 'all',
  directionFilter: ChatDirectionFilter = 'all'
) {
  const { data = null, isLoading: loading, error } = useQuery({
    queryKey: ['analytics', officeHoursFilter, directionFilter],
    queryFn: () => fetchAnalytics(officeHoursFilter, directionFilter),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2
  })

  return {
    data,
    loading,
    error: error ? (error as Error).message : null
  }
}