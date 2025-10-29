/**
 * Analysis Results Component
 * Displays complete analysis results with insights
 */

'use client'

import { useState } from 'react'
import { useAnalysisResults, useAnalysisStatus } from '@/hooks/use-customer-analysis'
import { AnalysisStatus } from './analysis-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, BarChart3, Users, TrendingUp, Activity } from 'lucide-react'

interface AnalysisResultsProps {
  analysisId: string
}

export function AnalysisResults({ analysisId }: AnalysisResultsProps) {
  const { data: status } = useAnalysisStatus(analysisId)
  const [showResults, setShowResults] = useState(false)

  // Only fetch results when analysis is complete
  const shouldFetchResults =
    showResults || status?.status === 'COMPLETED' || status?.status === 'PARTIAL'

  const {
    data: results,
    isLoading: resultsLoading,
    error: resultsError,
  } = useAnalysisResults(analysisId, {
    enabled: shouldFetchResults,
  })

  // Show status component while processing
  if (status && (status.status === 'PENDING' || status.status === 'PROCESSING')) {
    return <AnalysisStatus analysisId={analysisId} onComplete={() => setShowResults(true)} />
  }

  // Show status if failed
  if (status?.status === 'FAILED') {
    return <AnalysisStatus analysisId={analysisId} />
  }

  // Loading results
  if (resultsLoading) {
    return (
      <div className="space-y-4">
        <AnalysisStatus analysisId={analysisId} />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error loading results
  if (resultsError) {
    return (
      <div className="space-y-4">
        <AnalysisStatus analysisId={analysisId} />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to Load Results</AlertTitle>
          <AlertDescription>{resultsError.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // No results yet
  if (!results) {
    return <AnalysisStatus analysisId={analysisId} onComplete={() => setShowResults(true)} />
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <AnalysisStatus analysisId={analysisId} />

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
          <CardDescription>
            {results.summary.dateRange.start} to {results.summary.dateRange.end}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Chats</p>
              <p className="text-2xl font-bold">
                {results.summary.totalChatsAnalyzed.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Messages</p>
              <p className="text-2xl font-bold">
                {results.summary.totalMessagesAnalyzed.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">AI Categorizations</p>
              <p className="text-2xl font-bold">
                {results.summary.aiAnalysisCount.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-2xl font-bold">
                {results.status === 'COMPLETED' ? '100%' : 'Partial'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Different Insights */}
      <Tabs defaultValue="customer" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customer" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Customer Insights
          </TabsTrigger>
          <TabsTrigger value="agent" className="gap-2">
            <Users className="h-4 w-4" />
            Agent Performance
          </TabsTrigger>
          <TabsTrigger value="operational" className="gap-2">
            <Activity className="h-4 w-4" />
            Operations
          </TabsTrigger>
        </TabsList>

        {/* Customer Insights Tab */}
        <TabsContent value="customer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Intent Distribution</CardTitle>
              <CardDescription>What customers are asking about</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(Object.entries(results.customerInsights.intentDistribution) as Array<[
                  string,
                  number,
                ]>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([intent, percentage]) => (
                    <div key={intent}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{intent.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">
                          {(percentage * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${percentage * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Journey Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(Object.entries(results.customerInsights.journeyStageDistribution) as Array<[
                    string,
                    number,
                  ]>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([stage, percentage]) => (
                      <div key={stage} className="flex justify-between text-sm">
                        <span>{stage.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{(percentage * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(Object.entries(results.customerInsights.sentimentDistribution) as Array<[
                    string,
                    number,
                  ]>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sentiment, percentage]) => (
                      <div key={sentiment} className="flex justify-between text-sm">
                        <span>{sentiment}</span>
                        <span className="font-medium">{(percentage * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agent Performance Tab */}
        <TabsContent value="agent" className="space-y-4">
          {results.agentPerformance.topPerformers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.agentPerformance.topPerformers.map((performer) => (
                    <div
                      key={`${performer.agentId}-${performer.metric}`}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{performer.agentName}</p>
                        <p className="text-sm text-muted-foreground">
                          {performer.metric.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          {performer.metric.includes('time')
                            ? `${Math.round(performer.value / 1000 / 60)}m`
                            : performer.value.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Agent Performance Summary</CardTitle>
              <CardDescription>
                {results.agentPerformance.byAgent.length} agent(s) analyzed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.agentPerformance.byAgent.slice(0, 10).map((agent) => (
                  <div key={agent.agentId} className="border-b pb-4 last:border-0">
                    <p className="font-medium mb-2">{agent.agentName}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Chats</p>
                        <p className="font-medium">{agent.metrics.totalChats}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Response</p>
                        <p className="font-medium">
                          {Math.round(agent.metrics.firstResponseTime.average / 1000 / 60)}m
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Quality</p>
                        <p className="font-medium">
                          {agent.metrics.qualityScore.average.toFixed(1)}/10
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Messages</p>
                        <p className="font-medium">{agent.metrics.totalMessages}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operational Insights Tab */}
        <TabsContent value="operational" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
                <CardDescription>Busiest times of day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(results.operationalInsights.peakTimes.byHour)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([hour, count]) => (
                      <div key={hour} className="flex justify-between text-sm">
                        <span>
                          {hour}:00 - {parseInt(hour) + 1}:00
                        </span>
                        <span className="font-medium">{count} messages</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Text</span>
                    <span className="font-medium">
                      {results.operationalInsights.channelDistribution.text}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Voice</span>
                    <span className="font-medium">
                      {results.operationalInsights.channelDistribution.voice}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Media</span>
                    <span className="font-medium">
                      {results.operationalInsights.channelDistribution.media}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {results.operationalInsights.commonPainPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Common Pain Points</CardTitle>
                <CardDescription>Issues identified by AI analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.operationalInsights.commonPainPoints.map((painPoint, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium">{painPoint.category}</p>
                        <span className="text-sm text-muted-foreground">
                          {painPoint.frequency} occurrences
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{painPoint.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
