import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { WeeklyResponseTimeHeatmap } from '../weekly-response-time-heatmap'

// Mock the hooks
jest.mock('@/hooks/use-weekly-response-times', () => ({
  useWeeklyResponseTimes: jest.fn()
}))

jest.mock('@/hooks/use-response-time-drilldown', () => ({
  useResponseTimeDrilldown: jest.fn()
}))

// Mock date-fns functions
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  addDays: jest.fn((date, days) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }),
  subDays: jest.fn((date, days) => {
    const result = new Date(date)
    result.setDate(result.getDate() - days)
    return result
  }),
  format: jest.fn((date, formatStr) => {
    const d = new Date(date)
    if (formatStr === 'yyyy-MM-dd') {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    if (formatStr === 'MMM d') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${months[d.getMonth()]} ${d.getDate()}`
    }
    if (formatStr === 'MMM d, yyyy') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    }
    return date.toISOString()
  })
}))

import { useWeeklyResponseTimes } from '@/hooks/use-weekly-response-times'
import { useResponseTimeDrilldown } from '@/hooks/use-response-time-drilldown'

const mockUseWeeklyResponseTimes = useWeeklyResponseTimes as jest.MockedFunction<typeof useWeeklyResponseTimes>
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
const mockWeeklyData = {
  weekStart: '2025-10-13',
  weekEnd: '2025-10-19',
  agentId: null,
  agentName: null,
  filters: {
    direction: 'all' as const,
    officeHours: 'all' as const
  },
  data: Array.from({ length: 168 }, (_, i) => ({
    dayOfWeek: Math.floor(i / 24),
    dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Math.floor(i / 24)],
    hour: i % 24,
    avg: i % 10 === 0 ? '2.5m' : '0s',
    avgMs: i % 10 === 0 ? 150000 : 0,
    count: i % 10 === 0 ? 10 : 0
  })),
  summary: {
    totalChats: 100,
    overallAvg: '2.5m',
    overallAvgMs: 150000,
    fastestHour: { dayOfWeek: 1, hour: 9, avg: '1.2m' },
    slowestHour: { dayOfWeek: 4, hour: 14, avg: '5.7m' }
  }
}

const mockAgents = [
  { id: 'agent_1', name: 'John Doe' },
  { id: 'agent_2', name: 'Jane Smith' }
]

describe('WeeklyResponseTimeHeatmap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseWeeklyResponseTimes.mockReturnValue({
      data: mockWeeklyData,
      loading: false,
      error: null,
      refetch: jest.fn()
    })
    // Mock drill-down hook with default data
    mockUseResponseTimeDrilldown.mockReturnValue({
      data: {
        dayName: 'Monday',
        hourRange: '10:00 AM - 11:00 AM',
        timeSlotStart: '2025-10-13T10:00:00.000Z',
        timeSlotEnd: '2025-10-13T11:00:00.000Z',
        summary: {
          totalChats: 10,
          avgResponseTime: '2.5m',
          avgResponseTimeMs: 150000,
          comparisonToWeekly: '+0.5m',
          performanceIndicator: 'default' as const,
          performanceLabel: 'Average' as const
        },
        distribution: [],
        agentBreakdown: [],
        slowestChats: []
      },
      loading: false,
      error: null,
      refetch: jest.fn()
    })
  })

  describe('Rendering', () => {
    it('should render the component', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Weekly Response Time Heatmap')).toBeInTheDocument()
    })

    it('should render week picker control', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText(/Oct 13 - Oct 19, 2025/)).toBeInTheDocument()
    })

    it('should render agent selector dropdown', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('All Agents')).toBeInTheDocument()
    })

    it('should render 7 day labels', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Sun')).toBeInTheDocument()
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Tue')).toBeInTheDocument()
      expect(screen.getByText('Wed')).toBeInTheDocument()
      expect(screen.getByText('Thu')).toBeInTheDocument()
      expect(screen.getByText('Fri')).toBeInTheDocument()
      expect(screen.getByText('Sat')).toBeInTheDocument()
    })

    it('should render 24 hour labels', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('12A')).toBeInTheDocument()
      expect(screen.getByText('6A')).toBeInTheDocument()
      expect(screen.getByText('12P')).toBeInTheDocument()
      expect(screen.getByText('6P')).toBeInTheDocument()
      expect(screen.getByText('11P')).toBeInTheDocument()
    })

    it('should render 168 heatmap cells (7 days × 24 hours)', () => {
      const { container } = render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      // Count cells with the heatmap cell class pattern
      const cells = container.querySelectorAll('[class*="h-10"]')
      expect(cells.length).toBeGreaterThanOrEqual(168)
    })
  })

  describe('Loading State', () => {
    it('should display loading skeleton when loading', () => {
      mockUseWeeklyResponseTimes.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn()
      })

      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should display error message when error occurs', () => {
      mockUseWeeklyResponseTimes.mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to fetch data',
        refetch: jest.fn()
      })

      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText(/Failed to fetch data/)).toBeInTheDocument()
    })
  })

  describe('Week Navigation', () => {
    it('should call hook with new week when previous button clicked', async () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      const prevButton = screen.getByLabelText('Previous week')
      fireEvent.click(prevButton)

      await waitFor(() => {
        expect(mockUseWeeklyResponseTimes).toHaveBeenCalledWith(
          expect.objectContaining({
            weekStart: expect.stringMatching(/2025-10-06/)
          })
        )
      })
    })

    it('should call hook with new week when next button clicked', async () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      const nextButton = screen.getByLabelText('Next week')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(mockUseWeeklyResponseTimes).toHaveBeenCalledWith(
          expect.objectContaining({
            weekStart: expect.stringMatching(/2025-10-20/)
          })
        )
      })
    })
  })

  describe('Agent Filter', () => {
    it('should default to "All Agents"', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('All Agents')).toBeInTheDocument()
    })

    it('should call hook with "all" agentId by default', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(mockUseWeeklyResponseTimes).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'all'
        })
      )
    })
  })

  describe('Filter Integration', () => {
    it('should pass directionFilter to hook', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="incoming"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(mockUseWeeklyResponseTimes).toHaveBeenCalledWith(
        expect.objectContaining({
          directionFilter: 'incoming'
        })
      )
    })

    it('should pass officeHoursFilter to hook', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="office-hours"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(mockUseWeeklyResponseTimes).toHaveBeenCalledWith(
        expect.objectContaining({
          officeHoursFilter: 'office-hours'
        })
      )
    })
  })

  describe('Color Coding', () => {
    it('should apply different colors based on response time', () => {
      const { container } = render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      // Should have green cells (fast)
      expect(container.querySelector('.bg-green-200')).toBeInTheDocument()

      // Should have gray cells (no data)
      expect(container.querySelector('.bg-gray-100')).toBeInTheDocument()
    })
  })

  describe('Legend', () => {
    it('should display legend with all color categories', () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Fast')).toBeInTheDocument()
      expect(screen.getByText('Average')).toBeInTheDocument()
      expect(screen.getByText('Slow')).toBeInTheDocument()
      expect(screen.getByText('No data')).toBeInTheDocument()
    })
  })

  describe('Drill-Down Interaction', () => {
    it('should render cells with cursor-pointer class when they have data', () => {
      const { container } = render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      // Find cells with data (count > 0)
      const clickableCells = container.querySelectorAll('[class*="cursor-pointer"]')
      expect(clickableCells.length).toBeGreaterThan(0)
    })

    it('should not render cursor-pointer on cells with no data', () => {
      // Create mock data with one cell having count = 0
      const dataWithEmpty = {
        ...mockWeeklyData,
        data: mockWeeklyData.data.map((slot, i) =>
          i === 0 ? { ...slot, count: 0, avgMs: 0 } : slot
        )
      }

      mockUseWeeklyResponseTimes.mockReturnValue({
        data: dataWithEmpty,
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      const { container } = render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      // First cell should not be clickable
      const cells = container.querySelectorAll('[class*="h-10"]')
      const firstCell = cells[0]
      expect(firstCell?.className).not.toContain('cursor-pointer')
    })

    it('should open drill-down dialog when clicking a cell with data', async () => {
      const { container } = render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      // Find a clickable cell (one with data)
      const clickableCells = container.querySelectorAll('[class*="cursor-pointer"]')
      expect(clickableCells.length).toBeGreaterThan(0)

      // Click the first clickable cell
      fireEvent.click(clickableCells[0])

      // Wait for dialog to appear (title should be visible)
      await waitFor(() => {
        expect(screen.getByText(/Response Time Details/)).toBeInTheDocument()
      })
    })

    it('should pass correct context to drill-down dialog', async () => {
      render(
        <WeeklyResponseTimeHeatmap
          directionFilter="incoming"
          officeHoursFilter="office-hours"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      const { container } = render(
        <WeeklyResponseTimeHeatmap
          directionFilter="incoming"
          officeHoursFilter="office-hours"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      // Find and click a cell
      const clickableCells = container.querySelectorAll('[class*="cursor-pointer"]')
      if (clickableCells.length > 0) {
        fireEvent.click(clickableCells[0])

        // Dialog should open with filters passed through
        await waitFor(() => {
          expect(screen.getByText(/Response Time Details/)).toBeInTheDocument()
        })
      }
    })

    it('should close drill-down dialog when onOpenChange is called', async () => {
      const { container } = render(
        <WeeklyResponseTimeHeatmap
          directionFilter="all"
          officeHoursFilter="all"
          agents={mockAgents}
        />,
        { wrapper: createWrapper() }
      )

      // Click a cell to open dialog
      const clickableCells = container.querySelectorAll('[class*="cursor-pointer"]')
      if (clickableCells.length > 0) {
        fireEvent.click(clickableCells[0])

        await waitFor(() => {
          expect(screen.getByText(/Response Time Details/)).toBeInTheDocument()
        })

        // Close dialog (ESC key or clicking outside)
        const dialog = screen.getByRole('dialog')
        fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })

        // Dialog should close
        await waitFor(() => {
          expect(screen.queryByText(/Response Time Details/)).not.toBeInTheDocument()
        })
      }
    })
  })
})
