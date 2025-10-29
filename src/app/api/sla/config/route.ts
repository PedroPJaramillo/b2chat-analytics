import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSLAConfig, getOfficeHoursConfig, updateSLAConfig, updateOfficeHoursConfig } from '@/lib/config/sla-config';
import { slaLogger } from '@/lib/sla/sla-logger';

/**
 * GET /api/sla/config
 *
 * Returns current SLA configuration including targets and office hours
 */
export async function GET(request: NextRequest) {
  try {
    const [slaConfig, officeHoursConfig] = await Promise.all([
      getSLAConfig(),
      getOfficeHoursConfig(),
    ]);

    await slaLogger.logAPICall('/api/sla/config', 'GET', 200);

    return NextResponse.json({
      sla: slaConfig,
      officeHours: officeHoursConfig,
    });
  } catch (error) {
    console.error('Error fetching SLA config:', error);

    await slaLogger.logAPICall('/api/sla/config', 'GET', 500, undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sla/config
 *
 * Updates SLA configuration
 *
 * Request Body:
 * {
 *   sla?: {
 *     pickupTarget?: number,
 *     firstResponseTarget?: number,
 *     avgResponseTarget?: number,
 *     resolutionTarget?: number,
 *     complianceTarget?: number
 *   },
 *   officeHours?: {
 *     start?: string,  // HH:mm format
 *     end?: string,    // HH:mm format
 *     workingDays?: number[],  // 1-7 (Mon-Sun)
 *     timezone?: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (!body || (! body.sla && !body.officeHours)) {
      return NextResponse.json(
        { error: 'Request body must include sla or officeHours configuration' },
        { status: 400 }
      );
    }

    const changedSettings: string[] = [];
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    // Update SLA targets
    if (body.sla) {
      const slaUpdates = body.sla;

      // Validate SLA targets
      const targetFields = ['pickupTarget', 'firstResponseTarget', 'avgResponseTarget', 'resolutionTarget'];
      for (const field of targetFields) {
        if (slaUpdates[field] !== undefined) {
          const value = slaUpdates[field];
          if (typeof value !== 'number' || value <= 0) {
            return NextResponse.json(
              { error: `${field} must be a positive number` },
              { status: 400 }
            );
          }
        }
      }

      // Validate compliance target
      if (slaUpdates.complianceTarget !== undefined) {
        const value = slaUpdates.complianceTarget;
        if (typeof value !== 'number' || value < 0 || value > 100) {
          return NextResponse.json(
            { error: 'complianceTarget must be a number between 0 and 100' },
            { status: 400 }
          );
        }
      }

      // Get current config for logging
      const currentSLAConfig = await getSLAConfig();

      // Update each setting
      for (const [key, value] of Object.entries(slaUpdates)) {
        const settingKey = `sla.${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
        changedSettings.push(settingKey);
        oldValues[settingKey] = (currentSLAConfig as any)[key];
        newValues[settingKey] = value;

        await prisma.systemSetting.upsert({
          where: { key: settingKey },
          update: { value: String(value), updatedAt: new Date() },
          create: {
            key: settingKey,
            value: String(value),
            category: 'sla',
            description: `SLA target for ${key}`,
            isSystemSetting: true,
          },
        });
      }
    }

    // Update office hours
    if (body.officeHours) {
      const officeHoursUpdates = body.officeHours;

      // Validate time format (HH:mm)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

      if (officeHoursUpdates.start && !timeRegex.test(officeHoursUpdates.start)) {
        return NextResponse.json(
          { error: 'start time must be in HH:mm format (00:00-23:59)' },
          { status: 400 }
        );
      }

      if (officeHoursUpdates.end && !timeRegex.test(officeHoursUpdates.end)) {
        return NextResponse.json(
          { error: 'end time must be in HH:mm format (00:00-23:59)' },
          { status: 400 }
        );
      }

      // Validate end time is after start time
      if (officeHoursUpdates.start && officeHoursUpdates.end) {
        if (officeHoursUpdates.end <= officeHoursUpdates.start) {
          return NextResponse.json(
            { error: 'End time must be after start time' },
            { status: 400 }
          );
        }
      }

      // Validate working days
      if (officeHoursUpdates.workingDays) {
        const days = officeHoursUpdates.workingDays;
        if (!Array.isArray(days) || days.length === 0) {
          return NextResponse.json(
            { error: 'workingDays must be a non-empty array' },
            { status: 400 }
          );
        }
        if (!days.every((day: number) => day >= 1 && day <= 7)) {
          return NextResponse.json(
            { error: 'workingDays must contain numbers between 1 (Monday) and 7 (Sunday)' },
            { status: 400 }
          );
        }
      }

      // Get current config for logging
      const currentOfficeHours = await getOfficeHoursConfig();

      // Update each setting
      for (const [key, value] of Object.entries(officeHoursUpdates)) {
        const settingKey = `office_hours.${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
        changedSettings.push(settingKey);
        oldValues[settingKey] = (currentOfficeHours as any)[key];
        newValues[settingKey] = value;

        const stringValue = Array.isArray(value) ? value.join(',') : String(value);

        await prisma.systemSetting.upsert({
          where: { key: settingKey },
          update: { value: stringValue, updatedAt: new Date() },
          create: {
            key: settingKey,
            value: stringValue,
            category: 'sla',
            description: `Office hours ${key}`,
            isSystemSetting: true,
          },
        });
      }
    }

    // Log configuration change
    await slaLogger.logConfigChange(
      changedSettings,
      oldValues,
      newValues,
      undefined // TODO: Add userId from auth context
    );

    await slaLogger.logAPICall('/api/sla/config', 'POST', 200, undefined, {
      changedSettings,
    });

    return NextResponse.json({
      success: true,
      updated: changedSettings,
    });
  } catch (error) {
    console.error('Error updating SLA config:', error);

    await slaLogger.logAPICall('/api/sla/config', 'POST', 500, undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
