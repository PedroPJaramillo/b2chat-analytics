import type {
  SLAConfig,
  ChatForSLA,
  SLAMetricType,
  SLAComplianceResult,
  SLAMetrics,
} from "@/types/sla"

/**
 * Get the applicable SLA threshold for a specific chat and metric type
 */
export function getSLAThreshold(
  chat: ChatForSLA,
  slaConfig: SLAConfig,
  metricType: SLAMetricType
): number {
  const provider = chat.provider?.toLowerCase()
  const priority = chat.priority?.toLowerCase()

  // Check priority override first (highest priority)
  if (priority && slaConfig.priorityOverrides?.[priority as keyof typeof slaConfig.priorityOverrides]) {
    const priorityOverride = slaConfig.priorityOverrides[priority as keyof typeof slaConfig.priorityOverrides]
    if (priorityOverride) {
      const thresholdKey = metricType === "firstResponse"
        ? "firstResponse"
        : metricType === "resolution"
        ? "resolution"
        : "pickup"

      if (priorityOverride[thresholdKey]) {
        return priorityOverride[thresholdKey]!
      }
    }
  }

  // Check channel override next
  if (provider && slaConfig.channelOverrides?.[provider as keyof typeof slaConfig.channelOverrides]) {
    const channelOverride = slaConfig.channelOverrides[provider as keyof typeof slaConfig.channelOverrides]
    if (channelOverride) {
      const thresholdKey = metricType === "firstResponse"
        ? "firstResponse"
        : metricType === "resolution"
        ? "resolution"
        : "pickup"

      if (channelOverride[thresholdKey]) {
        return channelOverride[thresholdKey]!
      }
    }
  }

  // Fall back to default threshold
  switch (metricType) {
    case "firstResponse":
      return slaConfig.firstResponseThreshold
    case "resolution":
      return slaConfig.resolutionThreshold
    case "pickup":
      return slaConfig.pickupThreshold
    default:
      return slaConfig.firstResponseThreshold
  }
}

/**
 * Check if a specific metric is SLA compliant
 */
export function checkSLACompliance(
  actualTime: number, // in milliseconds
  threshold: number // in minutes
): boolean {
  const thresholdMs = threshold * 60 * 1000
  return actualTime <= thresholdMs
}

/**
 * Calculate time difference in milliseconds
 */
function calculateTimeDiff(start: Date | null | undefined, end: Date | null | undefined): number | null {
  if (!start || !end) return null

  const startTime = start instanceof Date ? start.getTime() : new Date(start).getTime()
  const endTime = end instanceof Date ? end.getTime() : new Date(end).getTime()

  return endTime - startTime
}

/**
 * Calculate comprehensive SLA metrics for a list of chats
 */
