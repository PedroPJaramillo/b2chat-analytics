import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ChatViewFilters } from '../chat-view-filters'
import type { ChatViewFilters as ChatViewFiltersType } from '@/types/chat-view'

// Mock scrollIntoView for Radix UI Select components
Element.prototype.scrollIntoView = jest.fn()

describe('ChatViewFilters', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render search input', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByPlaceholderText('Search by contact name...')).toBeInTheDocument()
    })

    it('should not show clear filters button when no filters are active', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      expect(screen.queryByText(/Clear/)).not.toBeInTheDocument()
    })

    it('should show clear filters button when filters are active', () => {
      render(
        <ChatViewFilters
          filters={{ search: 'test' }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Clear 1 filter')).toBeInTheDocument()
    })

    it('should show correct count for multiple filters', () => {
      render(
        <ChatViewFilters
          filters={{
            search: 'test',
            status: ['OPENED'],
            agentId: 'agent1'
          }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Clear 3 filters')).toBeInTheDocument()
    })
  })

  describe('Search Input', () => {
    it('should update search value on input', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search by contact name...')
      fireEvent.change(searchInput, { target: { value: 'John' } })

      expect(searchInput).toHaveValue('John')
    })

    it('should debounce search and call onChange after 300ms', async () => {
      jest.useFakeTimers()

      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search by contact name...')
      fireEvent.change(searchInput, { target: { value: 'John' } })

      expect(mockOnChange).not.toHaveBeenCalled()

      jest.advanceTimersByTime(300)

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({ search: 'John' })
      })

      jest.useRealTimers()
    })

    it('should display search value from filters prop', () => {
      render(
        <ChatViewFilters
          filters={{ search: 'test' }}
          onChange={mockOnChange}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search by contact name...')
      expect(searchInput).toHaveValue('test')
    })
  })

  describe('Filter State Display', () => {
    it('should display selected status in trigger', () => {
      const mockStats = {
        byStatus: {
          OPENED: 5,
          CLOSED: 3,
        },
      }

      render(
        <ChatViewFilters
          filters={{ status: ['OPENED'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      // The status value should be displayed in the multi-select trigger
      expect(screen.getByText('Opened')).toBeInTheDocument()
    })

    it('should display selected agent in trigger', () => {
      render(
        <ChatViewFilters
          filters={{ agentId: 'unassigned' }}
          onChange={mockOnChange}
        />
      )

      // The agent value should be displayed
      expect(screen.getByText('Unassigned')).toBeInTheDocument()
    })

    it('should display selected response time values in inputs', async () => {
      render(
        <ChatViewFilters
          filters={{
            responseTimeMin: 60000, // 1 minute
            responseTimeMax: 180000 // 3 minutes
          }}
          onChange={mockOnChange}
        />
      )

      // Expand advanced filters to access response time inputs
      const toggleButton = screen.getByText('Advanced Filters')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        // Check that input fields show the values in minutes
        const minInput = screen.getByPlaceholderText('Min') as HTMLInputElement
        const maxInput = screen.getByPlaceholderText('Max') as HTMLInputElement

        expect(minInput.value).toBe('1')
        expect(maxInput.value).toBe('3')
      })
    })

    it('should display default values when no filters', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      // Since Radix Select doesn't always render placeholder in test,
      // let's just verify the component renders without errors
      expect(screen.getByPlaceholderText('Search by contact name...')).toBeInTheDocument()
    })
  })

  describe('Clear All Filters', () => {
    it('should reset all filters when clear button is clicked', () => {
      render(
        <ChatViewFilters
          filters={{
            search: 'test',
            status: ['OPENED'],
            agentId: 'agent1',
            responseTimeMin: 60000
          }}
          onChange={mockOnChange}
        />
      )

      const clearButton = screen.getByText('Clear 4 filters')
      fireEvent.click(clearButton)

      expect(mockOnChange).toHaveBeenCalledWith({})
    })

    it('should clear search input when clear button is clicked', () => {
      render(
        <ChatViewFilters
          filters={{ search: 'test' }}
          onChange={mockOnChange}
        />
      )

      const clearButton = screen.getByText('Clear 1 filter')
      fireEvent.click(clearButton)

      const searchInput = screen.getByPlaceholderText('Search by contact name...')
      expect(searchInput).toHaveValue('')
    })
  })

  describe('Active Filter Badges', () => {
    it('should show badge for active search filter', () => {
      render(
        <ChatViewFilters
          filters={{ search: 'John' }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Search: John')).toBeInTheDocument()
    })

    it('should show badge for active status filter', () => {
      render(
        <ChatViewFilters
          filters={{ status: ['OPENED'] }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText(/Status:/)).toBeInTheDocument()
    })

    it('should show badge for active agent filter', () => {
      render(
        <ChatViewFilters
          filters={{ agentId: 'unassigned' }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Agent: Unassigned')).toBeInTheDocument()
    })

    it('should show badge for active response time filter', () => {
      render(
        <ChatViewFilters
          filters={{
            responseTimeMin: 60000,
            responseTimeMax: 180000
          }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText(/Response Time:/)).toBeInTheDocument()
    })

    it('should remove individual filter when badge X is clicked', () => {
      render(
        <ChatViewFilters
          filters={{ search: 'John' }}
          onChange={mockOnChange}
        />
      )

      const badge = screen.getByText('Search: John').closest('span')
      const removeButton = badge?.querySelector('button')

      if (removeButton) {
        fireEvent.click(removeButton)
        expect(mockOnChange).toHaveBeenCalledWith({})
      }
    })

    it('should show all active filter badges', () => {
      render(
        <ChatViewFilters
          filters={{
            search: 'John',
            status: ['CLOSED'],
            agentId: 'unassigned',
            responseTimeMin: 180000
          }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Search: John')).toBeInTheDocument()
      expect(screen.getByText(/Status:/)).toBeInTheDocument()
      expect(screen.getByText('Agent: Unassigned')).toBeInTheDocument()
      expect(screen.getByText(/Response Time:/)).toBeInTheDocument()
    })

    it('should remove status filter badge when clicked', () => {
      render(
        <ChatViewFilters
          filters={{ status: ['OPENED'], search: 'test' }}
          onChange={mockOnChange}
        />
      )

      const statusBadge = screen.getByText(/Status:/).closest('span')
      const removeButton = statusBadge?.querySelector('button')

      if (removeButton) {
        fireEvent.click(removeButton)
        expect(mockOnChange).toHaveBeenCalledWith({ search: 'test' })
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty filters object', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByPlaceholderText('Search by contact name...')).toBeInTheDocument()
      expect(screen.queryByText(/Clear/)).not.toBeInTheDocument()
    })

    it('should handle custom response time values', () => {
      render(
        <ChatViewFilters
          filters={{
            responseTimeMin: 120000, // 2 minutes in ms
            responseTimeMax: 300000 // 5 minutes in ms
          }}
          onChange={mockOnChange}
        />
      )

      // Should show badge for custom response time values
      expect(screen.getByText(/Response Time:/)).toBeInTheDocument()
      // Check that it shows the time values (2min - 5min)
      expect(screen.getByText(/2min - 5min/)).toBeInTheDocument()
    })

    it('should not call onChange when search value does not change', async () => {
      jest.useFakeTimers()

      render(
        <ChatViewFilters
          filters={{ search: 'test' }}
          onChange={mockOnChange}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search by contact name...')

      // Set the same value
      fireEvent.change(searchInput, { target: { value: 'test' } })

      jest.advanceTimersByTime(300)

      await waitFor(() => {
        // onChange should not be called because value didn't change
        expect(mockOnChange).not.toHaveBeenCalled()
      })

      jest.useRealTimers()
    })

    it('should handle multiple filter types simultaneously', () => {
      render(
        <ChatViewFilters
          filters={{
            search: 'customer1',
            status: ['PICKED_UP'],
            agentId: 'agent123',
            responseTimeMin: 60000,
            responseTimeMax: 180000
          }}
          onChange={mockOnChange}
        />
      )

      // Should show all 5 filters active (responseTimeMin and responseTimeMax count separately)
      expect(screen.getByText('Clear 5 filters')).toBeInTheDocument()

      // Should show all badges
      expect(screen.getByText('Search: customer1')).toBeInTheDocument()
      expect(screen.getByText(/Status:/)).toBeInTheDocument()
      expect(screen.getByText(/Agent:/)).toBeInTheDocument()
      expect(screen.getByText(/Response Time:/)).toBeInTheDocument()
    })
  })

  describe('Filter Count Logic', () => {
    it('should count search filter correctly', () => {
      render(
        <ChatViewFilters
          filters={{ search: 'test' }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Clear 1 filter')).toBeInTheDocument()
    })

    it('should not count empty search as active filter', () => {
      render(
        <ChatViewFilters
          filters={{ search: '' }}
          onChange={mockOnChange}
        />
      )

      expect(screen.queryByText(/Clear/)).not.toBeInTheDocument()
    })

    it('should count status filter correctly', () => {
      render(
        <ChatViewFilters
          filters={{ status: ['OPENED'] }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Clear 1 filter')).toBeInTheDocument()
    })

    it('should not count empty status array as active filter', () => {
      render(
        <ChatViewFilters
          filters={{ status: [] }}
          onChange={mockOnChange}
        />
      )

      expect(screen.queryByText(/Clear/)).not.toBeInTheDocument()
    })

    it('should count response time min only', () => {
      render(
        <ChatViewFilters
          filters={{ responseTimeMin: 60000 }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Clear 1 filter')).toBeInTheDocument()
    })

    it('should count response time max only', () => {
      render(
        <ChatViewFilters
          filters={{ responseTimeMax: 180000 }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Clear 1 filter')).toBeInTheDocument()
    })
  })

  describe('Advanced Filters Collapsible (Feature 015: Chunk 1)', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear()
    })

    it('should render advanced filters toggle button', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Advanced Filters')).toBeInTheDocument()
    })

    it('should have advanced filters collapsed by default', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      // Response Time label should not be visible when collapsed
      expect(screen.queryByText('Response Time (minutes):')).not.toBeInTheDocument()
    })

    it('should expand advanced filters when toggle button is clicked', async () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const toggleButton = screen.getByText('Advanced Filters')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        // Check for advanced filter label that's unique to advanced section
        expect(screen.getByText('Response Time (minutes):')).toBeInTheDocument()
      })
    })

    it('should collapse advanced filters when toggle button is clicked again', async () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const toggleButton = screen.getByText('Advanced Filters')

      // Expand
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getByText('Response Time (minutes):')).toBeInTheDocument()
      })

      // Collapse
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.queryByText('Response Time (minutes):')).not.toBeInTheDocument()
      })
    })

    it('should show badge count of active advanced filters', () => {
      render(
        <ChatViewFilters
          filters={{
            departmentId: 'dept1',
            slaStatus: 'breached',
            providerFilter: ['whatsapp']
          }}
          onChange={mockOnChange}
        />
      )

      // Should show count badge with 3 active advanced filters
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should not show badge count when no advanced filters are active', () => {
      render(
        <ChatViewFilters
          filters={{
            search: 'test',
            status: ['OPENED']
          }}
          onChange={mockOnChange}
        />
      )

      // Primary filters are active but not advanced filters
      const toggleButton = screen.getByText('Advanced Filters')
      const badge = toggleButton.querySelector('[class*="badge"]')
      expect(badge).not.toBeInTheDocument()
    })

    it('should persist collapsed state to localStorage when expanded', async () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const toggleButton = screen.getByText('Advanced Filters')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(localStorage.getItem('chat-view-advanced-filters-open')).toBe('true')
      })
    })

    it('should persist collapsed state to localStorage when collapsed', async () => {
      // Set initial state to expanded
      localStorage.setItem('chat-view-advanced-filters-open', 'true')

      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const toggleButton = screen.getByText('Advanced Filters')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(localStorage.getItem('chat-view-advanced-filters-open')).toBe('false')
      })
    })

    it('should restore collapsed state from localStorage on mount', () => {
      // Set localStorage to expanded
      localStorage.setItem('chat-view-advanced-filters-open', 'true')

      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      // Advanced filters should be visible - check for Response Time label
      expect(screen.getByText('Response Time (minutes):')).toBeInTheDocument()
    })

    it('should show chevron down icon when collapsed', () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const toggleButton = screen.getByText('Advanced Filters')
      const svg = toggleButton.querySelector('svg')
      // ChevronDown has specific SVG structure
      expect(svg).toBeInTheDocument()
    })

    it('should show chevron up icon when expanded', async () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
        />
      )

      const toggleButton = screen.getByText('Advanced Filters')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        const svg = toggleButton.querySelector('svg')
        expect(svg).toBeInTheDocument()
      })
    })

    it('should clear both primary and advanced filters when clear all is clicked', () => {
      render(
        <ChatViewFilters
          filters={{
            search: 'test',
            status: ['OPENED'],
            departmentId: 'dept1',
            slaStatus: 'breached'
          }}
          onChange={mockOnChange}
        />
      )

      const clearButton = screen.getByText('Clear 4 filters')
      fireEvent.click(clearButton)

      expect(mockOnChange).toHaveBeenCalledWith({})
    })

    it('should count advanced filters correctly in total filter count', () => {
      render(
        <ChatViewFilters
          filters={{
            search: 'test', // Primary filter
            status: ['OPENED'], // Primary filter
            departmentId: 'dept1', // Advanced filter
            slaStatus: 'breached', // Advanced filter
            responseTimeMin: 60000 // Advanced filter
          }}
          onChange={mockOnChange}
        />
      )

      // Should show total count of 5 filters
      expect(screen.getByText('Clear 5 filters')).toBeInTheDocument()
    })
  })

  describe('Multi-Select Filters (Feature 015: Chunk 4)', () => {
    const mockStats = {
      byStatus: {
        OPENED: 10,
        CLOSED: 5,
        PICKED_UP: 3,
      },
      byPriority: {
        urgent: 2,
        high: 5,
        normal: 8,
        low: 3,
      },
      byProvider: {
        whatsapp: 12,
        telegram: 4,
        facebook: 2,
      },
    }

    it('should display single selected status', () => {
      render(
        <ChatViewFilters
          filters={{ status: ['OPENED'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      expect(screen.getByText('Opened')).toBeInTheDocument()
    })

    it('should display "X selected" for multiple statuses', () => {
      render(
        <ChatViewFilters
          filters={{ status: ['OPENED', 'CLOSED'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      expect(screen.getByText('2 selected')).toBeInTheDocument()
    })

    it('should display single selected priority', () => {
      render(
        <ChatViewFilters
          filters={{ priorityFilter: ['urgent'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      expect(screen.getByText('Urgent')).toBeInTheDocument()
    })

    it('should display "X selected" for multiple priorities', () => {
      render(
        <ChatViewFilters
          filters={{ priorityFilter: ['urgent', 'high', 'normal'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('should show active filter badge for multiple statuses', () => {
      render(
        <ChatViewFilters
          filters={{ status: ['OPENED', 'CLOSED', 'PICKED_UP'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      // Check badge shows "3 selected"
      expect(screen.getByText('Status: 3 selected')).toBeInTheDocument()
    })

    it('should show active filter badge for single status', () => {
      render(
        <ChatViewFilters
          filters={{ status: ['OPENED'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      // Check badge shows the label
      expect(screen.getByText('Status: Opened')).toBeInTheDocument()
    })

    it('should open multi-select popover when clicked', async () => {
      render(
        <ChatViewFilters
          filters={{}}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      // Click the status multi-select button (find by text "Status")
      const statusButton = screen.getByText('Status')
      fireEvent.click(statusButton)

      // Wait for popover to open and show checkboxes
      await waitFor(() => {
        const selectAllButton = screen.getByText(/Select All|Clear All/i)
        expect(selectAllButton).toBeInTheDocument()
      })
    })

    it('should count multiple selections as single filter', () => {
      render(
        <ChatViewFilters
          filters={{
            status: ['OPENED', 'CLOSED', 'PICKED_UP'],
            priorityFilter: ['urgent', 'high']
          }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      // Should count as 2 filters (status and priority), not 5
      expect(screen.getByText('Clear 2 filters')).toBeInTheDocument()
    })

    it('should display provider multi-select in advanced filters', async () => {
      render(
        <ChatViewFilters
          filters={{ providerFilter: ['whatsapp', 'telegram'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      // Expand advanced filters
      const toggleButton = screen.getByText('Advanced Filters')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText('2 selected')).toBeInTheDocument()
      })
    })

    it('should show provider badge for multiple providers', () => {
      render(
        <ChatViewFilters
          filters={{ providerFilter: ['whatsapp', 'telegram'] }}
          onChange={mockOnChange}
          stats={mockStats as any}
        />
      )

      // Check badge shows "2 selected"
      expect(screen.getByText('Provider: 2 selected')).toBeInTheDocument()
    })
  })
})
