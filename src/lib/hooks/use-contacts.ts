"use client"

import { useQuery } from '@tanstack/react-query'
import {
  ContactsResponse,
  ContactsFilters,
  ContactsSorting
} from '@/types/contact'

interface UseContactsOptions {
  filters?: ContactsFilters
  sorting?: ContactsSorting
  page?: number
  limit?: number
}

/**
 * Build query string from filters, sorting, and pagination
 */
function buildContactsQueryString(
  filters: ContactsFilters = {},
  sorting: ContactsSorting = { sortBy: 'createdAt', sortOrder: 'desc' },
  page: number = 1,
  limit: number = 100
): string {
  const params = new URLSearchParams()

  // Pagination
  params.append('page', page.toString())
  params.append('limit', limit.toString())

  // Search
  if (filters.search) {
    params.append('search', filters.search)
  }

  // Tags filter (comma-separated)
  if (filters.tags && filters.tags.length > 0) {
    params.append('tags', filters.tags.join(','))
  }

  // VIP filter
  if (filters.isVIP !== undefined) {
    params.append('isVIP', filters.isVIP.toString())
  }

  // Contact type filter
  if (filters.contactType) {
    params.append('contactType', filters.contactType)
  }

  // Merchant ID filter
  if (filters.merchantId) {
    params.append('merchantId', filters.merchantId)
  }

  // Date range filters
  if (filters.createdAfter) {
    params.append('createdAfter', filters.createdAfter.toISOString())
  }
  if (filters.createdBefore) {
    params.append('createdBefore', filters.createdBefore.toISOString())
  }
  if (filters.updatedAfter) {
    params.append('updatedAfter', filters.updatedAfter.toISOString())
  }
  if (filters.updatedBefore) {
    params.append('updatedBefore', filters.updatedBefore.toISOString())
  }

  // Sorting
  params.append('sortBy', sorting.sortBy)
  params.append('sortOrder', sorting.sortOrder)

  return params.toString()
}

/**
 * Fetch contacts from API
 */
async function fetchContacts(
  filters: ContactsFilters = {},
  sorting: ContactsSorting = { sortBy: 'createdAt', sortOrder: 'desc' },
  page: number = 1,
  limit: number = 100
): Promise<ContactsResponse> {
  const queryString = buildContactsQueryString(filters, sorting, page, limit)
  const response = await fetch(`/api/contacts?${queryString}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch contacts: ${response.statusText}`)
  }

  return response.json()
}

/**
 * React Query hook for fetching contacts with filters, sorting, and pagination
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useContacts({
 *   filters: { search: 'john', isVIP: true },
 *   sorting: { sortBy: 'fullName', sortOrder: 'asc' },
 *   page: 1,
 *   limit: 100
 * })
 * ```
 */
export function useContacts(options: UseContactsOptions = {}) {
  const {
    filters = {},
    sorting = { sortBy: 'createdAt', sortOrder: 'desc' },
    page = 1,
    limit = 100
  } = options

  return useQuery<ContactsResponse, Error>({
    queryKey: ['contacts', filters, sorting, page, limit],
    queryFn: () => fetchContacts(filters, sorting, page, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
  })
}

/**
 * Helper function to get available tags from contacts data
 * Used for populating tag filter dropdown
 */
export function extractAvailableTags(contacts: ContactsResponse['contacts']): string[] {
  const tagsSet = new Set<string>()

  contacts.forEach(contact => {
    if (contact.tags) {
      contact.tags.forEach(tag => {
        tagsSet.add(tag.name)
      })
    }
  })

  return Array.from(tagsSet).sort()
}
