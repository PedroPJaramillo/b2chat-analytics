// Column Preferences Storage Utility - Feature 011
// Manages localStorage persistence for chat view column visibility

import {
  ColumnVisibilityState,
  DEFAULT_COLUMN_VISIBILITY,
} from '@/types/chat-view'

const STORAGE_KEY = 'b2chat-column-visibility'

/**
 * Retrieves column visibility preferences from localStorage
 * Returns default visibility if no preferences exist or if data is corrupted
 */
export function getColumnPreferences(): ColumnVisibilityState {
  if (typeof window === 'undefined') {
    return DEFAULT_COLUMN_VISIBILITY
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return DEFAULT_COLUMN_VISIBILITY
    }

    const parsed = JSON.parse(stored) as Partial<ColumnVisibilityState>

    // Merge with defaults to handle new columns added in future updates
    return {
      ...DEFAULT_COLUMN_VISIBILITY,
      ...parsed,
    }
  } catch (error) {
    console.error('Failed to parse column preferences from localStorage:', error)
    return DEFAULT_COLUMN_VISIBILITY
  }
}

/**
 * Saves column visibility preferences to localStorage
 * Handles errors gracefully and logs failures
 */
export function setColumnPreferences(
  preferences: ColumnVisibilityState
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.error('Failed to save column preferences to localStorage:', error)
  }
}

/**
 * Resets column preferences to default values
 */
export function resetColumnPreferences(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to reset column preferences:', error)
  }
}
