/**
 * Analysis Status Component
 * Displays status and progress of ongoing analysis
 */

'use client'

import { useAnalysisStatus } from '@/hooks/use-customer-analysis'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AnalysisStatusProps {
  analysisId: string
  onComplete?: () => void
}

export function AnalysisStatus({ analysisId, onComplete }: AnalysisStatusProps) {
  const { data: status, isLoading, error } = useAnalysisStatus(analysisId)

  // Call onComplete when analysis finishes
  if (
    status &&
    (status.status === 'COMPLETED' || status.status === 'PARTIAL' || status.status === 'FAILED') &&
    onComplete
  ) {
    // Use setTimeout to avoid calling setState during render
    setTimeout(() => onComplete(), 0)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Analysis Status...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Status</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!status) {
    return null
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'PENDING':
        return <Clock className="h-5 w-5 text-muted-foreground" />
      case 'PROCESSING':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'PARTIAL':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-destructive" />
    }
  }

  const getStatusBadge = () => {
    switch (status.status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>
      case 'PROCESSING':
        return <Badge variant="default">Processing</Badge>
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'PARTIAL':
        return <Badge variant="default" className="bg-yellow-500">Partial</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle>Analysis Status</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                {getStatusBadge()}
                {status.startedAt && (
                  <span className="text-xs">
                    Started {formatDistanceToNow(new Date(status.startedAt), { addSuffix: true })}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar for Processing */}
        {status.status === 'PROCESSING' && status.progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{status.progress.percentComplete}%</span>
            </div>
            <Progress value={status.progress.percentComplete} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Processed {status.progress.chatsProcessed.toLocaleString()} of{' '}
              {status.progress.totalChats.toLocaleString()} conversations
            </p>
          </div>
        )}

        {/* Completion Time */}
        {status.completedAt && (
          <div className="text-sm text-muted-foreground">
            Completed {formatDistanceToNow(new Date(status.completedAt), { addSuffix: true })}
          </div>
        )}

        {/* Error Message */}
        {status.status === 'FAILED' && status.errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>{status.errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Partial Completion Warning */}
        {status.status === 'PARTIAL' && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-900">Partial Results Available</AlertTitle>
            <AlertDescription className="space-y-3 text-yellow-800">
              {/* Error Summary */}
              <div className="space-y-1">
                <p className="font-medium">
                  AI Analysis: {status.aiAnalysisCount || 0} of {status.totalChatsAnalyzed || 0} conversations processed
                </p>
                {status.errorMessage && (
                  <p className="text-sm">
                    <span className="font-medium">Error:</span> {status.errorMessage}
                  </p>
                )}
              </div>

              {/* Available Metrics */}
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Available Metrics:
                </p>
                <ul className="text-xs space-y-0.5 ml-5 list-disc">
                  <li>Response time analysis (average, p50, p90)</li>
                  <li>Message volume and trends ({status.totalMessagesAnalyzed?.toLocaleString() || 0} messages)</li>
                  <li>Peak activity times and patterns</li>
                  <li>Agent performance metrics</li>
                  <li>Channel distribution</li>
                </ul>
              </div>

              {/* Missing AI Insights */}
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                  Unavailable AI Insights:
                </p>
                <ul className="text-xs space-y-0.5 ml-5 list-disc">
                  <li>Customer intent categorization</li>
                  <li>Journey stage identification</li>
                  <li>Sentiment analysis</li>
                  <li>Agent quality scoring</li>
                </ul>
              </div>

              {/* Next Steps */}
              {status.errorMessage?.includes('API_KEY') || status.errorMessage?.includes('ANTHROPIC') || status.errorMessage?.includes('CLAUDE') ? (
                <p className="text-sm font-medium">
                  → Next Steps: Check your CLAUDE_API_KEY configuration in .env and retry the analysis
                </p>
              ) : (
                <p className="text-sm font-medium">
                  → Next Steps: Review the error message and retry the analysis
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Filter Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            Date Range: {new Date(status.filters.dateStart).toLocaleDateString()} -{' '}
            {new Date(status.filters.dateEnd).toLocaleDateString()}
          </div>
          {status.filters.agentIds && status.filters.agentIds.length > 0 && (
            <div>Agents: {status.filters.agentIds.length} selected</div>
          )}
          {status.filters.departmentIds && status.filters.departmentIds.length > 0 && (
            <div>Departments: {status.filters.departmentIds.length} selected</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
