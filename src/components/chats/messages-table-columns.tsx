// TanStack Table Column Definitions for Messages View

'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Message } from '@/types/chat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, User as UserIcon } from 'lucide-react'
import { PriorityBadge } from './priority-badge'
import { TimeAgo } from '@/components/ui/time-ago'
import { truncateText } from '@/lib/chat-utils'

export const messageColumns: ColumnDef<Message>[] = [
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => {
      const customer = row.original.customer || 'Unknown'
      const email = row.original.customerEmail
      return (
        <div className="min-w-[150px]">
          <div className="font-medium">{customer}</div>
          {email && (
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
              {email}
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'sender',
    header: 'Sender',
    cell: ({ row }) => {
      const sender = row.original.sender || 'Unknown'
      const isAgent = row.original.senderIsAgent
      return (
        <div className="flex items-center gap-1 min-w-[120px]">
          <span className="font-medium text-sm">{sender}</span>
          {isAgent && (
            <Badge variant="secondary" className="text-xs">
              <UserIcon className="mr-1 h-3 w-3" />
              Agent
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'text',
    header: 'Message',
    cell: ({ row }) => {
      const text = row.original.text || ''
      const type = row.original.type

      if (type === 'image') {
        return (
          <div className="text-sm text-muted-foreground italic">
            📷 Image attachment
          </div>
        )
      }

      if (type === 'file') {
        return (
          <div className="text-sm text-muted-foreground italic">
            📎 File attachment
          </div>
        )
      }

      return (
        <div className="max-w-[300px] text-sm">
          {truncateText(text, 80)}
        </div>
      )
    },
  },
  {
    accessorKey: 'chatTopic',
    header: 'Topic',
    cell: ({ row }) => {
      const topic = row.original.chatTopic
      return (
        <div className="min-w-[100px] text-sm">
          {topic || <span className="text-muted-foreground">-</span>}
        </div>
      )
    },
  },
  {
    accessorKey: 'chatPriority',
    header: 'Priority',
    cell: ({ row }) => {
      const priority = row.original.chatPriority
      if (!priority) return <span className="text-muted-foreground">-</span>
      return <PriorityBadge priority={priority} />
    },
  },
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => {
      const timestamp = row.original.timestamp
      return (
        <div className="text-sm text-muted-foreground min-w-[120px]">
          <TimeAgo timestamp={timestamp} />
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }) => {
      const chatId = row.original.chatId
      const onViewChat = (table.options.meta as any)?.onViewChat

      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChat?.(chatId)}
          className="h-8"
        >
          <ExternalLink className="mr-1 h-4 w-4" />
          View
        </Button>
      )
    },
  },
]
