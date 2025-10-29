'use client'

import { AlertCircle, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react'
import { RecalculationResult, LastRecalculation } from '@/types/sla'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDuration, getRelativeTime } from '@/lib/sla/recalculation-helpers'

export interface SLARecalculationResultProps {
  result?: RecalculationResult | null
  lastRecalculation?: LastRecalculation | null
  mode: 'compact' | 'detailed'
  onDismiss?: () => void
}

export function SLARecalculationResult({
  result,
  lastRecalculation,
  mode,
  onDismiss,
}: SLARecalculationResultProps) {
  // Compact mode - show last recalculation info
  if (mode === 'compact' && lastRecalculation) {
    const { timestamp, processed, failed, duration } = lastRecalculation
    const hasErrors = failed > 0

    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="text-muted-foreground">Last recalculation: </span>
            <span className="font-medium">{getRelativeTime(timestamp)}</span>
            <span className="text-muted-foreground"> — </span>
            <span>{processed} chat{processed === 1 ? '' : 's'}</span>
            {hasErrors && (
              <>
                <span className="text-muted-foreground">, </span>
                <span className="text-destructive">{failed} failed</span>
              </>
            )}
          </div>
        </div>
        {hasErrors ? (
          <Badge variant="outline" className="text-xs">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Partial
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Success
          </Badge>
        )}
      </div>
    )
  }

  // Detailed mode - show current operation results
  if (mode === 'detailed' && result) {
    const { success, processed, failed, total, duration, errors } = result
    const hasErrors = failed > 0 || (errors && errors.length > 0)

    // Determine alert variant
    const variant = success && !hasErrors ? 'default' : hasErrors ? 'warning' : 'destructive'
    const Icon = success && !hasErrors ? CheckCircle2 : hasErrors ? AlertTriangle : AlertCircle

    return (
      <Alert variant={variant}>
        <Icon className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>
            {success && !hasErrors
              ? 'SLA Recalculation Completed'
              : hasErrors
                ? 'SLA Recalculation Completed with Errors'
                : 'SLA Recalculation Failed'}
          </span>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-auto p-1 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </AlertTitle>
        <AlertDescription className="mt-3 space-y-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 rounded-md border bg-background/50 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{processed}</div>
              <div className="text-xs text-muted-foreground">Processed</div>
            </div>
            {hasErrors && (
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold">{formatDuration(duration)}</div>
              <div className="text-xs text-muted-foreground">Duration</div>
            </div>
          </div>

          {/* Error List */}
          {errors && errors.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Errors:</div>
              <div className="space-y-1.5 rounded-md border bg-background/50 p-3 max-h-40 overflow-y-auto">
                {errors.map((error, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-xs"
                  >
                    <AlertCircle className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-muted-foreground">
                        {error.chatId}
                      </span>
                      <span className="mx-2">•</span>
                      <span className="text-foreground">{error.error}</span>
                    </div>
                  </div>
                ))}
              </div>
              {failed > errors.length && (
                <div className="text-xs text-muted-foreground">
                  ... and {failed - errors.length} more error{failed - errors.length === 1 ? '' : 's'}
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {success && !hasErrors && (
            <div className="text-sm text-muted-foreground">
              All chats were successfully recalculated using your current SLA configuration.
            </div>
          )}

          {/* Partial Success Message */}
          {hasErrors && processed > 0 && (
            <div className="text-sm text-muted-foreground">
              {processed} of {total} chats were successfully recalculated. Please review the errors above and consider retrying the failed chats.
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // No data to display
  return null
}
