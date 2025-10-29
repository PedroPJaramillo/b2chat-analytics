// Contact Filters Component (Feature 006, enhanced in Feature 010)

'use client'

import { Search, X, Filter, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
import { ContactsFilters } from '@/types/contact'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ContactFiltersProps {
  filters: ContactsFilters
  onChange: (filters: ContactsFilters) => void
}

// Contact type options
const CONTACT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'first-time', label: 'First-Time' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'vip', label: 'VIP' },
]

// VIP filter options
const VIP_FILTER_OPTIONS = [
  { value: 'all', label: 'All Contacts' },
  { value: 'vip-only', label: 'VIP Only' },
  { value: 'non-vip', label: 'Non-VIP' },
]

// Chat status filter options (Feature 010)
const CHAT_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
]

export function ContactFilters({ filters, onChange }: ContactFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '')

  // Date state for chat filters (Feature 010)
  const [chatDateFrom, setChatDateFrom] = useState<Date | undefined>(
    filters.chatDateFrom ? new Date(filters.chatDateFrom) : undefined
  )
  const [chatDateTo, setChatDateTo] = useState<Date | undefined>(
    filters.chatDateTo ? new Date(filters.chatDateTo) : undefined
  )

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onChange({ ...filters, search: searchValue || undefined })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue]) // Only depend on searchValue to avoid infinite loops

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return value && value.length > 0
    return value !== undefined
  }).length

  // Reset all filters
  const handleReset = () => {
    setSearchValue('')
    onChange({})
  }

  // Update contact type filter
  const handleContactTypeChange = (value: string) => {
    if (value === 'all') {
      const { contactType, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        contactType: value as 'first-time' | 'repeat' | 'vip'
      })
    }
  }

  // Update VIP filter
  const handleVIPFilterChange = (value: string) => {
    if (value === 'all') {
      const { isVIP, ...rest } = filters
      onChange(rest)
    } else if (value === 'vip-only') {
      onChange({ ...filters, isVIP: true })
    } else if (value === 'non-vip') {
      onChange({ ...filters, isVIP: false })
    }
  }

  // Get current VIP filter value for select
  const getCurrentVIPFilterValue = () => {
    if (filters.isVIP === true) return 'vip-only'
    if (filters.isVIP === false) return 'non-vip'
    return 'all'
  }

  // Handle chat status filter (Feature 010)
  const handleChatStatusChange = (value: string) => {
    if (value === 'all') {
      const { chatStatus, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        chatStatus: [value]
      })
    }
  }

  // Get current chat status filter value
  const getCurrentChatStatusValue = () => {
    if (filters.chatStatus && filters.chatStatus.length > 0) {
      return filters.chatStatus[0]
    }
    return 'all'
  }

  // Handle date range changes (Feature 010)
  const handleChatDateFromChange = (date: Date | undefined) => {
    setChatDateFrom(date)
    if (date) {
      onChange({ ...filters, chatDateFrom: date.toISOString() })
    } else {
      const { chatDateFrom, ...rest } = filters
      onChange(rest)
    }
  }

  const handleChatDateToChange = (date: Date | undefined) => {
    setChatDateTo(date)
    if (date) {
      onChange({ ...filters, chatDateTo: date.toISOString() })
    } else {
      const { chatDateTo, ...rest } = filters
      onChange(rest)
    }
  }

  // Remove specific filter
  const removeFilter = (key: keyof ContactsFilters) => {
    if (key === 'search') {
      setSearchValue('')
    }
    if (key === 'chatDateFrom') {
      setChatDateFrom(undefined)
    }
    if (key === 'chatDateTo') {
      setChatDateTo(undefined)
    }
    const { [key]: _, ...rest } = filters
    onChange(rest)
  }

  return (
    <div className="space-y-3">
      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[250px] max-w-[400px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
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

        {/* Contact Type Filter */}
        <Select
          value={filters.contactType || 'all'}
          onValueChange={handleContactTypeChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* VIP Filter */}
        <Select
          value={getCurrentVIPFilterValue()}
          onValueChange={handleVIPFilterChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="VIP Status" />
          </SelectTrigger>
          <SelectContent>
            {VIP_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Chat Status Filter (Feature 010) */}
        <Select
          value={getCurrentChatStatusValue()}
          onValueChange={handleChatStatusChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Chat Status" />
          </SelectTrigger>
          <SelectContent>
            {CHAT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Chat Date From (Feature 010) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[150px] justify-start text-left font-normal",
                !chatDateFrom && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {chatDateFrom ? format(chatDateFrom, "MMM d, yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={chatDateFrom}
              onSelect={handleChatDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Chat Date To (Feature 010) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[150px] justify-start text-left font-normal",
                !chatDateTo && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {chatDateTo ? format(chatDateTo, "MMM d, yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={chatDateTo}
              onSelect={handleChatDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

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
          {filters.contactType && (
            <Badge variant="outline" className="gap-1">
              Type: {CONTACT_TYPE_OPTIONS.find(o => o.value === filters.contactType)?.label}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('contactType')}
              />
            </Badge>
          )}
          {filters.isVIP !== undefined && (
            <Badge variant="outline" className="gap-1">
              {filters.isVIP ? 'VIP Only' : 'Non-VIP Only'}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('isVIP')}
              />
            </Badge>
          )}
          {filters.chatStatus && filters.chatStatus.length > 0 && (
            <Badge variant="outline" className="gap-1">
              Chat: {CHAT_STATUS_OPTIONS.find(o => o.value === filters.chatStatus![0])?.label}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('chatStatus')}
              />
            </Badge>
          )}
          {filters.chatDateFrom && (
            <Badge variant="outline" className="gap-1">
              From: {format(new Date(filters.chatDateFrom), 'MMM d, yyyy')}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('chatDateFrom')}
              />
            </Badge>
          )}
          {filters.chatDateTo && (
            <Badge variant="outline" className="gap-1">
              To: {format(new Date(filters.chatDateTo), 'MMM d, yyyy')}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter('chatDateTo')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
