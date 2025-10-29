"use client"

import { useQuery } from '@tanstack/react-query'
import type { OfficeHoursFilter, ChatDirectionFilter } from '@/types/filters'

// TypeScript interfaces for weekly response time data
export interface WeeklyHourlyDataPoint {
  dayOfWeek: number // 0=Sunday, 1=Monday, ..., 6=Saturday
  dayName: string // "Sunday", "Monday", etc.
  hour: number // 0-23
  avg: string // Formatted time: "2.5m", "45s", "1.2h"
  avgMs: number // Raw milliseconds
  count: number // Number of chats in this time slot
  chatIds: string[] // IDs of chats in this time slot for drill-down
}

export interface FastestSlowestHour {
  dayOfWeek: number
  hour: number
  avg: string
}

export interface WeeklyResponseTimeSummary {
  totalChats: number
  overallAvg: string
  overallAvgMs: number
  fastestHour: FastestSlowestHour | null
  slowestHour: FastestSlowestHour | null
}

export interface WeeklyResponseTimeFilters {
  direction: ChatDirectionFilter
  officeHours: OfficeHoursFilter
}

export interface WeeklyResponseTimeData {
  weekStart: string // ISO date: "2025-10-13"
  weekEnd: string // ISO date: "2025-10-19"
  agentId: string | null
  agentName: string | null
  filters: WeeklyResponseTimeFilters
  data: WeeklyHourlyDataPoint[] // 168 items (7 days × 24 hours)
  summary: WeeklyResponseTimeSummary
}

export interface UseWeeklyResponseTimesParams {
  weekStart: string // Required: ISO date (YYYY-MM-DD)
  agentId?: string // Optional: agent ID or "all"
  directionFilter?: ChatDirectionFilter // Optional: defaults to 'all'
  officeHoursFilter?: OfficeHoursFilter // Optional: defaults to 'all'
}

async function fetchWeeklyResponseTimes(
  params: UseWeeklyResponseTimesParams
): Promise<WeeklyResponseTimeData> {
  const searchParams = new URLSearchParams()

  // weekStart is required
  searchParams.append('weekStart', params.weekStart)

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
    `/api/analytics/weekly-response-times?${searchParams.toString()}`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch weekly response times')
  }

  return response.json()
}

export function useWeeklyResponseTimes(params: UseWeeklyResponseTimesParams) {
  const {
    weekStart,
    agentId = 'all',
    directionFilter = 'all',
    officeHoursFilter = 'all'
  } = params

  const { data = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['weekly-response-times', weekStart, agentId, directionFilter, officeHoursFilter],
    queryFn: () => fetchWeeklyResponseTimes({
      weekStart,
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
