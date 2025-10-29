/**
 * Agent Performance Visualization
 * Displays agent metrics, response times, and top performers
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
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, Clock, Star } from 'lucide-react'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

interface AgentPerformanceViewProps {
  data: AnalysisResultsResponse['agentPerformance']
}

export function AgentPerformanceView({ data }: AgentPerformanceViewProps) {
  // Transform data for response time chart
  const responseTimeData = data.byAgent
    .slice(0, 10)
    .map((agent) => ({
      name: agent.agentName.split(' ')[0], // First name only for space
      avgResponse: Math.round(agent.metrics.firstResponseTime.average / 1000 / 60), // Convert to minutes
      p50: Math.round(agent.metrics.firstResponseTime.p50 / 1000 / 60),
      p90: Math.round(agent.metrics.firstResponseTime.p90 / 1000 / 60),
      quality: agent.metrics.qualityScore.average,
    }))
    .sort((a, b) => a.avgResponse - b.avgResponse)

  // Top performers with icons
  const performerIcons = {
    fastest_response: Clock,
    highest_quality: Star,
    most_chats: TrendingUp,
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((item: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: item.color }}>
              {item.name}: {item.value} {item.dataKey.includes('quality') ? '/10' : 'min'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Top Performers */}
      {data.topPerformers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {data.topPerformers.slice(0, 3).map((performer, index) => {
            const Icon = performerIcons[performer.metric as keyof typeof performerIcons] || Trophy
            return (
              <Card key={`${performer.agentId}-${performer.metric}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">
                      {performer.metric.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold mb-1">{performer.agentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {performer.metric.includes('time')
                      ? `${Math.round(performer.value / 1000 / 60)} minutes`
                      : performer.value.toLocaleString()}
                  </p>
                  {index === 0 && <Badge className="mt-2">🥇 #1</Badge>}
                  {index === 1 && <Badge variant="secondary" className="mt-2">🥈 #2</Badge>}
                  {index === 2 && <Badge variant="secondary" className="mt-2">🥉 #3</Badge>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Response Time Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Response Time Analysis</CardTitle>
          <CardDescription>Average, P50, and P90 response times by agent (in minutes)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="p50" fill="#3b82f6" name="P50 (Median)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="avgResponse" fill="#8b5cf6" name="Average" radius={[0, 4, 4, 0]} />
                <Bar dataKey="p90" fill="#ec4899" name="P90" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Details</CardTitle>
          <CardDescription>
            Detailed metrics for {data.byAgent.length} agent{data.byAgent.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Chats</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Avg Response</TableHead>
                  <TableHead className="text-right">P90 Response</TableHead>
                  <TableHead className="text-right">Quality Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byAgent.slice(0, 20).map((agent) => (
                  <TableRow key={agent.agentId}>
                    <TableCell className="font-medium">{agent.agentName}</TableCell>
                    <TableCell className="text-right">{agent.metrics.totalChats.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {agent.metrics.totalMessages.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.round(agent.metrics.firstResponseTime.average / 1000 / 60)}m
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.round(agent.metrics.firstResponseTime.p90 / 1000 / 60)}m
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{agent.metrics.qualityScore.average.toFixed(1)}/10</span>
                        {agent.metrics.qualityScore.average >= 8 && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.byAgent.length > 20 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing top 20 of {data.byAgent.length} agents
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quality Score Distribution */}
      {data.byAgent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Score Distribution</CardTitle>
            <CardDescription>Agent quality scores across all conversations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byAgent.slice(0, 10).map((agent) => ({
                  name: agent.agentName.split(' ')[0],
                  score: agent.metrics.qualityScore.average,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" fill="#10b981" name="Quality Score" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
