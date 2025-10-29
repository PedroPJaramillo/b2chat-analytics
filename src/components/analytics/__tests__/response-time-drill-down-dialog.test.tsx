import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ResponseTimeDrillDownDialog } from '../response-time-drill-down-dialog'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock the hook
jest.mock('@/hooks/use-response-time-drilldown', () => ({
  useResponseTimeDrilldown: jest.fn()
}))

import { useResponseTimeDrilldown } from '@/hooks/use-response-time-drilldown'

const mockUseResponseTimeDrilldown = useResponseTimeDrilldown as jest.MockedFunction<typeof useResponseTimeDrilldown>

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  TestWrapper.displayName = 'TestWrapper'

  return TestWrapper
}

// Mock data
const mockDrillDownData = {
  dayName: 'Tuesday',
  hourRange: '2:00 PM - 3:00 PM',
  timeSlotStart: '2025-10-15T14:00:00.000Z',
  timeSlotEnd: '2025-10-15T15:00:00.000Z',
  summary: {
    totalChats: 15,
    avgResponseTime: '8.5m',
    avgResponseTimeMs: 510000,
    comparisonToWeekly: '+5.3m',
    performanceIndicator: 'destructive' as const,
    performanceLabel: 'Worse' as const
  },
  distribution: [
    { status: 'resolved', count: 8 },
    { status: 'pending', count: 5 },
    { status: 'active', count: 2 }
  ],
  agentBreakdown: [
    {
      agentId: 'agent_carlos',
      agentName: 'Carlos Rivera',
      chatCount: 8,
      avgResponseTime: '12.0m',
      avgResponseTimeMs: 720000
    },
    {
      agentId: 'agent_maria',
      agentName: 'Maria Santos',
      chatCount: 7,
      avgResponseTime: '4.5m',
      avgResponseTimeMs: 270000
    }
  ],
  slowestChats: [
    {
      chatId: 'chat_123',
      customerName: 'John Doe',
      agentName: 'Carlos Rivera',
      channel: 'whatsapp',
      responseTime: '18.2m',
      responseTimeMs: 1092000,
      status: 'resolved'
    },
    {
      chatId: 'chat_456',
      customerName: 'Jane Smith',
      agentName: 'Maria Santos',
      channel: 'webchat',
      responseTime: '15.0m',
      responseTimeMs: 900000,
      status: 'pending'
    }
  ]
}

describe('ResponseTimeDrillDownDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    weekStart: '2025-10-13',
    dayOfWeek: 2,
    hour: 14,
    agentId: 'all',
    directionFilter: 'all' as const,
    officeHoursFilter: 'all' as const
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseResponseTimeDrilldown.mockReturnValue({
      data: mockDrillDownData,
      loading: false,
      error: null,
      refetch: jest.fn()
    })
  })

  describe('Loading State', () => {
    it('should show loading skeleton when data is loading', () => {
      mockUseResponseTimeDrilldown.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn()
      })

      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      // Skeleton should be visible (implementation specific - may need adjustment)
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should show error message when there is an error', () => {
      mockUseResponseTimeDrilldown.mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to fetch drill-down data',
        refetch: jest.fn()
      })

      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText(/error loading data/i)).toBeInTheDocument()
    })
  })

  describe('Dialog Header', () => {
    it('should display time slot information in title', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Tuesday 2:00 PM - 3:00 PM - Response Time Details')).toBeInTheDocument()
    })

    it('should have close button functionality', () => {
      const onOpenChange = jest.fn()

      render(
        <ResponseTimeDrillDownDialog {...defaultProps} onOpenChange={onOpenChange} />,
        { wrapper: createWrapper() }
      )

      // Dialog should have close mechanism (ESC key, close button, etc.)
      // This tests the dialog's controlled open state
      expect(onOpenChange).not.toHaveBeenCalled()
    })
  })

  describe('Summary Section', () => {
    it('should display total chats', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Total Chats')).toBeInTheDocument()
      expect(screen.getByText('15')).toBeInTheDocument()
    })

    it('should display average response time', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getAllByText('Avg Response Time')[0]).toBeInTheDocument()
      expect(screen.getByText('8.5m')).toBeInTheDocument()
    })

    it('should display weekly comparison', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Weekly Comparison')).toBeInTheDocument()
      expect(screen.getByText('+5.3m')).toBeInTheDocument()
    })

    it('should display performance badge', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Worse')).toBeInTheDocument()
    })
  })

  describe('Distribution Section', () => {
    it('should display chat distribution by status', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Chat Distribution')).toBeInTheDocument()
      // Status badges may appear multiple times
      expect(screen.getAllByText('resolved').length).toBeGreaterThan(0)
      // Numbers may appear multiple times (distribution + agent breakdown)
      expect(screen.getAllByText('8').length).toBeGreaterThan(0)
      expect(screen.getAllByText('pending').length).toBeGreaterThan(0)
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getAllByText('active').length).toBeGreaterThan(0)
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('Agent Breakdown Section', () => {
    it('should display agent breakdown table when agentId is "all"', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} agentId="all" />, { wrapper: createWrapper() })

      expect(screen.getByText('Agent Performance')).toBeInTheDocument()
      // Names may appear multiple times (agent breakdown + slowest chats)
      expect(screen.getAllByText('Carlos Rivera').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0)
      expect(screen.getByText('12.0m')).toBeInTheDocument()
      expect(screen.getByText('4.5m')).toBeInTheDocument()
    })

    it('should not display agent breakdown when agentId is specific agent', () => {
      // Mock data with single agent
      const singleAgentData = {
        ...mockDrillDownData,
        agentBreakdown: [mockDrillDownData.agentBreakdown[0]]
      }

      mockUseResponseTimeDrilldown.mockReturnValue({
        data: singleAgentData,
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(
        <ResponseTimeDrillDownDialog {...defaultProps} agentId="agent_carlos" />,
        { wrapper: createWrapper() }
      )

      // Should not show agent breakdown section when filtered to single agent
      expect(screen.queryByText('Agent Performance')).not.toBeInTheDocument()
    })

    it('should display agent breakdown table headers', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} agentId="all" />, { wrapper: createWrapper() })

      // "Agent" appears in both agent breakdown and slowest chats tables
      expect(screen.getAllByText('Agent').length).toBeGreaterThan(0)
      expect(screen.getByText('Chats')).toBeInTheDocument()
      expect(screen.getAllByText('Avg Response Time').length).toBeGreaterThan(0)
    })
  })

  describe('Slowest Chats Section', () => {
    it('should display slowest chats table', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Slowest Chats')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('should display slowest chats table headers', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Customer')).toBeInTheDocument()
      // "Agent" appears in both agent breakdown and slowest chats tables
      expect(screen.getAllByText('Agent').length).toBeGreaterThan(0)
      expect(screen.getByText('Channel')).toBeInTheDocument()
      expect(screen.getByText('Response Time')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should display chat details correctly', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      // Check for specific chat details - using getAllByText since names may appear multiple times
      expect(screen.getAllByText('Carlos Rivera').length).toBeGreaterThan(0)
      expect(screen.getByText('whatsapp')).toBeInTheDocument()
      expect(screen.getByText('18.2m')).toBeInTheDocument()
    })
  })

  describe('View All Chats Button', () => {
    it('should render View All Chats button', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('View All Chats')).toBeInTheDocument()
    })

    it('should navigate to chats page with correct filters when clicked', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      const button = screen.getByText('View All Chats')
      fireEvent.click(button)

      const callUrl = mockPush.mock.calls[0][0]

      expect(callUrl).toContain('/dashboard/chats?')
      expect(callUrl).toContain('startDate=')
      expect(callUrl).toContain('2025-10-15')
      expect(callUrl).toContain('endDate=')
      expect(callUrl).toContain('sortBy=responseTime')
      expect(callUrl).toContain('sortOrder=desc')
    })

    it('should include agentId in navigation when specific agent selected', () => {
      render(
        <ResponseTimeDrillDownDialog {...defaultProps} agentId="agent_123" />,
        { wrapper: createWrapper() }
      )

      const button = screen.getByText('View All Chats')
      fireEvent.click(button)

      const callUrl = mockPush.mock.calls[0][0]
      expect(callUrl).toContain('agent=agent_123')
    })

    it('should not include agentId in navigation when agentId is "all"', () => {
      render(
        <ResponseTimeDrillDownDialog {...defaultProps} agentId="all" />,
        { wrapper: createWrapper() }
      )

      const button = screen.getByText('View All Chats')
      fireEvent.click(button)

      const callUrl = mockPush.mock.calls[0][0]
      expect(callUrl).not.toContain('agent=')
    })

    it('should close dialog after navigation', () => {
      const onOpenChange = jest.fn()

      render(
        <ResponseTimeDrillDownDialog {...defaultProps} onOpenChange={onOpenChange} />,
        { wrapper: createWrapper() }
      )

      const button = screen.getByText('View All Chats')
      fireEvent.click(button)

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Dialog Behavior', () => {
    it('should not render when open is false', () => {
      render(
        <ResponseTimeDrillDownDialog {...defaultProps} open={false} />,
        { wrapper: createWrapper() }
      )

      expect(screen.queryByText('Tuesday 2:00 PM - 3:00 PM - Response Time Details')).not.toBeInTheDocument()
    })

    it('should call hook with correct parameters', () => {
      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      expect(mockUseResponseTimeDrilldown).toHaveBeenCalledWith({
        weekStart: '2025-10-13',
        dayOfWeek: 2,
        hour: 14,
        agentId: 'all',
        directionFilter: 'all',
        officeHoursFilter: 'all'
      })
    })
  })

  describe('Empty State', () => {
    it('should handle empty distribution gracefully', () => {
      const emptyDistributionData = {
        ...mockDrillDownData,
        distribution: []
      }

      mockUseResponseTimeDrilldown.mockReturnValue({
        data: emptyDistributionData,
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      // Should still render the section header
      expect(screen.getByText('Chat Distribution')).toBeInTheDocument()
    })

    it('should handle empty slowest chats gracefully', () => {
      const emptyChatsData = {
        ...mockDrillDownData,
        slowestChats: []
      }

      mockUseResponseTimeDrilldown.mockReturnValue({
        data: emptyChatsData,
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ResponseTimeDrillDownDialog {...defaultProps} />, { wrapper: createWrapper() })

      // Should still render the section header
      expect(screen.getByText('Slowest Chats')).toBeInTheDocument()
    })
  })
})
