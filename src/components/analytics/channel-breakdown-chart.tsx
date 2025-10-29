"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { Badge } from "@/components/ui/badge"

interface ChannelResponseTime {
  name: string
  avg: string
  p50: string
  p95: string
  count: number
}

interface ChannelBreakdownChartProps {
  data: ChannelResponseTime[]
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

export function ChannelBreakdownChart({ data }: ChannelBreakdownChartProps) {
  // Client-side mount check to prevent SSR issues with Recharts
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Convert time strings to numeric values for charting
  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/^([\d.]+)([smh])$/)
    if (!match) return 0

    const value = parseFloat(match[1])
    const unit = match[2]

    switch (unit) {
      case 's': return value / 60 // Convert to minutes
      case 'm': return value
      case 'h': return value * 60
      default: return 0
    }
  }

  const chartData = data.map(channel => ({
    name: channelLabels[channel.name] || channel.name,
    channelKey: channel.name,
    avg: parseTime(channel.avg),
    p50: parseTime(channel.p50),
    p95: parseTime(channel.p95),
    count: channel.count,
    avgDisplay: channel.avg,
    p50Display: channel.p50,
    p95Display: channel.p95
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <div className="font-medium mb-2">{data.name}</div>
          <div className="space-y-1 text-sm">
            <div>Average: {data.avgDisplay}</div>
            <div>P50: {data.p50Display}</div>
            <div>P95: {data.p95Display}</div>
            <div>Chats: {data.count}</div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Time by Channel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {data.map(channel => (
              <Badge
                key={channel.name}
                variant="outline"
                className="flex items-center gap-1"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: channelColors[channel.name] || "#6B7280" }}
                />
                {channelLabels[channel.name] || channel.name}: {channel.avg}
              </Badge>
            ))}
          </div>

          {!isMounted ? (
            <div className="w-full h-[300px] flex items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <BarChart width={800} height={300} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                label={{
                  value: 'Response Time (minutes)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'currentColor', fontSize: '12px' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="avg"
                name="Average"
                fill="#8884d8"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="p50"
                name="Median (P50)"
                fill="#82ca9d"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="p95"
                name="P95"
                fill="#ffc658"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.map(channel => (
              <div
                key={channel.name}
                className="p-3 border rounded-lg space-y-1"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: channelColors[channel.name] || "#6B7280" }}
                  />
                  <span className="text-sm font-medium">
                    {channelLabels[channel.name] || channel.name}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Avg: {channel.avg}</div>
                  <div>Chats: {channel.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}