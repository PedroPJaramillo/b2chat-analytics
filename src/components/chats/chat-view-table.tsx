'use client'

import { useState, useEffect, Fragment, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnDef,
  VisibilityState,
} from '@tanstack/react-table'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronRight as ChevronRightIcon,
  MessageSquareText,
  ArrowUpDown
} from 'lucide-react'
import { ChatViewFilters } from './chat-view-filters'
import { ColumnSelector } from './column-selector'
import { ChatConversationView } from './chat-conversation-view'
import { useChatView, useChatViewStats } from '@/lib/hooks/use-chat-view'
import { useSLASettings } from '@/hooks/use-sla-settings'
import { formatSLATooltip, type ChatWithSLA } from '@/lib/sla-tooltip-formatter'
import type { ChatViewFilters as ChatViewFiltersType, ChatViewItem, ColumnVisibilityState } from '@/types/chat-view'
import type { ChatStatus, ChatPriority } from '@/types/chat'
import { formatResponseTime, getResponseTimeLabel, getResponseTimeBadgeClass } from '@/lib/chat-response-time'
import { getColumnPreferences, setColumnPreferences } from '@/lib/storage/column-preferences'
import { DEFAULT_COLUMN_VISIBILITY } from '@/types/chat-view'
import { cn } from '@/lib/utils'

interface ChatViewTableProps {
  className?: string
}

// Status badge colors
function getStatusBadgeVariant(status: ChatStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'OPENED':
    case 'BOT_CHATTING':
      return 'default'
    case 'PICKED_UP':
    case 'RESPONDED_BY_AGENT':
      return 'secondary'
    case 'CLOSED':
    case 'COMPLETED_POLL':
      return 'outline'
    default:
      return 'default'
  }
}

// Priority badge colors (Feature 011)
function getPriorityBadgeVariant(priority: ChatPriority): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (priority) {
    case 'urgent':
      return 'destructive'
    case 'high':
      return 'default'
    case 'normal':
      return 'secondary'
    case 'low':
      return 'outline'
    default:
      return 'secondary'
  }
}

// Format time duration from milliseconds (Feature 011)
function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A'
  return formatResponseTime(ms)
}

// Parse filters from URL search params (Feature 015: Chunk 3)
function parseFiltersFromURL(searchParams: URLSearchParams): ChatViewFiltersType {
  const filters: ChatViewFiltersType = {}

  // Search
  const search = searchParams.get('search')
  if (search) filters.search = search

  // Status (comma-separated)
  const status = searchParams.get('status')
  if (status) filters.status = status.split(',') as ChatStatus[]

  // Agent ID
  const agentId = searchParams.get('agentId')
  if (agentId) filters.agentId = agentId

  // Department ID
  const departmentId = searchParams.get('departmentId')
  if (departmentId) filters.departmentId = departmentId

  // Priority (comma-separated)
  const priority = searchParams.get('priority')
  if (priority) filters.priorityFilter = priority.split(',') as ChatPriority[]

  // SLA Status
  const slaStatus = searchParams.get('slaStatus')
  if (slaStatus) filters.slaStatus = slaStatus as 'all' | 'within' | 'breached'

  // Provider (comma-separated)
  const provider = searchParams.get('provider')
  if (provider) filters.providerFilter = provider.split(',') as any

  // Message Count Range
  const messageCountRange = searchParams.get('messageCountRange')
  if (messageCountRange) filters.messageCountRange = messageCountRange as any

  // Response Time
  const respTimeMin = searchParams.get('respTimeMin')
  if (respTimeMin) filters.responseTimeMin = parseInt(respTimeMin)

  const respTimeMax = searchParams.get('respTimeMax')
  if (respTimeMax) filters.responseTimeMax = parseInt(respTimeMax)

  // Created At Range
  const createdStart = searchParams.get('createdStart')
  const createdEnd = searchParams.get('createdEnd')
  if (createdStart && createdEnd) {
    filters.createdAtRange = {
      start: new Date(createdStart),
      end: new Date(createdEnd)
    }
  }

  // Updated At Range
  const updatedStart = searchParams.get('updatedStart')
  const updatedEnd = searchParams.get('updatedEnd')
  if (updatedStart && updatedEnd) {
    filters.updatedAtRange = {
      start: new Date(updatedStart),
      end: new Date(updatedEnd)
    }
  }

  return filters
}

