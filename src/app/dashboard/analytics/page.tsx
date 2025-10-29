"use client"

import { useState } from "react"
import { pageContainerClasses } from "@/lib/ui-utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MetricCard } from "@/components/analytics/metric-card"
import { ChartContainer } from "@/components/analytics/chart-container"
import { SimpleBarChart } from "@/components/analytics/simple-bar-chart"
import { ResponseTimeCard } from "@/components/analytics/response-time-card"
import { WeeklyResponseTimeHeatmap } from "@/components/analytics/weekly-response-time-heatmap"
import { SLAComplianceCard } from "@/components/analytics/sla-compliance-card"
import { ResponseTimeLeaderboard } from "@/components/analytics/response-time-leaderboard"
import { VolumeChartContainer } from "@/components/analytics/volume-chart-container"
import { DynamicChannelBreakdownChart } from "@/components/analytics/dynamic-channel-breakdown"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { Button } from "@/components/ui/button"

import {
  TrendingUp,
  Users,
  MessageSquare,
  Clock,
  UserCheck,
  Target,
  Activity,
  BarChart3,
  Zap,
  Timer
} from "lucide-react"
import { useAnalyticsData } from "@/hooks/use-analytics-data"
import { useAgents } from "@/hooks/use-agents"
import {
  OFFICE_HOURS_FILTER_OPTIONS,
  CHAT_DIRECTION_FILTER_OPTIONS,
  type OfficeHoursFilter,
  type ChatDirectionFilter
} from "@/types/filters"

