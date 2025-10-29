"use client"

import { useState, useEffect } from 'react'
import { Calendar, Filter, X, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format } from 'date-fns'
import type { ContactHistoryFilters } from '@/types/contact'

interface ContactHistoryFiltersProps {
  filters: ContactHistoryFilters
  onChange: (filters: ContactHistoryFilters) => void
}

// Status options
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'responded_by_agent', label: 'Responded' },
]

// Sort options
const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'responseTime', label: 'Response Time' },
  { value: 'messageCount', label: 'Message Count' },
  { value: 'duration', label: 'Duration' },
]

export function ContactHistoryFilters({ filters, onChange }: ContactHistoryFiltersProps) {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    filters.dateFrom ? new Date(filters.dateFrom) : undefined
  )
  const [dateTo, setDateTo] = useState<Date | undefined>(
    filters.dateTo ? new Date(filters.dateTo) : undefined
  )

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'sortBy' || key === 'sortOrder') return false // Don't count sorting as filters
    if (key === 'status' && Array.isArray(value)) return value.length > 0
    if (key === 'tags' && Array.isArray(value)) return value.length > 0
    return value !== undefined
  }).length

  // Handle status change
  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      const { status, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        status: [value]
      })
    }
  }

  // Handle sort change
  const handleSortByChange = (value: string) => {
    onChange({
      ...filters,
      sortBy: value as 'createdAt' | 'responseTime' | 'messageCount' | 'duration'
    })
  }

  // Handle sort order toggle
  const toggleSortOrder = () => {
    onChange({
      ...filters,
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'
    })
  }

  // Handle date from change
  const handleDateFromChange = (date: Date | undefined) => {
    setDateFrom(date)
    if (date) {
      onChange({
        ...filters,
        dateFrom: date.toISOString().split('T')[0]
      })
    } else {
      const { dateFrom, ...rest } = filters
      onChange(rest)
    }
  }

  // Handle date to change
  const handleDateToChange = (date: Date | undefined) => {
    setDateTo(date)
    if (date) {
      onChange({
        ...filters,
        dateTo: date.toISOString().split('T')[0]
      })
    } else {
      const { dateTo, ...rest } = filters
      onChange(rest)
    }
  }

  // Clear all filters
  const handleClearAll = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    onChange({
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc'
    })
  }

  // Remove specific filter
  const removeFilter = (key: keyof ContactHistoryFilters) => {
    if (key === 'dateFrom') {
      setDateFrom(undefined)
    } else if (key === 'dateTo') {
      setDateTo(undefined)
    }
    const { [key]: _, ...rest } = filters
    onChange(rest)
  }

  // Get current status label
  const getCurrentStatusLabel = () => {
    if (!filters.status || filters.status.length === 0) return 'All Statuses'
    const option = STATUS_OPTIONS.find(opt => opt.value === filters.status?.[0])
    return option?.label || filters.status[0]
  }

  // Get current sort label
  const getCurrentSortLabel = () => {
    const option = SORT_OPTIONS.find(opt => opt.value === filters.sortBy)
    return option?.label || 'Date Created'
  }

  return (
    <div className="space-y-3">
      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter */}
        <Select
          value={filters.status?.[0] || 'all'}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date From Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
              <Calendar className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={dateFrom}
              onSelect={handleDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
              <Calendar className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={dateTo}
              onSelect={handleDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Sort By */}
        <Select
          value={filters.sortBy || 'createdAt'}
          onValueChange={handleSortByChange}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Order Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSortOrder}
          title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          <ArrowUpDown className={`h-4 w-4 ${filters.sortOrder === 'desc' ? 'rotate-180' : ''}`} />
        </Button>

        {/* Active Filters Badge */}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-auto">
            <Filter className="h-3 w-3 mr-1" />
            {activeFilterCount} Active
          </Badge>
        )}

        {/* Clear All Button */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            <X className="mr-1 h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.status && filters.status.length > 0 && (
            <Badge variant="outline" className="gap-1">
              Status: {getCurrentStatusLabel()}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('status')}
              />
            </Badge>
          )}
          {filters.dateFrom && (
            <Badge variant="outline" className="gap-1">
              From: {format(new Date(filters.dateFrom), 'MMM d, yyyy')}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('dateFrom')}
              />
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="outline" className="gap-1">
              To: {format(new Date(filters.dateTo), 'MMM d, yyyy')}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('dateTo')}
              />
            </Badge>
          )}
          {filters.agentId && (
            <Badge variant="outline" className="gap-1">
              Agent: {filters.agentId === 'unassigned' ? 'Unassigned' : filters.agentId}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('agentId')}
              />
            </Badge>
          )}
          {filters.tags && filters.tags.length > 0 && (
            <Badge variant="outline" className="gap-1">
              Tags: {filters.tags.join(', ')}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('tags')}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Sort Info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Sorted by:</span>
        <span className="font-medium">{getCurrentSortLabel()}</span>
        <span>({filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'})</span>
      </div>
    </div>
  )
}