// Serialize filters to URL search params (Feature 015: Chunk 3)
function serializeFiltersToURL(filters: ChatViewFiltersType, params: URLSearchParams): void {
  // Clear all filter-related params first
  const filterKeys = ['search', 'status', 'agentId', 'departmentId', 'priority', 'slaStatus',
                      'provider', 'messageCountRange', 'respTimeMin', 'respTimeMax',
                      'createdStart', 'createdEnd', 'updatedStart', 'updatedEnd']
  filterKeys.forEach(key => params.delete(key))

  // Add active filters
  if (filters.search) params.set('search', filters.search)
  if (filters.status && filters.status.length > 0) params.set('status', filters.status.join(','))
  if (filters.agentId) params.set('agentId', filters.agentId)
  if (filters.departmentId) params.set('departmentId', filters.departmentId)
  if (filters.priorityFilter && filters.priorityFilter.length > 0) params.set('priority', filters.priorityFilter.join(','))
  if (filters.slaStatus && filters.slaStatus !== 'all') params.set('slaStatus', filters.slaStatus)
  if (filters.providerFilter && filters.providerFilter.length > 0) params.set('provider', filters.providerFilter.join(','))
  if (filters.messageCountRange) params.set('messageCountRange', filters.messageCountRange)
  if (filters.responseTimeMin !== undefined) params.set('respTimeMin', filters.responseTimeMin.toString())
  if (filters.responseTimeMax !== undefined) params.set('respTimeMax', filters.responseTimeMax.toString())
  if (filters.createdAtRange) {
    params.set('createdStart', filters.createdAtRange.start.toISOString())
    params.set('createdEnd', filters.createdAtRange.end.toISOString())
  }
  if (filters.updatedAtRange) {
    params.set('updatedStart', filters.updatedAtRange.start.toISOString())
    params.set('updatedEnd', filters.updatedAtRange.end.toISOString())
  }
}