export default function AnalyticsPage() {
  const [officeHoursFilter, setOfficeHoursFilter] = useState<OfficeHoursFilter>('all')
  const [directionFilter, setDirectionFilter] = useState<ChatDirectionFilter>('incoming')
  const { data, loading, error } = useAnalyticsData(officeHoursFilter, directionFilter)
  const { data: agents } = useAgents()

  if (error) {
    return (
      <div className={pageContainerClasses}>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Analytics data unavailable</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/sync">Check sync status</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={pageContainerClasses}>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 p-6 border rounded-lg">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={pageContainerClasses}>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={pageContainerClasses}>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Chat Type:</span>
              <Select value={directionFilter} onValueChange={(value) => setDirectionFilter(value as ChatDirectionFilter)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select chat type" />
                </SelectTrigger>
                <SelectContent>
                  {CHAT_DIRECTION_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Hours:</span>
              <Select value={officeHoursFilter} onValueChange={(value) => setOfficeHoursFilter(value as OfficeHoursFilter)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select time filter" />
                </SelectTrigger>
                <SelectContent>
                  {OFFICE_HOURS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Direction filter info */}
        {directionFilter !== 'all' && (
          <div className="bg-muted/50 border rounded-lg p-3 text-sm">
            <span className="font-medium">
              {CHAT_DIRECTION_FILTER_OPTIONS.find(opt => opt.value === directionFilter)?.label}:
            </span>{' '}
            <span className="text-muted-foreground">
              {CHAT_DIRECTION_FILTER_OPTIONS.find(opt => opt.value === directionFilter)?.description}
            </span>
          </div>
        )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="response-times">Response Times</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Performance Indicators */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <MetricCard
              title="Total Conversations"
              value={data.totalConversations.toLocaleString()}
              description="Last 30 days"
              icon={MessageSquare}
              trend={{ value: data.trends.conversationsTrend, label: "vs previous 30 days" }}
              tooltip="Total number of chat conversations created in the last 30 days (excluding deleted chats). Includes all channels: WhatsApp, Facebook, Telegram, Live Chat, and Bot API."
            />
            <MetricCard
              title="Average Response Time"
              value={data.avgResponseTime}
              description="First agent message"
              icon={Clock}
              trend={{ value: data.trends.responseTimeTrend, label: "improvement vs previous 30 days" }}
              tooltip="Average time from when chat opens (OPENED) to when agent sends first message (RESPONDED_BY_AGENT). Calculated as: AVG(responseAt - openedAt) for all chats in last 30 days."
            />
            <MetricCard
              title="Customer Satisfaction"
              value={data.satisfactionRate !== null ? `${data.satisfactionRate}%` : 'N/A'}
              description={data.satisfactionRate !== null ? "Based on feedback" : "Coming soon"}
              icon={UserCheck}
              trend={{ value: data.trends.satisfactionTrend, label: data.satisfactionRate !== null ? "vs previous 30 days" : "" }}
              tooltip="Percentage of customers who provided positive ratings in post-chat satisfaction polls. Currently unavailable - requires B2Chat poll data synchronization (COMPLETED_POLL state)."
            />
            <MetricCard
              title="Resolution Rate"
              value={`${data.resolutionRate}%`}
              description="Chats closed (last 30 days)"
              icon={Target}
              trend={{ value: data.trends.resolutionTrend, label: data.trends.resolutionTrend !== 0 ? "vs previous 30 days" : "" }}
              tooltip="Percentage of conversations that have been closed. Calculated as: (closed chats / total chats) × 100 for the last 30 days."
            />
          </div>

          {/* Response Time Metrics and SLA */}
          <div className="grid gap-4 md:grid-cols-3">
            <ResponseTimeCard
              title="First Response Time"
              metrics={data.responseTimeMetrics}
              trend={data.trends.responseTimeTrend}
              tooltip={`Time until agent sends first message to customer. Percentiles explained:
• Avg: Mean response time across all chats
• P50 (Median): 50% of chats responded faster
• P95: 95% of chats responded faster
• P99: 99% of chats responded faster
Calculated from responseAt - openedAt timestamps.`}
            />
            <ResponseTimeCard
              title="Resolution Time"
              metrics={data.resolutionTimeMetrics}
              variant="compact"
              tooltip="Total time from chat opening to closure. Shows how long it takes to completely resolve customer issues. Calculated as: closedAt - openedAt for completed chats."
            />
            <SLAComplianceCard
              compliance={data.slaCompliance}
              threshold={data.slaThreshold}
              tooltip={`Percentage of chats where first response met SLA threshold requirements. Calculated as: (compliant chats / total chats) × 100.

• Threshold: Maximum allowed response time
• Target: Goal compliance rate (typically 95%)

Different thresholds apply per channel and priority level.`}
            />
          </div>

          {/* Volume Chart Over Time */}
          <VolumeChartContainer
            officeHoursFilter={officeHoursFilter}
            directionFilter={directionFilter}
            agents={agents}
          />

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <ChartContainer
              title="Agent Performance"
              description="Customer satisfaction scores by agent"
              tooltip={`Relative performance scores (0-100) based on response time efficiency.

Calculation: Fastest agent = 100, slowest agent = 0
Formula: 100 - ((agent_avg - fastest_avg) / range × 100)

Higher score = faster average response times.`}
            >
              <SimpleBarChart data={data.agentPerformanceData} />
            </ChartContainer>

            <ChartContainer
              title="Weekly Chat Volume (Current Week)"
              description="Number of customer conversations per day"
              tooltip="Number of new conversations initiated each day during the current week (Sunday to Saturday). Shows daily patterns in customer contact volume."
            >
              <SimpleBarChart data={data.weeklyData} />
            </ChartContainer>
          </div>

          {/* Response Time Distribution */}
          <ChartContainer
            title="Response Time Distribution"
            description="Time taken to respond to customer messages"
            tooltip={`Number of chats grouped by first response time ranges:
• < 1 minute: Very fast
• 1-3 minutes: Fast
• 3-5 minutes: Moderate
• 5-10 minutes: Slow
• > 10 minutes: Very slow

Based on last 30 days of data.`}
          >
            <SimpleBarChart data={data.responseTimeData} />
          </ChartContainer>
        </TabsContent>

        <TabsContent value="response-times" className="space-y-4">
          {/* Response Time Deep Dive */}
          <div className="grid gap-4 md:grid-cols-2">
            <ResponseTimeCard
              title="Response Time Percentiles"
              metrics={data.responseTimeMetrics}
              trend={data.trends.responseTimeTrend}
              tooltip={`Time until agent sends first message to customer. Percentiles explained:
• Avg: Mean response time across all chats
• P50 (Median): 50% of chats responded faster
• P95: 95% of chats responded faster
• P99: 99% of chats responded faster
Calculated from responseAt - openedAt timestamps.`}
            />
            <ResponseTimeCard
              title="Resolution Time Percentiles"
              metrics={data.resolutionTimeMetrics}
              tooltip="Total time from chat opening to closure. Shows how long it takes to completely resolve customer issues. Calculated as: closedAt - openedAt for completed chats."
            />
          </div>

          {/* Weekly Response Time Heatmap */}
          <WeeklyResponseTimeHeatmap
            directionFilter={directionFilter}
            officeHoursFilter={officeHoursFilter}
            agents={agents}
          />

          {/* Channel Breakdown */}
          <DynamicChannelBreakdownChart data={data.responseTimeByChannel} />

          {/* Leaderboards */}
          <div className="grid gap-4 md:grid-cols-2">
            <ResponseTimeLeaderboard
              title="Top Performing Agents"
              data={data.agentResponseTimes}
              type="agents"
            />
            <ResponseTimeLeaderboard
              title="Department Performance"
              data={data.departmentResponseTimes}
              type="departments"
            />
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Active Agents"
              value={data.agentPerformanceData.length.toString()}
              description="Currently available"
              icon={Users}
              trend={{ value: 0, label: "stable" }}
              tooltip="Number of agents who have handled at least one chat with recorded response time in the last 30 days. Agents without any recorded responses are excluded."
            />
            <MetricCard
              title="Response Rate"
              value={`${Math.round(data.slaCompliance)}%`}
              description="SLA compliance"
              icon={Activity}
              trend={{ value: 0, label: "within target" }}
              tooltip="Percentage of first responses that met SLA threshold requirements. Same as SLA Compliance metric - shows how often agents respond within target time."
            />
            <MetricCard
              title="Total Chats"
              value={data.totalConversations.toLocaleString()}
              description="All conversations"
              icon={TrendingUp}
              trend={{ value: data.trends.conversationsTrend, label: "from last period" }}
              tooltip="Total number of chat conversations in the last 30 days. Same as 'Total Conversations' metric - repeated here for performance dashboard context."
            />
          </div>

          {/* Agent Performance Table */}
          <ChartContainer
            title="Agent Leaderboard"
            description="Top performing agents by satisfaction score"
            tooltip={`Top performing agents ranked by normalized response time scores.

Calculation: Fastest agent = 100, slowest agent = 0
Formula: 100 - ((agent_avg - fastest_avg) / range × 100)

Higher score = faster average response times.`}
          >
            <SimpleBarChart
              data={data.agentPerformanceData.sort((a, b) => b.value - a.value)}
            />
          </ChartContainer>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {/* Volume Chart Over Time */}
          <VolumeChartContainer
            officeHoursFilter={officeHoursFilter}
            directionFilter={directionFilter}
            agents={agents}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <ChartContainer
              title="7-Day Chat Volume Trend"
              description="Daily conversation volume over the past week"
              tooltip="Number of new conversations initiated each day during the current week (Sunday to Saturday). Shows daily patterns and trends in customer contact volume."
            >
              <SimpleBarChart data={data.weeklyData} />
            </ChartContainer>

            <ChartContainer
              title="Response Time Breakdown"
              description="Distribution of response times"
              tooltip={`Number of chats grouped by first response time ranges:
• < 1 minute: Very fast
• 1-3 minutes: Fast
• 3-5 minutes: Moderate
• 5-10 minutes: Slow
• > 10 minutes: Very slow

Based on last 30 days of data.`}
            >
              <SimpleBarChart data={data.responseTimeData} />
            </ChartContainer>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </TooltipProvider>
  )
}
