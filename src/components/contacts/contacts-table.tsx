// Contacts Table Component (Feature 006)

'use client'

import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  VisibilityState,
  useReactTable,
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
import { AlertCircle, ChevronLeft, ChevronRight, Users, Columns } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { contactsColumns } from './contacts-columns'
import { ContactFilters } from './contact-filters'
import { ContactHistoryPanel } from '../chats/contact-history-panel'
import { useContacts } from '@/lib/hooks/use-contacts'
import { ContactsFilters } from '@/types/contact'

interface ContactsTableProps {
  className?: string
}

export function ContactsTable({ className }: ContactsTableProps) {
  // State management
  const [filters, setFilters] = useState<ContactsFilters>({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true }
  ])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 100
  })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    b2chatId: false, // Hide B2Chat ID by default
    phoneNumber: false, // Hide phone number by default (we show mobile)
    updatedAt: false, // Hide updated date by default
    merchantId: false, // Hide merchant ID by default
    id: false, // Hide internal ID by default
  })
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  // Fetch contacts data
  const { data, isLoading, error } = useContacts({
    filters,
    sorting: sorting[0] ? {
      sortBy: sorting[0].id,
      sortOrder: sorting[0].desc ? 'desc' : 'asc'
    } : { sortBy: 'createdAt', sortOrder: 'desc' },
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize
  })

  // Configure TanStack Table
  const table = useReactTable({
    data: data?.contacts || [],
    columns: contactsColumns,
    state: {
      sorting,
      pagination,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: data?.pagination.totalPages || 0,
  })

  // Handle row click to open contact history
  const handleRowClick = (contactId: string) => {
    setSelectedContactId(contactId)
  }

  // Error state
  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Failed to load contacts</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
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
    <div className={className}>
      {/* Filters and Column Visibility */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <ContactFilters filters={filters} onChange={setFilters} />
        </div>

        {/* Column Visibility Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Columns className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table Card */}
      <Card className="mt-4">
        <CardContent className="p-0">
          {/* Loading State */}
          {isLoading && (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && data && data.contacts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {Object.keys(filters).length > 0
                  ? 'Try adjusting your filters to see more results.'
                  : 'No contacts have been synced yet.'}
              </p>
              {Object.keys(filters).length > 0 && (
                <Button variant="outline" onClick={() => setFilters({})}>
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {/* Table with Data */}
          {!isLoading && data && data.contacts.length > 0 && (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
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
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(row.original.id)}
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing{' '}
                  <span className="font-medium">
                    {pagination.pageIndex * pagination.pageSize + 1}
                  </span>
                  {' - '}
                  <span className="font-medium">
                    {Math.min(
                      (pagination.pageIndex + 1) * pagination.pageSize,
                      data.pagination.total
                    )}
                  </span>
                  {' of '}
                  <span className="font-medium">{data.pagination.total}</span>
                  {' contacts'}
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

                  <div className="text-sm font-medium">
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

      {/* Contact History Panel */}
      <ContactHistoryPanel
        contactId={selectedContactId}
        contactName={data?.contacts.find(c => c.id === selectedContactId)?.fullName || ''}
        open={!!selectedContactId}
        onOpenChange={(open) => !open && setSelectedContactId(null)}
      />
    </div>
  )
}
