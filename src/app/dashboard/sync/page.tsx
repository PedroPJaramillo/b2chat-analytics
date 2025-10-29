"use client"

import { useState, useEffect } from 'react'
import { pageContainerClasses } from "@/lib/ui-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Database,
  Users,
  MessageSquare,
} from "lucide-react"
import { useSyncStats } from "@/hooks/use-sync-stats"
import { useExtract } from "@/hooks/use-extract"
import { useTransform } from "@/hooks/use-transform"
import { SyncLogsModal } from "@/components/sync/sync-logs-modal"
import { ExtractStageControls } from "@/components/sync/extract-stage-controls"
import { TransformStageControls } from "@/components/sync/transform-stage-controls"
import { ExtractHistoryTable } from "@/components/sync/extract-history-table"
import { TransformHistoryTable } from "@/components/sync/transform-history-table"

export default function SyncPage() {
  const { stats, loading: statsLoading } = useSyncStats()
  const { extracting, batches, loadingBatches, triggerExtract, fetchBatches, cancelExtract } = useExtract()
  const { transforming, results, triggerTransform, fetchAllTransforms, cancelTransform } = useTransform()

  const [logsModalOpen, setLogsModalOpen] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1d' | '7d' | '30d' | '90d' | 'full'>('full')
  const [allTransforms, setAllTransforms] = useState<any[]>([])
  const [loadingAllTransforms, setLoadingAllTransforms] = useState(false)
  const formatCount = (value: number | null | undefined, fallback = '0') =>
    typeof value === 'number' ? value.toLocaleString() : fallback

  // Fetch all transforms on mount
  const handleRefreshAllTransforms = async () => {
    setLoadingAllTransforms(true)
    try {
      const transforms = await fetchAllTransforms()
      setAllTransforms(transforms)
    } finally {
      setLoadingAllTransforms(false)
    }
  }

  // Load transforms on mount
  useEffect(() => {
    handleRefreshAllTransforms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncedContacts = stats?.synced?.contacts
  const syncedChats = stats?.synced?.chats
  const contactsNeedingSync = stats?.synced?.contactsNeedingSync ?? 0 // Fix 006: Stub contacts
  const b2chatContacts = stats?.b2chat?.contacts
  const b2chatChats = stats?.b2chat?.chats
  const rawContacts = stats?.raw?.contacts
  const rawChats = stats?.raw?.chats
  const contactsSyncPercentage = stats?.syncPercentage?.contacts ?? 0
  const chatsSyncPercentage = stats?.syncPercentage?.chats ?? 0

  if (statsLoading) {
    return (
      <div className={pageContainerClasses}>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Data Synchronization</h2>
          <Badge variant="secondary">Admin Only</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={pageContainerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Data Synchronization</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Two-stage sync: Extract → Transform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setLogsModalOpen(true)}
          >
            <Database className="mr-2 h-4 w-4" />
            View Logs
          </Button>
          <Badge variant="secondary">Admin Only</Badge>
        </div>
      </div>

      {/* Quick Stats - Processed Data */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Processed Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacts</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? 'Loading...' : formatCount(syncedContacts, 'N/A')}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? '' : `${formatCount(b2chatContacts)} in B2Chat (${contactsSyncPercentage}% synced)`}
            </p>
            {rawContacts && rawContacts.total > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCount(rawContacts.total)} in staging ({formatCount(rawContacts.pending)} pending)
              </p>
            )}
            {/* Fix 006: Stub contact indicator */}
            {contactsNeedingSync > 0 && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200">
                  {formatCount(contactsNeedingSync)} need full sync
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processed Chats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? 'Loading...' : formatCount(syncedChats, 'N/A')}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? '' : `${formatCount(b2chatChats)} in B2Chat (${chatsSyncPercentage}% synced)`}
            </p>
            {rawChats && rawChats.total > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCount(rawChats.total)} in staging ({formatCount(rawChats.pending)} pending)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-Stage Sync Controls */}
      <ExtractStageControls
        selectedTimeRange={selectedTimeRange}
        onTimeRangeChange={setSelectedTimeRange}
        onExtract={triggerExtract}
        extracting={extracting}
        batches={batches}
        loadingBatches={loadingBatches}
        onRefreshBatches={fetchBatches}
        onCancel={cancelExtract}
      />

      <Separator />

      <TransformStageControls
        onTransform={triggerTransform}
        transforming={transforming}
        results={results}
        onCancel={cancelTransform}
      />

      <Separator />

      {/* Extract History */}
      <ExtractHistoryTable
        batches={batches}
        loading={loadingBatches}
        onRefresh={fetchBatches}
      />

      <Separator />

      {/* Transform History */}
      <TransformHistoryTable
        transforms={allTransforms}
        loading={loadingAllTransforms}
        onRefresh={handleRefreshAllTransforms}
      />

      {/* Logs Modal */}
      <SyncLogsModal
        open={logsModalOpen}
        onOpenChange={setLogsModalOpen}
      />
    </div>
  )
}
