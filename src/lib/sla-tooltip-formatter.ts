/**
 * SLA Tooltip Formatter
 *
 * Formats SLA data into readable tooltip content showing:
 * - All 4 SLA metrics (Pickup, First Response, Avg Response, Resolution)
 * - Both wall-clock and business hours values
 * - Pass/fail status with icons
 * - Disabled metrics
 * - Applied configuration (priority/channel)
 */

import type { SLAConfig } from '@/types/sla'
import type { ChatPriority, ChatProvider } from '@/types/chat'

/**
 * Extended chat data with SLA information
 */
export interface ChatWithSLA {
  // Wall Clock Time Metrics (milliseconds)
  pickupTimeMs?: number | null
  firstResponseTimeMs?: number | null
  avgResponseTimeMs?: number | null
  resolutionTimeMs?: number | null

  // Wall Clock SLA Compliance
  pickupSLA?: boolean | null
  firstResponseSLA?: boolean | null
  avgResponseSLA?: boolean | null
  resolutionSLA?: boolean | null
  overallSLA?: boolean | null

  // Business Hours Time Metrics (milliseconds)
  pickupTimeBHMs?: number | null
  firstResponseTimeBHMs?: number | null
  avgResponseTimeBHMs?: number | null
  resolutionTimeBHMs?: number | null

  // Business Hours SLA Compliance
  pickupSLABH?: boolean | null
  firstResponseSLABH?: boolean | null
  avgResponseSLABH?: boolean | null
  resolutionSLABH?: boolean | null
  overallSLABH?: boolean | null

  // Context for threshold determination
  priority: ChatPriority
  provider: ChatProvider

  // Chat status
  closedAt?: string | null
}

/**
 * Thresholds for all 4 SLA metrics (in minutes)
 */
interface AppliedThresholds {
  pickup: number
  firstResponse: number
  avgResponse: number
  resolution: number
}

/**
 * Format duration in milliseconds to human-readable string
 * Examples: "1m 30s", "2h 15m", "45s"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-'
  if (ms === 0) return '0s'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  return `${seconds}s`
}

/**
 * Get icon based on SLA status
 * ✅ = passed, ❌ = failed, ⊘ = disabled, - = null/incomplete
 */
export function getSLAIcon(
  passed: boolean | null | undefined,
  enabled: boolean
): string {
  if (!enabled) return '⊘'
  if (passed === null || passed === undefined) return '-'
  return passed ? '✅' : '❌'
}

/**
 * Get applied thresholds for a chat based on priority and provider
 * Priority overrides take precedence over channel overrides
 */
export function getAppliedThresholds(
  priority: ChatPriority,
  provider: ChatProvider,
  config: SLAConfig
): AppliedThresholds {
  const thresholds: AppliedThresholds = {
    pickup: config.pickupThreshold,
    firstResponse: config.firstResponseThreshold,
    avgResponse: config.avgResponseThreshold,
    resolution: config.resolutionThreshold,
  }

  // Apply channel overrides if available
  if (config.channelOverrides?.[provider]) {
    const channelOverride = config.channelOverrides[provider]
    if (channelOverride.pickup !== undefined) {
      thresholds.pickup = channelOverride.pickup
    }
    if (channelOverride.firstResponse !== undefined) {
      thresholds.firstResponse = channelOverride.firstResponse
    }
    if (channelOverride.avgResponse !== undefined) {
      thresholds.avgResponse = channelOverride.avgResponse
    }
    if (channelOverride.resolution !== undefined) {
      thresholds.resolution = channelOverride.resolution
    }
  }

  // Apply priority overrides (takes precedence over channel)
  if (config.priorityOverrides?.[priority]) {
    const priorityOverride = config.priorityOverrides[priority]
    if (priorityOverride.pickup !== undefined) {
      thresholds.pickup = priorityOverride.pickup
    }
    if (priorityOverride.firstResponse !== undefined) {
      thresholds.firstResponse = priorityOverride.firstResponse
    }
    if (priorityOverride.avgResponse !== undefined) {
      thresholds.avgResponse = priorityOverride.avgResponse
    }
    if (priorityOverride.resolution !== undefined) {
      thresholds.resolution = priorityOverride.resolution
    }
  }

  return thresholds
}

