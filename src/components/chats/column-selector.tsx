// Column Selector Component - Feature 011
// Reusable column visibility manager with localStorage persistence

'use client'

import * as React from 'react'
import { Columns, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ColumnVisibilityState } from '@/types/chat-view'
import {
  getColumnPreferences,
  setColumnPreferences,
  resetColumnPreferences,
} from '@/lib/storage/column-preferences'
import { DEFAULT_COLUMN_VISIBILITY } from '@/types/chat-view'

interface ColumnSelectorProps {
  columnVisibility: ColumnVisibilityState
  onVisibilityChange: (visibility: ColumnVisibilityState) => void
  className?: string
}

// Column labels for display (maps column IDs to human-readable names)
const COLUMN_LABELS: Record<keyof ColumnVisibilityState, string> = {
  id: 'ID',
  contactName: 'Contact',
  status: 'Status',
  agentName: 'Agent',
  responseTime: 'Response Time',
  updatedAt: 'Updated',
  departmentName: 'Department',
  priority: 'Priority',
  slaStatus: 'SLA Status',
  createdAt: 'Created At',
  provider: 'Provider',
  tags: 'Tags',
  topic: 'Topic',
  unreadCount: 'Unread Count',
  messageCount: 'Message Count',
  openedAt: 'Opened At',
  pickedUpAt: 'Picked Up At',
  responseAt: 'Response At',
  closedAt: 'Closed At',
  pickupTime: 'Pickup Time',
  resolutionTime: 'Resolution Time',
  avgResponseTime: 'Avg Response Time',
  direction: 'Direction',
}

export function ColumnSelector({
  columnVisibility,
  onVisibilityChange,
  className,
}: ColumnSelectorProps) {
  // Count hidden columns
  const hiddenCount = Object.values(columnVisibility).filter((visible) => !visible).length

  const handleShowAll = () => {
    const allVisible = Object.keys(columnVisibility).reduce(
      (acc, key) => ({
        ...acc,
        [key]: true,
      }),
      {} as ColumnVisibilityState
    )
    onVisibilityChange(allVisible)
    setColumnPreferences(allVisible)
  }

  const handleHideAll = () => {
    const allHidden = Object.keys(columnVisibility).reduce(
      (acc, key) => ({
        ...acc,
        [key]: false,
      }),
      {} as ColumnVisibilityState
    )
    onVisibilityChange(allHidden)
    setColumnPreferences(allHidden)
  }

  const handleReset = () => {
    onVisibilityChange(DEFAULT_COLUMN_VISIBILITY)
    resetColumnPreferences()
  }

  const handleToggleColumn = (columnId: keyof ColumnVisibilityState, visible: boolean) => {
    const newVisibility = {
      ...columnVisibility,
      [columnId]: visible,
    }
    onVisibilityChange(newVisibility)
    setColumnPreferences(newVisibility)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Columns className="mr-2 h-4 w-4" />
          Columns
          {hiddenCount > 0 && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              {hiddenCount} hidden
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Quick actions */}
        <div className="flex gap-2 px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleShowAll}
          >
            <Eye className="mr-1 h-3 w-3" />
            Show All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleHideAll}
          >
            <EyeOff className="mr-1 h-3 w-3" />
            Hide All
          </Button>
        </div>

        <DropdownMenuSeparator />

        {/* Column checkboxes */}
        <div className="max-h-[400px] overflow-y-auto">
          {(Object.keys(columnVisibility) as Array<keyof ColumnVisibilityState>).map(
            (columnId) => (
              <DropdownMenuCheckboxItem
                key={columnId}
                checked={columnVisibility[columnId]}
                onCheckedChange={(checked) =>
                  handleToggleColumn(columnId, checked)
                }
              >
                {COLUMN_LABELS[columnId]}
              </DropdownMenuCheckboxItem>
            )
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Reset button */}
        <div className="px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={handleReset}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset to Default
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
