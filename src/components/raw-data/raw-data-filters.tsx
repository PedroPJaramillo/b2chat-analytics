// Raw Data Filters Component (Feature 007)

'use client'

import { Search, X, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { RawDataFilters as RawDataFiltersType, ProcessingStatus } from '@/types/raw-data'
import { useEffect, useState } from 'react'

interface RawDataFiltersProps {
  filters: RawDataFiltersType
  onChange: (filters: RawDataFiltersType) => void
  stats?: {
    byStatus: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
  }
}

// Processing status options
const STATUS_OPTIONS: { value: ProcessingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

export function RawDataFilters({ filters, onChange, stats }: RawDataFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '')

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onChange({ ...filters, search: searchValue || undefined })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue]) // Only depend on searchValue to avoid infinite loops

  // Count active filters (excluding entityType as it's always set)
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'entityType') return false
    if (key === 'search') return value && value.length > 0
    return value !== undefined
  }).length

  // Reset all filters except entityType
  const handleReset = () => {
    setSearchValue('')
    onChange({ entityType: filters.entityType })
  }

  // Update entity type
  const handleEntityTypeChange = (value: 'contacts' | 'chats' | 'all') => {
    onChange({ ...filters, entityType: value })
  }

  // Update processing status filter
  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      const { processingStatus, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        processingStatus: value as ProcessingStatus
      })
    }
  }

  // Remove specific filter
  const removeFilter = (key: keyof RawDataFiltersType) => {
    if (key === 'search') {
      setSearchValue('')
    }
    const { [key]: _, ...rest } = filters
    onChange(rest as RawDataFiltersType)
  }

  return (
    <div className="space-y-3">
      {/* Entity Type Tabs */}
      <Tabs value={filters.entityType} onValueChange={(value) => handleEntityTypeChange(value as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="chats">Chats</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[250px] max-w-[400px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, name, mobile, chat ID..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-8 pr-8"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
              onClick={() => setSearchValue('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Processing Status Filter */}
        <Select
          value={filters.processingStatus || 'all'}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
                {stats && option.value !== 'all' && (
                  <span className="ml-2 text-muted-foreground">
                    ({stats.byStatus[option.value]})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active Filters Badge */}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-auto">
            <Filter className="h-3 w-3 mr-1" />
            {activeFilterCount} Active
          </Badge>
        )}

        {/* Clear All Button */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="mr-1 h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.search && (
            <Badge variant="outline" className="gap-1">
              Search: &ldquo;{filters.search}&rdquo;
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('search')}
              />
            </Badge>
          )}
          {filters.processingStatus && (
            <Badge variant="outline" className="gap-1">
              Status: {STATUS_OPTIONS.find(o => o.value === filters.processingStatus)?.label}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('processingStatus')}
              />
            </Badge>
          )}
          {filters.syncId && (
            <Badge variant="outline" className="gap-1">
              Sync: {filters.syncId.substring(0, 8)}...
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('syncId')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