export function calculateSLAMetrics(
  chats: ChatForSLA[],
  slaConfig: SLAConfig
): SLAMetrics {
  const metrics: SLAMetrics = {
    firstResponse: {
      threshold: slaConfig.firstResponseThreshold,
      target: slaConfig.firstResponseTarget,
      compliant: 0,
      total: 0,
      complianceRate: 0,
      avgTime: 0,
    },
    avgResponse: {
      threshold: slaConfig.avgResponseThreshold,
      target: slaConfig.avgResponseTarget,
      compliant: 0,
      total: 0,
      complianceRate: 0,
      avgTime: 0,
    },
    resolution: {
      threshold: slaConfig.resolutionThreshold,
      target: slaConfig.resolutionTarget,
      compliant: 0,
      total: 0,
      complianceRate: 0,
      avgTime: 0,
    },
    pickup: {
      threshold: slaConfig.pickupThreshold,
      target: slaConfig.pickupTarget,
      compliant: 0,
      total: 0,
      complianceRate: 0,
      avgTime: 0,
    },
  }

  const firstResponseTimes: number[] = []
  const resolutionTimes: number[] = []
  const pickupTimes: number[] = []

  chats.forEach((chat) => {
    // First Response Time (openedAt -> responseAt)
    // responseAt = when agent actually sent first message (RESPONDED_BY_AGENT state)
    const firstResponseTime = calculateTimeDiff(chat.openedAt, chat.responseAt)
    if (firstResponseTime !== null && firstResponseTime >= 0) {
      const threshold = getSLAThreshold(chat, slaConfig, "firstResponse")
      const isCompliant = checkSLACompliance(firstResponseTime, threshold)

      metrics.firstResponse.total++
      if (isCompliant) metrics.firstResponse.compliant++
      firstResponseTimes.push(firstResponseTime)
    }

    // Resolution Time (openedAt -> closedAt)
    const resolutionTime = calculateTimeDiff(chat.openedAt, chat.closedAt)
    if (resolutionTime !== null && resolutionTime >= 0 && chat.closedAt) {
      const threshold = getSLAThreshold(chat, slaConfig, "resolution")
      const isCompliant = checkSLACompliance(resolutionTime, threshold)

      metrics.resolution.total++
      if (isCompliant) metrics.resolution.compliant++
      resolutionTimes.push(resolutionTime)
    }

    // Pickup Time (openedAt -> pickedUpAt)
    // pickedUpAt = when agent accepted/took the chat (PICKED_UP state)
    const pickupTime = calculateTimeDiff(chat.openedAt, chat.pickedUpAt)
    if (pickupTime !== null && pickupTime >= 0) {
      const threshold = getSLAThreshold(chat, slaConfig, "pickup")
      const isCompliant = checkSLACompliance(pickupTime, threshold)

      metrics.pickup.total++
      if (isCompliant) metrics.pickup.compliant++
      pickupTimes.push(pickupTime)
    }
  })

  // Calculate compliance rates and averages
  if (metrics.firstResponse.total > 0) {
    metrics.firstResponse.complianceRate = Math.round(
      (metrics.firstResponse.compliant / metrics.firstResponse.total) * 100
    )
    metrics.firstResponse.avgTime =
      firstResponseTimes.reduce((sum, time) => sum + time, 0) / firstResponseTimes.length
  }

  if (metrics.resolution.total > 0) {
    metrics.resolution.complianceRate = Math.round(
      (metrics.resolution.compliant / metrics.resolution.total) * 100
    )
    metrics.resolution.avgTime =
      resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
  }

  if (metrics.pickup.total > 0) {
    metrics.pickup.complianceRate = Math.round(
      (metrics.pickup.compliant / metrics.pickup.total) * 100
    )
    metrics.pickup.avgTime =
      pickupTimes.reduce((sum, time) => sum + time, 0) / pickupTimes.length
  }

  return metrics
}

/**
 * Check SLA compliance for a single chat and metric
 */
export function checkChatSLACompliance(
  chat: ChatForSLA,
  slaConfig: SLAConfig,
  metricType: SLAMetricType
): SLAComplianceResult | null {
  let actualTime: number | null = null

  switch (metricType) {
    case "firstResponse":
      // First response = when agent actually sent first message (responseAt)
      actualTime = calculateTimeDiff(chat.openedAt, chat.responseAt)
      break
    case "pickup":
      // Pickup = when agent accepted the chat (pickedUpAt)
      actualTime = calculateTimeDiff(chat.openedAt, chat.pickedUpAt)
      break
    case "resolution":
      actualTime = calculateTimeDiff(chat.openedAt, chat.closedAt)
      break
  }

  if (actualTime === null || actualTime < 0) {
    return null
  }

  const threshold = getSLAThreshold(chat, slaConfig, metricType)
  const compliant = checkSLACompliance(actualTime, threshold)

  return {
    threshold,
    actual: actualTime,
    compliant,
    metricType,
  }
}

/**
 * Format milliseconds to human-readable time
 */
export function formatResponseTime(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Format threshold (in minutes) to human-readable string
 */
export function formatThreshold(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}