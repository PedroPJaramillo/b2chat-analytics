"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  MessageSquare,
  Clock,
  TrendingUp,
  Activity,
  UserCheck
} from "lucide-react"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useAgents } from "@/hooks/use-agents"
import { useDashboardActivity } from "@/hooks/use-dashboard-activity"
import { EmptyStateInline } from "@/components/empty-state"
import { Database } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { pageContainerClasses } from "@/lib/ui-utils"

export default function DashboardPage() {
  const { data: stats, loading: statsLoading, error: statsError } = useDashboardStats()
  const { data: agents, loading: agentsLoading } = useAgents()
  const { data: activities, loading: activitiesLoading } = useDashboardActivity()

  const maxChats = useMemo(
    () => agents && agents.length > 0 ? Math.max(...agents.map(a => a.activeChats)) : 0,
    [agents]
  )

  const renderBadge = () => {
    if (statsLoading) {
      return <Badge variant="outline" className="text-muted-foreground">Loading metrics…</Badge>
    }

    if (statsError) {
      return <Badge variant="destructive">Data unavailable</Badge>
    }

    if (stats && stats.totalChats > 0) {
      return <Badge variant="outline" className="bg-primary/10 text-primary">Live Data</Badge>
    }

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/dashboard/sync" className="inline-flex">
              <Badge variant="secondary" className="cursor-pointer">
                No Data — Run Sync
              </Badge>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="left">
            Launch a B2Chat sync to populate dashboard metrics.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={pageContainerClasses}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          {renderBadge()}
        </div>
      </div>

      {statsError && !statsLoading && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load dashboard metrics</AlertTitle>
          <AlertDescription>
            {statsError}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.totalAgents || 0}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  +{stats?.trends.agentsChange || 0} from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.activeChats || 0}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  +{stats?.trends.chatsChange || 0}% from yesterday
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.avgResponseTime || '0m'}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {stats?.trends.responseTimeChange && stats.trends.responseTimeChange < 0 ? '' : '+'}
                  {stats?.trends.responseTimeChange || 0}% from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Satisfaction Rate</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">
                    {stats?.satisfactionRate !== null && stats?.satisfactionRate !== undefined
                      ? `${stats.satisfactionRate}%`
                      : 'N/A'}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {stats?.satisfactionRate !== null && stats?.satisfactionRate !== undefined
                    ? `${stats.trends.satisfactionChange >= 0 ? '+' : ''}${stats.trends.satisfactionChange}% from last month`
                    : 'No rating data available'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Performance */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest customer service interactions and system events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activitiesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="w-2 h-2 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))
                ) : activities.length > 0 ? (
                  activities.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-4">
                      <div className={`w-2 h-2 ${activity.color} rounded-full`}></div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {activity.timeAgo}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyStateInline
                    icon={Activity}
                    title="No recent activity"
                    description="Activity will appear here as agents interact with customers"
                  />
                )}
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
                <CardDescription>
                  Current workload and efficiency metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agentsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))
                ) : agents.length > 0 ? (
                  agents.slice(0, 3).map((agent, index) => {
                    const colors = ['bg-green-500', 'bg-yellow-500', 'bg-blue-500']
                    const progressValue = maxChats > 0 ? (agent.activeChats / maxChats) * 100 : 0

                    return (
                      <div key={agent.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 ${colors[index]} rounded-full`}></div>
                            <span className="text-sm font-medium">{agent.name}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{agent.activeChats} chats</span>
                        </div>
                        <Progress value={progressValue} className="h-2" />
                      </div>
                    )
                  })
                ) : (
                  <EmptyStateInline
                    icon={Database}
                    title="No agent data available"
                    description="Run B2Chat sync to populate agent data from chats"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chat Volume</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.totalChats || 0}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  +{stats?.trends.chatsChange || 0}% from yesterday
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">
                    {stats?.satisfactionRate !== null && stats?.satisfactionRate !== undefined
                      ? `${stats.satisfactionRate}%`
                      : 'N/A'}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {stats?.satisfactionRate !== null && stats?.satisfactionRate !== undefined
                    ? `${stats.trends.satisfactionChange >= 0 ? '+' : ''}${stats.trends.satisfactionChange}% from last month`
                    : 'No rating data available'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.avgResponseTime || '0m'}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {stats?.trends.responseTimeChange && stats.trends.responseTimeChange < 0 ? '' : '+'}
                  {stats?.trends.responseTimeChange || 0}% from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.activeChats || 0}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  currently open
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
