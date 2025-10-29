// Chat View Filters Component (Feature 008, enhanced by Feature 011, Feature 015)

'use client'

import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
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
import { DateRangePicker, DateRange } from '@/components/ui/date-range-picker'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import type { ChatViewFilters, ChatViewStats } from '@/types/chat-view'
import type { ChatStatus, ChatPriority, ChatProvider } from '@/types/chat'
import { useEffect, useState, useMemo } from 'react'

interface ChatViewFiltersProps {
  filters: ChatViewFilters
  onChange: (filters: ChatViewFilters) => void
  stats?: ChatViewStats
}

// Status options
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'BOT_CHATTING', label: 'Bot Chatting' },
  { value: 'OPENED', label: 'Opened' },
  { value: 'PICKED_UP', label: 'Picked Up' },
  { value: 'RESPONDED_BY_AGENT', label: 'Responded' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'COMPLETING_POLL', label: 'Completing Poll' },
  { value: 'COMPLETED_POLL', label: 'Completed Poll' },
  { value: 'ABANDONED_POLL', label: 'Abandoned Poll' },
]

// Priority options (Feature 011)
const PRIORITY_OPTIONS: { value: ChatPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

// SLA Status options (Feature 011)
const SLA_OPTIONS: { value: 'all' | 'within' | 'breached'; label: string }[] = [
  { value: 'all', label: 'All SLA Status' },
  { value: 'within', label: 'Within SLA' },
  { value: 'breached', label: 'Breached SLA' },
]

// Provider options (Feature 011)
const PROVIDER_OPTIONS: { value: ChatProvider | 'all'; label: string }[] = [
  { value: 'all', label: 'All Providers' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'livechat', label: 'Live Chat' },
  { value: 'b2cbotapi', label: 'B2C Bot API' },
]

// Message count range options (Feature 011)
const MESSAGE_COUNT_OPTIONS = [
  { value: 'all', label: 'All Messages' },
  { value: '0', label: '0 messages' },
  { value: '1-5', label: '1-5 messages' },
  { value: '6-10', label: '6-10 messages' },
  { value: '11-20', label: '11-20 messages' },
  { value: '20+', label: '20+ messages' },
]

export function ChatViewFilters({ filters, onChange, stats }: ChatViewFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '')

  // Validation errors (Feature 011: Chunk 8)
  const [responseTimeError, setResponseTimeError] = useState<string | null>(null)
  const [createdAtError, setCreatedAtError] = useState<string | null>(null)
  const [updatedAtError, setUpdatedAtError] = useState<string | null>(null)

  // Advanced filters collapse state (Feature 015: Chunk 1)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('chat-view-advanced-filters-open')
      return stored === 'true'
    }
    return false
  })

  // Persist advanced filters state to localStorage (Feature 015: Chunk 1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chat-view-advanced-filters-open', String(advancedFiltersOpen))
    }
  }, [advancedFiltersOpen])

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onChange({ ...filters, search: searchValue || undefined })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue])

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return value && value.length > 0
    if (key === 'status') return value && value.length > 0
    if (key === 'priorityFilter') return value && value.length > 0
    if (key === 'providerFilter') return value && value.length > 0
    return value !== undefined
  }).length

  // Count active advanced filters (Feature 015: Chunk 1)
  const activeAdvancedFilterCount = Object.entries(filters).filter(([key, value]) => {
    // Advanced filter keys: departmentId, slaStatus, providerFilter, messageCountRange, updatedAtRange, responseTimeMin, responseTimeMax
    const advancedKeys = ['departmentId', 'slaStatus', 'providerFilter', 'messageCountRange', 'updatedAtRange', 'responseTimeMin', 'responseTimeMax']
    if (!advancedKeys.includes(key)) return false
    if (key === 'providerFilter') return value && value.length > 0
    return value !== undefined
  }).length

  // Reset all filters
  const handleReset = () => {
    setSearchValue('')
    // Clear all validation errors (Feature 011: Chunk 8)
    setResponseTimeError(null)
    setCreatedAtError(null)
    setUpdatedAtError(null)
    onChange({})
  }

  // Update status filter (Feature 015: Chunk 4 - Multi-select)
  const handleStatusChange = (values: string[]) => {
    if (values.length === 0) {
      const { status, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        status: values as ChatStatus[]
      })
    }
  }

  // Update agent filter
  const handleAgentFilterChange = (value: string) => {
    if (value === 'all') {
      const { agentId, ...rest } = filters
      onChange(rest)
    } else {
      onChange({ ...filters, agentId: value })
    }
  }

  // Update department filter (Feature 011)
  const handleDepartmentChange = (value: string) => {
    if (value === 'all') {
      const { departmentId, ...rest } = filters
      onChange(rest)
    } else {
      onChange({ ...filters, departmentId: value })
    }
  }

  // Update priority filter (Feature 015: Chunk 4 - Multi-select)
  const handlePriorityChange = (values: string[]) => {
    if (values.length === 0) {
      const { priorityFilter, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        priorityFilter: values as ChatPriority[]
      })
    }
  }

  // Update SLA status filter (Feature 011)
  const handleSLAStatusChange = (value: string) => {
    if (value === 'all') {
      const { slaStatus, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        slaStatus: value as 'within' | 'breached'
      })
    }
  }

  // Update provider filter (Feature 015: Chunk 4 - Multi-select)
  const handleProviderChange = (values: string[]) => {
    if (values.length === 0) {
      const { providerFilter, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        providerFilter: values as ChatProvider[]
      })
    }
  }

  // Prepare multi-select options with stats (Feature 015: Chunk 4)
  const statusOptions: MultiSelectOption[] = useMemo(() => {
    return [
      { value: 'BOT_CHATTING', label: 'Bot Chatting', count: stats?.byStatus?.BOT_CHATTING },
      { value: 'OPENED', label: 'Opened', count: stats?.byStatus?.OPENED },
      { value: 'PICKED_UP', label: 'Picked Up', count: stats?.byStatus?.PICKED_UP },
      { value: 'RESPONDED_BY_AGENT', label: 'Responded', count: stats?.byStatus?.RESPONDED_BY_AGENT },
      { value: 'CLOSED', label: 'Closed', count: stats?.byStatus?.CLOSED },
      { value: 'COMPLETING_POLL', label: 'Completing Poll', count: stats?.byStatus?.COMPLETING_POLL },
      { value: 'COMPLETED_POLL', label: 'Completed Poll', count: stats?.byStatus?.COMPLETED_POLL },
      { value: 'ABANDONED_POLL', label: 'Abandoned Poll', count: stats?.byStatus?.ABANDONED_POLL },
    ].filter(opt => opt.count !== undefined && opt.count > 0) // Only show statuses with data
  }, [stats])

  const priorityOptions: MultiSelectOption[] = useMemo(() => {
    return [
      { value: 'urgent', label: 'Urgent', count: stats?.byPriority?.urgent },
      { value: 'high', label: 'High', count: stats?.byPriority?.high },
      { value: 'normal', label: 'Normal', count: stats?.byPriority?.normal },
      { value: 'low', label: 'Low', count: stats?.byPriority?.low },
    ].filter(opt => opt.count !== undefined && opt.count > 0)
  }, [stats])

  const providerOptions: MultiSelectOption[] = useMemo(() => {
    return [
      { value: 'whatsapp', label: 'WhatsApp', count: stats?.byProvider?.whatsapp },
      { value: 'telegram', label: 'Telegram', count: stats?.byProvider?.telegram },
      { value: 'facebook', label: 'Facebook', count: stats?.byProvider?.facebook },
      { value: 'livechat', label: 'Live Chat', count: stats?.byProvider?.livechat },
      { value: 'b2cbotapi', label: 'B2C Bot API', count: stats?.byProvider?.b2cbotapi },
    ].filter(opt => opt.count !== undefined && opt.count > 0)
  }, [stats])

  // Update message count range (Feature 011)
  const handleMessageCountChange = (value: string) => {
    if (value === 'all') {
      const { messageCountRange, ...rest } = filters
      onChange(rest)
    } else {
      onChange({
        ...filters,
        messageCountRange: value as '0' | '1-5' | '6-10' | '11-20' | '20+'
      })
    }
  }

  // Update created at date range (Feature 011)
  const handleCreatedAtChange = (range: DateRange | undefined) => {
    if (!range) {
      setCreatedAtError(null)
      const { createdAtRange, ...rest } = filters
      onChange(rest)
    } else {
      // Validate: start date should not be after end date
      if (range.start && range.end && range.start > range.end) {
        setCreatedAtError('Start date cannot be after end date')
        return
      }

      setCreatedAtError(null)
      onChange({
        ...filters,
        createdAtRange: range
      })
    }
  }

  // Update updated at date range (Feature 011)
  const handleUpdatedAtChange = (range: DateRange | undefined) => {
    if (!range) {
      setUpdatedAtError(null)
      const { updatedAtRange, ...rest } = filters
      onChange(rest)
    } else {
      // Validate: start date should not be after end date
      if (range.start && range.end && range.start > range.end) {
        setUpdatedAtError('Start date cannot be after end date')
        return
      }

      setUpdatedAtError(null)
      onChange({
        ...filters,
        updatedAtRange: range
      })
    }
  }

  // Update response time min (Feature 011)
  const handleResponseTimeMinChange = (value: string) => {
    const minutes = value ? parseInt(value, 10) : undefined
    const newMin = minutes ? minutes * 60000 : undefined

    // Validate: min should not be greater than max
    if (newMin !== undefined && filters.responseTimeMax !== undefined && newMin > filters.responseTimeMax) {
      setResponseTimeError('Min response time cannot be greater than max')
      return
    }

    setResponseTimeError(null)
    onChange({
      ...filters,
      responseTimeMin: newMin
    })
  }

  // Update response time max (Feature 011)
  const handleResponseTimeMaxChange = (value: string) => {
    const minutes = value ? parseInt(value, 10) : undefined
    const newMax = minutes ? minutes * 60000 : undefined

    // Validate: max should not be less than min
    if (newMax !== undefined && filters.responseTimeMin !== undefined && newMax < filters.responseTimeMin) {
      setResponseTimeError('Max response time cannot be less than min')
      return
    }

    setResponseTimeError(null)
    onChange({
      ...filters,
      responseTimeMax: newMax
    })
  }

  // Remove specific filter
  const removeFilter = (key: keyof ChatViewFilters) => {
    if (key === 'search') {
      setSearchValue('')
    }

    // Clear validation errors when removing related filters (Feature 011: Chunk 8)
    if (key === 'responseTimeMin' || key === 'responseTimeMax') {
      setResponseTimeError(null)
    }
    if (key === 'createdAtRange') {
      setCreatedAtError(null)
    }
    if (key === 'updatedAtRange') {
      setUpdatedAtError(null)
    }

    const { [key]: _, ...rest } = filters
    onChange(rest as ChatViewFilters)
  }

  // Get stat count for display
  const getStatCount = (key: string, value: any): string | null => {
    if (!stats) return null

    try {
      if (key === 'status') {
        return stats.byStatus[value as ChatStatus]?.toString() || null
      }
      if (key === 'priority') {
        return stats.byPriority[value as ChatPriority]?.toString() || null
      }
      if (key === 'provider') {
        return stats.byProvider[value as ChatProvider]?.toString() || null
      }
      if (key === 'messageCount') {
        return stats.byMessageCount[value as keyof typeof stats.byMessageCount]?.toString() || null
      }
    } catch {
      return null
    }

    return null
  }

  return (
    <div className="space-y-3">
      {/* Primary Filter Controls - Row 1 (Feature 015: Chunk 1) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-[350px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by contact name..."
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

        {/* Status Filter - Multi-select (Feature 015: Chunk 4) */}
        <MultiSelect
          options={statusOptions}
          value={filters.status || []}
          onChange={handleStatusChange}
          placeholder="Status"
          className="w-[180px]"
          emptyText="No statuses available"
        />

        {/* Agent Filter */}
        <Select
          value={filters.agentId || 'all'}
          onValueChange={handleAgentFilterChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="unassigned">
              Unassigned
              {stats?.byAgent?.unassigned !== undefined && (
                <span className="ml-2 text-muted-foreground text-xs">
                  ({stats.byAgent.unassigned})
                </span>
              )}
            </SelectItem>
            {/* Additional agents from stats */}
            {stats?.byAgent && Object.entries(stats.byAgent)
              .filter(([key]) => key !== 'unassigned')
              .map(([agentId, data]) => (
                <SelectItem key={agentId} value={agentId}>
                  {typeof data === 'object' ? data.name : agentId}
                  {typeof data === 'object' && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({data.count})
                    </span>
                  )}
                </SelectItem>
              ))
            }
          </SelectContent>
        </Select>

        {/* Priority Filter - Multi-select (Feature 015: Chunk 4) */}
        <MultiSelect
          options={priorityOptions}
          value={filters.priorityFilter || []}
          onChange={handlePriorityChange}
          placeholder="Priority"
          className="w-[160px]"
          emptyText="No priorities available"
        />

        {/* Created At Date Range */}
        <div className="flex flex-col">
          <DateRangePicker
            value={filters.createdAtRange}
            onChange={handleCreatedAtChange}
            placeholder="Created At"
            className="w-[200px]"
          />
          {createdAtError && (
            <span className="text-xs text-destructive mt-1">{createdAtError}</span>
          )}
        </div>

        {/* Reset Filters Button */}
        {activeFilterCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1 ml-auto"
          >
            <X className="h-4 w-4" />
            Clear {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
          </Button>
        )}
      </div>

      {/* Advanced Filters Collapsible Section (Feature 015: Chunk 1) */}
      <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {advancedFiltersOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Advanced Filters
              {activeAdvancedFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeAdvancedFilterCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="space-y-3 pt-3">
          {/* Advanced Filter Controls - Row 2 (Feature 011) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Department Filter */}
            <Select
              value={filters.departmentId || 'all'}
              onValueChange={handleDepartmentChange}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {stats?.byDepartment && Object.entries(stats.byDepartment).map(([deptId, data]) => (
                  <SelectItem key={deptId} value={deptId}>
                    {data.name}
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({data.count})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* SLA Status Filter */}
            <Select
              value={filters.slaStatus || 'all'}
              onValueChange={handleSLAStatusChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="SLA Status" />
              </SelectTrigger>
              <SelectContent>
                {SLA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.value !== 'all' && stats?.bySLA && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({stats.bySLA[option.value]})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Provider Filter - Multi-select (Feature 015: Chunk 4) */}
            <MultiSelect
              options={providerOptions}
              value={filters.providerFilter || []}
              onChange={handleProviderChange}
              placeholder="Provider"
              className="w-[170px]"
              emptyText="No providers available"
            />

            {/* Message Count Range */}
            <Select
              value={filters.messageCountRange || 'all'}
              onValueChange={handleMessageCountChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Messages" />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_COUNT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.value !== 'all' && getStatCount('messageCount', option.value) && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({getStatCount('messageCount', option.value)})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Updated At Date Range */}
            <div className="flex flex-col">
              <DateRangePicker
                value={filters.updatedAtRange}
                onChange={handleUpdatedAtChange}
                placeholder="Updated At"
                className="w-[200px]"
              />
              {updatedAtError && (
                <span className="text-xs text-destructive mt-1">{updatedAtError}</span>
              )}
            </div>
          </div>

          {/* Advanced Filter Controls - Row 3: Response Time Range (Feature 011) */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm text-muted-foreground">Response Time (minutes):</div>
              <Input
                type="number"
                placeholder="Min"
                value={filters.responseTimeMin ? (filters.responseTimeMin / 60000).toString() : ''}
                onChange={(e) => handleResponseTimeMinChange(e.target.value)}
                className="w-[100px]"
                min="0"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.responseTimeMax ? (filters.responseTimeMax / 60000).toString() : ''}
                onChange={(e) => handleResponseTimeMaxChange(e.target.value)}
                className="w-[100px]"
                min="0"
              />
            </div>

            {/* Response Time Validation Error */}
            {responseTimeError && (
              <span className="text-xs text-destructive">{responseTimeError}</span>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active Filters Pills (Feature 011 - Enhanced) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <button
                onClick={() => removeFilter('search')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.status && filters.status.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status.length === 1
                ? statusOptions.find(o => o.value === filters.status![0])?.label
                : `${filters.status.length} selected`}
              <button
                onClick={() => removeFilter('status')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.agentId && filters.agentId !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Agent: {filters.agentId === 'unassigned' ? 'Unassigned' : filters.agentId}
              <button
                onClick={() => removeFilter('agentId')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.departmentId && (
            <Badge variant="secondary" className="gap-1">
              Department: {stats?.byDepartment?.[filters.departmentId]?.name || filters.departmentId}
              <button
                onClick={() => removeFilter('departmentId')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.priorityFilter && filters.priorityFilter.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Priority: {filters.priorityFilter.length === 1
                ? priorityOptions.find(o => o.value === filters.priorityFilter![0])?.label
                : `${filters.priorityFilter.length} selected`}
              <button
                onClick={() => removeFilter('priorityFilter')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.slaStatus && (
            <Badge variant="secondary" className="gap-1">
              SLA: {SLA_OPTIONS.find(o => o.value === filters.slaStatus)?.label}
              <button
                onClick={() => removeFilter('slaStatus')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.providerFilter && filters.providerFilter.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Provider: {filters.providerFilter.length === 1
                ? providerOptions.find(o => o.value === filters.providerFilter![0])?.label
                : `${filters.providerFilter.length} selected`}
              <button
                onClick={() => removeFilter('providerFilter')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.messageCountRange && (
            <Badge variant="secondary" className="gap-1">
              Messages: {MESSAGE_COUNT_OPTIONS.find(o => o.value === filters.messageCountRange)?.label}
              <button
                onClick={() => removeFilter('messageCountRange')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.createdAtRange && (
            <Badge variant="secondary" className="gap-1">
              Created: {filters.createdAtRange.start.toLocaleDateString()} - {filters.createdAtRange.end.toLocaleDateString()}
              <button
                onClick={() => removeFilter('createdAtRange')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.updatedAtRange && (
            <Badge variant="secondary" className="gap-1">
              Updated: {filters.updatedAtRange.start.toLocaleDateString()} - {filters.updatedAtRange.end.toLocaleDateString()}
              <button
                onClick={() => removeFilter('updatedAtRange')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.responseTimeMin !== undefined || filters.responseTimeMax !== undefined) && (
            <Badge variant="secondary" className="gap-1">
              Response Time: {filters.responseTimeMin !== undefined ? `${filters.responseTimeMin / 60000}min` : '∞'} - {filters.responseTimeMax !== undefined ? `${filters.responseTimeMax / 60000}min` : '∞'}
              <button
                onClick={() => {
                  const { responseTimeMin, responseTimeMax, ...rest } = filters
                  onChange(rest)
                }}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
