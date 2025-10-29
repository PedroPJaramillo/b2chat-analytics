import { SLAConfig, OfficeHoursConfig } from '@/lib/config/sla-config';
import {
  calculatePickupTime,
  calculateFirstResponseTime,
  calculateAvgResponseTime,
  calculateResolutionTime,
  calculateSLACompliance,
  getFirstAgentMessageTime,
  type ChatData,
  type SLAMetrics,
  type EnabledMetrics,
} from './sla-calculator';
import {
  calculatePickupTimeBH,
  calculateFirstResponseTimeBH,
  calculateAvgResponseTimeBH,
  calculateResolutionTimeBH,
} from './business-hours';

/**
 * Calculates all SLA metrics for a chat including both wall-clock and business hours
 *
 * @param chatData - Chat data including timestamps and messages
 * @param slaConfig - SLA configuration with targets
 * @param officeHoursConfig - Office hours configuration for business hours calculations
 * @param enabledMetrics - Which metrics should count toward overall SLA (default: all enabled)
 * @returns Complete SLA metrics object with both wall-clock and business hours
 */
export function calculateAllSLAMetricsWithBusinessHours(
  chatData: ChatData,
  slaConfig: SLAConfig,
  officeHoursConfig: OfficeHoursConfig,
  enabledMetrics: EnabledMetrics = { pickup: true, firstResponse: true, avgResponse: true, resolution: true }
): SLAMetrics {
  // Extract first agent message timestamp
  const firstAgentMessageAt = getFirstAgentMessageTime(chatData.messages);

  // ===== WALL CLOCK CALCULATIONS =====

  // Calculate wall-clock metric values
  const timeToPickup = calculatePickupTime(chatData.openedAt, chatData.firstAgentAssignedAt);
  const firstResponseTime = calculateFirstResponseTime(chatData.openedAt, firstAgentMessageAt);
  const avgResponseTime = calculateAvgResponseTime(chatData.messages);
  const resolutionTime = calculateResolutionTime(chatData.openedAt, chatData.closedAt);

  // Calculate wall-clock compliance flags
  const pickupSLA = calculateSLACompliance(timeToPickup, slaConfig.pickupTarget);
  const firstResponseSLA = calculateSLACompliance(firstResponseTime, slaConfig.firstResponseTarget);
  const avgResponseSLA = calculateSLACompliance(avgResponseTime, slaConfig.avgResponseTarget);
  const resolutionSLA = calculateSLACompliance(resolutionTime, slaConfig.resolutionTarget);

  // Calculate overall wall-clock SLA based on enabled metrics only
  const enabledSLAs: (boolean | null)[] = [];

  if (enabledMetrics.pickup) enabledSLAs.push(pickupSLA);
  if (enabledMetrics.firstResponse) enabledSLAs.push(firstResponseSLA);
  if (enabledMetrics.avgResponse) enabledSLAs.push(avgResponseSLA);
  if (enabledMetrics.resolution) enabledSLAs.push(resolutionSLA);

  let overallSLA: boolean | null = null;

  if (enabledSLAs.length === 0) {
    overallSLA = null;
  } else if (enabledSLAs.some(sla => sla === null)) {
    overallSLA = null;
  } else if (enabledSLAs.every(sla => sla === true)) {
    overallSLA = true;
  } else {
    overallSLA = false;
  }

  // ===== BUSINESS HOURS CALCULATIONS =====

  // Calculate business hours metric values
  const timeToPickupBH = calculatePickupTimeBH(
    chatData.openedAt,
    chatData.firstAgentAssignedAt,
    officeHoursConfig
  );
  const firstResponseTimeBH = calculateFirstResponseTimeBH(
    chatData.openedAt,
    firstAgentMessageAt,
    officeHoursConfig
  );
  const avgResponseTimeBH = calculateAvgResponseTimeBH(chatData.messages, officeHoursConfig);
  const resolutionTimeBH = calculateResolutionTimeBH(
    chatData.openedAt,
    chatData.closedAt,
    officeHoursConfig
  );

  // Calculate business hours compliance flags
  const pickupSLABH = calculateSLACompliance(timeToPickupBH, slaConfig.pickupTarget);
  const firstResponseSLABH = calculateSLACompliance(firstResponseTimeBH, slaConfig.firstResponseTarget);
  const avgResponseSLABH = calculateSLACompliance(avgResponseTimeBH, slaConfig.avgResponseTarget);
  const resolutionSLABH = calculateSLACompliance(resolutionTimeBH, slaConfig.resolutionTarget);

  // Calculate overall business hours SLA based on enabled metrics only
  const enabledSLAsBH: (boolean | null)[] = [];

  if (enabledMetrics.pickup) enabledSLAsBH.push(pickupSLABH);
  if (enabledMetrics.firstResponse) enabledSLAsBH.push(firstResponseSLABH);
  if (enabledMetrics.avgResponse) enabledSLAsBH.push(avgResponseSLABH);
  if (enabledMetrics.resolution) enabledSLAsBH.push(resolutionSLABH);

  let overallSLABH: boolean | null = null;

  if (enabledSLAsBH.length === 0) {
    overallSLABH = null;
  } else if (enabledSLAsBH.some(sla => sla === null)) {
    overallSLABH = null;
  } else if (enabledSLAsBH.every(sla => sla === true)) {
    overallSLABH = true;
  } else {
    overallSLABH = false;
  }

  return {
    // Wall clock metric values
    timeToPickup,
    firstResponseTime,
    avgResponseTime,
    resolutionTime,

    // Wall clock compliance flags
    pickupSLA,
    firstResponseSLA,
    avgResponseSLA,
    resolutionSLA,
    overallSLA,

    // Business hours metric values
    timeToPickupBH,
    firstResponseTimeBH,
    avgResponseTimeBH,
    resolutionTimeBH,

    // Business hours compliance flags
    pickupSLABH,
    firstResponseSLABH,
    avgResponseSLABH,
    resolutionSLABH,
    overallSLABH,
  };
}

/**
 * Formats seconds into a human-readable duration string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2h 30m", "45s", "1d 3h")
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return 'N/A';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}

/**
 * Formats a compliance percentage
 *
 * @param compliant - Number of compliant items
 * @param total - Total number of items
 * @returns Formatted percentage string (e.g., "95.5%")
 */
export function formatCompliancePercentage(compliant: number, total: number): string {
  if (total === 0) {
    return '0%';
  }

  const percentage = (compliant / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

/**
 * Determines if overall compliance meets the target threshold
 *
 * @param compliant - Number of compliant items
 * @param total - Total number of items
 * @param target - Target compliance percentage (e.g., 95 for 95%)
 * @returns true if compliance meets target, false otherwise
 */
export function meetsComplianceTarget(
  compliant: number,
  total: number,
  target: number
): boolean {
  if (total === 0) {
    return false;
  }

  const percentage = (compliant / total) * 100;
  return percentage >= target;
}
