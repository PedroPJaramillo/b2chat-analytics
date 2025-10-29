/**
 * Operational Insights Visualization
 * Displays peak times, channel distribution, and pain points
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, MessageSquare, AlertTriangle } from 'lucide-react'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

interface OperationalInsightsViewProps {
  data: AnalysisResultsResponse['operationalInsights']
}

export function OperationalInsightsView({ data }: OperationalInsightsViewProps) {
  // Transform peak hours data
  const peakHoursData = Object.entries(data.peakTimes.byHour)
    .map(([hour, count]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      hourNum: parseInt(hour),
      messages: count,
    }))
    .sort((a, b) => a.hourNum - b.hourNum)

  // Transform day of week data
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const peakDaysData = dayOrder
    .filter((day) => data.peakTimes.byDayOfWeek[day] !== undefined)
    .map((day) => ({
      day,
      messages: data.peakTimes.byDayOfWeek[day],
    }))

  // Channel distribution
  const channelData = [
    {
      name: 'Text',
      value: data.channelDistribution.text,
      color: '#3b82f6',
    },
    {
      name: 'Voice',
      value: data.channelDistribution.voice,
      color: '#8b5cf6',
    },
    {
      name: 'Media',
      value: data.channelDistribution.media,
      color: '#ec4899',
    },
  ].filter((channel) => channel.value > 0)

  // Find peak hours
  const topPeakHours = [...peakHoursData].sort((a, b) => b.messages - a.messages).slice(0, 3)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-primary">{payload[0].value.toLocaleString()} messages</p>
        </div>
      )
    }
    return null
  }

  // Get color for peak hours (gradient based on volume)
  const maxMessages = Math.max(...peakHoursData.map((d) => d.messages))
  const getBarColor = (value: number) => {
    const intensity = value / maxMessages
    if (intensity > 0.7) return '#ef4444' // High - red
    if (intensity > 0.4) return '#f59e0b' // Medium - orange
    return '#3b82f6' // Low - blue
  }

  return (
    <div className="space-y-6">
      {/* Peak Hours Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        {topPeakHours.map((peak, index) => (
          <Card key={peak.hour}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {index === 0 ? 'Busiest Hour' : `Peak #${index + 1}`}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-1">{peak.hour}</p>
              <p className="text-sm text-muted-foreground">
                {peak.messages.toLocaleString()} messages
              </p>
              {index === 0 && <Badge className="mt-2">🔥 Highest Volume</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Peak Hours Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Hourly Message Volume</CardTitle>
          <CardDescription>Distribution of messages throughout the day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" fontSize={12} />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="messages" radius={[4, 4, 0, 0]}>
                  {peakHoursData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.messages)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend for colors */}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#ef4444]" />
              <span className="text-muted-foreground">High Volume</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#f59e0b]" />
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#3b82f6]" />
              <span className="text-muted-foreground">Low</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peak Days & Channel Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Day of Week */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <div>
                <CardTitle>Peak Days</CardTitle>
                <CardDescription>Message volume by day of week</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakDaysData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="messages" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <div>
                <CardTitle>Channel Distribution</CardTitle>
                <CardDescription>Messages by communication channel</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Channel Stats */}
            <div className="mt-4 space-y-2">
              {channelData.map((channel) => {
                const total = channelData.reduce((sum, c) => sum + c.value, 0)
                const percentage = ((channel.value / total) * 100).toFixed(1)
                return (
                  <div key={channel.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }} />
                      <span>{channel.name}</span>
                    </div>
                    <span className="font-medium">
                      {channel.value.toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Common Pain Points */}
      {data.commonPainPoints.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <CardTitle>Common Pain Points</CardTitle>
                <CardDescription>Issues identified through AI analysis</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.commonPainPoints.map((painPoint, index) => (
                <div key={index} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{painPoint.category}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {painPoint.frequency} occurrence{painPoint.frequency !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm mb-2">{painPoint.description}</p>
                  {painPoint.exampleChatIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Example chats: {painPoint.exampleChatIds.slice(0, 3).join(', ')}
                      {painPoint.exampleChatIds.length > 3 && ` +${painPoint.exampleChatIds.length - 3} more`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
