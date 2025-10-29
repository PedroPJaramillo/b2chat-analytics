import { detectChatChanges } from '../change-detector'
import { Chat, ChatStatus } from '@prisma/client'

describe('Change Detector - Feature 001: Full Status Support', () => {
  const baseChat: Chat = {
    id: 'chat_123',
    b2chatId: '123',
    agentId: 'agent_1',
    contactId: 'contact_1',
    departmentId: null,
    provider: 'whatsapp',
    status: ChatStatus.PICKED_UP,
    isAgentAvailable: true,
    alias: null,
    tags: [],
    priority: 'normal',
    topic: null,
    unreadCount: 0,
    resolutionNote: null,
    direction: 'incoming',
    originalDirection: null,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    openedAt: new Date('2024-01-01T10:00:00Z'),
    pickedUpAt: new Date('2024-01-01T10:01:00Z'),
    responseAt: new Date('2024-01-01T10:02:00Z'),
    closedAt: null,
    duration: null,
    pollStartedAt: null,
    pollCompletedAt: null,
    pollAbandonedAt: null,
    pollResponse: null,
    isDeleted: false,
    deletedAt: null,
    deletionReason: null,
    lastModifiedAt: new Date('2024-01-01T10:02:00Z'),
    lastSyncAt: new Date('2024-01-01T10:02:00Z'),
    syncVersion: 1,
    timeToPickup: 60,
    firstResponseTime: 120,
    avgResponseTime: 150,
    resolutionTime: null,
    pickupSLA: true,
    firstResponseSLA: true,
    avgResponseSLA: true,
    resolutionSLA: null,
    overallSLA: true,
    timeToPickupBH: 60,
    firstResponseTimeBH: 120,
    avgResponseTimeBH: 150,
    resolutionTimeBH: null,
    pickupSLABH: true,
    firstResponseSLABH: true,
    avgResponseSLABH: true,
    resolutionSLABH: null,
    overallSLABH: true,
  }

  describe('Status Change Detection', () => {
    it('should detect status change from PICKED_UP to RESPONDED_BY_AGENT', () => {
      const rawData = {
        status: 'RESPONDED_BY_AGENT',
        provider: 'whatsapp',
      }

      const changes = detectChatChanges(baseChat, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.statusChanged).toBe(true)
      expect(changes?.previousStatus).toBe(ChatStatus.PICKED_UP)
      expect(changes?.newStatus).toBe('RESPONDED_BY_AGENT')
      expect(changes?.changedFields).toContain('status')
    })

    it('should detect status change from PICKED_UP to CLOSED', () => {
      const rawData = {
        status: 'CLOSED',
        provider: 'whatsapp',
        closed_at: '2024-01-01T11:00:00Z',
      }

      const changes = detectChatChanges(baseChat, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.statusChanged).toBe(true)
      expect(changes?.previousStatus).toBe(ChatStatus.PICKED_UP)
      expect(changes?.newStatus).toBe('CLOSED')
    })

    it('should detect no change when status is the same', () => {
      const rawData = {
        status: 'PICKED_UP',
        provider: 'whatsapp',
        opened_at: '2024-01-01T10:00:00Z',
        picked_up_at: '2024-01-01T10:01:00Z',
        responded_at: '2024-01-01T10:02:00Z',
      }

      const changes = detectChatChanges(baseChat, rawData)

      expect(changes.hasChanges).toBe(false)
      expect(changes.statusChanged).toBe(false)
    })
  })

  describe('Survey Field Change Detection', () => {
    it('should detect poll_started_at change', () => {
      const rawData = {
        status: 'COMPLETING_POLL',
        provider: 'whatsapp',
        poll_started_at: '2024-01-01T11:00:00Z',
      }

      const changes = detectChatChanges(baseChat, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.changedFields).toContain('status')
      expect(changes?.changedFields).toContain('pollStartedAt')
      expect(changes?.newValues.pollStartedAt).toEqual(new Date('2024-01-01T11:00:00Z'))
    })

    it('should detect poll_completed_at change', () => {
      const chatWithPoll: Chat = {
        ...baseChat,
        status: ChatStatus.COMPLETING_POLL,
        pollStartedAt: new Date('2024-01-01T11:00:00Z'),
      }

      const rawData = {
        status: 'COMPLETED_POLL',
        provider: 'whatsapp',
        poll_started_at: '2024-01-01T11:00:00Z',
        poll_completed_at: '2024-01-01T11:05:00Z',
        poll_response: {
          rating: 5,
          comment: 'Great service!',
        },
      }

      const changes = detectChatChanges(chatWithPoll, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.changedFields).toContain('status')
      expect(changes?.changedFields).toContain('pollCompletedAt')
      expect(changes?.changedFields).toContain('pollResponse')
      expect(changes?.newValues.pollCompletedAt).toEqual(new Date('2024-01-01T11:05:00Z'))
      expect(changes?.newValues.pollResponse).toEqual({
        rating: 5,
        comment: 'Great service!',
      })
    })

    it('should detect poll_abandoned_at change', () => {
      const chatWithPoll: Chat = {
        ...baseChat,
        status: ChatStatus.COMPLETING_POLL,
        pollStartedAt: new Date('2024-01-01T11:00:00Z'),
      }

      const rawData = {
        status: 'ABANDONED_POLL',
        provider: 'whatsapp',
        poll_started_at: '2024-01-01T11:00:00Z',
        poll_abandoned_at: '2024-01-02T11:00:00Z', // 24 hours later
      }

      const changes = detectChatChanges(chatWithPoll, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.changedFields).toContain('status')
      expect(changes?.changedFields).toContain('pollAbandonedAt')
      expect(changes?.newValues.pollAbandonedAt).toEqual(new Date('2024-01-02T11:00:00Z'))
    })

    it('should not detect change when poll fields are the same', () => {
      const chatWithPoll: Chat = {
        ...baseChat,
        status: ChatStatus.COMPLETED_POLL,
        pollStartedAt: new Date('2024-01-01T11:00:00Z'),
        pollCompletedAt: new Date('2024-01-01T11:05:00Z'),
        pollResponse: { rating: 5 },
      }

      const rawData = {
        status: 'COMPLETED_POLL',
        provider: 'whatsapp',
        opened_at: '2024-01-01T10:00:00Z',
        picked_up_at: '2024-01-01T10:01:00Z',
        responded_at: '2024-01-01T10:02:00Z',
        poll_started_at: '2024-01-01T11:00:00Z',
        poll_completed_at: '2024-01-01T11:05:00Z',
        poll_response: { rating: 5 },
      }

      const changes = detectChatChanges(chatWithPoll, rawData)

      expect(changes.hasChanges).toBe(false)
      expect(changes.statusChanged).toBe(false)
    })

    it('should detect poll_response change', () => {
      const chatWithPoll: Chat = {
        ...baseChat,
        status: ChatStatus.COMPLETED_POLL,
        pollStartedAt: new Date('2024-01-01T11:00:00Z'),
        pollCompletedAt: new Date('2024-01-01T11:05:00Z'),
        pollResponse: { rating: 4 },
      }

      const rawData = {
        status: 'COMPLETED_POLL',
        provider: 'whatsapp',
        opened_at: '2024-01-01T10:00:00Z',
        picked_up_at: '2024-01-01T10:01:00Z',
        responded_at: '2024-01-01T10:02:00Z',
        poll_started_at: '2024-01-01T11:00:00Z',
        poll_completed_at: '2024-01-01T11:05:00Z',
        poll_response: { rating: 5, comment: 'Updated rating' },
      }

      const changes = detectChatChanges(chatWithPoll, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.changedFields).toContain('pollResponse')
      expect(changes?.oldValues.pollResponse).toEqual({ rating: 4 })
      expect(changes?.newValues.pollResponse).toEqual({ rating: 5, comment: 'Updated rating' })
    })
  })

  describe('Status Normalization', () => {
    it('should use status from rawData without transformation', () => {
      const rawData = {
        status: 'BOT_CHATTING',
        provider: 'whatsapp',
      }

      const changes = detectChatChanges(baseChat, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.newValues.status).toBe('BOT_CHATTING')
    })

    it('should default to OPENED when status is missing', () => {
      const rawData = {
        provider: 'whatsapp',
        // no status field
      }

      const changes = detectChatChanges(baseChat, rawData)

      expect(changes).not.toBeNull()
      expect(changes?.newValues.status).toBe('OPENED')
    })
  })
})
