"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MetricCard } from "@/components/analytics/metric-card"
import { ChartContainer } from "@/components/analytics/chart-container"
import { SimpleBarChart } from "@/components/analytics/simple-bar-chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp,
  Users,
  MessageSquare,
  Clock,
  UserCheck,
  Target,
  Activity,
  BarChart3
} from "lucide-react"
import { useAnalyticsData } from "@/hooks/use-analytics-data"

export default function AnalyticsPage() {
  const { data, loading, error } = useAnalyticsData()

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Performance Indicators */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Conversations"
              value={data.totalConversations.toLocaleString()}
              description="This month"
              icon={MessageSquare}
              trend={{ value: data.trends.conversationsTrend, label: "from last month" }}
            />
            <MetricCard
              title="Average Response Time"
              value={data.avgResponseTime}
              description="Across all agents"
              icon={Clock}
              trend={{ value: data.trends.responseTimeTrend, label: "from last week" }}
            />
            <MetricCard
              title="Customer Satisfaction"
              value={`${data.satisfactionRate}%`}
              description="Based on feedback"
              icon={UserCheck}
              trend={{ value: data.trends.satisfactionTrend, label: "from last month" }}
            />
            <MetricCard
              title="Resolution Rate"
              value={`${data.resolutionRate}%`}
              description="First contact resolution"
              icon={Target}
              trend={{ value: data.trends.resolutionTrend, label: "from last month" }}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <ChartContainer
              title="Weekly Chat Volume"
              description="Number of customer conversations per day"
            >
              <SimpleBarChart data={data.weeklyData} />
            </ChartContainer>

            <ChartContainer
              title="Agent Performance"
              description="Customer satisfaction scores by agent"
            >
              <SimpleBarChart data={data.agentPerformanceData} />
            </ChartContainer>
          </div>

          {/* Response Time Distribution */}
          <ChartContainer
            title="Response Time Distribution"
            description="Time taken to respond to customer messages"
          >
            <SimpleBarChart data={data.responseTimeData} />
          </ChartContainer>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Active Agents"
              value={data.agentPerformanceData.length.toString()}
              description="Currently available"
              icon={Users}
              trend={{ value: 0, label: "stable" }}
            />
            <MetricCard
              title="Queue Length"
              value="7"
              description="Customers waiting"
              icon={Activity}
              trend={{ value: -25, label: "from peak hour" }}
            />
            <MetricCard
              title="Peak Hours"
              value="2-4 PM"
              description="Busiest time today"
              icon={TrendingUp}
              trend={{ value: 0, label: "consistent" }}
            />
          </div>

          {/* Agent Performance Table */}
          <ChartContainer
            title="Agent Leaderboard"
            description="Top performing agents by satisfaction score"
          >
            <SimpleBarChart
              data={data.agentPerformanceData.sort((a, b) => b.value - a.value)}
            />
          </ChartContainer>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartContainer
              title="7-Day Chat Volume Trend"
              description="Daily conversation volume over the past week"
            >
              <SimpleBarChart data={data.weeklyData} />
            </ChartContainer>

            <ChartContainer
              title="Response Time Breakdown"
              description="Distribution of response times"
            >
              <SimpleBarChart data={data.responseTimeData} />
            </ChartContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}