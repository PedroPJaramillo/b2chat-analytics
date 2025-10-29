import { SLAConfig } from '@/lib/config/sla-config';

/**
 * Message interface for SLA calculations
 */
export interface Message {
  role: 'customer' | 'agent' | 'system';
  createdAt: Date;
}

/**
 * Chat data interface for SLA calculations
 */
export interface ChatData {
  openedAt: Date;
  firstAgentAssignedAt: Date | null;
  closedAt: Date | null;
  messages: Message[];
}

/**
 * SLA metrics result interface
 */
export interface SLAMetrics {
  // Wall clock metric values (in seconds)
  timeToPickup: number | null;
  firstResponseTime: number | null;
  avgResponseTime: number | null;
  resolutionTime: number | null;

  // Wall clock compliance flags
  pickupSLA: boolean | null;
  firstResponseSLA: boolean | null;
  avgResponseSLA: boolean | null;
  resolutionSLA: boolean | null;
  overallSLA: boolean | null;

  // Business hours metric values (in seconds)
  timeToPickupBH?: number | null;
  firstResponseTimeBH?: number | null;
  avgResponseTimeBH?: number | null;
  resolutionTimeBH?: number | null;

  // Business hours compliance flags
  pickupSLABH?: boolean | null;
  firstResponseSLABH?: boolean | null;
  avgResponseSLABH?: boolean | null;
  resolutionSLABH?: boolean | null;
  overallSLABH?: boolean | null;
}

/**
 * Calculates the time from chat opened to first agent assignment (pickup time)
 *
 * @param openedAt - When the chat was opened
 * @param firstAgentAssignedAt - When first agent was assigned (null if never picked up)
 * @returns Time in seconds, or null if not picked up
 */
export function calculatePickupTime(
  openedAt: Date,
  firstAgentAssignedAt: Date | null
): number | null {
  if (!firstAgentAssignedAt) {
    return null;
  }

  const diffMs = firstAgentAssignedAt.getTime() - openedAt.getTime();
  return Math.floor(diffMs / 1000);
}

/**
 * Calculates the time from chat opened to first agent message
 *
 * @param openedAt - When the chat was opened
 * @param firstAgentMessageAt - When first agent message was sent (null if no messages)
 * @returns Time in seconds, or null if no agent message
 */
export function calculateFirstResponseTime(
  openedAt: Date,
  firstAgentMessageAt: Date | null
): number | null {
  if (!firstAgentMessageAt) {
    return null;
  }

  const diffMs = firstAgentMessageAt.getTime() - openedAt.getTime();
  return Math.floor(diffMs / 1000);
}

/**
 * Calculates the average response time between customer messages and agent replies
 *
 * @param messages - Array of messages with role and timestamp
 * @returns Average response time in seconds, or null if no responses
 */
export function calculateAvgResponseTime(messages: Message[]): number | null {
  if (messages.length === 0) {
    return null;
  }

  const responseTimes: number[] = [];
  let lastCustomerMessageTime: Date | null = null;

  for (const message of messages) {
    if (message.role === 'customer') {
      lastCustomerMessageTime = message.createdAt;
    } else if (message.role === 'agent' && lastCustomerMessageTime) {
      const responseTimeMs = message.createdAt.getTime() - lastCustomerMessageTime.getTime();
      const responseTimeSec = responseTimeMs / 1000;
      responseTimes.push(responseTimeSec);
      lastCustomerMessageTime = null; // Reset to avoid counting consecutive agent messages
    }
  }

  if (responseTimes.length === 0) {
    return null;
  }

  const sum = responseTimes.reduce((acc, time) => acc + time, 0);
  return sum / responseTimes.length;
}

/**
 * Calculates the total resolution time from chat opened to closed
 *
 * @param openedAt - When the chat was opened
 * @param closedAt - When the chat was closed (null if still open)
 * @returns Time in seconds, or null if not closed
 */
export function calculateResolutionTime(
  openedAt: Date,
  closedAt: Date | null
): number | null {
  if (!closedAt) {
    return null;
  }

  const diffMs = closedAt.getTime() - openedAt.getTime();
  return Math.floor(diffMs / 1000);
}

