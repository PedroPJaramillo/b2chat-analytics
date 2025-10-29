"use client"

import { useEffect } from "react"
import { DynamicVolumeChart } from "./dynamic-volume-chart"
import type { VolumeChartData } from "@/hooks/use-volume-chart"

interface DebugVolumeChartProps {
  data: VolumeChartData
  title?: string
  description?: string
  variant?: 'line' | 'area'
  showChannelBreakdown?: boolean
  className?: string
}

/**
 * Debug wrapper to help diagnose why chart isn't showing
 */
export function DebugVolumeChart(props: DebugVolumeChartProps) {
  useEffect(() => {
    console.log('🔍 DebugVolumeChart mounted')
    console.log('📊 Data received:', {
      hasData: !!props.data,
      timeSeriesLength: props.data?.timeSeries?.length || 0,
      channelBreakdownLength: props.data?.channelBreakdown?.length || 0,
      summary: props.data?.summary,
      firstDataPoint: props.data?.timeSeries?.[0],
      lastDataPoint: props.data?.timeSeries?.[props.data.timeSeries.length - 1]
    })
  }, [props.data])

  if (!props.data) {
    console.error('❌ No data prop provided to chart!')
    return (
      <div className="border border-red-500 p-4 rounded bg-red-50">
        <strong>Debug: No data provided to chart</strong>
      </div>
    )
  }

  if (!props.data.timeSeries || props.data.timeSeries.length === 0) {
    console.error('❌ timeSeries is empty!')
    return (
      <div className="border border-yellow-500 p-4 rounded bg-yellow-50">
        <strong>Debug: timeSeries is empty</strong>
        <pre>{JSON.stringify(props.data, null, 2)}</pre>
      </div>
    )
  }

  console.log('✅ Rendering DynamicVolumeChart with valid data')

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 bg-green-500 text-white text-xs px-2 py-1 rounded">
        Debug: {props.data.timeSeries.length} data points
      </div>
      <DynamicVolumeChart {...props} />
    </div>
  )
}
