import { TransformEngine } from '../transform-engine'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    transformLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
    rawContact: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    contact: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    rawChat: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    chat: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

// Mock SLA modules
jest.mock('@/lib/sla/sla-calculator-full', () => ({
  calculateAllSLAMetricsWithBusinessHours: jest.fn(),
}))

jest.mock('@/lib/config/sla-config', () => ({
  getSLAConfig: jest.fn(),
  getOfficeHoursConfig: jest.fn(),
}))

jest.mock('@/lib/sla/sla-logger', () => ({
  slaLogger: {
    logCalculation: jest.fn(),
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('TransformEngine - Feature 002: Contact Field Fixes', () => {
  let engine: TransformEngine

  beforeEach(() => {
    jest.clearAllMocks()
    engine = new TransformEngine()

    // Default mock for transformLog operations
    mockPrisma.transformLog.create.mockResolvedValue({
      id: 'transform_log_test',
      syncId: 'test_sync',
      extractSyncId: 'extract_123',
      entityType: 'contacts',
      startedAt: new Date(),
      status: 'running',
    } as any)

    mockPrisma.transformLog.update.mockResolvedValue({} as any)
  })

  describe('Landline Field Mapping', () => {
    it('should map landline field correctly when creating new contact', async () => {
      const rawContact = {
        id: 'raw_123',
        syncId: 'extract_123',
        rawData: {
          contact_id: '123',
          fullname: 'Office User',
          mobile: '+573001234567',
          landline: '+571234567',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null) // New contact
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_123')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phoneNumber: '+571234567', // Should be landline, not phone_number
          mobile: '+573001234567',
        }),
      })
    })

    it('should map landline field correctly when updating existing contact', async () => {
      const rawContact = {
        id: 'raw_123',
        syncId: 'extract_123',
        rawData: {
          contact_id: '123',
          fullname: 'Office User',
          mobile: '+573001234567',
          landline: '+571234567',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      const existingContact = {
        id: 'contact_123',
        b2chatId: '123',
        fullName: 'Office User',
        mobile: '+573001234567',
        phoneNumber: null, // No landline before
        email: null,
        identification: null,
        address: null,
        city: null,
        country: null,
        company: null,
        customAttributes: null,
        tags: null,
        merchantId: null,
        b2chatCreatedAt: null,
        b2chatUpdatedAt: null,
        isDeleted: false,
        deletedAt: null,
        deletionReason: null,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        chats: [],
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(existingContact as any)
      mockPrisma.contact.update.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_123')

      expect(mockPrisma.contact.update).toHaveBeenCalledWith({
        where: { b2chatId: '123' },
        data: expect.objectContaining({
          phoneNumber: '+571234567',
        }),
      })
    })
  })

  describe('Tags Field Storage', () => {
    it('should store tags as JSON with assignment timestamps', async () => {
      const rawContact = {
        id: 'raw_456',
        syncId: 'extract_456',
        rawData: {
          contact_id: '456',
          fullname: 'Tagged User',
          tags: [
            { name: 'VIP', assigned_at: 1706644084 },
            { name: 'Premium', assigned_at: 1706648900 },
          ],
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_456')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tags: [
            { name: 'VIP', assigned_at: 1706644084 },
            { name: 'Premium', assigned_at: 1706648900 },
          ],
        }),
      })
    })

    it('should handle null tags gracefully', async () => {
      const rawContact = {
        id: 'raw_111',
        syncId: 'extract_111',
        rawData: {
          contact_id: '111',
          fullname: 'No Tags User',
          tags: null,
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_111')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tags: undefined, // null becomes undefined
        }),
      })
    })

    it('should handle dynamic new tags without code change', async () => {
      const rawContact = {
        id: 'raw_222',
        syncId: 'extract_222',
        rawData: {
          contact_id: '222',
          fullname: 'Dynamic Tags User',
          tags: [
            { name: 'VIP', assigned_at: 1706644084 },
            { name: 'Urgent Follow-up', assigned_at: 1730000000 }, // New tag!
          ],
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_222')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tags: expect.arrayContaining([
            { name: 'Urgent Follow-up', assigned_at: 1730000000 },
          ]),
        }),
      })
    })
  })

  describe('Merchant ID Field', () => {
    it('should store merchant_id as string when provided as number', async () => {
      const rawContact = {
        id: 'raw_789',
        syncId: 'extract_789',
        rawData: {
          contact_id: '789',
          fullname: 'Merchant User',
          merchant_id: 100,
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_789')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          merchantId: '100', // Converted to string
        }),
      })
    })

    it('should store merchant_id as string when provided as string', async () => {
      const rawContact = {
        id: 'raw_790',
        syncId: 'extract_790',
        rawData: {
          contact_id: '790',
          fullname: 'Merchant User',
          merchant_id: 'merchant_abc',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_790')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          merchantId: 'merchant_abc',
        }),
      })
    })
  })

  describe('B2Chat Original Timestamps', () => {
    it('should parse and store B2Chat created/updated timestamps', async () => {
      const rawContact = {
        id: 'raw_999',
        syncId: 'extract_999',
        rawData: {
          contact_id: '999',
          fullname: 'Old Contact',
          created: '2020-11-09 19:10:23',
          updated: '2024-01-25 16:24:14',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_999')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          b2chatCreatedAt: new Date('2020-11-09 19:10:23'),
          b2chatUpdatedAt: new Date('2024-01-25 16:24:14'),
        }),
      })
    })

    it('should handle null created/updated timestamps', async () => {
      const rawContact = {
        id: 'raw_1000',
        syncId: 'extract_1000',
        rawData: {
          contact_id: '1000',
          fullname: 'Contact Without Dates',
          created: null,
          updated: null,
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_1000')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          b2chatCreatedAt: undefined,
          b2chatUpdatedAt: undefined,
        }),
      })
    })
  })

  describe('Complete Field Mapping Integration', () => {
    it('should map all fields correctly in a comprehensive test', async () => {
      const rawContact = {
        id: 'raw_complete',
        syncId: 'extract_complete',
        rawData: {
          contact_id: '12345',
          fullname: 'Complete Test User',
          mobile: '+573001234567',
          landline: '+571234567',
          email: 'test@example.com',
          merchant_id: 100,
          tags: [
            { name: 'VIP', assigned_at: 1706644084 },
            { name: 'Premium', assigned_at: 1706648900 },
          ],
          created: '2020-11-09 19:10:23',
          updated: '2024-01-25 16:24:14',
          custom_attributes: { tier: 'gold' },
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      await engine.transformContacts('extract_complete')

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          b2chatId: '12345',
          fullName: 'Complete Test User',
          mobile: '+573001234567',
          phoneNumber: '+571234567',
          email: 'test@example.com',
          merchantId: '100',
          tags: [
            { name: 'VIP', assigned_at: 1706644084 },
            { name: 'Premium', assigned_at: 1706648900 },
          ],
          b2chatCreatedAt: new Date('2020-11-09 19:10:23'),
          b2chatUpdatedAt: new Date('2024-01-25 16:24:14'),
          customAttributes: { tier: 'gold' },
        }),
      })
    })
  })
})