/**
 * Determines if a metric meets the SLA target
 *
 * @param actualTime - The actual time taken (in seconds)
 * @param targetTime - The target time (in seconds)
 * @returns true if within SLA, false if exceeded, null if actualTime is null
 */
export function calculateSLACompliance(
  actualTime: number | null,
  targetTime: number
): boolean | null {
  if (actualTime === null) {
    return null;
  }

  return actualTime <= targetTime;
}

/**
 * Enabled metrics configuration
 */
export interface EnabledMetrics {
  pickup: boolean;
  firstResponse: boolean;
  avgResponse: boolean;
  resolution: boolean;
}

/**
 * Calculates all SLA metrics for a chat (wall clock time only)
 *
 * @param chatData - Chat data including timestamps and messages
 * @param slaConfig - SLA configuration with targets
 * @param enabledMetrics - Which metrics should count toward overall SLA (default: all enabled)
 * @returns Complete SLA metrics object
 */
export function calculateAllSLAMetrics(
  chatData: ChatData,
  slaConfig: SLAConfig,
  enabledMetrics: EnabledMetrics = { pickup: true, firstResponse: true, avgResponse: true, resolution: true }
): SLAMetrics {
  // Extract first agent message timestamp
  const firstAgentMessage = chatData.messages.find(m => m.role === 'agent');
  const firstAgentMessageAt = firstAgentMessage ? firstAgentMessage.createdAt : null;

  // Calculate metric values
  const timeToPickup = calculatePickupTime(chatData.openedAt, chatData.firstAgentAssignedAt);
  const firstResponseTime = calculateFirstResponseTime(chatData.openedAt, firstAgentMessageAt);
  const avgResponseTime = calculateAvgResponseTime(chatData.messages);
  const resolutionTime = calculateResolutionTime(chatData.openedAt, chatData.closedAt);

  // Calculate compliance flags
  const pickupSLA = calculateSLACompliance(timeToPickup, slaConfig.pickupTarget);
  const firstResponseSLA = calculateSLACompliance(firstResponseTime, slaConfig.firstResponseTarget);
  const avgResponseSLA = calculateSLACompliance(avgResponseTime, slaConfig.avgResponseTarget);
  const resolutionSLA = calculateSLACompliance(resolutionTime, slaConfig.resolutionTarget);

  // Calculate overall SLA based on enabled metrics only
  // Overall is true only if ALL enabled SLAs are true
  // Overall is null if ANY enabled SLA is null
  // Overall is false if ANY enabled SLA is false (and none are null)
  const enabledSLAs: (boolean | null)[] = [];

  if (enabledMetrics.pickup) enabledSLAs.push(pickupSLA);
  if (enabledMetrics.firstResponse) enabledSLAs.push(firstResponseSLA);
  if (enabledMetrics.avgResponse) enabledSLAs.push(avgResponseSLA);
  if (enabledMetrics.resolution) enabledSLAs.push(resolutionSLA);

  let overallSLA: boolean | null = null;

  if (enabledSLAs.length === 0) {
    // No metrics enabled - overall SLA is null
    overallSLA = null;
  } else if (enabledSLAs.some(sla => sla === null)) {
    // At least one enabled metric is null - overall is null
    overallSLA = null;
  } else if (enabledSLAs.every(sla => sla === true)) {
    // All enabled metrics are true - overall is true
    overallSLA = true;
  } else {
    // At least one enabled metric is false - overall is false
    overallSLA = false;
  }

  return {
    // Metric values
    timeToPickup,
    firstResponseTime,
    avgResponseTime,
    resolutionTime,

    // Compliance flags
    pickupSLA,
    firstResponseSLA,
    avgResponseSLA,
    resolutionSLA,
    overallSLA,
  };
}

/**
 * Extracts first agent message timestamp from messages array
 *
 * @param messages - Array of messages
 * @returns First agent message timestamp or null
 */
export function getFirstAgentMessageTime(messages: Message[]): Date | null {
  const firstAgentMessage = messages.find(m => m.role === 'agent');
  return firstAgentMessage ? firstAgentMessage.createdAt : null;
}
