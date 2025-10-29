"use client"

import { useQuery } from '@tanstack/react-query'
import type { OfficeHoursFilter, ChatDirectionFilter } from '@/types/filters'
import type { ChatProvider } from '@prisma/client'

export type TimeRange = '7d' | '30d' | '90d' | '12m'
export type GroupBy = 'hour' | 'day' | 'week' | 'month'

export interface VolumeDataPoint {
  timestamp: string
  count: number
  label: string
}

export interface ChannelBreakdown {
  channel: string
  count: number
}

export interface VolumeChartData {
  timeSeries: VolumeDataPoint[]
  channelBreakdown: ChannelBreakdown[]
  summary: {
    total: number
    avgPerPeriod: number
    peak: {
      timestamp: string
      count: number
      label: string
    } | null
    trend: number
  }
}

export interface VolumeChartFilters {
  timeRange?: TimeRange
  groupBy?: GroupBy
  officeHoursFilter?: OfficeHoursFilter
  directionFilter?: ChatDirectionFilter
  channel?: ChatProvider | null
  agentId?: string | null
  departmentId?: string | null
}

async function fetchVolumeChart(filters: VolumeChartFilters): Promise<VolumeChartData> {
  const params = new URLSearchParams()

  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange)
  }
  if (filters.groupBy) {
    params.append('groupBy', filters.groupBy)
  }
  if (filters.officeHoursFilter && filters.officeHoursFilter !== 'all') {
    params.append('officeHoursFilter', filters.officeHoursFilter)
  }
  if (filters.directionFilter && filters.directionFilter !== 'all') {
    params.append('direction', filters.directionFilter)
  }
  if (filters.channel) {
    params.append('channel', filters.channel)
  }
  if (filters.agentId && filters.agentId !== 'all') {
    params.append('agentId', filters.agentId)
  }
  if (filters.departmentId && filters.departmentId !== 'all') {
    params.append('departmentId', filters.departmentId)
  }

  const response = await fetch(`/api/analytics/volume?${params.toString()}`)

  if (!response.ok) {
    throw new Error('Failed to fetch volume chart data')
  }

  return response.json()
}

export function useVolumeChart(filters: VolumeChartFilters = {}) {
  const {
    timeRange = '30d',
    groupBy,
    officeHoursFilter = 'all',
    directionFilter = 'all',
    channel = null,
    agentId = null,
    departmentId = null
  } = filters

  const { data = null, isLoading: loading, error } = useQuery({
    queryKey: [
      'volumeChart',
      timeRange,
      groupBy,
      officeHoursFilter,
      directionFilter,
      channel,
      agentId,
      departmentId
    ],
    queryFn: () => fetchVolumeChart({
      timeRange,
      groupBy,
      officeHoursFilter,
      directionFilter,
      channel,
      agentId,
      departmentId
    }),
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
