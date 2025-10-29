import { render, screen } from '@testing-library/react'
import React from 'react'
import { ColumnSelector } from '../column-selector'
import { DEFAULT_COLUMN_VISIBILITY } from '@/types/chat-view'
import type { ColumnVisibilityState } from '@/types/chat-view'
import * as columnPreferences from '@/lib/storage/column-preferences'

// Mock scrollIntoView for Radix UI Dropdown components
Element.prototype.scrollIntoView = jest.fn()

// Mock column preferences module
jest.mock('@/lib/storage/column-preferences', () => ({
  getColumnPreferences: jest.fn(),
  setColumnPreferences: jest.fn(),
  resetColumnPreferences: jest.fn(),
}))

describe('ColumnSelector', () => {
  const mockOnVisibilityChange = jest.fn()

  const mockVisibility: ColumnVisibilityState = {
    ...DEFAULT_COLUMN_VISIBILITY,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render Columns button', () => {
      render(
        <ColumnSelector
          columnVisibility={mockVisibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument()
    })

    it('should show hidden count when columns are hidden', () => {
      const visibility = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: false,
        tags: false,
        topic: false,
      }

      render(
        <ColumnSelector
          columnVisibility={visibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      expect(screen.getByText(/3 hidden/)).toBeInTheDocument()
    })

    it('should show correct hidden count', () => {
      const visibility = Object.keys(DEFAULT_COLUMN_VISIBILITY).reduce(
        (acc, key) => ({ ...acc, [key]: false }),
        {} as ColumnVisibilityState
      )

      render(
        <ColumnSelector
          columnVisibility={visibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      // All columns are hidden (23 columns total based on ColumnVisibilityState)
      const hiddenCount = Object.keys(DEFAULT_COLUMN_VISIBILITY).length
      expect(screen.getByText(new RegExp(`${hiddenCount} hidden`))).toBeInTheDocument()
    })

    it('should not show hidden count when all columns visible', () => {
      const allVisible = Object.keys(DEFAULT_COLUMN_VISIBILITY).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as ColumnVisibilityState
      )

      render(
        <ColumnSelector
          columnVisibility={allVisible}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      expect(screen.queryByText(/hidden/)).not.toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <ColumnSelector
          columnVisibility={mockVisibility}
          onVisibilityChange={mockOnVisibilityChange}
          className="custom-class"
        />
      )

      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })
  })

  describe('Component Integration', () => {
    it('should accept columnVisibility prop', () => {
      const visibility: ColumnVisibilityState = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: true,
        tags: true,
      }

      render(
        <ColumnSelector
          columnVisibility={visibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      // Component renders successfully with custom visibility
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should accept onVisibilityChange callback', () => {
      render(
        <ColumnSelector
          columnVisibility={mockVisibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      // Component renders successfully with callback
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('Hidden Count Calculation', () => {
    it('should calculate hidden count correctly with one hidden column', () => {
      const visibility = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: false,
      }

      render(
        <ColumnSelector
          columnVisibility={visibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      // Count hidden columns in default visibility (provider defaults to false, so we need to check other hidden ones)
      const defaultHidden = Object.values(DEFAULT_COLUMN_VISIBILITY).filter(v => !v).length
      expect(screen.getByText(new RegExp(`${defaultHidden} hidden`))).toBeInTheDocument()
    })

    it('should calculate hidden count correctly with multiple hidden columns', () => {
      const visibility = {
        ...DEFAULT_COLUMN_VISIBILITY,
        provider: false,
        tags: false,
        topic: false,
        unreadCount: false,
        messageCount: false,
      }

      render(
        <ColumnSelector
          columnVisibility={visibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      const hiddenCount = Object.values(visibility).filter(v => !v).length
      expect(screen.getByText(new RegExp(`${hiddenCount} hidden`))).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle', () => {
    it('should render without crashing with minimal props', () => {
      render(
        <ColumnSelector
          columnVisibility={DEFAULT_COLUMN_VISIBILITY}
          onVisibilityChange={jest.fn()}
        />
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle undefined optional className', () => {
      render(
        <ColumnSelector
          columnVisibility={mockVisibility}
          onVisibilityChange={mockOnVisibilityChange}
        />
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })
})
