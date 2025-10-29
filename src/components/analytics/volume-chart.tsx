"use client"

import { useMemo, useState, useEffect } from "react"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react"
import type { VolumeChartData } from "@/hooks/use-volume-chart"

interface VolumeChartProps {
  data: VolumeChartData
  title?: string
  description?: string
  variant?: 'line' | 'area'
  showChannelBreakdown?: boolean
  className?: string
}

const channelColors: Record<string, string> = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  telegram: "#0088cc",
  livechat: "#FF6900",
  b2cbotapi: "#7C3AED"
}

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  telegram: "Telegram",
  livechat: "Live Chat",
  b2cbotapi: "Bot API"
}

export function VolumeChart({
  data,
  title = "Chat Volume Over Time",
  description = "Track conversation trends and patterns",
  variant = 'area',
  showChannelBreakdown = true,
  className
}: VolumeChartProps) {
  // Client-side mount check to prevent SSR issues with Recharts
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prepare chart data with comprehensive data validation
  const chartData = useMemo(() => {
    if (!data || !data.timeSeries || data.timeSeries.length === 0) {
      return []
    }

    const validData = data.timeSeries
      .filter(point => {
        // Validate point exists and has valid count
        if (!point) return false
        if (typeof point.count !== 'number') return false
        if (isNaN(point.count)) return false
        if (!isFinite(point.count)) return false
        if (point.count < 0) return false
        // Validate label exists and is valid
        if (!point.label) return false
        if (typeof point.label !== 'string' && typeof point.label !== 'number') return false
        // Validate timestamp
        if (!point.timestamp) return false
        return true
      })
      .map(point => ({
        timestamp: new Date(point.timestamp).getTime(),
        label: String(point.label).trim() || 'N/A', // Ensure non-empty string
        count: Number(Math.max(0, Math.floor(point.count))) // Ensure valid number
      }))

    // Final validation: ensure all mapped values are valid
    const fullyValidData = validData.filter(point =>
      !isNaN(point.count) &&
      isFinite(point.count) &&
      point.label &&
      point.label.length > 0 &&
      !isNaN(point.timestamp) &&
      isFinite(point.timestamp)
    )

    // Only return data if we have at least one valid point
    return fullyValidData.length > 0 ? fullyValidData : []
  }, [data])

  // Additional safety: Check if chartData is truly renderable
  const isChartRenderable = useMemo(() => {
    if (!chartData || chartData.length === 0) return false
    // Ensure at least one point has a non-zero count
    const hasValidCounts = chartData.some(d => d.count > 0)
    // Ensure all labels are valid
    const hasValidLabels = chartData.every(d => d.label && d.label.length > 0)
    return hasValidCounts && hasValidLabels
  }, [chartData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <div className="font-medium mb-2">{data.label}</div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: payload[0].color }}
              />
              <span>Chats: <span className="font-medium">{data.count}</span></span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // Trend indicator
  const TrendIndicator = () => {
    if (!data || !data.summary) return null
    const { trend } = data.summary

    // Guard against NaN or invalid trend values
    if (typeof trend !== 'number' || isNaN(trend) || !isFinite(trend)) {
      return null
    }

    if (trend === 0) {
      return (
        <Badge variant="outline" className="gap-1">
          <Minus className="h-3 w-3" />
          No change
        </Badge>
      )
    }
    if (trend > 0) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <TrendingUp className="h-3 w-3" />
          +{trend}% vs previous period
        </Badge>
      )
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <TrendingDown className="h-3 w-3" />
        {trend}% vs previous period
      </Badge>
    )
  }

  // Early return for unmounted state
  if (!isMounted) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="w-full h-[350px] flex items-center justify-center text-muted-foreground">
            Loading chart...
          </div>
        </CardContent>
      </Card>
    )
  }

  // Early return for no data states
  if (!data || !chartData || chartData.length === 0 || !isChartRenderable) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[350px] flex items-center justify-center">
            <div className="text-center space-y-2">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {!data ? 'Loading data...' : chartData.length === 0 ? 'No data available for the selected period' : 'No chat activity during this period'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Only render chart with valid data
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <TrendIndicator />
        </div>

        {/* Summary Stats */}
        <div className="flex flex-wrap gap-4 pt-4 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">Total Chats</div>
              <div className="text-2xl font-bold">{data.summary.total.toLocaleString()}</div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg per Period</div>
            <div className="text-2xl font-bold">{data.summary.avgPerPeriod.toLocaleString()}</div>
          </div>
          {data.summary.peak && (
            <div>
              <div className="text-muted-foreground">Peak</div>
              <div className="text-2xl font-bold">{data.summary.peak.count.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{data.summary.peak.label}</div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Main Chart */}
          <div className="w-full overflow-x-auto">
            {variant === 'area' ? (
                <AreaChart width={800} height={350} data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  allowDataOverflow={false}
                  allowDecimals={false}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  label={{
                    value: 'Chat Count',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'currentColor', fontSize: '12px' }
                  }}
                  domain={[
                    0,
                    (dataMax: number) => {
                      // Ensure we always return a valid number
                      const max = typeof dataMax === 'number' && !isNaN(dataMax) && isFinite(dataMax)
                        ? Math.max(dataMax, 1)
                        : 1
                      return max
                    }
                  ]}
                  allowDataOverflow={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  fill="url(#colorCount)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <LineChart width={800} height={350} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  allowDataOverflow={false}
                  allowDecimals={false}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  label={{
                    value: 'Chat Count',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'currentColor', fontSize: '12px' }
                  }}
                  domain={[
                    0,
                    (dataMax: number) => {
                      // Ensure we always return a valid number
                      const max = typeof dataMax === 'number' && !isNaN(dataMax) && isFinite(dataMax)
                        ? Math.max(dataMax, 1)
                        : 1
                      return max
                    }
                  ]}
                  allowDataOverflow={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </div>

          {/* Channel Breakdown */}
          {showChannelBreakdown && data && data.channelBreakdown && data.channelBreakdown.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <div className="text-sm font-medium">Channel Breakdown</div>
              <div className="flex flex-wrap gap-2">
                {data.channelBreakdown.map(channel => (
                  <Badge
                    key={channel.channel}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: channelColors[channel.channel] || "#6B7280" }}
                    />
                    <span>
                      {channelLabels[channel.channel] || channel.channel}
                    </span>
                    <span className="font-medium">{channel.count.toLocaleString()}</span>
                    <span className="text-muted-foreground">
                      ({Math.round((channel.count / data.summary.total) * 100)}%)
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
