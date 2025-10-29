/**
 * Customer Analysis Dashboard Page
 * Main page for triggering and viewing customer service analysis
 */

'use client'

import { useState, useEffect } from 'react'
import { AnalysisTrigger } from '@/components/customer-analysis/analysis-trigger'
import { AnalysisResultsEnhanced } from '@/components/customer-analysis/analysis-results-enhanced'
import { useAnalysisList } from '@/hooks/use-customer-analysis'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  FileText,
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function CustomerAnalysisPage() {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'trigger' | 'history'>('trigger')

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N - New Analysis tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setActiveTab('trigger')
      }
      // Ctrl/Cmd + H - History tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        setActiveTab('history')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
  } = useAnalysisList(1, 20)

  const handleAnalysisTriggered = (analysisId: string) => {
    setSelectedAnalysisId(analysisId)
    setActiveTab('history')
  }

  const handleViewAnalysis = (analysisId: string) => {
    setSelectedAnalysisId(analysisId)
    setActiveTab('history')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case 'PROCESSING':
        return <Clock className="h-4 w-4 text-primary animate-pulse" />
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'PARTIAL':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-destructive" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>
      case 'PROCESSING':
        return <Badge variant="default">Processing</Badge>
      case 'COMPLETED':
        return <Badge className="bg-green-500">Completed</Badge>
      case 'PARTIAL':
        return <Badge className="bg-yellow-500">Partial</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>
    }
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Customer Analysis</h2>
          <p className="text-muted-foreground mt-1">
            AI-powered analysis of customer conversations and agent performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'trigger' | 'history')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="trigger">New Analysis</TabsTrigger>
          <TabsTrigger value="history">History & Results</TabsTrigger>
        </TabsList>

        {/* New Analysis Tab */}
        <TabsContent value="trigger" className="space-y-4 mt-6">
          <AnalysisTrigger onAnalysisTriggered={handleAnalysisTriggered} />
        </TabsContent>

        {/* History & Results Tab */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Analysis History List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Analyses</CardTitle>
                  <CardDescription>
                    {historyData
                      ? `${historyData.analyses.length} of ${historyData.pagination.total} shown`
                      : 'Loading...'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading && (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="space-y-2 p-3 border rounded-lg">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      ))}
                    </div>
                  )}

                  {historyError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{historyError.message}</AlertDescription>
                    </Alert>
                  )}

                  {historyData && historyData.analyses.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No analyses yet</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setActiveTab('trigger')}
                        className="mt-2"
                      >
                        Create your first analysis
                      </Button>
                    </div>
                  )}

                  {historyData && historyData.analyses.length > 0 && (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {historyData.analyses.map((analysis) => (
                        <button
                          key={analysis.id}
                          onClick={() => handleViewAnalysis(analysis.id)}
                          className={`w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                            selectedAnalysisId === analysis.id ? 'bg-muted border-primary' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon(analysis.status)}
                                {getStatusBadge(analysis.status)}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {new Date(analysis.filters.dateStart).toLocaleDateString()} -{' '}
                                {new Date(analysis.filters.dateEnd).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(analysis.createdAt), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Results Display */}
            <div className="lg:col-span-2">
              {!selectedAnalysisId && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Analysis Selected</CardTitle>
                    <CardDescription>
                      Select an analysis from the list to view results
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Choose an analysis or create a new one
                    </p>
                  </CardContent>
                </Card>
              )}

              {selectedAnalysisId && <AnalysisResultsEnhanced analysisId={selectedAnalysisId} />}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
