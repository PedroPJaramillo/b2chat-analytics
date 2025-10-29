"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface HourlyResponseTime {
  hour: number
  avg: string
  count: number
}

interface ResponseTimeHeatmapProps {
  data: HourlyResponseTime[]
  title?: string
}

export function ResponseTimeHeatmap({ data, title = "Response Time by Hour" }: ResponseTimeHeatmapProps) {
  // Parse response times to get numeric values in milliseconds
  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/^([\d.]+)([smh])$/)
    if (!match) return 0

    const value = parseFloat(match[1])
    const unit = match[2]

    switch (unit) {
      case 's': return value * 1000
      case 'm': return value * 60 * 1000
      case 'h': return value * 60 * 60 * 1000
      default: return 0
    }
  }

  const times = data.map(d => parseTime(d.avg))
  const maxTime = Math.max(...times.filter(t => t > 0))
  const minTime = Math.min(...times.filter(t => t > 0))

  const getColorIntensity = (timeStr: string): string => {
    const time = parseTime(timeStr)
    if (time === 0) return 'bg-gray-100'

    const normalized = maxTime > minTime
      ? (time - minTime) / (maxTime - minTime)
      : 0

    // Green (fast) to Yellow to Red (slow)
    if (normalized < 0.33) return 'bg-green-200 hover:bg-green-300'
    if (normalized < 0.66) return 'bg-yellow-200 hover:bg-yellow-300'
    return 'bg-red-200 hover:bg-red-300'
  }

  const formatHour = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}${period}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Hour labels */}
          <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="text-center">{formatHour(i)}</div>
            ))}
          </div>

          {/* Morning heatmap (0-11) */}
          <TooltipProvider>
            <div className="grid grid-cols-12 gap-1">
              {data.slice(0, 12).map((hourData) => (
                <Tooltip key={hourData.hour}>
                  <TooltipTrigger asChild>
                    <div
                      className={`h-8 rounded cursor-pointer transition-colors ${
                        hourData.count > 0
                          ? getColorIntensity(hourData.avg)
                          : 'bg-gray-100'
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{formatHour(hourData.hour)}</div>
                      <div>Avg: {hourData.avg || 'No data'}</div>
                      <div>Chats: {hourData.count}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          {/* Hour labels */}
          <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i + 12} className="text-center">{formatHour(i + 12)}</div>
            ))}
          </div>

          {/* Afternoon/Evening heatmap (12-23) */}
          <TooltipProvider>
            <div className="grid grid-cols-12 gap-1">
              {data.slice(12, 24).map((hourData) => (
                <Tooltip key={hourData.hour}>
                  <TooltipTrigger asChild>
                    <div
                      className={`h-8 rounded cursor-pointer transition-colors ${
                        hourData.count > 0
                          ? getColorIntensity(hourData.avg)
                          : 'bg-gray-100'
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{formatHour(hourData.hour)}</div>
                      <div>Avg: {hourData.avg || 'No data'}</div>
                      <div>Chats: {hourData.count}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-200 rounded" />
              <span>Fast</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-yellow-200 rounded" />
              <span>Average</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-200 rounded" />
              <span>Slow</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-100 rounded" />
              <span>No data</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}