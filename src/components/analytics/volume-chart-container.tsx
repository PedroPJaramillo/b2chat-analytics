"use client"

import { useState } from "react"
import { DynamicVolumeChart } from "./dynamic-volume-chart"
import { useVolumeChart, type TimeRange, type GroupBy } from "@/hooks/use-volume-chart"
import type { OfficeHoursFilter, ChatDirectionFilter } from "@/types/filters"
import type { ChatProvider } from "@prisma/client"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RefreshCw, Download } from "lucide-react"

interface VolumeChartContainerProps {
  officeHoursFilter: OfficeHoursFilter
  directionFilter: ChatDirectionFilter
  agents?: Array<{ id: string; name: string }>
  departments?: Array<{ id: string; name: string }>
}

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '12m', label: 'Last 12 Months' }
]

const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' }
]

const CHANNEL_OPTIONS: Array<{ value: ChatProvider; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'livechat', label: 'Live Chat' },
  { value: 'b2cbotapi', label: 'Bot API' }
]

const CHART_VARIANT_OPTIONS = [
  { value: 'area', label: 'Area Chart' },
  { value: 'line', label: 'Line Chart' }
]

export function VolumeChartContainer({
  officeHoursFilter,
  directionFilter,
  agents = [],
  departments = []
}: VolumeChartContainerProps) {
  // Local filter state
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [groupBy, setGroupBy] = useState<GroupBy | undefined>(undefined)
  const [channel, setChannel] = useState<ChatProvider | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [chartVariant, setChartVariant] = useState<'line' | 'area'>('area')

  // Fetch data
  const { data, loading, error } = useVolumeChart({
    timeRange,
    groupBy,
    officeHoursFilter,
    directionFilter,
    channel,
    agentId,
    departmentId
  })

  // Export to CSV
  const handleExport = () => {
    if (!data) return

    const csvContent = [
      ['Timestamp', 'Label', 'Count'],
      ...data.timeSeries.map(point => [
        point.timestamp,
        point.label,
        point.count.toString()
      ])
    ]
      .map(row => row.join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-volume-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-[350px] w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Unable to load chart data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // No data state
  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Period:</span>
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group By Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Group by:</span>
              <Select value={groupBy || 'auto'} onValueChange={(value) => setGroupBy(value === 'auto' ? undefined : value as GroupBy)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  {GROUP_BY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Channel:</span>
              <Select value={channel || 'all'} onValueChange={(value) => setChannel(value === 'all' ? null : value as ChatProvider)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {CHANNEL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agent Filter */}
            {agents.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agent:</span>
                <Select value={agentId || 'all'} onValueChange={(value) => setAgentId(value === 'all' ? null : value)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Department Filter */}
            {departments.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Department:</span>
                <Select value={departmentId || 'all'} onValueChange={(value) => setDepartmentId(value === 'all' ? null : value)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Chart Variant Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Chart:</span>
              <Select value={chartVariant} onValueChange={(value) => setChartVariant(value as 'line' | 'area')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_VARIANT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex gap-2">
              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!data || data.timeSeries.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <DynamicVolumeChart
        data={data}
        variant={chartVariant}
        showChannelBreakdown={!channel}
      />
    </div>
  )
}
