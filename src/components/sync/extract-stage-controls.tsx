"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Download, Users, MessageSquare, RefreshCw, X, Search, ChevronDown, ChevronRight, Database } from "lucide-react"
import { useExtract, type ExtractBatch, type ExtractOptions } from "@/hooks/use-extract"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { useSyncConfig } from "@/hooks/use-sync-config"

interface ExtractStageControlsProps {
  selectedTimeRange?: '1d' | '7d' | '30d' | '90d' | 'custom' | 'full'
  onTimeRangeChange?: (range: '1d' | '7d' | '30d' | '90d' | 'full') => void
  customDateRange?: { startDate?: string; endDate?: string }
  onExtractComplete?: (syncId: string) => void
  onExtract?: (
    entityType: 'contacts' | 'chats' | 'all',
    options?: ExtractOptions
  ) => Promise<any>
  extracting?: boolean
  batches?: ExtractBatch[]
  loadingBatches?: boolean
  onRefreshBatches?: (entityType?: 'contacts' | 'chats') => Promise<any> | any
  onCancel?: () => void
}

export function ExtractStageControls({
  selectedTimeRange,
  onTimeRangeChange,
  customDateRange,
  onExtractComplete,
  onExtract,
  extracting,
  batches,
  loadingBatches,
  onRefreshBatches,
  onCancel,
}: ExtractStageControlsProps) {
  const {
    extracting: hookExtracting,
    batches: hookBatches,
    loadingBatches: hookLoadingBatches,
    triggerExtract: hookTriggerExtract,
    fetchBatches: hookFetchBatches,
    cancelExtract: hookCancelExtract,
  } = useExtract()
  const { config: syncConfig } = useSyncConfig()
  const { toast } = useToast()
  const [lastExtractSyncId, setLastExtractSyncId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [contactMobile, setContactMobile] = useState('')
  const [searchingContact, setSearchingContact] = useState(false)
  const [selectedContact, setSelectedContact] = useState<any | null>(null)
  const [selectedEntityType, setSelectedEntityType] = useState<'contacts' | 'chats' | 'all'>('all')

  const effectiveTimeRange = selectedTimeRange ?? 'full'
  const triggerExtract = onExtract ?? hookTriggerExtract
  const fetchBatches = onRefreshBatches ?? hookFetchBatches
  const cancelExtract = onCancel ?? hookCancelExtract
  const extractingState = extracting ?? hookExtracting
  const batchesState = batches ?? hookBatches
  const loadingBatchesState = loadingBatches ?? hookLoadingBatches

  // Fetch batches on mount
  useEffect(() => {
    fetchBatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchContact = async () => {
    if (!contactMobile.trim()) {
      toast({
        title: 'Mobile number required',
        description: 'Please enter a mobile number to search',
        variant: 'destructive',
      })
      return
    }

    try {
      setSearchingContact(true)
      const response = await fetch(`/api/contacts/search?mobile=${encodeURIComponent(contactMobile)}`)

      if (!response.ok) {
        throw new Error('Failed to search contact')
      }

      const data = await response.json()

      if (data.contacts && data.contacts.length > 0) {
        setSelectedContact(data.contacts[0])
        toast({
          title: 'Contact Found',
          description: `Found: ${data.contacts[0].fullName || 'Unknown'} (${data.contacts[0].mobile})`,
        })
      } else {
        setSelectedContact(null)
        toast({
          title: 'No Contact Found',
          description: 'No contact found with that mobile number. Extract will search for new contacts.',
        })
      }
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Failed to search contact',
        variant: 'destructive',
      })
    } finally {
      setSearchingContact(false)
    }
  }

  const handleClearContact = () => {
    setContactMobile('')
    setSelectedContact(null)
  }

  const handleExtract = async () => {
    try {
      // Build contact filter if contact is selected
      const contactFilter = selectedContact ? {
        mobile: selectedContact.mobile,
        b2chatId: selectedContact.b2chatId,
      } : undefined

      const result = await triggerExtract(selectedEntityType, {
        batchSize: syncConfig.batchSize,
        fullSync: effectiveTimeRange === 'full',
        timeRangePreset: effectiveTimeRange,
        dateRange: effectiveTimeRange === 'custom' ? customDateRange : undefined,
        contactFilter,
      })

      // Get syncId from result
      let syncId: string | null = null
      if (selectedEntityType === 'all') {
        syncId = result.result.contacts?.syncId || result.result.chats?.syncId
      } else {
        syncId = result.result[selectedEntityType]?.syncId
      }

      if (syncId) {
        setLastExtractSyncId(syncId)
        onExtractComplete?.(syncId)
      }
    } catch (error) {
      // Error already handled in useExtract hook
    }
  }

  const getStatusBadge = () => {
    if (extractingState) {
      return <Badge variant="default" className="bg-blue-600">Running</Badge>
    }
    if (lastExtractSyncId) {
      return <Badge variant="default" className="bg-green-600">Completed</Badge>
    }
    return <Badge variant="secondary">Idle</Badge>
  }

  // Get the latest batch for each entity type
  const latestContactsBatch = batchesState.find(b => b.entityType === 'contacts')
  const latestChatsBatch = batchesState.find(b => b.entityType === 'chats')

  // Determine if the latest operation was "Extract All" by checking if there are
  // contacts and chats extracts within a short time window (5 minutes)
  const isExtractAllOperation = latestContactsBatch && latestChatsBatch &&
    Math.abs(
      new Date(latestContactsBatch.startedAt).getTime() -
      new Date(latestChatsBatch.startedAt).getTime()
    ) < 5 * 60 * 1000

  const latestBatch = batchesState[0]

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-blue-600" />
            <CardTitle>Stage 1: Extract Raw Data</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Fetch data from B2Chat API and store in staging tables
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Range Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Time Range:</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={effectiveTimeRange === '1d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange?.('1d')}
              disabled={extractingState}
            >
              1 Day
            </Button>
            <Button
              variant={effectiveTimeRange === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange?.('7d')}
              disabled={extractingState}
            >
              7 Days
            </Button>
            <Button
              variant={effectiveTimeRange === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange?.('30d')}
              disabled={extractingState}
            >
              30 Days
            </Button>
            <Button
              variant={effectiveTimeRange === '90d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange?.('90d')}
              disabled={extractingState}
            >
              90 Days
            </Button>
            <Button
              variant={effectiveTimeRange === 'full' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange?.('full')}
              disabled={extractingState}
            >
              Full Sync
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {effectiveTimeRange === 'full'
              ? 'Will extract all available data from B2Chat'
              : `Will extract data from the last ${effectiveTimeRange === '1d' ? '24 hours' : effectiveTimeRange.replace('d', ' days')}`
            }
          </p>
        </div>

        {/* Advanced: Single Contact Sync */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-0 h-auto font-medium hover:bg-transparent"
          >
            {showAdvanced ? (
              <ChevronDown className="mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4" />
            )}
            Advanced: Sync Specific Contact
          </Button>

          {showAdvanced && (
            <div className="p-4 border rounded-lg space-y-3 bg-gray-50">
              <div>
                <label className="text-sm font-medium mb-2 block">Find Contact</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter mobile number (e.g., +1234567890)"
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value)}
                    disabled={extractingState || searchingContact}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchContact()
                      }
                    }}
                  />
                  <Button
                    onClick={handleSearchContact}
                    disabled={extractingState || searchingContact || !contactMobile.trim()}
                    size="icon"
                    variant="outline"
                  >
                    <Search className={`h-4 w-4 ${searchingContact ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {selectedContact && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-900">
                        ✓ Contact Found
                      </p>
                      <p className="text-sm text-green-700">
                        {selectedContact.fullName || 'Unknown Name'}
                      </p>
                      <p className="text-xs text-green-600">
                        Mobile: {selectedContact.mobile}
                      </p>
                      {selectedContact.lastSyncAt && (
                        <p className="text-xs text-green-600">
                          Last synced: {new Date(selectedContact.lastSyncAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearContact}
                      disabled={extractingState}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                ℹ️ When a contact is selected, only their chats and messages will be processed during transform.
              </p>
            </div>
          )}
        </div>

        {/* Entity Type Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Entity Type:</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedEntityType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEntityType('all')}
              disabled={extractingState}
              className={selectedEntityType === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <Database className="mr-2 h-4 w-4" />
              All (Contacts + Chats)
            </Button>
            <Button
              variant={selectedEntityType === 'contacts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEntityType('contacts')}
              disabled={extractingState}
              className={selectedEntityType === 'contacts' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <Users className="mr-2 h-4 w-4" />
              Contacts Only
            </Button>
            <Button
              variant={selectedEntityType === 'chats' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEntityType('chats')}
              disabled={extractingState}
              className={selectedEntityType === 'chats' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Chats Only
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedEntityType === 'all'
              ? 'Will extract both contacts and chats'
              : selectedEntityType === 'contacts'
              ? 'Will extract only contact information'
              : 'Will extract only chat and message data'
            }
          </p>
        </div>

        {/* Extract Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleExtract}
            disabled={extractingState}
            className="bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <Download className={`mr-2 h-4 w-4 ${extractingState ? 'animate-spin' : ''}`} />
            Start Extract
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchBatches()}
            disabled={loadingBatchesState}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingBatchesState ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
          {extractingState && (
            <Button
              variant="destructive"
              onClick={cancelExtract}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>

        {/* Active Configuration Summary */}
        {!extractingState && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
            <p className="font-medium text-blue-900 mb-1">Current Configuration:</p>
            <ul className="list-disc list-inside text-blue-700 space-y-1">
              <li>
                Entity Type: {selectedEntityType === 'all' ? 'All (Contacts + Chats)' : selectedEntityType === 'contacts' ? 'Contacts Only' : 'Chats Only'}
              </li>
              <li>
                Time Range: {effectiveTimeRange === 'full' ? 'Full Sync (All Data)' : effectiveTimeRange === '1d' ? 'Last 24 hours' : `Last ${effectiveTimeRange.replace('d', ' days')}`}
              </li>
              {selectedContact && (
                <li>
                  Contact Filter: {selectedContact.fullName || 'Unknown'} ({selectedContact.mobile})
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Progress Display */}
        {extractingState && (
          <div className="space-y-2 p-4 bg-blue-50 rounded-md">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Extracting data...</span>
              <span className="text-muted-foreground">Please wait</span>
            </div>
            <Progress value={50} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Fetching records from B2Chat API...
            </p>
          </div>
        )}

        {/* Latest Extract Info */}
        {!extractingState && latestBatch && (
          <div className="space-y-3">
            {/* Show both contacts and chats if Extract All was used */}
            {isExtractAllOperation && latestContactsBatch && latestChatsBatch ? (
              <>
                <div className="text-sm font-medium mb-2">Latest Extract (All Entities)</div>

                {/* Contacts Extract Summary */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Contacts</span>
                    </div>
                    <Badge variant={latestContactsBatch.status === 'completed' ? 'default' : 'secondary'}>
                      {latestContactsBatch.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Records:</span>{' '}
                      <span className="font-medium">{latestContactsBatch.recordsFetched?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pages:</span>{' '}
                      <span className="font-medium">{latestContactsBatch.totalPages || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">API Calls:</span>{' '}
                      <span className="font-medium">{latestContactsBatch.apiCallCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{' '}
                      <span className="font-medium">
                        {latestContactsBatch.completedAt && latestContactsBatch.startedAt
                          ? `${Math.round((new Date(latestContactsBatch.completedAt).getTime() - new Date(latestContactsBatch.startedAt).getTime()) / 1000)}s`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Completed: {new Date(latestContactsBatch.completedAt || latestContactsBatch.startedAt).toLocaleString()}
                  </div>
                </div>

                {/* Chats Extract Summary */}
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-md space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Chats</span>
                    </div>
                    <Badge variant={latestChatsBatch.status === 'completed' ? 'default' : 'secondary'}>
                      {latestChatsBatch.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Records:</span>{' '}
                      <span className="font-medium">{latestChatsBatch.recordsFetched?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pages:</span>{' '}
                      <span className="font-medium">{latestChatsBatch.totalPages || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">API Calls:</span>{' '}
                      <span className="font-medium">{latestChatsBatch.apiCallCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{' '}
                      <span className="font-medium">
                        {latestChatsBatch.completedAt && latestChatsBatch.startedAt
                          ? `${Math.round((new Date(latestChatsBatch.completedAt).getTime() - new Date(latestChatsBatch.startedAt).getTime()) / 1000)}s`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Completed: {new Date(latestChatsBatch.completedAt || latestChatsBatch.startedAt).toLocaleString()}
                  </div>
                </div>

                {/* Shared Configuration */}
                <div className="p-3 bg-gray-50 border rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Configuration:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Time Range:</span>{' '}
                      <span className="font-medium">
                        {latestBatch.timeRangePreset === 'full' ? 'Full Sync' :
                         latestBatch.timeRangePreset === '1d' ? 'Last 24 hours' :
                         latestBatch.timeRangePreset ? `Last ${latestBatch.timeRangePreset.replace('d', ' days')}` :
                         'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Batch Size:</span>{' '}
                      <span className="font-medium">{latestBatch.batchSize || syncConfig.batchSize}</span>
                    </div>
                    {latestBatch.contactFilterMobile && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Contact Filter:</span>{' '}
                        <span className="font-medium">{latestBatch.contactFilterMobile}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Single Entity Extract Summary */
              <div className="space-y-3 p-4 bg-gray-50 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Latest Extract</span>
                  <Badge variant={latestBatch.status === 'completed' ? 'default' : 'secondary'}>
                    {latestBatch.status}
                  </Badge>
                </div>

                {/* Extract Parameters */}
                <div className="border-t pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Configuration:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Entity:</span>{' '}
                      <span className="font-medium">{latestBatch.entityType}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time Range:</span>{' '}
                      <span className="font-medium">
                        {latestBatch.timeRangePreset === 'full' ? 'Full Sync' :
                         latestBatch.timeRangePreset === '1d' ? 'Last 24 hours' :
                         latestBatch.timeRangePreset ? `Last ${latestBatch.timeRangePreset.replace('d', ' days')}` :
                         'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Batch Size:</span>{' '}
                      <span className="font-medium">{latestBatch.batchSize || syncConfig.batchSize}</span>
                    </div>
                    {latestBatch.contactFilterMobile && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Contact Filter:</span>{' '}
                        <span className="font-medium">{latestBatch.contactFilterMobile}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extract Results */}
                <div className="border-t pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Results:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Records:</span>{' '}
                      <span className="font-medium">{latestBatch.recordsFetched?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pages:</span>{' '}
                      <span className="font-medium">{latestBatch.totalPages || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">API Calls:</span>{' '}
                      <span className="font-medium">{latestBatch.apiCallCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{' '}
                      <span className="font-medium">
                        {latestBatch.completedAt && latestBatch.startedAt
                          ? `${Math.round((new Date(latestBatch.completedAt).getTime() - new Date(latestBatch.startedAt).getTime()) / 1000)}s`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground border-t pt-2">
                  Completed: {new Date(latestBatch.completedAt || latestBatch.startedAt).toLocaleString()}
                </div>
                {latestBatch.syncId && (
                  <div className="text-xs font-mono text-muted-foreground">
                    Sync ID: {latestBatch.syncId}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No extracts yet */}
        {!extractingState && !latestBatch && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No extract operations yet. Click a button above to start.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
