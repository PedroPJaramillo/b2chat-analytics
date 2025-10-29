// Filter Bar Component for Chat Management

'use client'

import { Search, Filter, X, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useChatFilters } from '@/lib/hooks/use-chat-filters'
import { ViewMode } from '@/types/chat'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CHANNEL_OPTIONS,
  CONTACT_TYPE_OPTIONS,
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
} from '@/types/filters'
import { useEffect, useState } from 'react'
import { TagFilter } from './tag-filter'

interface FilterBarProps {
  viewMode: ViewMode
  agentOptions?: Array<{ value: string; label: string }>
}

export function FilterBar({ viewMode, agentOptions = [] }: FilterBarProps) {
  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useChatFilters()

  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [isOpen, setIsOpen] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        setFilter('search', searchValue)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue, filters.search, setFilter])

  // Agent options with default entries
  const agentSelectOptions = [
    { value: 'all', label: 'All Agents' },
    { value: 'unassigned', label: 'Unassigned' },
    ...agentOptions,
  ]

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-3">
        {/* Active Filter Pills (when collapsed) */}
        {hasActiveFilters && !isOpen && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.status && filters.status !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {STATUS_OPTIONS.find(o => o.value === filters.status)?.label}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFilter('status', 'all')
                  }}
                />
              </Badge>
            )}
            {filters.priority && filters.priority !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Priority: {PRIORITY_OPTIONS.find(o => o.value === filters.priority)?.label}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFilter('priority', 'all')
                  }}
                />
              </Badge>
            )}
            {filters.agent && filters.agent !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Agent: {agentSelectOptions.find(o => o.value === filters.agent)?.label}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFilter('agent', 'all')
                  }}
                />
              </Badge>
            )}
            {filters.channel && filters.channel !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Channel: {CHANNEL_OPTIONS.find(o => o.value === filters.channel)?.label}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFilter('channel', 'all')
                  }}
                />
              </Badge>
            )}
            {filters.search && (
              <Badge variant="secondary" className="gap-1">
                Search: &ldquo;{filters.search}&rdquo;
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSearchValue('')
                    setFilter('search', '')
                  }}
                />
              </Badge>
            )}
            {/* Temporal filters badge */}
            {(filters.weekStart || filters.dayOfWeek !== undefined || filters.hourOfDay !== undefined) && (
              <Badge variant="default" className="gap-1 bg-blue-500">
                Time Filter Active
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFilter('weekStart', undefined)
                    setFilter('dayOfWeek', undefined)
                    setFilter('hourOfDay', undefined)
                  }}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Toggle Button */}
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              {isOpen ? 'Hide Filters' : `Show Filters${hasActiveFilters ? ` (${activeFilterCount})` : ''}`}
              {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
          </CollapsibleTrigger>

          {/* Reset Button */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {/* Expanded Filter UI */}
        <CollapsibleContent className="space-y-4">
          {/* Primary Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, agent, alias, tags, or topic..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Status Filter */}
            <Select value={filters.status || 'all'} onValueChange={(value) => setFilter('status', value)}>
              <SelectTrigger className="w-[160px]">
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

            {/* Priority Filter */}
            <Select
              value={filters.priority || 'all'}
              onValueChange={(value) => setFilter('priority', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Agent Filter */}
            <Select value={filters.agent || 'all'} onValueChange={(value) => setFilter('agent', value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                {agentSelectOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Channel Filter */}
            <Select
              value={filters.channel || 'all'}
              onValueChange={(value) => setFilter('channel', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Secondary Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Contact Type Filter - Only in Contact View */}
            {viewMode === 'contact' && (
              <Select
                value={filters.contactType || 'all'}
                onValueChange={(value) => setFilter('contactType', value)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Contact Type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Date Range Filter */}
            <Select
              value={filters.dateRange || 'all'}
              onValueChange={(value) => setFilter('dateRange', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort By with Direction Toggle */}
            {viewMode !== 'messages' && (
              <div className="flex items-center gap-1">
                <Select
                  value={filters.sortBy || 'lastActivity'}
                  onValueChange={(value) => setFilter('sortBy', value)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="h-10 w-10 shrink-0"
                  title={filters.sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
                >
                  {filters.sortOrder === 'asc' ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Unread Only Toggle */}
            {viewMode !== 'messages' && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="unread-only"
                  checked={filters.unreadOnly || false}
                  onCheckedChange={(checked) => setFilter('unreadOnly', checked)}
                />
                <Label htmlFor="unread-only" className="text-sm cursor-pointer">
                  Unread Only
                </Label>
              </div>
            )}
          </div>

          {/* Tag Filter */}
          <TagFilter />
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
