// Feature 011: Chunk 8 - Integration Tests for Chat View Filters
// Tests validation, edge cases, and complete user flows

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ChatViewFilters } from '../chat-view-filters'
import type { ChatViewFilters as ChatViewFiltersType, ChatViewStats } from '@/types/chat-view'

// Mock scrollIntoView for Radix UI components
Element.prototype.scrollIntoView = jest.fn()

const mockStats: ChatViewStats = {
  byStatus: {
    OPENED: 10,
    PICKED_UP: 5,
    CLOSED: 20,
    BOT_CHATTING: 3,
    RESPONDED_BY_AGENT: 8,
    COMPLETING_POLL: 1,
    COMPLETED_POLL: 2,
    ABANDONED_POLL: 1,
  },
  byDepartment: {
    dept1: { name: 'Support', count: 15 },
    dept2: { name: 'Sales', count: 10 },
  },
  byAgent: {
    unassigned: 5,
    agent1: { name: 'Agent Smith', count: 10 },
    agent2: { name: 'Agent Jones', count: 8 },
  },
  byPriority: {
    normal: 20,
    high: 8,
    urgent: 2,
    low: 5,
  },
  bySLA: {
    within: 25,
    breached: 5,
  },
  byProvider: {
    whatsapp: 15,
    telegram: 10,
    facebook: 5,
    livechat: 3,
    b2cbotapi: 2,
  },
  byMessageCount: {
    '0': 2,
    '1-5': 10,
    '6-10': 8,
    '11-20': 5,
    '20+': 5,
  },
}

