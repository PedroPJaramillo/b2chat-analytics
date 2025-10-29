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
import { ChevronDown, ChevronRight, RefreshCw, Settings, AlertCircle } from "lucide-react"
import { type TransformResult } from "@/hooks/use-transform"
import { ErrorDetailsDialog } from "./error-details-dialog"

interface TransformHistoryTableProps {
  transforms: TransformResult[]
  loading?: boolean
  onRefresh?: () => void
}

export function TransformHistoryTable({ transforms, loading, onRefresh }: TransformHistoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [selectedTransform, setSelectedTransform] = useState<TransformResult | null>(null)

  const toggleRow = (transformId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(transformId)) {
      newExpanded.delete(transformId)
    } else {
      newExpanded.add(transformId)
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
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>
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

  const showErrorDetails = (transform: TransformResult) => {
    setSelectedTransform(transform)
    setErrorDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-green-600" />
            <CardTitle>Transform History</CardTitle>
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
          Recent transform operations with detailed results
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transforms.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No transform operations yet
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transforms.map((transform) => {
                  const isExpanded = expandedRows.has(transform.syncId)
                  return (
                    <React.Fragment key={transform.syncId}>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={() => toggleRow(transform.syncId)}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {new Date(transform.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium capitalize">{transform.entityType}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {transform.recordsCreated?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right font-medium text-blue-600">
                          {transform.recordsUpdated?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-600">
                          {transform.recordsSkipped?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {transform.recordsFailed?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell>{getStatusBadge(transform.status)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-4">
                            <div className="space-y-4">
                              {/* Summary Stats */}
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Summary</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Total Processed:</span>{' '}
                                    <span className="font-medium">{transform.recordsProcessed?.toLocaleString() || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Duration:</span>{' '}
                                    <span className="font-medium">
                                      {formatDuration(transform.startedAt, transform.completedAt)}
                                    </span>
                                  </div>
                                  {transform.validationWarnings > 0 && (
                                    <div className="col-span-2">
                                      <span className="text-amber-600">⚠ Validation Warnings:</span>{' '}
                                      <span className="font-medium text-amber-600">{transform.validationWarnings}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Changes Summary - Detailed Breakdown */}
                              {transform.changesSummary && Object.keys(transform.changesSummary).length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">Transformation Details</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(transform.changesSummary).map(([key, value]: [string, any]) => {
                                      // Recursive function to render nested objects
                                      const renderValue = (val: any, depth: number = 0): React.ReactNode => {
                                        if (val === null || val === undefined) {
                                          return <span className="text-gray-400">N/A</span>
                                        }

                                        if (typeof val === 'object' && !Array.isArray(val)) {
                                          return (
                                            <div className={depth > 0 ? "mt-1 pl-3 space-y-1" : "mt-1 pl-2 space-y-1 border-l-2 border-gray-200"}>
                                              {Object.entries(val).map(([k, v]) => (
                                                <div key={k} className="flex justify-between items-start">
                                                  <span className="text-muted-foreground capitalize">
                                                    {k.replace(/([A-Z])/g, ' $1').trim()}:
                                                  </span>
                                                  <span className="font-medium text-right ml-2">
                                                    {typeof v === 'object' && v !== null ? renderValue(v, depth + 1) : String(v)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )
                                        }

                                        if (Array.isArray(val)) {
                                          return <span>{val.join(', ')}</span>
                                        }

                                        return <span>{String(val)}</span>
                                      }

                                      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                        return (
                                          <div key={key} className="bg-white p-3 rounded border text-xs">
                                            <div className="font-medium capitalize mb-1 text-gray-700">
                                              {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </div>
                                            {renderValue(value)}
                                          </div>
                                        )
                                      }

                                      return (
                                        <div key={key} className="bg-white p-2 rounded border text-xs flex justify-between">
                                          <span className="text-muted-foreground capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                                          </span>
                                          <span className="font-medium">{renderValue(value)}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Source Extract Info */}
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Source Extract</h4>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {transform.extractSyncId}
                                </code>
                              </div>

                              {/* Transform Sync ID */}
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Transform ID</h4>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {transform.syncId}
                                </code>
                              </div>

                              {/* Error Message */}
                              {transform.errorMessage && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-sm text-red-600">Error</h4>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => showErrorDetails(transform)}
                                      className="h-7"
                                    >
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      View Details
                                    </Button>
                                  </div>
                                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                    {transform.errorMessage}
                                  </p>
                                </div>
                              )}

                              {/* Completion Timestamp */}
                              {transform.completedAt && (
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                  Completed: {new Date(transform.completedAt).toLocaleString()}
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
      {selectedTransform && (
        <ErrorDetailsDialog
          open={errorDialogOpen}
          onOpenChange={setErrorDialogOpen}
          errorMessage={selectedTransform.errorMessage || 'Unknown error'}
          errorDetails={undefined}
        />
      )}
    </Card>
  )
}
