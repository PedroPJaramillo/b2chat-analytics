'use client'

import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { RecalculationRequest } from '@/types/sla'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  estimateChatCount,
  formatDateRange,
  formatEstimatedTime,
} from '@/lib/sla/recalculation-helpers'

export interface SLARecalculationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  request: RecalculationRequest
  loading?: boolean
}

export function SLARecalculationDialog({
  open,
  onOpenChange,
  onConfirm,
  request,
  loading = false,
}: SLARecalculationDialogProps) {
  const { startDate, endDate, chatId, limit } = request

  // Calculate estimated impact
  const estimatedChats = startDate && endDate ? estimateChatCount(startDate, endDate) : 0
  const estimatedTime = estimateChatCount(startDate || '', endDate || '')
  const isLargeOperation = estimatedChats > 1000

  // Handle confirm
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Recalculate SLA Metrics?</DialogTitle>
          <DialogDescription>
            This will recalculate SLA metrics using your current configuration for the specified date range.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Range Display */}
          {startDate && endDate && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recalculation Scope:</h4>
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date Range:</span>
                  <span className="font-medium">{formatDateRange(startDate, endDate)}</span>
                </div>
                {chatId ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chat ID:</span>
                    <span className="font-mono text-xs">{chatId}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Chats:</span>
                      <span className="font-medium">~{estimatedChats} chats</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Time:</span>
                      <span className="font-medium">{formatEstimatedTime(estimatedTime)}</span>
                    </div>
                  </>
                )}
                {limit && !chatId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Chats:</span>
                    <span className="font-medium">{limit.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning for large operations */}
          {isLargeOperation && !chatId && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Large Operation</AlertTitle>
              <AlertDescription>
                This will process over 1,000 chats. Consider running during off-peak hours to minimize performance
                impact.
              </AlertDescription>
            </Alert>
          )}

          {/* Info about what happens */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>What will happen</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <div className="space-y-1 text-xs">
                <p>• Your current SLA configuration will be applied</p>
                <p>• All enabled metrics will be recalculated</p>
                <p>• Existing chat data will not be modified</p>
                <p>• Operation will continue even if some chats fail</p>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Recalculating...
              </>
            ) : (
              'Recalculate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
