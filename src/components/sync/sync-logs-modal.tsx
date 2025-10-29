"use client"

import { useState, useMemo, useId, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
} from '@tanstack/react-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle, Clock, RefreshCw, ChevronLeft, ChevronRight, Calendar, Filter, ArrowUpDown, XCircle, Activity, TrendingUp, Database } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface SyncLog {
  id: string
  userId: string
  entityType: string
  operation: string
  recordCount: number
  status: string
  startedAt: string
  completedAt: string | null
  errorMessage: string | null
  metadata: any
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface SyncLogsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'running':
    case 'started':
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-600" />
    default:
      return <Clock className="h-4 w-4 text-gray-400" />
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
    case 'running':
    case 'started':
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Running</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

const formatDuration = (startedAt: string, completedAt: string | null) => {
  const start = new Date(startedAt)
  const end = completedAt ? new Date(completedAt) : new Date()
  const durationMs = end.getTime() - start.getTime()

  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`
  return `${Math.round(durationMs / 60000)}m`
}

async function fetchSyncLogs(params: {
  page: number
  limit: number
  entityType?: string
  status?: string
  operation?: string
  dateFrom?: string
  dateTo?: string
}) {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  })

  const shouldInclude = (value?: string) => value && value !== 'all'

  if (shouldInclude(params.entityType) && params.entityType) searchParams.set('entityType', params.entityType)
  if (shouldInclude(params.status) && params.status) searchParams.set('status', params.status)
  if (shouldInclude(params.operation) && params.operation) searchParams.set('operation', params.operation)
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params.dateTo) searchParams.set('dateTo', params.dateTo)

  const response = await fetch(`/api/sync/logs?${searchParams}`)
  if (!response.ok) {
    throw new Error('Failed to fetch sync logs')
  }
  return response.json()
}

async function cancelSync(syncId: string, reason?: string) {
  const response = await fetch('/api/sync/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syncId, reason })
  })
  if (!response.ok) {
    let errorMessage = 'Failed to cancel sync'
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error || errorBody.message || errorMessage
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage)
  }
  return response.json()
}

const columnHelper = createColumnHelper<SyncLog>()

export function SyncLogsModal({ open, onOpenChange }: SyncLogsModalProps) {
  const descriptionId = useId()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [filters, setFilters] = useState({
    entityType: 'all',
    status: 'all',
    operation: 'all',
    dateFrom: '',
    dateTo: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sync-logs', page, limit, filters],
    queryFn: () => fetchSyncLogs({ page, limit, ...filters }),
    enabled: open,
  })

  const cancelMutation = useMutation({
    mutationFn: ({ syncId, reason }: { syncId: string; reason?: string }) =>
      cancelSync(syncId, reason),
    onSuccess: (result) => {
      toast({
        title: "Sync Cancelled",
        description: result.message,
      })
      refetch()
    },
    onError: (error: Error) => {
      toast({
        title: "Cancel Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleCancelSync = useCallback((syncId: string) => {
    cancelMutation.mutate({ syncId, reason: 'User requested cancellation' })
  }, [cancelMutation])

  const handleCancelAll = useCallback(() => {
    cancelMutation.mutate({ syncId: 'all', reason: 'User requested cancellation of all syncs' })
  }, [cancelMutation])

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(rowId)) {
        newSet.delete(rowId)
      } else {
        newSet.add(rowId)
      }
      return newSet
    })
  }

  const columns = useMemo(() => [
    columnHelper.accessor('status', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(row.getValue('status'))}
          {getStatusBadge(row.getValue('status'))}
        </div>
      ),
    }),
    columnHelper.accessor('entityType', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Entity
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('entityType')}</span>
      ),
    }),
    columnHelper.accessor('operation', {
      header: 'Operation',
      cell: ({ row }) => row.getValue('operation'),
    }),
    columnHelper.accessor('recordCount', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Records
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span>{row.getValue<number>('recordCount').toLocaleString()}</span>
      ),
    }),
    columnHelper.accessor('startedAt', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Duration
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span>{formatDuration(row.getValue('startedAt'), row.original.completedAt)}</span>
      ),
    }),
    columnHelper.accessor('startedAt', {
      id: 'startedAtDisplay',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Started
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.getValue('startedAt')).toLocaleString()}
        </span>
      ),
    }),
    columnHelper.accessor('user.name', {
      header: 'User',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.user.name || row.original.user.email}
        </span>
      ),
    }),
    columnHelper.accessor('errorMessage', {
      header: 'Error',
      cell: ({ row }) => {
        const error = row.getValue<string | null>('errorMessage')
        return error ? (
          <div className="max-w-[200px] truncate text-red-600 text-sm">
            {error}
          </div>
        ) : null
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const status = row.original.status
        const isCancelable = status === 'running' || status === 'started'
        if (!isCancelable) return null

        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCancelSync(row.original.id)}
            disabled={cancelMutation.isPending}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        )
      },
    }),
  ], [cancelMutation.isPending, handleCancelSync])

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    manualPagination: true, // We handle pagination on the server
    pageCount: data?.pagination?.totalPages || 0,
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({
      entityType: 'all',
      status: 'all',
      operation: 'all',
      dateFrom: '',
      dateTo: '',
    })
    setColumnFilters([])
    setPage(1)
  }

  const statistics = data?.statistics
  const activeSyncs = data?.activeSyncs || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden"
        aria-describedby={descriptionId}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync Logs
          </DialogTitle>
          <DialogDescription id={descriptionId}>
            View and monitor data synchronization logs and operations
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Statistics Cards */}
          {statistics && (
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Syncs</p>
                      <p className="text-2xl font-bold">{statistics.activeCount}</p>
                    </div>
                    <Activity className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Completed (24h)</p>
                      <p className="text-2xl font-bold">{statistics.completedLast24h}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Failed (24h)</p>
                      <p className="text-2xl font-bold">{statistics.failedLast24h}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold">{statistics.successRate}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Active Syncs Section */}
          {activeSyncs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Active Sync Operations
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelAll}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeSyncs.map((sync: any) => (
                  <div key={sync.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{sync.entityType}</Badge>
                        <span className="text-sm font-medium">{sync.id.substring(0, 8)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(sync.startedAt, null)}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelSync(sync.id)}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    {sync.metadata?.progress !== undefined && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>Progress</span>
                          <span>{Math.round(sync.metadata.progress)}%</span>
                        </div>
                        <Progress value={sync.metadata.progress} className="h-2" />
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Records: </span>
                        {sync.recordCount || 0}
                      </div>
                      {sync.metadata?.currentRate && (
                        <div>
                          <span className="text-muted-foreground">Rate: </span>
                          {sync.metadata.currentRate.toFixed(1)}/s
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">User: </span>
                        {sync.user?.name || sync.user?.email || 'Unknown'}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-sm">Filters</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? 'Hide' : 'Show'} Filters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleContent>
                <CardContent className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="entityType">Entity Type</Label>
                    <Select
                      value={filters.entityType}
                      onValueChange={(value) => handleFilterChange('entityType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="contacts">Contacts</SelectItem>
                        <SelectItem value="chats">Chats</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => handleFilterChange('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="started">Started</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="operation">Operation</Label>
                    <Select
                      value={filters.operation}
                      onValueChange={(value) => handleFilterChange('operation', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All operations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All operations</SelectItem>
                        <SelectItem value="sync">Sync</SelectItem>
                        <SelectItem value="full_sync">Full Sync</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dateFrom">From Date</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dateTo">To Date</Label>
                    <div className="flex gap-2">
                      <Input
                        id="dateTo"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Logs Table */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0 h-full overflow-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-8 text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Failed to load sync logs. Please try again.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id} className="px-2">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="px-2">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No results found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {data?.pagination && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.pagination.totalCount)} of {data.pagination.totalCount} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!data.pagination.hasPreviousPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!data.pagination.hasNextPage}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
