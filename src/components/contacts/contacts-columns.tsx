// TanStack Table Column Definitions for Contacts List (Feature 006)

'use client'

import { ColumnDef } from '@tanstack/react-table'
import { ContactWithStats } from '@/types/contact'
import { Badge } from '@/components/ui/badge'
import { ContactTagsCompact } from '@/components/contacts/contact-tags'
import { formatDistanceToNow } from 'date-fns'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Get customer type badge based on chat count and VIP status
 */
function CustomerTypeBadge({ chatCount, isVIP }: { chatCount: number; isVIP: boolean }) {
  if (isVIP) {
    return (
      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
        VIP
      </Badge>
    )
  }

  if (chatCount === 0) {
    return (
      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
        No Chats
      </Badge>
    )
  }

  if (chatCount === 1) {
    return (
      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
        First-Time
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
      Repeat ({chatCount})
    </Badge>
  )
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return '—'
  }
}

/**
 * Format relative time for last contact date
 */
function formatLastContact(dateString: string | null): string {
  if (!dateString) return 'Never'

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
 * Contact table column definitions
 */
export const contactsColumns: ColumnDef<ContactWithStats>[] = [
  {
    accessorKey: 'fullName',
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
    cell: ({ row }) => {
      const name = row.original.fullName
      return (
        <div className="font-medium min-w-[150px]">
          {name}
        </div>
      )
    },
  },
  {
    accessorKey: 'b2chatId',
    header: ({ column }) => <SortableHeader column={column} label="B2Chat ID" />,
    cell: ({ row }) => {
      const b2chatId = row.original.b2chatId
      return (
        <div className="font-mono text-xs text-muted-foreground min-w-[100px]">
          {b2chatId}
        </div>
      )
    },
  },
  {
    accessorKey: 'email',
    header: ({ column }) => <SortableHeader column={column} label="Email" />,
    cell: ({ row }) => {
      const email = row.original.email
      return (
        <div className="min-w-[180px] text-sm">
          {email || <span className="text-muted-foreground">—</span>}
        </div>
      )
    },
  },
  {
    accessorKey: 'mobile',
    header: ({ column }) => <SortableHeader column={column} label="Mobile" />,
    cell: ({ row }) => {
      const mobile = row.original.mobile
      return (
        <div className="min-w-[120px] text-sm">
          {mobile || <span className="text-muted-foreground">—</span>}
        </div>
      )
    },
  },
  {
    accessorKey: 'phoneNumber',
    header: ({ column }) => <SortableHeader column={column} label="Phone" />,
    cell: ({ row }) => {
      const phoneNumber = row.original.phoneNumber
      return (
        <div className="min-w-[120px] text-sm">
          {phoneNumber || <span className="text-muted-foreground">—</span>}
        </div>
      )
    },
  },
  {
    accessorKey: 'company',
    header: ({ column }) => <SortableHeader column={column} label="Company" />,
    cell: ({ row }) => {
      const company = row.original.company
      return (
        <div className="min-w-[140px] text-sm">
          {company || <span className="text-muted-foreground">—</span>}
        </div>
      )
    },
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.original.tags
      return (
        <div className="min-w-[80px]">
          {tags && tags.length > 0 ? (
            <ContactTagsCompact tags={tags} />
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
      )
    },
  },
  {
    id: 'customerType',
    header: 'Type',
    cell: ({ row }) => {
      const chatCount = row.original.chatCount
      const isVIP = row.original.isVIP
      return (
        <div className="min-w-[100px]">
          <CustomerTypeBadge chatCount={chatCount} isVIP={isVIP} />
        </div>
      )
    },
  },
  {
    accessorKey: 'chatCount',
    header: ({ column }) => <SortableHeader column={column} label="Total Chats" />,
    cell: ({ row }) => {
      const count = row.original.chatCount
      return (
        <div className="text-sm font-medium min-w-[80px]">
          {count}
        </div>
      )
    },
  },
  {
    accessorKey: 'lastContactDate',
    header: ({ column }) => <SortableHeader column={column} label="Last Contact" />,
    cell: ({ row }) => {
      const lastContact = row.original.lastContactDate
      return (
        <div className="text-sm text-muted-foreground min-w-[130px]">
          {formatLastContact(lastContact)}
        </div>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <SortableHeader column={column} label="Created" />,
    cell: ({ row }) => {
      const created = row.original.createdAt
      return (
        <div className="text-sm text-muted-foreground min-w-[110px]">
          {formatDate(created)}
        </div>
      )
    },
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => <SortableHeader column={column} label="Updated" />,
    cell: ({ row }) => {
      const updated = row.original.updatedAt
      return (
        <div className="text-sm text-muted-foreground min-w-[110px]">
          {formatDate(updated)}
        </div>
      )
    },
  },
  {
    accessorKey: 'merchantId',
    header: ({ column }) => <SortableHeader column={column} label="Merchant ID" />,
    cell: ({ row }) => {
      const merchantId = row.original.merchantId
      return (
        <div className="font-mono text-xs text-muted-foreground min-w-[120px]">
          {merchantId || <span className="text-muted-foreground">—</span>}
        </div>
      )
    },
  },
  {
    accessorKey: 'id',
    header: ({ column }) => <SortableHeader column={column} label="Internal ID" />,
    cell: ({ row }) => {
      const id = row.original.id
      return (
        <div className="font-mono text-xs text-muted-foreground min-w-[100px]">
          {id}
        </div>
      )
    },
  },
]

