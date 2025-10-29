import { prisma } from '@/lib/prisma';

/**
 * SLA Configuration interface
 * All time values are in seconds
 */
export interface SLAConfig {
  pickupTarget: number;        // seconds (default: 120 = 2 minutes)
  firstResponseTarget: number; // seconds (default: 300 = 5 minutes)
  avgResponseTarget: number;   // seconds (default: 300 = 5 minutes)
  resolutionTarget: number;    // seconds (default: 7200 = 2 hours)
  complianceTarget: number;    // percentage (default: 95%)
}

/**
 * Office Hours Configuration interface
 */
export interface OfficeHoursConfig {
  start: string;              // "09:00" (HH:mm format, 24-hour)
  end: string;                // "17:00" (HH:mm format, 24-hour)
  workingDays: number[];      // [1,2,3,4,5] (1=Mon, 7=Sun)
  timezone: string;           // "America/New_York"
}

/**
 * Default SLA configuration values
 */
const DEFAULT_SLA_CONFIG: SLAConfig = {
  pickupTarget: 120,        // 2 minutes
  firstResponseTarget: 300, // 5 minutes
  avgResponseTarget: 300,   // 5 minutes
  resolutionTarget: 7200,   // 2 hours
  complianceTarget: 95,     // 95%
};

/**
 * Default office hours configuration
 */
const DEFAULT_OFFICE_HOURS_CONFIG: OfficeHoursConfig = {
  start: '09:00',
  end: '17:00',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: 'America/New_York',
};

/**
 * Retrieves SLA configuration from SystemSettings
 * Falls back to default values if settings are not found
 *
 * @returns {Promise<SLAConfig>} SLA configuration object
 */
export async function getSLAConfig(): Promise<SLAConfig> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { category: 'sla' },
      select: { key: true, value: true }
    });

    // Convert snake_case keys to camelCase and parse values
    const config = settings.reduce((acc, setting) => {
      // Remove 'sla.' prefix and convert to camelCase
      const key = setting.key
        .replace('sla.', '')
        .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

      acc[key] = parseInt(setting.value, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      pickupTarget: config.pickupTarget || DEFAULT_SLA_CONFIG.pickupTarget,
      firstResponseTarget: config.firstResponseTarget || DEFAULT_SLA_CONFIG.firstResponseTarget,
      avgResponseTarget: config.avgResponseTarget || DEFAULT_SLA_CONFIG.avgResponseTarget,
      resolutionTarget: config.resolutionTarget || DEFAULT_SLA_CONFIG.resolutionTarget,
      complianceTarget: config.complianceTarget || DEFAULT_SLA_CONFIG.complianceTarget,
    };
  } catch (error) {
    console.error('Error fetching SLA config, using defaults:', error);
    return DEFAULT_SLA_CONFIG;
  }
}

/**
 * Retrieves Office Hours configuration from SystemSettings
 * Falls back to default values if settings are not found
 *
 * @returns {Promise<OfficeHoursConfig>} Office hours configuration object
 */
export async function getOfficeHoursConfig(): Promise<OfficeHoursConfig> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { category: 'office_hours' },
      select: { key: true, value: true }
    });

    const configMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    return {
      start: configMap['office_hours.start'] || DEFAULT_OFFICE_HOURS_CONFIG.start,
      end: configMap['office_hours.end'] || DEFAULT_OFFICE_HOURS_CONFIG.end,
      workingDays: configMap['office_hours.working_days']
        ? JSON.parse(configMap['office_hours.working_days'])
        : DEFAULT_OFFICE_HOURS_CONFIG.workingDays,
      timezone: configMap['office_hours.timezone'] || DEFAULT_OFFICE_HOURS_CONFIG.timezone,
    };
  } catch (error) {
    console.error('Error fetching office hours config, using defaults:', error);
    return DEFAULT_OFFICE_HOURS_CONFIG;
  }
}

/**
 * Updates SLA configuration in SystemSettings
 *
 * @param {Partial<SLAConfig>} config - Partial SLA configuration to update
 * @returns {Promise<void>}
 */
export async function updateSLAConfig(config: Partial<SLAConfig>): Promise<void> {
  const updates: Array<Promise<any>> = [];

  if (config.pickupTarget !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'sla.pickup_target' },
        update: { value: config.pickupTarget.toString() },
        create: {
          key: 'sla.pickup_target',
          value: config.pickupTarget.toString(),
          category: 'sla',
          description: 'SLA target for pickup time in seconds',
          isSystemSetting: true,
        }
      })
    );
  }

  if (config.firstResponseTarget !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'sla.first_response_target' },
        update: { value: config.firstResponseTarget.toString() },
        create: {
          key: 'sla.first_response_target',
          value: config.firstResponseTarget.toString(),
          category: 'sla',
          description: 'SLA target for first response time in seconds',
          isSystemSetting: true,
        }
      })
    );
  }

  if (config.avgResponseTarget !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'sla.avg_response_target' },
        update: { value: config.avgResponseTarget.toString() },
        create: {
          key: 'sla.avg_response_target',
          value: config.avgResponseTarget.toString(),
          category: 'sla',
          description: 'SLA target for average response time in seconds',
          isSystemSetting: true,
        }
      })
    );
  }

  if (config.resolutionTarget !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'sla.resolution_target' },
        update: { value: config.resolutionTarget.toString() },
        create: {
          key: 'sla.resolution_target',
          value: config.resolutionTarget.toString(),
          category: 'sla',
          description: 'SLA target for resolution time in seconds',
          isSystemSetting: true,
        }
      })
    );
  }

  if (config.complianceTarget !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'sla.compliance_target' },
        update: { value: config.complianceTarget.toString() },
        create: {
          key: 'sla.compliance_target',
          value: config.complianceTarget.toString(),
          category: 'sla',
          description: 'Overall SLA compliance target percentage',
          isSystemSetting: true,
        }
      })
    );
  }

  await Promise.all(updates);
}

/**
 * Updates Office Hours configuration in SystemSettings
 *
 * @param {Partial<OfficeHoursConfig>} config - Partial office hours configuration to update
 * @returns {Promise<void>}
 */
export async function updateOfficeHoursConfig(config: Partial<OfficeHoursConfig>): Promise<void> {
  const updates: Array<Promise<any>> = [];

  if (config.start !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'office_hours.start' },
        update: { value: config.start },
        create: {
          key: 'office_hours.start',
          value: config.start,
          category: 'office_hours',
          description: 'Office hours start time (HH:mm format, 24-hour)',
          isSystemSetting: true,
        }
      })
    );
  }

  if (config.end !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'office_hours.end' },
        update: { value: config.end },
        create: {
          key: 'office_hours.end',
          value: config.end,
          category: 'office_hours',
          description: 'Office hours end time (HH:mm format, 24-hour)',
          isSystemSetting: true,
        }
      })
    );
  }

  if (config.workingDays !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'office_hours.working_days' },
        update: { value: JSON.stringify(config.workingDays) },
        create: {
          key: 'office_hours.working_days',
          value: JSON.stringify(config.workingDays),
          category: 'office_hours',
          description: 'Working days (1=Monday, 7=Sunday)',
          isSystemSetting: true,
        }
      })
    );
  }

  if (config.timezone !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'office_hours.timezone' },
        update: { value: config.timezone },
        create: {
          key: 'office_hours.timezone',
          value: config.timezone,
          category: 'office_hours',
          description: 'Timezone for office hours',
          isSystemSetting: true,
        }
      })
    );
  }

  await Promise.all(updates);
}