/**
 * Format a single SLA metric row with wall-clock and business hours
 */
export function formatMetricRow(
  name: string,
  wallClockTime: number | null | undefined,
  wallClockSLA: boolean | null | undefined,
  businessHoursTime: number | null | undefined,
  businessHoursSLA: boolean | null | undefined,
  thresholdMinutes: number,
  enabled: boolean
): string {
  const wcIcon = getSLAIcon(wallClockSLA, enabled)
  const bhIcon = getSLAIcon(businessHoursSLA, enabled)

  // If disabled, always show "Disabled" regardless of time values
  const wcDisplay = !enabled
    ? 'Disabled'
    : wallClockTime !== null && wallClockTime !== undefined
    ? `${formatDuration(wallClockTime)} / ${thresholdMinutes}m`
    : 'Not available yet'

  const bhDisplay = !enabled
    ? 'Disabled'
    : businessHoursTime !== null && businessHoursTime !== undefined
    ? `${formatDuration(businessHoursTime)} / ${thresholdMinutes}m`
    : 'Not available yet'

  return `${name.toUpperCase()}
Wall Clock:     ${wcIcon} ${wcDisplay}
Business Hours: ${bhIcon} ${bhDisplay}`
}

/**
 * Get provider display name
 */
function getProviderDisplayName(provider: ChatProvider): string {
  const names: Record<ChatProvider, string> = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    facebook: 'Facebook',
    livechat: 'Live Chat',
    b2cbotapi: 'B2C Bot API',
  }
  return names[provider] || provider
}

/**
 * Get priority display name
 */
function getPriorityDisplayName(priority: ChatPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

/**
 * Main formatter function
 * Generates complete tooltip content with all SLA metrics
 */
export function formatSLATooltip(
  chat: ChatWithSLA,
  config: SLAConfig
): string {
  // Get applied thresholds for this chat
  const thresholds = getAppliedThresholds(chat.priority, chat.provider, config)

  // Determine overall status
  const overallIcon = getSLAIcon(chat.overallSLA, true)
  const overallStatus = chat.overallSLA === null
    ? 'Incomplete'
    : chat.overallSLA
    ? 'Within SLA'
    : 'Breached'

  // Build header
  let tooltip = `Overall SLA: ${overallStatus} ${overallIcon}\n`
  tooltip += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

  // Pickup Time
  tooltip += formatMetricRow(
    'Pickup Time',
    chat.pickupTimeMs,
    chat.pickupSLA,
    chat.pickupTimeBHMs,
    chat.pickupSLABH,
    thresholds.pickup,
    config.enabledMetrics?.pickup ?? true
  )

  tooltip += '\n\n'

  // First Response Time
  tooltip += formatMetricRow(
    'First Response Time',
    chat.firstResponseTimeMs,
    chat.firstResponseSLA,
    chat.firstResponseTimeBHMs,
    chat.firstResponseSLABH,
    thresholds.firstResponse,
    config.enabledMetrics?.firstResponse ?? true
  )

  tooltip += '\n\n'

  // Average Response Time
  tooltip += formatMetricRow(
    'Avg Response Time',
    chat.avgResponseTimeMs,
    chat.avgResponseSLA,
    chat.avgResponseTimeBHMs,
    chat.avgResponseSLABH,
    thresholds.avgResponse,
    config.enabledMetrics?.avgResponse ?? false
  )

  tooltip += '\n\n'

  // Resolution Time
  tooltip += formatMetricRow(
    'Resolution Time',
    chat.resolutionTimeMs,
    chat.resolutionSLA,
    chat.resolutionTimeBHMs,
    chat.resolutionSLABH,
    thresholds.resolution,
    config.enabledMetrics?.resolution ?? false
  )

  // Footer with configuration info
  tooltip += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  tooltip += `\nConfig: ${getPriorityDisplayName(chat.priority)} Priority, ${getProviderDisplayName(chat.provider)}`

  return tooltip
}
