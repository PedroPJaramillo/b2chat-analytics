/**
 * Analysis Trigger Component
 * Handles triggering new analysis and displaying status
 */

'use client'

import { useState } from 'react'
import { AnalysisFilters } from './analysis-filters'
import { useTriggerAnalysis } from '@/hooks/use-customer-analysis'
import type { AnalysisFiltersFormData } from '@/lib/customer-analysis/filter-schema'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AnalysisTriggerProps {
  onAnalysisTriggered?: (analysisId: string) => void
}

export function AnalysisTrigger({ onAnalysisTriggered }: AnalysisTriggerProps) {
  const { mutate: triggerAnalysis, isPending, error, data } = useTriggerAnalysis()
  const { toast } = useToast()
  const [triggeredAnalysisId, setTriggeredAnalysisId] = useState<string | null>(null)

  const handleTrigger = (filters: AnalysisFiltersFormData) => {
    const sanitizedFilters: AnalysisFiltersFormData = {
      ...filters,
      agentIds: filters.agentIds && filters.agentIds.length > 0 ? filters.agentIds : undefined,
      departmentIds:
        filters.departmentIds && filters.departmentIds.length > 0 ? filters.departmentIds : undefined,
      contactIds:
        filters.contactIds && filters.contactIds.length > 0 ? filters.contactIds : undefined,
    }

    triggerAnalysis(
      { filters: sanitizedFilters },
      {
        onSuccess: (response) => {
          setTriggeredAnalysisId(response.analysisId)
          onAnalysisTriggered?.(response.analysisId)

          toast({
            title: 'Analysis Started',
            description: response.message,
            variant: 'default',
          })
        },
        onError: (err) => {
          toast({
            title: 'Analysis Failed',
            description: err.message,
            variant: 'destructive',
          })
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Customer Service Analysis</CardTitle>
          <CardDescription>
            Analyze customer conversations to gain insights into intent, journey stages, sentiment,
            and agent performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Success Message */}
          {data && !error && (
            <Alert className="mb-4" variant="default">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Analysis Triggered Successfully</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{data.message}</p>
                {data.estimatedProcessingTime && (
                  <p className="text-sm flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Estimated processing time:{' '}
                    {Math.round(data.estimatedProcessingTime / 1000 / 60)} minutes
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to Trigger Analysis</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isPending && (
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50 mb-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Starting analysis...</p>
                <p className="text-sm text-muted-foreground">
                  Validating filters and queuing analysis job
                </p>
              </div>
            </div>
          )}

          {/* Filters Form */}
          <AnalysisFilters onSubmit={handleTrigger} isSubmitting={isPending} />
        </CardContent>
      </Card>
    </div>
  )
}
