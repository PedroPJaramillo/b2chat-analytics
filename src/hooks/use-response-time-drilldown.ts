"use client"

import { useQuery } from '@tanstack/react-query'
import type { OfficeHoursFilter, ChatDirectionFilter } from '@/types/filters'

// TypeScript interfaces for response time drill-down data
export interface ResponseTimeDrilldownSummary {
  totalChats: number
  avgResponseTime: string // Formatted: "5.2m", "45s"
  avgResponseTimeMs: number // Raw milliseconds
  comparisonToWeekly: string // "+2.3m" or "-1.5m"
  performanceIndicator: 'default' | 'secondary' | 'destructive'
  performanceLabel: 'Better' | 'Average' | 'Worse'
}

export interface ChatDistribution {
  status: string // 'resolved', 'pending', 'active'
  count: number
}

export interface AgentBreakdown {
  agentId: string | null
  agentName: string | null
  chatCount: number
  avgResponseTime: string
  avgResponseTimeMs: number
}

export interface SlowestChat {
  chatId: string
  customerName: string
  agentName: string | null
  channel: string
  responseTime: string
  responseTimeMs: number
  status: string
}

export interface ResponseTimeDrilldownData {
  dayName: string // "Tuesday"
  hourRange: string // "2:00 PM - 3:00 PM"
  timeSlotStart: string // ISO datetime for navigation
  timeSlotEnd: string // ISO datetime for navigation
  summary: ResponseTimeDrilldownSummary
  distribution: ChatDistribution[]
  agentBreakdown: AgentBreakdown[]
  slowestChats: SlowestChat[] // Top 10
}

export interface UseResponseTimeDrilldownParams {
  weekStart: string // Required: ISO date (YYYY-MM-DD)
  dayOfWeek: number // Required: 0-6 (0=Sunday, 6=Saturday)
  hour: number // Required: 0-23
  agentId?: string // Optional: agent ID or "all"
  directionFilter?: ChatDirectionFilter // Optional: defaults to 'all'
  officeHoursFilter?: OfficeHoursFilter // Optional: defaults to 'all'
}

async function fetchResponseTimeDrilldown(
  params: UseResponseTimeDrilldownParams
): Promise<ResponseTimeDrilldownData> {
  const searchParams = new URLSearchParams()

  // Required parameters
  searchParams.append('weekStart', params.weekStart)
  searchParams.append('dayOfWeek', params.dayOfWeek.toString())
  searchParams.append('hour', params.hour.toString())

  // Add optional parameters
  if (params.agentId && params.agentId !== 'all') {
    searchParams.append('agentId', params.agentId)
  }

  if (params.directionFilter && params.directionFilter !== 'all') {
    searchParams.append('direction', params.directionFilter)
  }

  if (params.officeHoursFilter && params.officeHoursFilter !== 'all') {
    searchParams.append('officeHoursFilter', params.officeHoursFilter)
  }

  const response = await fetch(
    `/api/analytics/response-time-drilldown?${searchParams.toString()}`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch drill-down data')
  }

  return response.json()
}

export function useResponseTimeDrilldown(params: UseResponseTimeDrilldownParams) {
  const {
    weekStart,
    dayOfWeek,
    hour,
    agentId = 'all',
    directionFilter = 'all',
    officeHoursFilter = 'all'
  } = params

  const { data = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['response-time-drilldown', weekStart, dayOfWeek, hour, agentId, directionFilter, officeHoursFilter],
    queryFn: () => fetchResponseTimeDrilldown({
      weekStart,
      dayOfWeek,
      hour,
      agentId,
      directionFilter,
      officeHoursFilter
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
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
