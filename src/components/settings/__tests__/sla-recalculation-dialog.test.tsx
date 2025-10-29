import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SLARecalculationDialog } from '../sla-recalculation-dialog'
import { getDefaultDateRange } from '@/lib/sla/recalculation-helpers'

describe('SLARecalculationDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onConfirm: jest.fn(),
    request: getDefaultDateRange(),
    loading: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render dialog when open', () => {
    render(<SLARecalculationDialog {...defaultProps} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Recalculate SLA Metrics?')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<SLARecalculationDialog {...defaultProps} open={false} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should display date range', () => {
    render(<SLARecalculationDialog {...defaultProps} />)

    expect(screen.getByText('Date Range:')).toBeInTheDocument()
    // Date range should be displayed (exact format depends on dates)
    expect(screen.getByText(/\d{4}/)).toBeInTheDocument() // Should contain a year
  })

  it('should display estimated chat count', () => {
    render(<SLARecalculationDialog {...defaultProps} />)

    expect(screen.getByText('Estimated Chats:')).toBeInTheDocument()
    expect(screen.getByText(/~\d+ chats/)).toBeInTheDocument()
  })

  it('should display estimated time', () => {
    render(<SLARecalculationDialog {...defaultProps} />)

    expect(screen.getByText('Estimated Time:')).toBeInTheDocument()
    expect(screen.getByText(/\d+ (second|minute|hour)s?/)).toBeInTheDocument()
  })

  it('should display chat ID when provided', () => {
    const request = {
      ...getDefaultDateRange(),
      chatId: 'chat-123',
    }

    render(<SLARecalculationDialog {...defaultProps} request={request} />)

    expect(screen.getByText('Chat ID:')).toBeInTheDocument()
    expect(screen.getByText('chat-123')).toBeInTheDocument()
    // Should not show estimated chats when chatId is provided
    expect(screen.queryByText('Estimated Chats:')).not.toBeInTheDocument()
  })

  it('should display max chats limit when provided', () => {
    const request = {
      ...getDefaultDateRange(),
      limit: 500,
    }

    render(<SLARecalculationDialog {...defaultProps} request={request} />)

    expect(screen.getByText('Max Chats:')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('should show warning for large operations', () => {
    // Create a request with a large date range (> 20 days = ~1000 chats)
    const startDate = new Date('2025-01-01').toISOString()
    const endDate = new Date('2025-02-01').toISOString() // 31 days = ~1550 chats

    render(
      <SLARecalculationDialog
        {...defaultProps}
        request={{ startDate, endDate }}
      />
    )

    expect(screen.getByText('Large Operation')).toBeInTheDocument()
    expect(screen.getByText(/over 1,000 chats/)).toBeInTheDocument()
  })

  it('should not show warning for small operations', () => {
    // Create a request with a small date range (<= 20 days)
    const startDate = new Date('2025-01-01').toISOString()
    const endDate = new Date('2025-01-10').toISOString() // 9 days = ~450 chats

    render(
      <SLARecalculationDialog
        {...defaultProps}
        request={{ startDate, endDate }}
      />
    )

    expect(screen.queryByText('Large Operation')).not.toBeInTheDocument()
  })

  it('should not show warning when chatId is provided', () => {
    // Even with a large date range, warning shouldn't show for single chat
    const startDate = new Date('2025-01-01').toISOString()
    const endDate = new Date('2025-02-01').toISOString()

    render(
      <SLARecalculationDialog
        {...defaultProps}
        request={{ startDate, endDate, chatId: 'chat-123' }}
      />
    )

    expect(screen.queryByText('Large Operation')).not.toBeInTheDocument()
  })

  it('should display info about what will happen', () => {
    render(<SLARecalculationDialog {...defaultProps} />)

    expect(screen.getByText('What will happen')).toBeInTheDocument()
    expect(screen.getByText(/current SLA configuration/)).toBeInTheDocument()
    expect(screen.getByText(/enabled metrics/)).toBeInTheDocument()
    expect(screen.getByText(/chat data will not be modified/)).toBeInTheDocument()
  })

  it('should call onConfirm when Recalculate button is clicked', async () => {
    const onConfirm = jest.fn()
    render(<SLARecalculationDialog {...defaultProps} onConfirm={onConfirm} />)

    const recalculateButton = screen.getByRole('button', { name: /Recalculate/i })
    fireEvent.click(recalculateButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  it('should call onOpenChange when Cancel button is clicked', () => {
    const onOpenChange = jest.fn()
    render(<SLARecalculationDialog {...defaultProps} onOpenChange={onOpenChange} />)

    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should disable buttons when loading', () => {
    render(<SLARecalculationDialog {...defaultProps} loading={true} />)

    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    const recalculateButton = screen.getByRole('button', { name: /Recalculating/i })

    expect(cancelButton).toBeDisabled()
    expect(recalculateButton).toBeDisabled()
  })

  it('should show loading state on Recalculate button', () => {
    render(<SLARecalculationDialog {...defaultProps} loading={true} />)

    expect(screen.getByText('Recalculating...')).toBeInTheDocument()
    expect(screen.queryByText('Recalculate')).not.toBeInTheDocument()
  })

  it('should show regular state on Recalculate button when not loading', () => {
    render(<SLARecalculationDialog {...defaultProps} loading={false} />)

    expect(screen.getByText('Recalculate')).toBeInTheDocument()
    expect(screen.queryByText('Recalculating...')).not.toBeInTheDocument()
  })

  it('should handle async onConfirm', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined)
    render(<SLARecalculationDialog {...defaultProps} onConfirm={onConfirm} />)

    const recalculateButton = screen.getByRole('button', { name: /Recalculate/i })
    fireEvent.click(recalculateButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  it('should display all bullet points in info section', () => {
    render(<SLARecalculationDialog {...defaultProps} />)

    expect(screen.getByText(/current SLA configuration will be applied/)).toBeInTheDocument()
    expect(screen.getByText(/enabled metrics will be recalculated/)).toBeInTheDocument()
    expect(screen.getByText(/chat data will not be modified/)).toBeInTheDocument()
    expect(screen.getByText(/continue even if some chats fail/)).toBeInTheDocument()
  })
})
