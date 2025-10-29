"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Settings, Users, MessageSquare, CheckCircle, AlertCircle, RefreshCw, X, Info, ChevronDown, ChevronRight, Database } from "lucide-react"
import { useTransform, type TransformOptions, type TransformResult } from "@/hooks/use-transform"
import { usePendingCounts } from "@/hooks/use-pending-counts"
import { useSyncConfig } from "@/hooks/use-sync-config"

interface TransformStageControlsProps {
  onTransform?: (
    entityType: 'contacts' | 'chats' | 'all',
    extractSyncId?: string,
    options?: TransformOptions
  ) => Promise<any>
  transforming?: boolean
  results?: TransformResult[]
  onCancel?: () => void
}

export function TransformStageControls({
  onTransform,
  transforming,
  results,
  onCancel,
}: TransformStageControlsProps) {
  const {
    transforming: hookTransforming,
    results: hookResults,
    triggerTransform: hookTriggerTransform,
    cancelTransform: hookCancelTransform,
  } = useTransform()
  const { counts, loading: loadingCounts, fetchCounts } = usePendingCounts()
  const { config: syncConfig } = useSyncConfig()
  const [showInfo, setShowInfo] = useState(false)

  const transformResults = results ?? hookResults
  const transformingState = transforming ?? hookTransforming
  const triggerTransformFn = onTransform ?? hookTriggerTransform
  const cancelTransform = onCancel ?? hookCancelTransform

  // Fetch pending counts on mount and after transforms
  useEffect(() => {
    fetchCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh counts after transformation completes
  useEffect(() => {
    if (!transformingState && transformResults.length > 0) {
      const latestResult = transformResults[0]
      if (latestResult?.status === 'completed' || latestResult?.status === 'failed') {
        fetchCounts()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformingState, transformResults])

  const handleTransform = async (entityType: 'contacts' | 'chats' | 'all') => {
    try {
      // Call with new signature: entityType first, no extractSyncId (batch-agnostic mode)
      await triggerTransformFn(entityType, undefined, {
        batchSize: syncConfig.batchSize,
      })
      // Refresh counts after transform
      await fetchCounts()
    } catch (error) {
      // Error already handled in useTransform hook
    }
  }

  const getStatusBadge = () => {
    if (transformingState) {
      return <Badge variant="default" className="bg-green-600">Running</Badge>
    }
    const latestResult = transformResults[0]
    if (latestResult?.status === 'completed') {
      return <Badge variant="default" className="bg-green-600">Completed</Badge>
    }
    if (latestResult?.status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>
    }
    return <Badge variant="secondary">Idle</Badge>
  }

  // Get latest transform result
  const latestResult = transformResults[0]

  // Check if there's pending data
  const hasPendingData = counts.total > 0

  return (
    <Card className="border-green-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-green-600" />
            <CardTitle>Stage 2: Transform & Validate</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Process raw data into model tables with validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Data Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Pending Transformations</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCounts}
              disabled={loadingCounts}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${loadingCounts ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Contacts */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-900">Contacts</span>
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {loadingCounts ? '...' : counts.contacts.toLocaleString()}
              </div>
              <div className="text-xs text-purple-600 mt-0.5">pending</div>
            </div>

            {/* Chats */}
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <MessageSquare className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-medium text-orange-900">Chats</span>
              </div>
              <div className="text-2xl font-bold text-orange-700">
                {loadingCounts ? '...' : counts.chats.toLocaleString()}
              </div>
              <div className="text-xs text-orange-600 mt-0.5">pending</div>
            </div>

            {/* Total */}
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <Database className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-900">Total</span>
              </div>
              <div className="text-2xl font-bold text-green-700">
                {loadingCounts ? '...' : counts.total.toLocaleString()}
              </div>
              <div className="text-xs text-green-600 mt-0.5">records</div>
            </div>
          </div>
          {hasPendingData && (
            <p className="text-xs text-orange-600 flex items-center mt-2">
              <AlertCircle className="h-3 w-3 mr-1" />
              Ready to process {counts.total.toLocaleString()} pending records from completed extracts
            </p>
          )}
          {!hasPendingData && !loadingCounts && (
            <p className="text-xs text-gray-500 flex items-center mt-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              No pending data to transform. Run an extract first.
            </p>
          )}
        </div>

        {/* How Transformations Work - Info Section */}
        <Collapsible open={showInfo} onOpenChange={setShowInfo}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start p-0 h-auto font-medium hover:bg-transparent text-blue-600"
            >
              {showInfo ? (
                <ChevronDown className="mr-2 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              <Info className="mr-2 h-4 w-4" />
              How Transformations Work
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-4 border rounded-lg bg-blue-50 space-y-4">
            {/* Overview */}
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center">
                <Database className="h-4 w-4 mr-2 text-blue-600" />
                Overview
              </h4>
              <p className="text-xs text-gray-700 leading-relaxed">
                Transformations convert raw API data from the staging tables (RawContact, RawChat) into your structured model tables (Contacts, Chats, Messages, etc.).
                This process includes smart change detection, so only modified data is updated, making it efficient and preserving existing records.
              </p>
            </div>

            {/* Contacts Transformation */}
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2 text-purple-600" />
                Contacts Transformation
              </h4>
              <div className="text-xs text-gray-700 space-y-2">
                <p className="leading-relaxed">
                  <strong>Process:</strong> For each raw contact, the system checks if it exists in your Contacts table (by B2Chat ID).
                  If it exists, change detection compares the data. If changes are found, the contact is updated. If no changes, it's skipped (marked as "unchanged").
                  New contacts are created automatically.
                </p>
                <div className="bg-white p-2 rounded">
                  <p className="font-medium mb-1">Fields Monitored for Changes:</p>
                  <p className="text-gray-600">
                    Full Name, Mobile, Phone Number, Email, Identification, Address, City, Country, Company, Merchant ID, Tags, Custom Attributes
                  </p>
                </div>
              </div>
            </div>

            {/* Chats Transformation */}
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2 flex items-center">
                <MessageSquare className="h-4 w-4 mr-2 text-orange-600" />
                Chats Transformation (Complex Process)
              </h4>
              <div className="text-xs text-gray-700 space-y-2">
                <p className="leading-relaxed">
                  <strong>Multi-Step Process:</strong> Chat transformation is more complex and includes several operations:
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li><strong>Extract Nested Entities:</strong> Agents, Departments, and Contacts are extracted from chat data and created/updated in their respective tables</li>
                  <li><strong>Create or Update Chat:</strong> Main chat record is created or updated based on change detection</li>
                  <li><strong>Track Status Changes:</strong> If chat status changed (e.g., OPENED → CLOSED), a ChatStatusHistory entry is created</li>
                  <li><strong>Process Messages:</strong> Only new messages are inserted (duplicates are detected by timestamp)</li>
                  <li><strong>Calculate SLA Metrics:</strong> Response times, pickup times, and resolution times are calculated for both wall-clock and business hours</li>
                  <li><strong>Survey Data:</strong> Tracks poll responses, completions, and abandonments</li>
                </ol>
              </div>
            </div>

            {/* Change Detection Logic */}
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2 flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Smart Change Detection
              </h4>
              <div className="text-xs text-gray-700 space-y-2">
                <p className="leading-relaxed">
                  <strong>Efficiency:</strong> The system only updates records when data has actually changed. This prevents unnecessary database writes and preserves timestamps.
                </p>
                <div className="bg-white p-2 rounded space-y-1">
                  <p><strong className="text-green-600">Created:</strong> Brand new records added to the database</p>
                  <p><strong className="text-blue-600">Updated:</strong> Existing records where at least one field changed</p>
                  <p><strong className="text-gray-600">Skipped:</strong> Existing records with identical data (already up-to-date)</p>
                  <p><strong className="text-red-600">Failed:</strong> Records that encountered errors during processing</p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Transform Action Buttons */}
        <div className="space-y-3">
          {/* Transform All */}
          <div>
            <Button
              onClick={() => handleTransform('all')}
              disabled={transformingState || !hasPendingData}
              className="bg-green-600 hover:bg-green-700"
            >
              <Settings className={`mr-2 h-4 w-4 ${transformingState ? 'animate-spin' : ''}`} />
              Transform All {hasPendingData && `(${counts.total.toLocaleString()} pending)`}
            </Button>
            <p className="text-xs text-muted-foreground mt-1 ml-1">
              Processes both contacts and chats. Recommended for complete synchronization.
            </p>
          </div>

          {/* Individual Transform Buttons */}
          <div className="flex flex-wrap gap-4">
            <div>
              <Button
                variant="outline"
                onClick={() => handleTransform('contacts')}
                disabled={transformingState || counts.contacts === 0}
              >
                <Users className="mr-2 h-4 w-4" />
                Transform Contacts {counts.contacts > 0 && `(${counts.contacts.toLocaleString()} pending)`}
              </Button>
              <p className="text-xs text-muted-foreground mt-1 ml-1 max-w-xs">
                Creates new contacts and updates existing ones if their data has changed.
              </p>
            </div>

            <div>
              <Button
                variant="outline"
                onClick={() => handleTransform('chats')}
                disabled={transformingState || counts.chats === 0}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Transform Chats {counts.chats > 0 && `(${counts.chats.toLocaleString()} pending)`}
              </Button>
              <p className="text-xs text-muted-foreground mt-1 ml-1 max-w-xs">
                Processes chats with nested entities (agents, departments), messages, and calculates SLA metrics.
              </p>
            </div>

            {transformingState && (
              <div>
                <Button
                  variant="destructive"
                  onClick={cancelTransform}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Progress Display */}
        {transformingState && (
          <div className="space-y-2 p-4 bg-green-50 rounded-md">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Processing data...</span>
              <span className="text-muted-foreground">Please wait</span>
            </div>
            <Progress value={50} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Transforming raw data into model tables...
            </p>
          </div>
        )}

        {/* Transform Results */}
        {!transformingState && latestResult && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-md border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Latest Transform - {latestResult.entityType}</span>
              <Badge variant={latestResult.status === 'completed' ? 'default' : 'destructive'}>
                {latestResult.status}
              </Badge>
            </div>

            {/* Statistics Grid */}
            <TooltipProvider>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Created */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2 cursor-help">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          Created
                          <Info className="h-3 w-3 ml-1 opacity-50" />
                        </div>
                        <div className="font-bold text-green-600">{latestResult.recordsCreated}</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Brand new records added to the database</p>
                  </TooltipContent>
                </Tooltip>

                {/* Updated */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2 cursor-help">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          Updated
                          <Info className="h-3 w-3 ml-1 opacity-50" />
                        </div>
                        <div className="font-bold text-blue-600">{latestResult.recordsUpdated}</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Existing records that had data changes detected</p>
                  </TooltipContent>
                </Tooltip>

                {/* Skipped */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2 cursor-help">
                      <CheckCircle className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          Skipped
                          <Info className="h-3 w-3 ml-1 opacity-50" />
                        </div>
                        <div className="font-bold text-gray-600">{latestResult.recordsSkipped}</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Existing records with no changes (already up-to-date)</p>
                  </TooltipContent>
                </Tooltip>

                {/* Failed */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2 cursor-help">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          Failed
                          <Info className="h-3 w-3 ml-1 opacity-50" />
                        </div>
                        <div className="font-bold text-red-600">{latestResult.recordsFailed}</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Records that encountered errors during processing</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            {/* Changes Summary - Detailed Breakdown */}
            {latestResult.changesSummary && Object.keys(latestResult.changesSummary).length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">Transformation Details:</h4>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(latestResult.changesSummary).map(([key, value]: [string, any]) => {
                    // Recursive function to render nested objects
                    const renderValue = (val: any, depth: number = 0): React.ReactNode => {
                      if (val === null || val === undefined) {
                        return <span className="text-gray-400">N/A</span>
                      }

                      if (typeof val === 'object' && !Array.isArray(val)) {
                        return (
                          <div className={depth > 0 ? "mt-1 pl-3 space-y-1" : "mt-1 pl-3 space-y-1 border-l-2 border-gray-200"}>
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
                          <div className="font-medium capitalize text-gray-700 mb-1">
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

            {/* Validation Warnings */}
            {latestResult.validationWarnings > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center space-x-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {latestResult.validationWarnings} validation warning{latestResult.validationWarnings > 1 ? 's' : ''} detected
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Check the transform logs for details
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="border-t pt-2">
              <div className="text-xs text-muted-foreground">
                Processed {latestResult.recordsProcessed} records
              </div>
              {latestResult.completedAt && (
                <div className="text-xs text-muted-foreground">
                  Completed: {new Date(latestResult.completedAt).toLocaleString()}
                </div>
              )}
            </div>

            {/* Error message if failed */}
            {latestResult.status === 'failed' && latestResult.errorMessage && (
              <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-800">
                {latestResult.errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Ready to Transform message */}
        {!transformingState && !latestResult && hasPendingData && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-900 mb-1">
                  Ready to Transform
                </h4>
                <p className="text-xs text-green-700 mb-3">
                  You have <strong>{counts.total.toLocaleString()}</strong> pending records ready for transformation
                  (<strong>{counts.contacts.toLocaleString()}</strong> contacts, <strong>{counts.chats.toLocaleString()}</strong> chats).
                </p>
                <div className="flex items-center space-x-2 text-xs text-green-600 pt-2 border-t border-green-200">
                  <span className="font-medium">Next step:</span>
                  <span>Click a transform button above to process this data</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