// Sortable header component with visual indicators (Feature 015: Chunk 2)
function SortableHeader({ column, label }: { column: any; label: string }) {
  const sortDirection = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className={cn(
        "-ml-4 h-8 data-[state=open]:bg-accent",
        sortDirection && "text-primary font-semibold"
      )}
      aria-sort={
        sortDirection === 'asc' ? 'ascending' :
        sortDirection === 'desc' ? 'descending' :
        'none'
      }
    >
      {label}
      {sortDirection === 'asc' ? (
        <ChevronUp className="ml-2 h-4 w-4" />
      ) : sortDirection === 'desc' ? (
        <ChevronDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  )
}

export function ChatViewTable({ className }: ChatViewTableProps) {
  // URL state management (Feature 015: Chunk 3)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize filters from URL on mount
  const initialFilters = useMemo(() => parseFiltersFromURL(searchParams), [searchParams])

  // Initialize sorting from URL
  const initialSorting = useMemo(() => {
    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder')
    if (sortBy) {
      return [{ id: sortBy, desc: sortOrder === 'desc' }]
    }
    return [{ id: 'updatedAt', desc: true }]
  }, [searchParams])

  // Initialize page from URL
  const initialPage = useMemo(() => {
    const page = searchParams.get('page')
    return page ? parseInt(page) - 1 : 0 // TanStack uses 0-indexed pages
  }, [searchParams])

  // State management
  const [filters, setFilters] = useState<ChatViewFiltersType>(initialFilters)
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [pagination, setPagination] = useState({
    pageIndex: initialPage,
    pageSize: 25
  })
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  // Feature 011: Column visibility from localStorage
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(
    () => getColumnPreferences()
  )

  // Update localStorage when column visibility changes
  useEffect(() => {
    setColumnPreferences(columnVisibility)
  }, [columnVisibility])

  // Update state from URL when browser back/forward (Feature 015: Chunk 3)
  useEffect(() => {
    const newFilters = parseFiltersFromURL(searchParams)
    const newSortBy = searchParams.get('sortBy')
    const newSortOrder = searchParams.get('sortOrder')
    const newPage = searchParams.get('page')

    // Update filters if changed
    setFilters(newFilters)

    // Update sorting if changed
    if (newSortBy) {
      setSorting([{ id: newSortBy, desc: newSortOrder === 'desc' }])
    } else {
      setSorting([{ id: 'updatedAt', desc: true }])
    }

    // Update pagination if changed
    if (newPage) {
      setPagination(prev => ({ ...prev, pageIndex: parseInt(newPage) - 1 }))
    }
  }, [searchParams])

  // Sync filters, sorting, and pagination to URL (Feature 015: Chunk 3)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())

      // Serialize filters
      serializeFiltersToURL(filters, params)

      // Add sorting
      if (sorting[0]) {
        params.set('sortBy', sorting[0].id)
        params.set('sortOrder', sorting[0].desc ? 'desc' : 'asc')
      } else {
        params.delete('sortBy')
        params.delete('sortOrder')
      }

      // Add pagination
      params.set('page', (pagination.pageIndex + 1).toString())

      // Update URL without reloading
      const newSearch = params.toString()
      const currentSearch = searchParams.toString()

      if (newSearch !== currentSearch) {
        router.replace(`${pathname}?${newSearch}`, { scroll: false })
      }
    }, 500) // Debounce 500ms to avoid excessive URL updates

    return () => clearTimeout(timeoutId)
  }, [filters, sorting, pagination, router, pathname, searchParams])

  // SLA Tooltips: Fetch SLA configuration
  const { config: slaConfig, loading: slaConfigLoading } = useSLASettings()

  // Fetch chat view data
  const { data, loading, error } = useChatView({
    filters,
    sortBy: sorting[0]?.id as any || 'updatedAt',
    sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize
  })

  // Feature 011: Fetch stats for filter dropdowns
  const { data: stats } = useChatViewStats()

  // Convert ColumnVisibilityState to TanStack Table format
  const tableColumnVisibility: VisibilityState = {
    expand: true, // Always show expand button
    b2chatId: columnVisibility.id,
    contactName: columnVisibility.contactName,
    status: columnVisibility.status,
    agentName: columnVisibility.agentName,
    responseTime: columnVisibility.responseTime,
    updatedAt: columnVisibility.updatedAt,
    // Feature 011: New columns
    departmentName: columnVisibility.departmentName,
    priority: columnVisibility.priority,
    slaStatus: columnVisibility.slaStatus,
    createdAt: columnVisibility.createdAt,
    provider: columnVisibility.provider,
    tags: columnVisibility.tags,
    topic: columnVisibility.topic,
    unreadCount: columnVisibility.unreadCount,
    messageCount: columnVisibility.messageCount,
    openedAt: columnVisibility.openedAt,
    pickedUpAt: columnVisibility.pickedUpAt,
    responseAt: columnVisibility.responseAt,
    closedAt: columnVisibility.closedAt,
    pickupTime: columnVisibility.pickupTime,
    resolutionTime: columnVisibility.resolutionTime,
    avgResponseTime: columnVisibility.avgResponseTime,
    direction: columnVisibility.direction,
  }

  // Define table columns (Feature 011: Extended with all new columns)
  const columns: ColumnDef<ChatViewItem>[] = [
    {
      id: 'expand',
      header: '',
      cell: ({ row }) => {
        const isExpanded = expandedRowId === row.original.id
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRowToggle(row.original.id)
            }}
            className="p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </button>
        )
      },
      size: 40,
      enableHiding: false,
    },
    {
      accessorKey: 'b2chatId',
      id: 'b2chatId',
      header: 'ID',
      cell: ({ row }) => (
        <div className="font-mono text-xs">{row.original.b2chatId}</div>
      ),
      size: 100,
    },
    {
      accessorKey: 'contactName',
      id: 'contactName',
      header: ({ column }) => <SortableHeader column={column} label="Contact" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.contactName}</div>
        </div>
      ),
      size: 180,
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      cell: ({ row }) => (
        <Badge variant={getStatusBadgeVariant(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
      size: 140,
    },
    {
      accessorKey: 'agentName',
      id: 'agentName',
      header: ({ column }) => <SortableHeader column={column} label="Agent" />,
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.agentName || <span className="text-muted-foreground italic">Unassigned</span>}
        </div>
      ),
      size: 140,
    },
    {
      accessorKey: 'firstResponseTimeMs',
      id: 'responseTime',
      header: ({ column }) => <SortableHeader column={column} label="Response Time" />,
      cell: ({ row }) => {
        const { firstResponseTimeMs, firstResponseTimeFormatted, responseTimeIndicator } = row.original

        if (!firstResponseTimeMs || !firstResponseTimeFormatted || !responseTimeIndicator) {
          return <span className="text-xs text-muted-foreground">N/A</span>
        }

        return (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                getResponseTimeBadgeClass(responseTimeIndicator)
              )}
            >
              {getResponseTimeLabel(responseTimeIndicator)}
            </Badge>
            <span className="text-sm">{firstResponseTimeFormatted}</span>
          </div>
        )
      },
      size: 180,
    },
    {
      accessorKey: 'updatedAt',
      id: 'updatedAt',
      header: ({ column }) => <SortableHeader column={column} label="Updated" />,
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {new Date(row.original.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      ),
      size: 120,
    },
    // Feature 011: New columns
    {
      accessorKey: 'departmentName',
      id: 'departmentName',
      header: ({ column }) => <SortableHeader column={column} label="Department" />,
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.departmentName || <span className="text-muted-foreground italic">None</span>}
        </div>
      ),
      size: 140,
    },
    {
      accessorKey: 'priority',
      id: 'priority',
      header: ({ column }) => <SortableHeader column={column} label="Priority" />,
      cell: ({ row }) => (
        <Badge variant={getPriorityBadgeVariant(row.original.priority)}>
          {row.original.priority}
        </Badge>
      ),
      size: 100,
    },
    {
      accessorKey: 'slaStatus',
      id: 'slaStatus',
      header: ({ column }) => <SortableHeader column={column} label="SLA" />,
      cell: ({ row }) => {
        const chat = row.original

        // Generate tooltip content if SLA config is available
        const tooltipContent = slaConfig && !slaConfigLoading
          ? formatSLATooltip(chat as ChatWithSLA, slaConfig)
          : 'Loading SLA configuration...'

        // Determine badge variant and text based on SLA status
        const getBadgeVariant = (): 'secondary' | 'destructive' | 'outline' => {
          if (chat.slaStatus === 'within') return 'secondary'
          if (chat.slaStatus === 'breached') return 'destructive'
          return 'outline' // incomplete
        }

        const getBadgeText = (): string => {
          if (chat.slaStatus === 'within') return 'Within'
          if (chat.slaStatus === 'breached') return 'Breached'
          return 'Incomplete'
        }

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help inline-block">
                <Badge variant={getBadgeVariant()}>
                  {getBadgeText()}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent
              className="max-w-md whitespace-pre-line text-xs font-mono"
              side="right"
              align="start"
            >
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        )
      },
      size: 100,
    },
    {
      accessorKey: 'createdAt',
      id: 'createdAt',
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: 'provider',
      id: 'provider',
      header: 'Provider',
      cell: ({ row }) => (
        <div className="text-sm capitalize">{row.original.provider}</div>
      ),
      size: 100,
    },
    {
      accessorKey: 'tags',
      id: 'tags',
      header: 'Tags',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.tags.length > 0 ? (
            row.original.tags.slice(0, 2).map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
          {row.original.tags.length > 2 && (
            <span className="text-xs text-muted-foreground">+{row.original.tags.length - 2}</span>
          )}
        </div>
      ),
      size: 150,
    },
    {
      accessorKey: 'topic',
      id: 'topic',
      header: 'Topic',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.topic || <span className="text-muted-foreground italic">None</span>}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: 'unreadCount',
      id: 'unreadCount',
      header: 'Unread',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.unreadCount > 0 ? (
            <Badge variant="default">{row.original.unreadCount}</Badge>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </div>
      ),
      size: 80,
    },
    {
      accessorKey: 'messageCount',
      id: 'messageCount',
      header: ({ column }) => <SortableHeader column={column} label="Messages" />,
      cell: ({ row }) => (
        <div className="text-sm">{row.original.messageCount}</div>
      ),
      size: 80,
    },
    {
      accessorKey: 'openedAt',
      id: 'openedAt',
      header: 'Opened At',
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {row.original.openedAt
            ? new Date(row.original.openedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'N/A'}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: 'pickedUpAt',
      id: 'pickedUpAt',
      header: 'Picked Up At',
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {row.original.pickedUpAt
            ? new Date(row.original.pickedUpAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'N/A'}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: 'responseAt',
      id: 'responseAt',
      header: 'Response At',
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {row.original.responseAt
            ? new Date(row.original.responseAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'N/A'}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: 'closedAt',
      id: 'closedAt',
      header: 'Closed At',
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {row.original.closedAt
            ? new Date(row.original.closedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'N/A'}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: 'pickupTimeMs',
      id: 'pickupTime',
      header: 'Pickup Time',
      cell: ({ row }) => (
        <div className="text-sm">{formatDuration(row.original.pickupTimeMs)}</div>
      ),
      size: 120,
    },
    {
      accessorKey: 'resolutionTimeMs',
      id: 'resolutionTime',
      header: 'Resolution Time',
      cell: ({ row }) => (
        <div className="text-sm">{formatDuration(row.original.resolutionTimeMs)}</div>
      ),
      size: 140,
    },
    {
      accessorKey: 'avgResponseTimeMs',
      id: 'avgResponseTime',
      header: 'Avg Response',
      cell: ({ row }) => (
        <div className="text-sm">{formatDuration(row.original.avgResponseTimeMs)}</div>
      ),
      size: 140,
    },
    {
      accessorKey: 'direction',
      id: 'direction',
      header: 'Direction',
      cell: ({ row }) => (
        <div className="text-sm capitalize">
          {row.original.direction || <span className="text-muted-foreground italic">N/A</span>}
        </div>
      ),
      size: 100,
    },
  ]

  // Configure TanStack Table
  const table = useReactTable({
    data: data?.chats || [],
    columns,
    state: {
      sorting,
      pagination,
      columnVisibility: tableColumnVisibility,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: data?.pagination.totalPages || 0,
  })

  // Handle row toggle (expand/collapse)
  const handleRowToggle = (rowId: string) => {
    setExpandedRowId(prev => prev === rowId ? null : rowId)
  }

  // Handle column visibility change
  const handleColumnVisibilityChange = (newVisibility: ColumnVisibilityState) => {
    setColumnVisibility(newVisibility)
  }

  // Error state
  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Failed to load chat view</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className={className}>
      {/* Filters and Column Selector (Feature 011) */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <ChatViewFilters filters={filters} onChange={setFilters} stats={stats || undefined} />
        </div>
        <ColumnSelector
          columnVisibility={columnVisibility}
          onVisibilityChange={handleColumnVisibilityChange}
        />
      </div>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          {/* Loading State */}
          {loading && (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && data && data.chats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquareText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No chats found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {Object.keys(filters).length > 0
                  ? 'Try adjusting your filters to see more results.'
                  : 'No chats available to display.'}
              </p>
              {Object.keys(filters).length > 0 && (
                <Button variant="outline" onClick={() => setFilters({})}>
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {/* Table with Data */}
          {!loading && data && data.chats.length > 0 && (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            style={{ width: header.column.columnDef.size }}
                          >
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
                    {table.getRowModel().rows.map((row) => {
                      const isExpanded = expandedRowId === row.original.id

                      return (
                        <Fragment key={row.id}>
                          {/* Regular Row */}
                          <TableRow
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              isExpanded && "bg-muted/30"
                            )}
                            onClick={() => handleRowToggle(row.original.id)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Expanded Row - Conversation View */}
                          {isExpanded && (
                            <TableRow key={`${row.id}-expanded`}>
                              <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-0">
                                <div className="bg-muted/30 border-t">
                                  <div className="p-6">
                                    <h3 className="text-sm font-medium mb-4">
                                      Conversation - {row.original.messageCount} messages
                                    </h3>
                                    <ChatConversationView chatId={row.original.id} />
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {data.chats.length} of {data.pagination.total} chats
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <div className="text-sm">
                    Page {pagination.pageIndex + 1} of {data.pagination.totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  )
}
