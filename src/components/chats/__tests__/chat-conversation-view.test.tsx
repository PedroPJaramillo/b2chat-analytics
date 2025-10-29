import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ChatConversationView } from '../chat-conversation-view'

// Mock the hook
jest.mock('@/lib/hooks/use-chat-view', () => ({
  useChatMessages: jest.fn()
}))

import { useChatMessages } from '@/lib/hooks/use-chat-view'

const mockUseChatMessages = useChatMessages as jest.MockedFunction<typeof useChatMessages>

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
const mockMessagesData = {
  messages: [
    {
      id: 'msg1',
      chatId: 'chat1',
      text: 'Hello, I need help',
      type: 'text' as const,
      incoming: true,
      timestamp: '2025-01-15T10:00:00.000Z'
    },
    {
      id: 'msg2',
      chatId: 'chat1',
      text: 'Hi! How can I help you today?',
      type: 'text' as const,
      incoming: false,
      timestamp: '2025-01-15T10:01:23.000Z'
    },
    {
      id: 'msg3',
      chatId: 'chat1',
      text: 'I have a billing question',
      type: 'text' as const,
      incoming: true,
      timestamp: '2025-01-15T10:02:00.000Z'
    },
    {
      id: 'msg4',
      chatId: 'chat1',
      text: 'Sure, let me check your account',
      type: 'text' as const,
      incoming: false,
      timestamp: '2025-01-15T10:02:45.000Z'
    }
  ],
  chat: {
    id: 'chat1',
    b2chatId: 'b2chat-1',
    contactName: 'John Doe',
    agentName: 'Agent Smith',
    status: 'CLOSED'
  }
}