describe('TransformEngine - Feature 004: SLA Calculation Integration', () => {
  let engine: TransformEngine
  const mockCalculateAllSLAMetricsWithBusinessHours = require('@/lib/sla/sla-calculator-full')
    .calculateAllSLAMetricsWithBusinessHours as jest.Mock
  const mockGetSLAConfig = require('@/lib/config/sla-config').getSLAConfig as jest.Mock
  const mockGetOfficeHoursConfig = require('@/lib/config/sla-config')
    .getOfficeHoursConfig as jest.Mock
  const mockSlaLogger = require('@/lib/sla/sla-logger').slaLogger

  beforeEach(() => {
    jest.clearAllMocks()
    engine = new TransformEngine()

    // Default mock for transformLog operations
    mockPrisma.transformLog.create.mockResolvedValue({
      id: 'transform_log_test',
      syncId: 'test_sync',
      extractSyncId: 'extract_123',
      entityType: 'chats',
      startedAt: new Date(),
      status: 'running',
    } as any)

    mockPrisma.transformLog.update.mockResolvedValue({} as any)

    // Mock SLA config
    mockGetSLAConfig.mockResolvedValue({
      pickupTarget: 120,
      firstResponseTarget: 300,
      avgResponseTarget: 300,
      resolutionTarget: 7200,
      complianceTarget: 95,
    })

    mockGetOfficeHoursConfig.mockResolvedValue({
      start: '09:00',
      end: '17:00',
      workingDays: [1, 2, 3, 4, 5],
      timezone: 'America/New_York',
    })

    // Mock SLA calculator to return metrics
    mockCalculateAllSLAMetricsWithBusinessHours.mockReturnValue({
      timeToPickup: 60,
      firstResponseTime: 120,
      avgResponseTime: 180,
      resolutionTime: 3600,
      pickupSLA: true,
      firstResponseSLA: true,
      avgResponseSLA: true,
      resolutionSLA: true,
      overallSLA: true,
      timeToPickupBH: 50,
      firstResponseTimeBH: 100,
      avgResponseTimeBH: 150,
      resolutionTimeBH: 3000,
      pickupSLABH: true,
      firstResponseSLABH: true,
      avgResponseSLABH: true,
      resolutionSLABH: true,
      overallSLABH: true,
    })

    mockSlaLogger.logCalculation.mockResolvedValue(undefined)
  })

  describe('SLA Calculation for New Chats', () => {
    it('should calculate and include SLA metrics when creating new chat', async () => {
      const rawChat = {
        id: 'raw_chat_123',
        syncId: 'extract_123',
        rawData: {
          chat_id: 'chat_123',
          opened_at: '2024-10-23 09:00:00',
          picked_up_at: '2024-10-23 09:01:00',
          responded_at: '2024-10-23 09:02:00',
          closed_at: '2024-10-23 10:00:00',
          status: 'CLOSED',
          messages: [
            { incoming: true, created_at: '2024-10-23 09:00:00', body: 'Hello' },
            { incoming: false, created_at: '2024-10-23 09:02:00', body: 'Hi there' },
          ],
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null) // New chat
      mockPrisma.chat.create.mockResolvedValue({ id: 'chat_chat_123' } as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_123')

      // Verify SLA calculation was called
      expect(mockCalculateAllSLAMetricsWithBusinessHours).toHaveBeenCalled()

      // Verify SLA logger was called
      expect(mockSlaLogger.logCalculation).toHaveBeenCalledWith(
        'chat_chat_123',
        expect.any(Object),
        'initial'
      )

      // Verify chat created with SLA fields
      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'chat_chat_123',
          b2chatId: 'chat_123',
          // Wall clock SLA metrics
          timeToPickup: 60,
          firstResponseTime: 120,
          avgResponseTime: 180,
          resolutionTime: 3600,
          pickupSLA: true,
          firstResponseSLA: true,
          avgResponseSLA: true,
          resolutionSLA: true,
          overallSLA: true,
          // Business hours SLA metrics
          timeToPickupBH: 50,
          firstResponseTimeBH: 100,
          avgResponseTimeBH: 150,
          resolutionTimeBH: 3000,
          pickupSLABH: true,
          firstResponseSLABH: true,
          avgResponseSLABH: true,
          resolutionSLABH: true,
          overallSLABH: true,
        }),
      })
    })

    it('should handle SLA calculation errors gracefully and continue chat creation', async () => {
      const rawChat = {
        id: 'raw_chat_456',
        syncId: 'extract_123',
        rawData: {
          chat_id: 'chat_456',
          opened_at: '2024-10-23 09:00:00',
          status: 'OPENED',
          messages: [],
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      // Mock SLA calculator to throw error
      mockCalculateAllSLAMetricsWithBusinessHours.mockImplementation(() => {
        throw new Error('SLA calculation failed')
      })

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null)
      mockPrisma.chat.create.mockResolvedValue({ id: 'chat_chat_456' } as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_123')

      // Chat should still be created even though SLA failed
      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'chat_chat_456',
          b2chatId: 'chat_456',
          // SLA fields should NOT be present when calculation fails
        }),
      })

      // Verify SLA fields are not in the data
      const createCall = mockPrisma.chat.create.mock.calls[0][0]
      expect(createCall.data).not.toHaveProperty('timeToPickup')
      expect(createCall.data).not.toHaveProperty('overallSLA')
    })
  })

  describe('SLA Calculation for Updated Chats', () => {
    it('should recalculate SLA metrics when updating existing chat', async () => {
      const existingChat = {
        id: 'chat_existing_789',
        b2chatId: 'chat_789',
        status: 'OPENED',
        openedAt: new Date('2024-10-23 08:00:00'),
        pickedUpAt: null,
        responseAt: null,
        closedAt: null,
        messages: [],
      }

      const rawChat = {
        id: 'raw_chat_789',
        syncId: 'extract_123',
        rawData: {
          chat_id: 'chat_789',
          opened_at: '2024-10-23 08:00:00',
          picked_up_at: '2024-10-23 08:01:00', // Now picked up
          responded_at: '2024-10-23 08:02:00', // Now responded
          closed_at: '2024-10-23 09:00:00', // Now closed
          status: 'CLOSED',
          messages: [
            { incoming: true, created_at: '2024-10-23 08:00:00', body: 'Question' },
            { incoming: false, created_at: '2024-10-23 08:02:00', body: 'Answer' },
          ],
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.chat.findUnique.mockResolvedValue(existingChat as any)
      mockPrisma.chat.update.mockResolvedValue({} as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_123')

      // Verify SLA calculation was called
      expect(mockCalculateAllSLAMetricsWithBusinessHours).toHaveBeenCalled()

      // Verify chat updated with recalculated SLA fields
      expect(mockPrisma.chat.update).toHaveBeenCalledWith({
        where: { b2chatId: 'chat_789' },
        data: expect.objectContaining({
          timeToPickup: 60,
          firstResponseTime: 120,
          overallSLA: true,
          overallSLABH: true,
        }),
      })
    })
  })
})

describe('TransformEngine - Fix 005: Batch-Agnostic Transform', () => {
  let engine: TransformEngine

  beforeEach(() => {
    jest.clearAllMocks()
    engine = new TransformEngine()

    // Default mock for transformLog operations
    mockPrisma.transformLog.create.mockResolvedValue({
      id: 'transform_log_test',
      syncId: 'test_sync',
      extractSyncId: null,
      entityType: 'contacts',
      startedAt: new Date(),
      status: 'running',
    } as any)

    mockPrisma.transformLog.update.mockResolvedValue({} as any)
  })

  describe('Batch-Agnostic Mode (without extractSyncId)', () => {
    it('should transform contacts from all completed extracts when extractSyncId not provided', async () => {
      // Mock extractLog to add the findMany method
      ;(mockPrisma as any).extractLog = {
        findMany: jest.fn().mockResolvedValue([
          { syncId: 'extract_contacts_1', entityType: 'contacts' },
          { syncId: 'extract_all_1', entityType: 'all' },
        ]),
      }

      const rawContact1 = {
        id: 'raw_1',
        syncId: 'extract_contacts_1',
        rawData: { contact_id: '1', fullname: 'User 1' },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      const rawContact2 = {
        id: 'raw_2',
        syncId: 'extract_all_1',
        rawData: { contact_id: '2', fullname: 'User 2' },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact1, rawContact2] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      // Call without extractSyncId (batch-agnostic mode)
      const result = await engine.transformContacts(undefined)

      // Verify extractLog was queried for completed extracts
      expect((mockPrisma as any).extractLog.findMany).toHaveBeenCalledWith({
        where: {
          status: 'completed',
          OR: [{ entityType: 'contacts' }, { entityType: 'all' }],
        },
        select: { syncId: true },
      })

      // Verify rawContact query included both extract IDs
      expect(mockPrisma.rawContact.findMany).toHaveBeenCalledWith({
        where: {
          processingStatus: 'pending',
          syncId: { in: ['extract_contacts_1', 'extract_all_1'] },
        },
        orderBy: { fetchedAt: 'asc' },
      })

      // Verify both contacts were processed
      expect(mockPrisma.contact.create).toHaveBeenCalledTimes(2)
      expect(result.recordsProcessed).toBe(2)
      expect(result.extractSyncId).toBeNull()
    })

    it('should only process data from completed extracts (not running ones)', async () => {
      ;(mockPrisma as any).extractLog = {
        findMany: jest.fn().mockResolvedValue([
          { syncId: 'extract_contacts_completed', entityType: 'contacts' },
        ]),
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([])
      await engine.transformContacts(undefined)

      // Verify only completed extracts were queried
      expect((mockPrisma as any).extractLog.findMany).toHaveBeenCalledWith({
        where: {
          status: 'completed',
          OR: [{ entityType: 'contacts' }, { entityType: 'all' }],
        },
        select: { syncId: true },
      })
    })

    it('should handle empty pending data gracefully', async () => {
      ;(mockPrisma as any).extractLog = {
        findMany: jest.fn().mockResolvedValue([
          { syncId: 'extract_1', entityType: 'contacts' },
        ]),
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([])

      const result = await engine.transformContacts(undefined)

      expect(result.status).toBe('completed')
      expect(result.recordsProcessed).toBe(0)
      expect(result.extractSyncId).toBeNull()
    })
  })

  describe('Legacy Mode (with extractSyncId)', () => {
    it('should still work with extractSyncId provided (backward compatibility)', async () => {
      const rawContact = {
        id: 'raw_legacy',
        syncId: 'extract_specific',
        rawData: { contact_id: 'legacy', fullname: 'Legacy User' },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.contact.create.mockResolvedValue({} as any)
      mockPrisma.rawContact.update.mockResolvedValue({} as any)

      // Call with extractSyncId (legacy mode)
      const result = await engine.transformContacts('extract_specific')

      // Verify traditional query without getCompletedExtractIds
      expect(mockPrisma.rawContact.findMany).toHaveBeenCalledWith({
        where: {
          syncId: 'extract_specific',
          processingStatus: 'pending',
        },
        orderBy: { fetchedAt: 'asc' },
      })

      expect(result.extractSyncId).toBe('extract_specific')
      expect(result.recordsProcessed).toBe(1)
    })
  })

  describe('Fix 006: Contact Deduplication - Smart Stub Strategy', () => {
    beforeEach(() => {
      // Mock ExtractLog for batch-agnostic mode
      ;(prisma as any).extractLog = {
        findMany: jest.fn().mockResolvedValue([
          { syncId: 'extract_chat_1', entityType: 'chats' },
        ]),
      }
    })

    it('should create stub contact from chat embedding when contact does not exist', async () => {
      const rawChat = {
        id: 'raw_chat_1',
        syncId: 'extract_chat_1',
        rawData: {
          chat_id: '47a87b2f-5755-4e28-8a2e-28ac40dea80c',
          contact: {
            id: 63448755, // Real B2Chat contact ID
            name: 'Omaira Ruiz',
            tags: null,
            email: '',
            mobile: '+573117023474',
            fullname: 'Omaira Ruiz',
            phone_number: '',
            mobile_number: '+573117023474',
            identification: '',
            custom_attributes: null,
          },
          status: 'RESPONDED_BY_AGENT',
          created_at: '2025-10-28 10:44:57',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null) // No existing contact
      mockPrisma.contact.create.mockResolvedValue({
        id: 'contact_63448755',
        b2chatId: '63448755',
        syncSource: 'chat_embedded',
        needsFullSync: true,
      } as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null)
      mockPrisma.chat.create.mockResolvedValue({} as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_chat_1')

      // Should create stub contact with chat_embedded source
      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          b2chatId: '63448755',
          fullName: 'Omaira Ruiz',
          mobile: '+573117023474',
          syncSource: 'chat_embedded',
          needsFullSync: true,
        }),
      })
    })

    it('should link to existing full contact without updating (contacts_api source)', async () => {
      const rawChat = {
        id: 'raw_chat_2',
        syncId: 'extract_chat_1',
        rawData: {
          chat_id: 'chat_456',
          contact: {
            id: 67890, // Real B2Chat contact ID
            identification: 'ID_67890',
            name: 'Different Name',
            mobile: '+573009999999',
            fullname: 'Different Name',
            email: '',
            phone_number: '',
            mobile_number: '+573009999999',
          },
          status: 'CLOSED',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      const existingFullContact = {
        id: 'contact_67890',
        b2chatId: '67890',
        fullName: 'Original Name',
        mobile: '+573001111111',
        email: 'original@example.com',
        syncSource: 'contacts_api', // Full contact from API
        needsFullSync: false,
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(existingFullContact as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null)
      mockPrisma.chat.create.mockResolvedValue({} as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_chat_1')

      // Should NOT update the full contact
      expect(mockPrisma.contact.update).not.toHaveBeenCalled()
      // Should create chat linking to existing contact
      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: 'contact_67890',
        }),
      })
    })

    it('should link to existing upgraded contact without updating', async () => {
      const rawChat = {
        id: 'raw_chat_3',
        syncId: 'extract_chat_1',
        rawData: {
          chat_id: 'chat_789',
          contact: {
            id: 11111, // Real B2Chat contact ID
            identification: 'ID_UPGRADED',
            name: 'New Name',
            fullname: 'New Name',
            email: '',
            mobile: '+573001122333',
            phone_number: '',
            mobile_number: '+573001122333',
          },
          status: 'CLOSED',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      const upgradedContact = {
        id: 'contact_11111',
        b2chatId: '11111',
        fullName: 'Upgraded Contact',
        syncSource: 'upgraded', // Was stub, now upgraded
        needsFullSync: false,
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(upgradedContact as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null)
      mockPrisma.chat.create.mockResolvedValue({} as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_chat_1')

      // Should NOT update the upgraded contact
      expect(mockPrisma.contact.update).not.toHaveBeenCalled()
      // Should create chat linking to existing contact
      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: 'contact_11111',
        }),
      })
    })

    it('should update existing stub contact with newer embedded data', async () => {
      const rawChat = {
        id: 'raw_chat_4',
        syncId: 'extract_chat_1',
        rawData: {
          chat_id: 'chat_999',
          contact: {
            id: 22222, // Real B2Chat contact ID
            mobile: '+573002222222',
            name: 'Updated Name',
            fullname: 'Updated Name',
            email: 'updated@example.com',
            phone_number: '',
            mobile_number: '+573002222222',
            identification: '',
          },
          status: 'CLOSED',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      const existingStub = {
        id: 'contact_22222',
        b2chatId: '22222',
        fullName: 'Old Name',
        mobile: '+573002222222',
        email: null,
        syncSource: 'chat_embedded', // Existing stub
        needsFullSync: true,
      }

      // Mock detectContactChanges to return changes
      const mockContactChanges = {
        hasChanges: true,
        changes: ['fullName', 'email'],
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.contact.findUnique.mockResolvedValue(existingStub as any)
      mockPrisma.contact.update.mockResolvedValue({} as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null)
      mockPrisma.chat.create.mockResolvedValue({} as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_chat_1')

      // Should update the stub with newer data
      expect(mockPrisma.contact.update).toHaveBeenCalledWith({
        where: { b2chatId: '22222' },
        data: expect.objectContaining({
          fullName: 'Updated Name',
          email: 'updated@example.com',
          mobile: '+573002222222',
        }),
      })
    })

    it('should handle chat without contact data gracefully (NULL contactId)', async () => {
      const rawChat = {
        id: 'raw_chat_5',
        syncId: 'extract_chat_1',
        rawData: {
          chat_id: 'chat_no_contact',
          contact: null, // No contact data
          status: 'CLOSED',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null)
      mockPrisma.chat.create.mockResolvedValue({} as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_chat_1')

      // Should create chat with NULL contactId (no contact created)
      expect(mockPrisma.contact.create).not.toHaveBeenCalled()
      expect(mockPrisma.contact.update).not.toHaveBeenCalled()
      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          b2chatId: 'chat_no_contact',
          contactId: null, // NULL is valid
        }),
      })
    })

    it('should handle contact with no valid identifier gracefully', async () => {
      const rawChat = {
        id: 'raw_chat_6',
        syncId: 'extract_chat_1',
        rawData: {
          chat_id: 'chat_invalid',
          contact: {
            // No identification, mobile, email, or name
            random_field: 'value',
          },
          status: 'CLOSED',
        },
        processingStatus: 'pending',
        fetchedAt: new Date(),
        processingAttempt: 0,
      }

      mockPrisma.rawChat.findMany.mockResolvedValue([rawChat] as any)
      mockPrisma.chat.findUnique.mockResolvedValue(null)
      mockPrisma.chat.create.mockResolvedValue({} as any)
      mockPrisma.rawChat.update.mockResolvedValue({} as any)

      await engine.transformChats('extract_chat_1')

      // Should not create contact (invalid data)
      expect(mockPrisma.contact.create).not.toHaveBeenCalled()
      expect(mockPrisma.contact.update).not.toHaveBeenCalled()
      // Should create chat with NULL contactId
      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          b2chatId: 'chat_invalid',
          contactId: null,
        }),
      })
    })

    describe('transformContacts() - Upgrade Logic', () => {
      it('should upgrade stub contact to full contact with API data', async () => {
        const rawContact = {
          id: 'raw_contact_1',
          syncId: 'extract_contacts_1',
          b2chatContactId: 'STUB_123',
          rawData: {
            contact_id: 'STUB_123',
            fullname: 'Full Name from API',
            mobile: '+573001111111',
            email: 'api@example.com',
            address: '123 API Street',
            tags: [{ name: 'VIP', assigned_at: 1706644084 }],
            merchant_id: 'MERCHANT_001',
            created: '2024-01-01T00:00:00Z',
            updated: '2024-06-15T00:00:00Z',
          },
          processingStatus: 'pending',
          fetchedAt: new Date(),
          processingAttempt: 0,
        }

        const existingStub = {
          id: 'contact_STUB_123',
          b2chatId: 'STUB_123',
          fullName: 'Stub Name',
          mobile: '+573002222222',
          email: null,
          syncSource: 'chat_embedded', // Stub
          needsFullSync: true,
        }

        mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
        mockPrisma.contact.findUnique.mockResolvedValue(existingStub as any)
        mockPrisma.contact.update.mockResolvedValue({} as any)
        mockPrisma.rawContact.update.mockResolvedValue({} as any)

        const result = await engine.transformContacts('extract_contacts_1')

        // Should upgrade the stub
        expect(mockPrisma.contact.update).toHaveBeenCalledWith({
          where: { b2chatId: 'STUB_123' },
          data: expect.objectContaining({
            fullName: 'Full Name from API',
            mobile: '+573001111111',
            email: 'api@example.com',
            address: '123 API Street',
            syncSource: 'upgraded', // Changed from chat_embedded
            needsFullSync: false, // Changed from true
          }),
        })

        expect(result.recordsUpdated).toBe(1)
        expect(result.recordsCreated).toBe(0)
      })

      it('should preserve existing stub data when API returns null', async () => {
        const rawContact = {
          id: 'raw_contact_2',
          syncId: 'extract_contacts_1',
          b2chatContactId: 'STUB_456',
          rawData: {
            contact_id: 'STUB_456',
            fullname: 'Name from API',
            mobile: null, // API has no mobile
            email: null, // API has no email
          },
          processingStatus: 'pending',
          fetchedAt: new Date(),
          processingAttempt: 0,
        }

        const existingStub = {
          id: 'contact_STUB_456',
          b2chatId: 'STUB_456',
          fullName: 'Stub Name',
          mobile: '+573003333333', // Stub has mobile
          email: 'stub@example.com', // Stub has email
          syncSource: 'chat_embedded',
          needsFullSync: true,
        }

        mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
        mockPrisma.contact.findUnique.mockResolvedValue(existingStub as any)
        mockPrisma.contact.update.mockResolvedValue({} as any)
        mockPrisma.rawContact.update.mockResolvedValue({} as any)

        await engine.transformContacts('extract_contacts_1')

        // Should preserve stub's mobile and email when API returns null
        expect(mockPrisma.contact.update).toHaveBeenCalledWith({
          where: { b2chatId: 'STUB_456' },
          data: expect.objectContaining({
            fullName: 'Name from API', // API wins
            mobile: '+573003333333', // Preserved from stub
            email: 'stub@example.com', // Preserved from stub
            syncSource: 'upgraded',
            needsFullSync: false,
          }),
        })
      })

      it('should create new full contact with contacts_api source when no stub exists', async () => {
        const rawContact = {
          id: 'raw_contact_3',
          syncId: 'extract_contacts_1',
          b2chatContactId: 'NEW_789',
          rawData: {
            contact_id: 'NEW_789',
            fullname: 'New Contact',
            mobile: '+573004444444',
            email: 'new@example.com',
          },
          processingStatus: 'pending',
          fetchedAt: new Date(),
          processingAttempt: 0,
        }

        mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
        mockPrisma.contact.findUnique.mockResolvedValue(null) // No existing contact
        mockPrisma.contact.create.mockResolvedValue({} as any)
        mockPrisma.rawContact.update.mockResolvedValue({} as any)

        const result = await engine.transformContacts('extract_contacts_1')

        // Should create new contact with contacts_api source
        expect(mockPrisma.contact.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            b2chatId: 'NEW_789',
            fullName: 'New Contact',
            mobile: '+573004444444',
            email: 'new@example.com',
            syncSource: 'contacts_api', // New contact from API
            needsFullSync: false,
          }),
        })

        expect(result.recordsCreated).toBe(1)
        expect(result.recordsUpdated).toBe(0)
      })

      it('should NOT upgrade contacts_api or upgraded contacts (normal update)', async () => {
        const rawContact = {
          id: 'raw_contact_4',
          syncId: 'extract_contacts_1',
          b2chatContactId: 'FULL_999',
          rawData: {
            contact_id: 'FULL_999',
            fullname: 'Updated Full Name',
            mobile: '+573005555555',
          },
          processingStatus: 'pending',
          fetchedAt: new Date(),
          processingAttempt: 0,
        }

        const existingFullContact = {
          id: 'contact_FULL_999',
          b2chatId: 'FULL_999',
          fullName: 'Original Full Name',
          mobile: '+573005555555',
          syncSource: 'contacts_api', // Already full contact
          needsFullSync: false,
        }

        // Mock detectContactChanges to return changes
        ;(prisma as any).contact = {
          ...mockPrisma.contact,
          findUnique: jest.fn().mockResolvedValue(existingFullContact),
          update: jest.fn().mockResolvedValue({}),
        }

        mockPrisma.rawContact.findMany.mockResolvedValue([rawContact] as any)
        mockPrisma.rawContact.update.mockResolvedValue({} as any)

        await engine.transformContacts('extract_contacts_1')

        // Should do normal update, NOT upgrade
        expect(mockPrisma.contact.update).toHaveBeenCalled()
        const updateCall = mockPrisma.contact.update.mock.calls[0][0]

        // syncSource should NOT change to 'upgraded'
        expect(updateCall.data.syncSource).toBeUndefined()
      })
    })
  })
})
