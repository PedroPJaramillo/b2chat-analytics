/**
 * @jest-environment node
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('SLA Schema Migration Tests', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Chat Model SLA Columns', () => {
    it('should have timeToPickup column (nullable integer)', async () => {
      const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'chats' AND column_name = 'timeToPickup';
      `;

      expect(tableInfo).toHaveLength(1);
      expect(tableInfo[0].data_type).toBe('integer');
      expect(tableInfo[0].is_nullable).toBe('YES');
    });

    it('should have firstResponseTime column (nullable integer)', async () => {
      const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'chats' AND column_name = 'firstResponseTime';
      `;

      expect(tableInfo).toHaveLength(1);
      expect(tableInfo[0].data_type).toBe('integer');
      expect(tableInfo[0].is_nullable).toBe('YES');
    });

    it('should have avgResponseTime column (nullable double precision)', async () => {
      const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'chats' AND column_name = 'avgResponseTime';
      `;

      expect(tableInfo).toHaveLength(1);
      expect(tableInfo[0].data_type).toBe('double precision');
      expect(tableInfo[0].is_nullable).toBe('YES');
    });

    it('should have resolutionTime column (nullable integer)', async () => {
      const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'chats' AND column_name = 'resolutionTime';
      `;

      expect(tableInfo).toHaveLength(1);
      expect(tableInfo[0].data_type).toBe('integer');
      expect(tableInfo[0].is_nullable).toBe('YES');
    });

    it('should have all 5 SLA compliance flag columns (nullable boolean)', async () => {
      const columns = ['pickupSLA', 'firstResponseSLA', 'avgResponseSLA', 'resolutionSLA', 'overallSLA'];

      for (const column of columns) {
        const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'chats' AND column_name = ${column};
        `;

        expect(tableInfo).toHaveLength(1);
        expect(tableInfo[0].data_type).toBe('boolean');
        expect(tableInfo[0].is_nullable).toBe('YES');
      }
    });

    it('should have all 4 business hours metric columns (nullable)', async () => {
      const columns = [
        { name: 'timeToPickupBH', type: 'integer' },
        { name: 'firstResponseTimeBH', type: 'integer' },
        { name: 'avgResponseTimeBH', type: 'double precision' },
        { name: 'resolutionTimeBH', type: 'integer' }
      ];

      for (const column of columns) {
        const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'chats' AND column_name = ${column.name};
        `;

        expect(tableInfo).toHaveLength(1);
        expect(tableInfo[0].data_type).toBe(column.type);
        expect(tableInfo[0].is_nullable).toBe('YES');
      }
    });

    it('should have all 5 business hours compliance flag columns (nullable boolean)', async () => {
      const columns = ['pickupSLABH', 'firstResponseSLABH', 'avgResponseSLABH', 'resolutionSLABH', 'overallSLABH'];

      for (const column of columns) {
        const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'chats' AND column_name = ${column};
        `;

        expect(tableInfo).toHaveLength(1);
        expect(tableInfo[0].data_type).toBe('boolean');
        expect(tableInfo[0].is_nullable).toBe('YES');
      }
    });
  });

  describe('SLA Indexes', () => {
    it('should have index on overallSLA column', async () => {
      const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'chats' AND indexname = 'idx_chat_overallSLA';
      `;

      expect(indexes).toHaveLength(1);
    });

    it('should have index on overallSLABH column', async () => {
      const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'chats' AND indexname = 'idx_chat_overallSLABH';
      `;

      expect(indexes).toHaveLength(1);
    });

    it('should have indexes on individual SLA metrics', async () => {
      const expectedIndexes = [
        'idx_chat_pickupSLA',
        'idx_chat_firstResponseSLA',
        'idx_chat_avgResponseSLA',
        'idx_chat_resolutionSLA'
      ];

      for (const indexName of expectedIndexes) {
        const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'chats' AND indexname = ${indexName};
        `;

        expect(indexes).toHaveLength(1);
      }
    });

    it('should have composite index on opened_at and overallSLA', async () => {
      const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'chats' AND indexname = 'idx_chat_opened_overallSLA';
      `;

      expect(indexes).toHaveLength(1);
    });

    it('should have composite index on agent_id and overallSLA', async () => {
      const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'chats' AND indexname = 'idx_chat_agent_overallSLA';
      `;

      expect(indexes).toHaveLength(1);
    });
  });

  describe('Data Integrity', () => {
    it('should allow null values for all SLA columns', async () => {
      // This is tested by the schema validation - nullable columns should accept null
      const testChat = await prisma.chat.create({
        data: {
          id: 'test-sla-null-' + Date.now(),
          b2chatId: 'b2-test-' + Date.now(),
          provider: 'whatsapp',
          status: 'open',
          createdAt: new Date(),
          // All SLA columns should default to null
        }
      });

      expect(testChat).toBeDefined();
      expect(testChat.timeToPickup).toBeNull();
      expect(testChat.firstResponseTime).toBeNull();
      expect(testChat.avgResponseTime).toBeNull();
      expect(testChat.resolutionTime).toBeNull();
      expect(testChat.pickupSLA).toBeNull();
      expect(testChat.firstResponseSLA).toBeNull();
      expect(testChat.avgResponseSLA).toBeNull();
      expect(testChat.resolutionSLA).toBeNull();
      expect(testChat.overallSLA).toBeNull();

      // Cleanup
      await prisma.chat.delete({ where: { id: testChat.id } });
    });

    it('should accept valid SLA metric values', async () => {
      const testChat = await prisma.chat.create({
        data: {
          id: 'test-sla-values-' + Date.now(),
          b2chatId: 'b2-test-' + Date.now(),
          provider: 'whatsapp',
          status: 'closed',
          createdAt: new Date(),
          timeToPickup: 90, // 1.5 minutes
          firstResponseTime: 240, // 4 minutes
          avgResponseTime: 180.5, // 3 minutes
          resolutionTime: 3600, // 1 hour
          pickupSLA: true,
          firstResponseSLA: true,
          avgResponseSLA: true,
          resolutionSLA: true,
          overallSLA: true,
          timeToPickupBH: 90,
          firstResponseTimeBH: 240,
          avgResponseTimeBH: 180.5,
          resolutionTimeBH: 3600,
          pickupSLABH: true,
          firstResponseSLABH: true,
          avgResponseSLABH: true,
          resolutionSLABH: true,
          overallSLABH: true,
        }
      });

      expect(testChat.timeToPickup).toBe(90);
      expect(testChat.firstResponseTime).toBe(240);
      expect(testChat.avgResponseTime).toBe(180.5);
      expect(testChat.resolutionTime).toBe(3600);
      expect(testChat.pickupSLA).toBe(true);
      expect(testChat.overallSLA).toBe(true);

      // Cleanup
      await prisma.chat.delete({ where: { id: testChat.id } });
    });
  });
});
