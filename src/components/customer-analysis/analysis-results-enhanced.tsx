/**
 * Enhanced Analysis Results Component with Visualizations
 * Displays complete analysis results with interactive charts
 */

'use client'

import { useState, Suspense, lazy } from 'react'
import { useAnalysisResults, useAnalysisStatus } from '@/hooks/use-customer-analysis'
import { AnalysisStatus } from './analysis-status'
import { ExportButton } from './export-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, BarChart3, Users, Activity } from 'lucide-react'

// Lazy load visualization components for better performance
const CustomerInsightsView = lazy(
  () =>
    import('./visualizations/customer-insights-view').then((mod) => ({
      default: mod.CustomerInsightsView,
    }))
)

const AgentPerformanceView = lazy(
  () =>
    import('./visualizations/agent-performance-view').then((mod) => ({
      default: mod.AgentPerformanceView,
    }))
)

const OperationalInsightsView = lazy(
  () =>
    import('./visualizations/operational-insights-view').then((mod) => ({
      default: mod.OperationalInsightsView,
    }))
)

// Skeleton loader for visualizations
function VisualizationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface AnalysisResultsEnhancedProps {
  analysisId: string
}

export function AnalysisResultsEnhanced({ analysisId }: AnalysisResultsEnhancedProps) {
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
        <VisualizationSkeleton />
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
      {/* Status Banner with Export Button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AnalysisStatus analysisId={analysisId} />
        </div>
        <div className="flex-shrink-0">
          <ExportButton analysisId={analysisId} disabled={results.status !== 'COMPLETED'} />
        </div>
      </div>

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
            <span className="hidden sm:inline">Customer Insights</span>
            <span className="sm:hidden">Customer</span>
          </TabsTrigger>
          <TabsTrigger value="agent" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Agent Performance</span>
            <span className="sm:hidden">Agents</span>
          </TabsTrigger>
          <TabsTrigger value="operational" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Operations</span>
            <span className="sm:hidden">Ops</span>
          </TabsTrigger>
        </TabsList>

        {/* Customer Insights Tab */}
        <TabsContent value="customer">
          <Suspense fallback={<VisualizationSkeleton />}>
            <CustomerInsightsView data={results.customerInsights} />
          </Suspense>
        </TabsContent>

        {/* Agent Performance Tab */}
        <TabsContent value="agent">
          <Suspense fallback={<VisualizationSkeleton />}>
            <AgentPerformanceView data={results.agentPerformance} />
          </Suspense>
        </TabsContent>

        {/* Operational Insights Tab */}
        <TabsContent value="operational">
          <Suspense fallback={<VisualizationSkeleton />}>
            <OperationalInsightsView data={results.operationalInsights} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
