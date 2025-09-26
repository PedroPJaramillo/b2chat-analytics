"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  MessageSquare,
  Settings
} from "lucide-react"
import { useSync } from "@/hooks/use-sync"
import { useSyncConfig } from "@/hooks/use-sync-config"
import { useSyncStats } from "@/hooks/use-sync-stats"
import { SyncConfigModal } from "@/components/sync/sync-config-modal"
import { SyncLogsModal } from "@/components/sync/sync-logs-modal"

const moduleIcons = {
  "Contacts": Users,
  "Chats": MessageSquare
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case "running":
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-600" />
    default:
      return <Clock className="h-4 w-4 text-gray-400" />
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
    case "running":
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Running</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="outline">Pending</Badge>
  }
}

export default function SyncPage() {
  const { syncStatus, modules, loading, error, syncing, triggerSync } = useSync()
  const { config } = useSyncConfig()
  const { stats, loading: statsLoading } = useSyncStats()
  const { toast } = useToast()
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [logsModalOpen, setLogsModalOpen] = useState(false)

  const handleSyncNow = async () => {
    try {
      await triggerSync('all', config.fullSync)
      toast({
        title: "Sync Started",
        description: `Data synchronization has been initiated successfully${config.fullSync ? ' (Full Sync)' : ''}.`,
      })
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to start synchronization",
        variant: "destructive",
      })
    }
  }

  const handleModuleSync = async (entityType: 'contacts' | 'chats') => {
    try {
      await triggerSync(entityType, config.fullSync)
      toast({
        title: "Module Sync Started",
        description: `${entityType} synchronization has been initiated successfully${config.fullSync ? ' (Full Sync)' : ''}.`,
      })
    } catch (error) {
      toast({
        title: "Module Sync Failed",
        description: error instanceof Error ? error.message : `Failed to sync ${entityType}`,
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  const formatNextSync = (dateString: string) => {
    try {
      const nextSync = new Date(dateString)
      const now = new Date()
      const diff = Math.max(0, Math.floor((nextSync.getTime() - now.getTime()) / 1000 / 60))
      return `${diff}m`
    } catch {
      return "15m"
    }
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Data Sync</h2>
          <Badge variant="secondary">Admin Only</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Data Sync</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">Admin Only</Badge>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* B2Chat vs Synced Records */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">B2Chat Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? 'Loading...' : stats?.b2chat.total.toLocaleString() || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Total in B2Chat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Synced Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? 'Loading...' : stats?.synced.total.toLocaleString() || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Total synced locally</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Progress</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? 'Loading...' : `${stats?.syncPercentage.overall || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">Overall completion</p>
            {!statsLoading && stats && (
              <div className="mt-2">
                <Progress value={stats.syncPercentage.overall} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sync Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.status === 'completed' ? 'Success' :
               syncStatus?.status === 'running' ? 'Running' :
               syncStatus?.status === 'failed' ? 'Failed' : 'Pending'}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncStatus?.lastSync ? formatDate(syncStatus.lastSync) : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.totalRecords?.toLocaleString() || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Synchronized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.nextSync ? formatNextSync(syncStatus.nextSync) : '15m'}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncStatus?.nextSync ? formatDate(syncStatus.nextSync) : 'Scheduled'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(syncStatus?.status || 'pending')}
              <span className="text-2xl font-bold">
                {syncing ? 'Syncing' : 'Active'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-sync enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Controls</CardTitle>
          <CardDescription>
            Manage data synchronization with B2Chat API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleSyncNow}
              disabled={syncing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfigModalOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </Button>
            <Button
              variant="outline"
              onClick={() => setLogsModalOpen(true)}
            >
              <Database className="mr-2 h-4 w-4" />
              View Logs
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Progress</span>
              <span className="text-sm text-muted-foreground">
                {syncStatus?.progress || 0}%
              </span>
            </div>
            <Progress value={syncStatus?.progress || 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Sync Modules Status */}
      <Card>
        <CardHeader>
          <CardTitle>Module Status</CardTitle>
          <CardDescription>
            Individual sync status for each data module
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {modules.map((module, index) => {
              const IconComponent = moduleIcons[module.name as keyof typeof moduleIcons] || Database
              return (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{module.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {module.records.toLocaleString()} records • Duration: {module.duration}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Last sync</div>
                      <div className="text-sm font-medium">
                        {formatDate(module.lastSync)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(module.status)}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModuleSync(module.name.toLowerCase() as 'contacts' | 'chats')}
                        disabled={syncing}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sync Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Sync settings and schedule configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sync Interval</label>
              <div className="text-2xl font-bold">{config.interval} minutes</div>
              <p className="text-xs text-muted-foreground">
                Automatic synchronization frequency
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Batch Size</label>
              <div className="text-2xl font-bold">{config.batchSize} records</div>
              <p className="text-xs text-muted-foreground">
                Records processed per batch
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">API Connection</label>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Connected to B2Chat API</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last connection test: {syncStatus?.lastSync ? formatDate(syncStatus.lastSync) : 'Never'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Modal */}
      <SyncConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
      />

      {/* Logs Modal */}
      <SyncLogsModal
        open={logsModalOpen}
        onOpenChange={setLogsModalOpen}
      />
    </div>
  )
}