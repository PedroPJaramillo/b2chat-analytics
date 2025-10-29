/**
 * @jest-environment node
 */

import { PrismaClient } from '@prisma/client';
import { getSLAConfig, getOfficeHoursConfig } from '../sla-config';

const prisma = new PrismaClient();

describe('SLA Configuration Tests', () => {
  beforeAll(async () => {
    // Ensure test configuration exists
    await prisma.systemSetting.upsert({
      where: { key: 'sla.pickup_target' },
      update: { value: '120' },
      create: {
        key: 'sla.pickup_target',
        value: '120',
        category: 'sla',
        description: 'SLA target for pickup time in seconds (default: 2 minutes)',
        isSystemSetting: true,
      }
    });

    await prisma.systemSetting.upsert({
      where: { key: 'sla.first_response_target' },
      update: { value: '300' },
      create: {
        key: 'sla.first_response_target',
        value: '300',
        category: 'sla',
        description: 'SLA target for first response time in seconds (default: 5 minutes)',
        isSystemSetting: true,
      }
    });

    await prisma.systemSetting.upsert({
      where: { key: 'sla.avg_response_target' },
      update: { value: '300' },
      create: {
        key: 'sla.avg_response_target',
        value: '300',
        category: 'sla',
        description: 'SLA target for average response time in seconds (default: 5 minutes)',
        isSystemSetting: true,
      }
    });

    await prisma.systemSetting.upsert({
      where: { key: 'sla.resolution_target' },
      update: { value: '7200' },
      create: {
        key: 'sla.resolution_target',
        value: '7200',
        category: 'sla',
        description: 'SLA target for resolution time in seconds (default: 2 hours)',
        isSystemSetting: true,
      }
    });

    await prisma.systemSetting.upsert({
      where: { key: 'sla.compliance_target' },
      update: { value: '95' },
      create: {
        key: 'sla.compliance_target',
        value: '95',
        category: 'sla',
        description: 'Overall SLA compliance target percentage (default: 95%)',
        isSystemSetting: true,
      }
    });

    // Create office hours settings
    await prisma.systemSetting.upsert({
      where: { key: 'office_hours.start' },
      update: { value: '09:00' },
      create: {
        key: 'office_hours.start',
        value: '09:00',
        category: 'office_hours',
        description: 'Office hours start time (HH:mm format, 24-hour)',
        isSystemSetting: true,
      }
    });

    await prisma.systemSetting.upsert({
      where: { key: 'office_hours.end' },
      update: { value: '17:00' },
      create: {
        key: 'office_hours.end',
        value: '17:00',
        category: 'office_hours',
        description: 'Office hours end time (HH:mm format, 24-hour)',
        isSystemSetting: true,
      }
    });

    await prisma.systemSetting.upsert({
      where: { key: 'office_hours.working_days' },
      update: { value: '[1,2,3,4,5]' },
      create: {
        key: 'office_hours.working_days',
        value: '[1,2,3,4,5]',
        category: 'office_hours',
        description: 'Working days (1=Monday, 7=Sunday)',
        isSystemSetting: true,
      }
    });

    await prisma.systemSetting.upsert({
      where: { key: 'office_hours.timezone' },
      update: { value: 'America/New_York' },
      create: {
        key: 'office_hours.timezone',
        value: 'America/New_York',
        category: 'office_hours',
        description: 'Timezone for office hours',
        isSystemSetting: true,
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('getSLAConfig', () => {
    it('should retrieve all SLA configuration values', async () => {
      const config = await getSLAConfig();

      expect(config).toBeDefined();
      expect(config.pickupTarget).toBe(120);
      expect(config.firstResponseTarget).toBe(300);
      expect(config.avgResponseTarget).toBe(300);
      expect(config.resolutionTarget).toBe(7200);
      expect(config.complianceTarget).toBe(95);
    });

    it('should return default values if settings are missing', async () => {
      // Temporarily delete one setting
      await prisma.systemSetting.deleteMany({
        where: { key: 'sla.pickup_target' }
      });

      const config = await getSLAConfig();

      expect(config.pickupTarget).toBe(120); // Should fall back to default

      // Restore setting
      await prisma.systemSetting.create({
        data: {
          key: 'sla.pickup_target',
          value: '120',
          category: 'sla',
          description: 'SLA target for pickup time in seconds',
          isSystemSetting: true,
        }
      });
    });

    it('should parse numeric values correctly', async () => {
      // Update with different value
      await prisma.systemSetting.update({
        where: { key: 'sla.pickup_target' },
        data: { value: '180' } // 3 minutes
      });

      const config = await getSLAConfig();

      expect(config.pickupTarget).toBe(180);
      expect(typeof config.pickupTarget).toBe('number');

      // Restore default
      await prisma.systemSetting.update({
        where: { key: 'sla.pickup_target' },
        data: { value: '120' }
      });
    });

    it('should handle all SLA targets as positive integers', async () => {
      const config = await getSLAConfig();

      expect(config.pickupTarget).toBeGreaterThan(0);
      expect(config.firstResponseTarget).toBeGreaterThan(0);
      expect(config.avgResponseTarget).toBeGreaterThan(0);
      expect(config.resolutionTarget).toBeGreaterThan(0);
      expect(config.complianceTarget).toBeGreaterThan(0);
      expect(config.complianceTarget).toBeLessThanOrEqual(100);
    });
  });

  describe('getOfficeHoursConfig', () => {
    it('should retrieve all office hours configuration values', async () => {
      const config = await getOfficeHoursConfig();

      expect(config).toBeDefined();
      expect(config.start).toBe('09:00');
      expect(config.end).toBe('17:00');
      expect(config.workingDays).toEqual([1, 2, 3, 4, 5]); // Mon-Fri
      expect(config.timezone).toBe('America/New_York');
    });

    it('should return default values if settings are missing', async () => {
      // Temporarily delete one setting
      await prisma.systemSetting.deleteMany({
        where: { key: 'office_hours.start' }
      });

      const config = await getOfficeHoursConfig();

      expect(config.start).toBe('09:00'); // Should fall back to default

      // Restore setting
      await prisma.systemSetting.create({
        data: {
          key: 'office_hours.start',
          value: '09:00',
          category: 'office_hours',
          description: 'Office hours start time',
          isSystemSetting: true,
        }
      });
    });

    it('should parse working days JSON correctly', async () => {
      const config = await getOfficeHoursConfig();

      expect(Array.isArray(config.workingDays)).toBe(true);
      expect(config.workingDays).toHaveLength(5);
      expect(config.workingDays.every(day => day >= 1 && day <= 7)).toBe(true);
    });

    it('should validate time format (HH:mm)', async () => {
      const config = await getOfficeHoursConfig();

      expect(config.start).toMatch(/^\d{2}:\d{2}$/);
      expect(config.end).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should validate start time is before end time', async () => {
      const config = await getOfficeHoursConfig();

      const [startHour, startMin] = config.start.split(':').map(Number);
      const [endHour, endMin] = config.end.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      expect(startMinutes).toBeLessThan(endMinutes);
    });

    it('should handle custom office hours', async () => {
      // Set custom hours (8am-6pm)
      await prisma.systemSetting.update({
        where: { key: 'office_hours.start' },
        data: { value: '08:00' }
      });
      await prisma.systemSetting.update({
        where: { key: 'office_hours.end' },
        data: { value: '18:00' }
      });

      const config = await getOfficeHoursConfig();

      expect(config.start).toBe('08:00');
      expect(config.end).toBe('18:00');

      // Restore defaults
      await prisma.systemSetting.update({
        where: { key: 'office_hours.start' },
        data: { value: '09:00' }
      });
      await prisma.systemSetting.update({
        where: { key: 'office_hours.end' },
        data: { value: '17:00' }
      });
    });

    it('should handle different working day configurations', async () => {
      // Set to Mon-Sat (1-6)
      await prisma.systemSetting.update({
        where: { key: 'office_hours.working_days' },
        data: { value: '[1,2,3,4,5,6]' }
      });

      const config = await getOfficeHoursConfig();

      expect(config.workingDays).toEqual([1, 2, 3, 4, 5, 6]);

      // Restore default
      await prisma.systemSetting.update({
        where: { key: 'office_hours.working_days' },
        data: { value: '[1,2,3,4,5]' }
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should have all required SLA settings in database', async () => {
      const requiredKeys = [
        'sla.pickup_target',
        'sla.first_response_target',
        'sla.avg_response_target',
        'sla.resolution_target',
        'sla.compliance_target'
      ];

      for (const key of requiredKeys) {
        const setting = await prisma.systemSetting.findUnique({
          where: { key }
        });

        expect(setting).not.toBeNull();
        expect(setting?.category).toBe('sla');
        expect(parseInt(setting!.value)).toBeGreaterThan(0);
      }
    });

    it('should have all required office hours settings in database', async () => {
      const requiredKeys = [
        'office_hours.start',
        'office_hours.end',
        'office_hours.working_days',
        'office_hours.timezone'
      ];

      for (const key of requiredKeys) {
        const setting = await prisma.systemSetting.findUnique({
          where: { key }
        });

        expect(setting).not.toBeNull();
        expect(setting?.category).toBe('office_hours');
      }
    });
  });
});