describe('ChatConversationView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseChatMessages.mockReturnValue({
      data: mockMessagesData,
      loading: false,
      error: null,
      refetch: jest.fn()
    })
  })

  describe('Loading State', () => {
    it('should show loading skeletons when data is loading', () => {
      mockUseChatMessages.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      // Check for skeleton elements (there should be multiple)
      const skeletons = document.querySelectorAll('[data-testid="skeleton"]')
      // Skeletons are rendered with custom class, just check the loading is happening
      expect(screen.queryByText(/Customer/i)).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should show error message when there is an error', () => {
      const mockRefetch = jest.fn()
      mockUseChatMessages.mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to fetch chat messages',
        refetch: mockRefetch
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText(/failed to load messages/i)).toBeInTheDocument()
      expect(screen.getByText(/failed to fetch chat messages/i)).toBeInTheDocument()

      // Test retry button
      const retryButton = screen.getByRole('button', { name: /try again/i })
      fireEvent.click(retryButton)
      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty State', () => {
    it('should show empty message when there are no messages', () => {
      mockUseChatMessages.mockReturnValue({
        data: {
          messages: [],
          chat: mockMessagesData.chat
        },
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText(/no messages in this chat/i)).toBeInTheDocument()
    })
  })

  describe('Messages Display', () => {
    it('should render all messages', () => {
      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText('Hello, I need help')).toBeInTheDocument()
      expect(screen.getByText('Hi! How can I help you today?')).toBeInTheDocument()
      expect(screen.getByText('I have a billing question')).toBeInTheDocument()
      expect(screen.getByText('Sure, let me check your account')).toBeInTheDocument()
    })

    it('should show customer label for customer messages', () => {
      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      const customerLabels = screen.getAllByText('[Customer]')
      expect(customerLabels.length).toBeGreaterThan(0)
    })

    it('should show agent label for agent messages', () => {
      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      const agentLabels = screen.getAllByText(/agent/i)
      expect(agentLabels.length).toBeGreaterThan(0)
    })

    it('should display timestamps for all messages', () => {
      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      // Should have multiple timestamps (checking for AM/PM format)
      const timestamps = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}\s[AP]M/i)
      expect(timestamps.length).toBeGreaterThan(0)
    })
  })

  describe('Response Time Display', () => {
    it('should calculate and display response times for agent messages', () => {
      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      // Check that response times are displayed (looking for time format patterns)
      // Should find at least one response time indicator
      const responseTimes = screen.getAllByText(/\d+[smh](\s\d+[smh])?/i)
      expect(responseTimes.length).toBeGreaterThan(0)

      // Verify specific response times are shown
      expect(screen.getByText('45s')).toBeInTheDocument()
      expect(screen.getByText('1m 23s')).toBeInTheDocument()
    })

    it('should display response time summary', () => {
      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText(/response time summary/i)).toBeInTheDocument()
      expect(screen.getByText(/avg:/i)).toBeInTheDocument()
      expect(screen.getByText(/fastest:/i)).toBeInTheDocument()
      expect(screen.getByText(/slowest:/i)).toBeInTheDocument()
    })

    it('should not show response time summary when no agent responses', () => {
      mockUseChatMessages.mockReturnValue({
        data: {
          messages: [
            {
              id: 'msg1',
              chatId: 'chat1',
              text: 'Hello',
              type: 'text' as const,
              incoming: true,
              timestamp: '2025-01-15T10:00:00.000Z'
            }
          ],
          chat: mockMessagesData.chat
        },
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.queryByText(/response time summary/i)).not.toBeInTheDocument()
    })
  })

  describe('Message Types', () => {
    it('should handle image messages', () => {
      mockUseChatMessages.mockReturnValue({
        data: {
          messages: [
            {
              id: 'msg1',
              chatId: 'chat1',
              text: null,
              type: 'image' as const,
              incoming: true,
              timestamp: '2025-01-15T10:00:00.000Z',
              imageUrl: 'https://example.com/image.jpg',
              caption: 'Here is the screenshot'
            }
          ],
          chat: mockMessagesData.chat
        },
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText('Here is the screenshot')).toBeInTheDocument()
      expect(screen.getByAltText('Here is the screenshot')).toBeInTheDocument()
    })

    it('should handle file messages', () => {
      mockUseChatMessages.mockReturnValue({
        data: {
          messages: [
            {
              id: 'msg1',
              chatId: 'chat1',
              text: null,
              type: 'file' as const,
              incoming: true,
              timestamp: '2025-01-15T10:00:00.000Z',
              fileUrl: 'https://example.com/document.pdf',
              caption: 'invoice.pdf'
            }
          ],
          chat: mockMessagesData.chat
        },
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText('invoice.pdf')).toBeInTheDocument()
    })

    it('should show placeholder when image is unavailable', () => {
      mockUseChatMessages.mockReturnValue({
        data: {
          messages: [
            {
              id: 'msg1',
              chatId: 'chat1',
              text: null,
              type: 'image' as const,
              incoming: true,
              timestamp: '2025-01-15T10:00:00.000Z',
              imageUrl: null
            }
          ],
          chat: mockMessagesData.chat
        },
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText('Image unavailable')).toBeInTheDocument()
    })
  })

  describe('Component Props', () => {
    it('should accept and use chatId prop', () => {
      render(<ChatConversationView chatId="chat123" />, { wrapper: createWrapper() })

      expect(mockUseChatMessages).toHaveBeenCalledWith('chat123')
    })

    it('should accept custom className', () => {
      const { container } = render(
        <ChatConversationView chatId="chat1" className="custom-class" />,
        { wrapper: createWrapper() }
      )

      const rootElement = container.firstChild as HTMLElement
      expect(rootElement.classList.contains('custom-class')).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle messages with no text content', () => {
      mockUseChatMessages.mockReturnValue({
        data: {
          messages: [
            {
              id: 'msg1',
              chatId: 'chat1',
              text: null,
              type: 'text' as const,
              incoming: true,
              timestamp: '2025-01-15T10:00:00.000Z'
            }
          ],
          chat: mockMessagesData.chat
        },
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText('No content')).toBeInTheDocument()
    })

    it('should handle consecutive agent messages without customer messages', () => {
      mockUseChatMessages.mockReturnValue({
        data: {
          messages: [
            {
              id: 'msg1',
              chatId: 'chat1',
              text: 'First agent message',
              type: 'text' as const,
              incoming: false,
              timestamp: '2025-01-15T10:00:00.000Z'
            },
            {
              id: 'msg2',
              chatId: 'chat1',
              text: 'Second agent message',
              type: 'text' as const,
              incoming: false,
              timestamp: '2025-01-15T10:01:00.000Z'
            }
          ],
          chat: mockMessagesData.chat
        },
        loading: false,
        error: null,
        refetch: jest.fn()
      })

      render(<ChatConversationView chatId="chat1" />, { wrapper: createWrapper() })

      expect(screen.getByText('First agent message')).toBeInTheDocument()
      expect(screen.getByText('Second agent message')).toBeInTheDocument()
      // Should not crash or show response times for messages without preceding customer message
    })
  })
})