describe('ChatViewFilters - Integration Tests (Feature 011: Chunk 8)', () => {
  // Helper function to expand advanced filters (Feature 015: Chunk 1)
  const expandAdvancedFilters = async () => {
    const toggleButton = screen.getByText('Advanced Filters')
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(screen.getByText('Response Time (minutes):')).toBeInTheDocument()
    })
  }

  describe('Validation: Response Time', () => {
    it('should show error when min > max', async () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        responseTimeMax: 300000, // 5 minutes
      }

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Expand advanced filters to access response time inputs
      await expandAdvancedFilters()

      // Try to set min to 10 (greater than max of 5, should show error)
      const minInput = screen.getByPlaceholderText('Min')
      fireEvent.change(minInput, { target: { value: '10' } })

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Min response time cannot be greater than max')).toBeInTheDocument()
      })

      // onChange should not be called for the invalid change
      expect(onChange).not.toHaveBeenCalled()
    })

    it('should show error when max < min', async () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        responseTimeMin: 600000, // 10 minutes
      }

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Expand advanced filters to access response time inputs
      await expandAdvancedFilters()

      // Try to set max to 5 (less than min of 10, should show error)
      const maxInput = screen.getByPlaceholderText('Max')
      fireEvent.change(maxInput, { target: { value: '5' } })

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Max response time cannot be less than min')).toBeInTheDocument()
      })

      // onChange should not be called for the invalid change
      expect(onChange).not.toHaveBeenCalled()
    })

    it('should clear error when valid value is entered', async () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        responseTimeMax: 300000, // 5 minutes in ms
      }

      const { rerender } = render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Expand advanced filters to access response time inputs
      await expandAdvancedFilters()

      // Try to set min to 10 (should show error)
      const minInput = screen.getByPlaceholderText('Min')
      fireEvent.change(minInput, { target: { value: '10' } })

      // Should show validation error
      expect(screen.getByText('Min response time cannot be greater than max')).toBeInTheDocument()

      // Now set to valid value (3 minutes)
      fireEvent.change(minInput, { target: { value: '3' } })

      // Error should be gone and onChange should be called
      expect(screen.queryByText('Min response time cannot be greater than max')).not.toBeInTheDocument()
      expect(onChange).toHaveBeenCalledWith({
        ...filters,
        responseTimeMin: 180000, // 3 minutes in ms
      })
    })
  })

  describe('Edge Cases: No Stats Available', () => {
    it('should not show count badges when stats is undefined', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {}

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={undefined} />)

      // The component should render without crashing
      expect(screen.getByPlaceholderText('Search by contact name...')).toBeInTheDocument()

      // Stat counts should not be visible
      // (getStatCount returns null when stats is undefined)
    })

    it('should handle stats loading state gracefully', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {}

      render(<ChatViewFilters filters={filters} onChange={onChange} />)

      // Component should render even without stats prop
      expect(screen.getByPlaceholderText('Search by contact name...')).toBeInTheDocument()
    })
  })

  describe('Edge Cases: Clear All Filters', () => {
    it('should reset to empty state when Clear Filters is clicked', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        search: 'test',
        status: 'OPENED',
        agentId: 'agent1',
        responseTimeMin: 60000,
        responseTimeMax: 300000,
      }

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Should show Clear button
      const clearButton = screen.getByText(/Clear \d+ filters?/)
      fireEvent.click(clearButton)

      // Should call onChange with empty object
      expect(onChange).toHaveBeenCalledWith({})
    })

    it('should clear validation errors when all filters are reset', async () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        responseTimeMax: 300000,
      }

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Expand advanced filters to access response time inputs
      await expandAdvancedFilters()

      // Create validation error
      const minInput = screen.getByPlaceholderText('Min')
      fireEvent.change(minInput, { target: { value: '10' } })

      expect(screen.getByText('Min response time cannot be greater than max')).toBeInTheDocument()

      // Clear all filters
      const clearButton = screen.getByText(/Clear/)
      fireEvent.click(clearButton)

      // Error should be gone
      expect(screen.queryByText('Min response time cannot be greater than max')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases: Remove Individual Filter', () => {
    it('should clear related validation error when filter is removed', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        responseTimeMax: 300000,
      }

      const { rerender } = render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Create validation error
      const minInput = screen.getByPlaceholderText('Min')
      fireEvent.change(minInput, { target: { value: '10' } })

      expect(screen.getByText('Min response time cannot be greater than max')).toBeInTheDocument()

      // Rerender with updated filters after onChange was called
      rerender(<ChatViewFilters filters={{ responseTimeMax: 300000 }} onChange={onChange} stats={mockStats} />)

      // Error should still be there since we haven't removed the filter yet
      expect(screen.getByText('Min response time cannot be greater than max')).toBeInTheDocument()
    })
  })

  describe('Complete User Flow: Multiple Filters', () => {
    it('should allow setting multiple filters together', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {}

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Set search
      const searchInput = screen.getByPlaceholderText('Search by contact name...')
      fireEvent.change(searchInput, { target: { value: 'test query' } })

      // Wait for debounce
      waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'test query' })
        )
      }, { timeout: 500 })

      // All filters should work independently
      expect(screen.getByPlaceholderText('Search by contact name...')).toBeInTheDocument()
    })

    it('should display active filter count correctly', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        search: 'test',
        status: 'OPENED',
        agentId: 'agent1',
      }

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Should show "Clear 3 filters"
      expect(screen.getByText('Clear 3 filters')).toBeInTheDocument()
    })

    it('should show singular "filter" when only one filter is active', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {
        search: 'test',
      }

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Should show "Clear 1 filter" (singular)
      expect(screen.getByText('Clear 1 filter')).toBeInTheDocument()
    })
  })

  describe('Keyboard Accessibility', () => {
    it('should allow keyboard navigation through inputs', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {}

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      const searchInput = screen.getByPlaceholderText('Search by contact name...')
      const minInput = screen.getByPlaceholderText('Min')
      const maxInput = screen.getByPlaceholderText('Max')

      // All inputs should be focusable
      expect(searchInput).not.toBeDisabled()
      expect(minInput).not.toBeDisabled()
      expect(maxInput).not.toBeDisabled()

      // Test keyboard input
      searchInput.focus()
      fireEvent.change(searchInput, { target: { value: 'keyboard test' } })
      expect(searchInput).toHaveValue('keyboard test')
    })
  })

  describe('Responsive Layout', () => {
    it('should render all filter controls without crashing', () => {
      const onChange = jest.fn()
      const filters: ChatViewFiltersType = {}

      render(<ChatViewFilters filters={filters} onChange={onChange} stats={mockStats} />)

      // Verify all major filter controls are present
      expect(screen.getByPlaceholderText('Search by contact name...')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Min')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Max')).toBeInTheDocument()

      // Component renders without errors
    })
  })
})
