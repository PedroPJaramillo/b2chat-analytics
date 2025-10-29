// Custom hook for managing chat filters with URL persistence

'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { ChatFilters, DEFAULT_FILTERS } from '@/types/filters'
import { ChatPriority, ChatStatus, ChatProvider } from '@/types/chat'

/**
 * Hook to manage chat filters with URL synchronization
 */
export function useChatFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /**
   * Parse filters from URL search params
   */
  const filters = useMemo<ChatFilters>(() => {
    // Parse temporal filters from URL
    const weekStart = searchParams.get('weekStart') || undefined
    const dayOfWeekParam = searchParams.get('dayOfWeek')
    const hourOfDayParam = searchParams.get('hourOfDay')

    return {
      status: (searchParams.get('status') as ChatStatus | 'all') || DEFAULT_FILTERS.status,
      priority: (searchParams.get('priority') as ChatPriority | 'all') || DEFAULT_FILTERS.priority,
      agent: searchParams.get('agent') || DEFAULT_FILTERS.agent,
      channel: (searchParams.get('channel') as ChatProvider | 'all') || DEFAULT_FILTERS.channel,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || DEFAULT_FILTERS.tags,
      dateRange: (searchParams.get('dateRange') as any) || DEFAULT_FILTERS.dateRange,
      search: searchParams.get('search') || DEFAULT_FILTERS.search,
      contactType: (searchParams.get('contactType') as any) || DEFAULT_FILTERS.contactType,
      messageType: (searchParams.get('messageType') as any) || DEFAULT_FILTERS.messageType,
      unreadOnly: searchParams.get('unreadOnly') === 'true',
      sortBy: (searchParams.get('sortBy') as any) || DEFAULT_FILTERS.sortBy,
      sortOrder: (searchParams.get('sortOrder') as any) || DEFAULT_FILTERS.sortOrder,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      // Temporal filters for analytics drill-down
      weekStart,
      dayOfWeek: dayOfWeekParam ? parseInt(dayOfWeekParam) : undefined,
      hourOfDay: hourOfDayParam ? parseInt(hourOfDayParam) : undefined,
    }
  }, [searchParams])

  /**
   * Update filters and sync to URL
   */
  const setFilters = useCallback(
    (updates: Partial<ChatFilters>) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || value === 'all') {
          params.delete(key)
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            params.delete(key)
          } else {
            params.set(key, value.join(','))
          }
        } else if (typeof value === 'boolean') {
          if (value) {
            params.set(key, 'true')
          } else {
            params.delete(key)
          }
        } else {
          params.set(key, String(value))
        }
      })

      // Reset to page 1 when filters change (except when explicitly setting page)
      if (!('page' in updates)) {
        params.set('page', '1')
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  /**
   * Reset all filters to defaults
   */
  const resetFilters = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  /**
   * Update a single filter value
   */
  const setFilter = useCallback(
    (key: keyof ChatFilters, value: any) => {
      setFilters({ [key]: value })
    },
    [setFilters]
  )

  /**
   * Add a tag to the filter
   */
  const addTag = useCallback(
    (tag: string) => {
      const currentTags = filters.tags || []
      if (!currentTags.includes(tag)) {
        setFilters({ tags: [...currentTags, tag] })
      }
    },
    [filters.tags, setFilters]
  )

  /**
   * Remove a tag from the filter
   */
  const removeTag = useCallback(
    (tag: string) => {
      const currentTags = filters.tags || []
      setFilters({ tags: currentTags.filter(t => t !== tag) })
    },
    [filters.tags, setFilters]
  )

  /**
   * Clear all tags
   */
  const clearTags = useCallback(() => {
    setFilters({ tags: [] })
  }, [setFilters])

  /**
   * Toggle a tag on/off
   */
  const toggleTag = useCallback(
    (tag: string) => {
      const currentTags = filters.tags || []
      if (currentTags.includes(tag)) {
        removeTag(tag)
      } else {
        addTag(tag)
      }
    },
    [filters.tags, addTag, removeTag]
  )

  /**
   * Check if filters are active (different from defaults)
   */
  const hasActiveFilters = useMemo(() => {
    return (
      filters.status !== DEFAULT_FILTERS.status ||
      filters.priority !== DEFAULT_FILTERS.priority ||
      filters.agent !== DEFAULT_FILTERS.agent ||
      filters.channel !== DEFAULT_FILTERS.channel ||
      (filters.tags && filters.tags.length > 0) ||
      filters.dateRange !== DEFAULT_FILTERS.dateRange ||
      (filters.search && filters.search.length > 0) ||
      filters.contactType !== DEFAULT_FILTERS.contactType ||
      filters.messageType !== DEFAULT_FILTERS.messageType ||
      filters.unreadOnly ||
      filters.weekStart !== undefined ||
      filters.dayOfWeek !== undefined ||
      filters.hourOfDay !== undefined
    )
  }, [filters])

  /**
   * Count active filters
   */
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.status !== DEFAULT_FILTERS.status) count++
    if (filters.priority !== DEFAULT_FILTERS.priority) count++
    if (filters.agent !== DEFAULT_FILTERS.agent) count++
    if (filters.channel !== DEFAULT_FILTERS.channel) count++
    if (filters.tags && filters.tags.length > 0) count++
    if (filters.dateRange !== DEFAULT_FILTERS.dateRange) count++
    if (filters.search && filters.search.length > 0) count++
    if (filters.contactType !== DEFAULT_FILTERS.contactType) count++
    if (filters.messageType !== DEFAULT_FILTERS.messageType) count++
    if (filters.unreadOnly) count++
    // Temporal filters count as one combined filter
    if (filters.weekStart || filters.dayOfWeek !== undefined || filters.hourOfDay !== undefined) count++
    return count
  }, [filters])

  return {
    filters,
    setFilters,
    setFilter,
    resetFilters,
    addTag,
    removeTag,
    clearTags,
    toggleTag,
    hasActiveFilters,
    activeFilterCount,
  }
}
