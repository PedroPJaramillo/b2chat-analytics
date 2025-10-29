/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  getColumnPreferences,
  setColumnPreferences,
  resetColumnPreferences,
} from '../column-preferences'
import {
  ColumnVisibilityState,
  DEFAULT_COLUMN_VISIBILITY,
} from '@/types/chat-view'

describe('Column Preferences Storage Utility', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('getColumnPreferences', () => {
    it('should return default preferences when localStorage is empty', () => {
      const preferences = getColumnPreferences()

      expect(preferences).toEqual(DEFAULT_COLUMN_VISIBILITY)
    })

    it('should return stored preferences when they exist', () => {
      const customPreferences: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: true,
        tags: true,
        messageCount: true,
      }

      localStorage.setItem(
        'b2chat-column-visibility',
        JSON.stringify(customPreferences)
      )

      const preferences = getColumnPreferences()

      expect(preferences).toEqual(customPreferences)
      expect(preferences.provider).toBe(true)
      expect(preferences.tags).toBe(true)
      expect(preferences.messageCount).toBe(true)
    })

    it('should merge stored preferences with defaults for new columns', () => {
      // Simulate old stored preferences missing new columns
      const oldPreferences = {
        id: true,
        contactName: true,
        status: true,
        agentName: true,
        responseTime: true,
        updatedAt: true,
      }

      localStorage.setItem(
        'b2chat-column-visibility',
        JSON.stringify(oldPreferences)
      )

      const preferences = getColumnPreferences()

      // Should have old preferences
      expect(preferences.id).toBe(true)
      expect(preferences.contactName).toBe(true)
      // Should also have new columns with default values
      expect(preferences.departmentName).toBe(DEFAULT_COLUMN_VISIBILITY.departmentName)
      expect(preferences.priority).toBe(DEFAULT_COLUMN_VISIBILITY.priority)
      expect(preferences.slaStatus).toBe(DEFAULT_COLUMN_VISIBILITY.slaStatus)
    })

    it('should return defaults when stored data is corrupted', () => {
      localStorage.setItem('b2chat-column-visibility', 'invalid-json{')

      const preferences = getColumnPreferences()

      expect(preferences).toEqual(DEFAULT_COLUMN_VISIBILITY)
    })

    it('should handle null values in localStorage gracefully', () => {
      localStorage.setItem('b2chat-column-visibility', 'null')

      const preferences = getColumnPreferences()

      expect(preferences).toEqual(DEFAULT_COLUMN_VISIBILITY)
    })
  })

  describe('setColumnPreferences', () => {
    it('should save preferences to localStorage', () => {
      const customPreferences: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: true,
        tags: true,
        topic: true,
      }

      setColumnPreferences(customPreferences)

      const stored = localStorage.getItem('b2chat-column-visibility')
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored!) as ColumnVisibilityState
      expect(parsed).toEqual(customPreferences)
      expect(parsed.provider).toBe(true)
      expect(parsed.tags).toBe(true)
      expect(parsed.topic).toBe(true)
    })

    it('should overwrite existing preferences', () => {
      const firstPreferences: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: true,
      }

      setColumnPreferences(firstPreferences)

      const secondPreferences: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: false,
        tags: true,
      }

      setColumnPreferences(secondPreferences)

      const stored = localStorage.getItem('b2chat-column-visibility')
      const parsed = JSON.parse(stored!) as ColumnVisibilityState

      expect(parsed.provider).toBe(false)
      expect(parsed.tags).toBe(true)
    })

    it('should handle localStorage quota errors gracefully', () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = jest.fn(() => {
        const error = new Error('QuotaExceededError')
        error.name = 'QuotaExceededError'
        throw error
      })

      // Should not throw
      expect(() => {
        setColumnPreferences(DEFAULT_COLUMN_VISIBILITY)
      }).not.toThrow()

      // Restore original setItem
      Storage.prototype.setItem = originalSetItem
    })
  })

  describe('resetColumnPreferences', () => {
    it('should remove preferences from localStorage', () => {
      const customPreferences: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: true,
        tags: true,
      }

      setColumnPreferences(customPreferences)

      // Verify it was saved
      expect(localStorage.getItem('b2chat-column-visibility')).not.toBeNull()

      resetColumnPreferences()

      // Verify it was removed
      expect(localStorage.getItem('b2chat-column-visibility')).toBeNull()
    })

    it('should not throw if preferences do not exist', () => {
      expect(() => {
        resetColumnPreferences()
      }).not.toThrow()
    })

    it('should result in default preferences when getting after reset', () => {
      const customPreferences: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: true,
        tags: true,
      }

      setColumnPreferences(customPreferences)
      resetColumnPreferences()

      const preferences = getColumnPreferences()

      expect(preferences).toEqual(DEFAULT_COLUMN_VISIBILITY)
      expect(preferences.provider).toBe(false) // Back to default
      expect(preferences.tags).toBe(false) // Back to default
    })
  })

  describe('Integration scenarios', () => {
    it('should handle full workflow: set, get, reset, get', () => {
      // Get initial (should be defaults)
      const initial = getColumnPreferences()
      expect(initial).toEqual(DEFAULT_COLUMN_VISIBILITY)

      // Set custom
      const custom: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: true,
        tags: true,
        messageCount: true,
      }
      setColumnPreferences(custom)

      // Get custom
      const retrieved = getColumnPreferences()
      expect(retrieved).toEqual(custom)

      // Reset
      resetColumnPreferences()

      // Get defaults again
      const afterReset = getColumnPreferences()
      expect(afterReset).toEqual(DEFAULT_COLUMN_VISIBILITY)
    })
  })
})
