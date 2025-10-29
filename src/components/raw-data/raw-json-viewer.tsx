// Raw JSON Viewer Component (Feature 007)

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Copy, Download, ExternalLink, AlertCircle } from 'lucide-react'
import { useRawDataRecord } from '@/lib/hooks/use-raw-data'
import { formatProcessingStatus } from '@/lib/hooks/use-raw-data'
import { formatDistanceToNow } from 'date-fns'

interface RawJsonViewerProps {
  recordId: string | null
  entityType?: 'contact' | 'chat'
  open: boolean
  onClose: () => void
}

/**
 * Format JSON with syntax highlighting (simple implementation)
 */
function JsonDisplay({ data }: { data: any }) {
  const jsonString = JSON.stringify(data, null, 2)

  return (
    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[600px] text-xs font-mono">
      {jsonString}
    </pre>
  )
}

/**
 * Copy JSON to clipboard
 */
function copyToClipboard(data: any) {
  const jsonString = JSON.stringify(data, null, 2)
  navigator.clipboard.writeText(jsonString)
}

/**
 * Download JSON as file
 */
function downloadJson(data: any, filename: string) {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function RawJsonViewer({ recordId, entityType, open, onClose }: RawJsonViewerProps) {
  const { data: recordData, isLoading, error } = useRawDataRecord(recordId, entityType)
  const [activeTab, setActiveTab] = useState('raw')

  const record = recordData

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raw Data Record</DialogTitle>
          <DialogDescription>
            View raw JSON from B2Chat API and transformed data
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 py-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 py-6">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Failed to load record</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}

        {/* Data Display */}
        {record && !isLoading && (
          <div className="space-y-4">
            {/* Metadata Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Entity Type:</span>
                  <div className="font-medium">{record.entityType}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">B2Chat ID:</span>
                  <div className="font-mono text-xs">{record.b2chatId}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Sync ID:</span>
                  <div className="font-mono text-xs">{record.syncId}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div>
                    <Badge className={formatProcessingStatus(record.processingStatus).color}>
                      {formatProcessingStatus(record.processingStatus).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Fetched:</span>
                  <div>{formatDistanceToNow(new Date(record.fetchedAt), { addSuffix: true })}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Processed:</span>
                  <div>
                    {record.processedAt
                      ? formatDistanceToNow(new Date(record.processedAt), { addSuffix: true })
                      : 'Not yet'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">API Page:</span>
                  <div>{record.apiPage}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Processing Attempts:</span>
                  <div className={record.processingAttempt > 0 ? 'text-orange-600 font-medium' : ''}>
                    {record.processingAttempt}
                  </div>
                </div>
                {record.processingError && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Error:</span>
                    <div className="text-red-600 text-xs mt-1 p-2 bg-red-50 rounded border border-red-200">
                      {record.processingError}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs for Different Views */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                  {(record as any).transformedRecord && (
                    <TabsTrigger value="transformed">Transformed</TabsTrigger>
                  )}
                  {(record as any).transformedRecord && (
                    <TabsTrigger value="comparison">Comparison</TabsTrigger>
                  )}
                </TabsList>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(record.rawData)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadJson(record.rawData, `raw-${record.b2chatId}.json`)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>

              {/* Raw JSON Tab */}
              <TabsContent value="raw">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Raw Data from B2Chat API</CardTitle>
                    <CardDescription>
                      Unprocessed JSON response as received from B2Chat
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <JsonDisplay data={record.rawData} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Transformed Record Tab */}
              {(record as any).transformedRecord && (
                <TabsContent value="transformed">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Transformed Record</CardTitle>
                      <CardDescription>
                        Normalized data after transformation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <JsonDisplay data={(record as any).transformedRecord} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Comparison Tab */}
              {(record as any).transformedRecord && (
                <TabsContent value="comparison">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs">Raw (B2Chat)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <JsonDisplay data={record.rawData} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs">Transformed (App)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <JsonDisplay data={(record as any).transformedRecord} />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {/* Extract Metadata */}
            {(record as any).extractMetadata && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Extract Operation</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Operation:</span>
                    <div className="font-medium">{(record as any).extractMetadata.operation}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Records Fetched:</span>
                    <div className="font-medium">{(record as any).extractMetadata.recordsFetched}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Started:</span>
                    <div>
                      {formatDistanceToNow(new Date((record as any).extractMetadata.startedAt), {
                        addSuffix: true
                      })}
                    </div>
                  </div>
                  {(record as any).extractMetadata.completedAt && (
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <div>
                        {formatDistanceToNow(new Date((record as any).extractMetadata.completedAt), {
                          addSuffix: true
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
