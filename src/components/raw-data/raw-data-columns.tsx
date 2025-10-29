// TanStack Table Column Definitions for Raw Data List (Feature 007)

'use client'

import { ColumnDef } from '@tanstack/react-table'
import { RawDataRecord } from '@/types/raw-data'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { ArrowUpDown, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatProcessingStatus } from '@/lib/hooks/use-raw-data'

/**
 * Get entity type badge
 */
function EntityTypeBadge({ type }: { type: 'contact' | 'chat' }) {
  if (type === 'contact') {
    return (
      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
        Contact
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
      Chat
    </Badge>
  )
}

/**
 * Truncate ID and show full in tooltip
 */
function TruncatedId({ id, label }: { id: string; label?: string }) {
  const truncated = id.length > 12 ? `${id.substring(0, 12)}...` : id

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-xs cursor-help">{truncated}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-mono">
            {label && <span className="font-semibold">{label}: </span>}
            {id}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '—'

  try {
    const date = new Date(dateString)
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return '—'
  }
}

/**
 * Sortable header component
 */
function SortableHeader({ column, label }: { column: any; label: string }) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="-ml-4 h-8 data-[state=open]:bg-accent"
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

/**
 * Raw data table column definitions
 */
export const rawDataColumns: ColumnDef<RawDataRecord>[] = [
  {
    accessorKey: 'entityType',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.entityType
      return (
        <div className="min-w-[80px]">
          <EntityTypeBadge type={type} />
        </div>
      )
    },
  },
  {
    accessorKey: 'b2chatId',
    header: ({ column }) => <SortableHeader column={column} label="B2Chat ID" />,
    cell: ({ row }) => {
      const id = row.original.b2chatId
      return (
        <div className="min-w-[120px]">
          <TruncatedId id={id} label="B2Chat ID" />
        </div>
      )
    },
  },
  {
    accessorKey: 'syncId',
    header: ({ column }) => <SortableHeader column={column} label="Sync ID" />,
    cell: ({ row }) => {
      const syncId = row.original.syncId
      return (
        <div className="min-w-[120px]">
          <TruncatedId id={syncId} label="Sync ID" />
        </div>
      )
    },
  },
  {
    accessorKey: 'processingStatus',
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const status = row.original.processingStatus
      const statusInfo = formatProcessingStatus(status)
      return (
        <div className="min-w-[100px]">
          <Badge variant={statusInfo.variant} className={`text-xs ${statusInfo.color}`}>
            {statusInfo.label}
          </Badge>
        </div>
      )
    },
  },
  {
    accessorKey: 'fetchedAt',
    header: ({ column }) => <SortableHeader column={column} label="Fetched" />,
    cell: ({ row }) => {
      const fetchedAt = row.original.fetchedAt
      return (
        <div className="text-sm text-muted-foreground min-w-[130px]">
          {formatRelativeTime(fetchedAt)}
        </div>
      )
    },
  },
  {
    accessorKey: 'processedAt',
    header: ({ column }) => <SortableHeader column={column} label="Processed" />,
    cell: ({ row }) => {
      const processedAt = row.original.processedAt
      return (
        <div className="text-sm text-muted-foreground min-w-[130px]">
          {processedAt ? formatRelativeTime(processedAt) : (
            <span className="italic text-muted-foreground/60">Not yet</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'apiPage',
    header: ({ column }) => <SortableHeader column={column} label="Page" />,
    cell: ({ row }) => {
      const page = row.original.apiPage
      return (
        <div className="text-sm font-medium min-w-[60px]">
          {page}
        </div>
      )
    },
  },
  {
    accessorKey: 'processingAttempt',
    header: ({ column }) => <SortableHeader column={column} label="Retries" />,
    cell: ({ row }) => {
      const attempts = row.original.processingAttempt
      return (
        <div className={`text-sm font-medium min-w-[70px] ${attempts > 0 ? 'text-orange-600' : ''}`}>
          {attempts}
        </div>
      )
    },
  },
  {
    accessorKey: 'processingError',
    header: 'Error',
    cell: ({ row }) => {
      const error = row.original.processingError
      const status = row.original.processingStatus

      if (status !== 'failed' || !error) {
        return <span className="text-muted-foreground text-sm">—</span>
      }

      const truncatedError = error.length > 50 ? `${error.substring(0, 50)}...` : error

      return (
        <div className="min-w-[200px]">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-sm text-red-600 cursor-help">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="truncate">{truncatedError}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <p className="text-xs whitespace-pre-wrap">{error}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    },
  },
  {
    accessorKey: 'id',
    header: 'Internal ID',
    cell: ({ row }) => {
      const id = row.original.id
      return (
        <div className="min-w-[120px]">
          <TruncatedId id={id} label="Internal ID" />
        </div>
      )
    },
  },
  {
    accessorKey: 'apiOffset',
    header: ({ column }) => <SortableHeader column={column} label="Offset" />,
    cell: ({ row }) => {
      const offset = row.original.apiOffset
      return (
        <div className="text-sm text-muted-foreground min-w-[70px]">
          {offset}
        </div>
      )
    },
  },
]
