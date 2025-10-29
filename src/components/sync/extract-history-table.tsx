"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, RefreshCw, History, AlertCircle } from "lucide-react"
import { type ExtractBatch } from "@/hooks/use-extract"
import { ErrorDetailsDialog } from "./error-details-dialog"

interface ExtractHistoryTableProps {
  batches: ExtractBatch[]
  loading?: boolean
  onRefresh?: () => void
}

export function ExtractHistoryTable({ batches, loading, onRefresh }: ExtractHistoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<ExtractBatch | null>(null)

  const toggleRow = (batchId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId)
    } else {
      newExpanded.add(batchId)
    }
    setExpandedRows(newExpanded)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>
      case 'running':
        return <Badge variant="default" className="bg-blue-600">Running</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDuration = (startedAt: string, completedAt?: string) => {
    if (!completedAt) return 'N/A'
    const duration = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  const formatTimeRange = (timeRangePreset?: string) => {
    if (!timeRangePreset) return 'N/A'
    if (timeRangePreset === 'full') return 'Full Sync'
    if (timeRangePreset === '1d') return 'Last 24h'
    return `Last ${timeRangePreset.replace('d', 'd')}`
  }

  const showErrorDetails = (batch: ExtractBatch) => {
    setSelectedBatch(batch)
    setErrorDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5 text-gray-600" />
            <CardTitle>Extract History</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Last 20 extract operations with detailed parameters
        </CardDescription>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No extract operations yet
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const isExpanded = expandedRows.has(batch.id)
                  return (
                    <React.Fragment key={batch.id}>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={() => toggleRow(batch.id)}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {new Date(batch.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium capitalize">{batch.entityType}</span>
                        </TableCell>
                        <TableCell>{formatTimeRange(batch.timeRangePreset)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {batch.recordsFetched?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDuration(batch.startedAt, batch.completedAt)}
                        </TableCell>
                        <TableCell>{getStatusBadge(batch.status)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Configuration</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Operation:</span>{' '}
                                    <span className="font-medium">{batch.operation}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Batch Size:</span>{' '}
                                    <span className="font-medium">{batch.batchSize || 100}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Pages Fetched:</span>{' '}
                                    <span className="font-medium">{batch.totalPages || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">API Calls:</span>{' '}
                                    <span className="font-medium">{batch.apiCallCount || 0}</span>
                                  </div>
                                  {batch.contactFilterMobile && (
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Contact Filter:</span>{' '}
                                      <span className="font-medium font-mono">{batch.contactFilterMobile}</span>
                                    </div>
                                  )}
                                  {batch.dateRangeFrom && batch.dateRangeTo && (
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Date Range:</span>{' '}
                                      <span className="font-medium text-xs">
                                        {new Date(batch.dateRangeFrom).toLocaleDateString()} - {new Date(batch.dateRangeTo).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold text-sm mb-2">Sync ID</h4>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {batch.syncId}
                                </code>
                              </div>

                              {batch.errorMessage && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-sm text-red-600">Error</h4>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => showErrorDetails(batch)}
                                      className="h-7"
                                    >
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      View Details
                                    </Button>
                                  </div>
                                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                    {batch.errorMessage}
                                  </p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Error Details Dialog */}
      {selectedBatch && (
        <ErrorDetailsDialog
          open={errorDialogOpen}
          onOpenChange={setErrorDialogOpen}
          errorMessage={selectedBatch.errorMessage || 'Unknown error'}
          errorDetails={selectedBatch.metadata?.error}
        />
      )}
    </Card>
  )
}
