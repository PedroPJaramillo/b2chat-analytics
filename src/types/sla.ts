import { z } from "zod"

// Channel-specific SLA overrides
export const channelSLAOverrideSchema = z.object({
  firstResponse: z.number().min(1).max(240).optional(), // 1-240 minutes
  avgResponse: z.number().min(1).max(240).optional(),   // 1-240 minutes
  resolution: z.number().min(1).max(1440).optional(),   // 1-1440 minutes (24 hours)
  pickup: z.number().min(1).max(60).optional(),         // 1-60 minutes
})

export type ChannelSLAOverride = z.infer<typeof channelSLAOverrideSchema>

// Priority-specific SLA overrides
export const prioritySLAOverrideSchema = z.object({
  firstResponse: z.number().min(1).max(240).optional(),
  avgResponse: z.number().min(1).max(240).optional(),
  resolution: z.number().min(1).max(1440).optional(),
  pickup: z.number().min(1).max(60).optional(),
})

export type PrioritySLAOverride = z.infer<typeof prioritySLAOverrideSchema>

// Enabled metrics configuration
export const enabledMetricsSchema = z.object({
  pickup: z.boolean().default(true),
  firstResponse: z.boolean().default(true),
  avgResponse: z.boolean().default(false),
  resolution: z.boolean().default(false),
})

export type EnabledMetrics = z.infer<typeof enabledMetricsSchema>

// Main SLA configuration
export const slaConfigSchema = z.object({
  // Default thresholds (in minutes)
  firstResponseThreshold: z.number().min(1).max(240).default(5),
  avgResponseThreshold: z.number().min(1).max(240).default(5),
  resolutionThreshold: z.number().min(1).max(1440).default(30),
  pickupThreshold: z.number().min(1).max(60).default(2),

  // Compliance targets (percentages 0-100)
  firstResponseTarget: z.number().min(0).max(100).default(95),
  avgResponseTarget: z.number().min(0).max(100).default(90),
  resolutionTarget: z.number().min(0).max(100).default(90),
  pickupTarget: z.number().min(0).max(100).default(98),

  // Enabled metrics (which metrics count toward overall SLA)
  enabledMetrics: enabledMetricsSchema.default({
    pickup: true,
    firstResponse: true,
    avgResponse: false,
    resolution: false,
  }),

  // Channel-specific overrides
  channelOverrides: z.object({
    whatsapp: channelSLAOverrideSchema.optional(),
    facebook: channelSLAOverrideSchema.optional(),
    telegram: channelSLAOverrideSchema.optional(),
    livechat: channelSLAOverrideSchema.optional(),
    b2cbotapi: channelSLAOverrideSchema.optional(),
  }).optional(),

  // Priority-based overrides
  priorityOverrides: z.object({
    urgent: prioritySLAOverrideSchema.optional(),
    high: prioritySLAOverrideSchema.optional(),
    normal: prioritySLAOverrideSchema.optional(),
    low: prioritySLAOverrideSchema.optional(),
  }).optional(),
})

export type SLAConfig = z.infer<typeof slaConfigSchema>

// Default SLA configuration
export const defaultSLAConfig: SLAConfig = {
  firstResponseThreshold: 5,
  avgResponseThreshold: 5,
  resolutionThreshold: 30,
  pickupThreshold: 2,
  firstResponseTarget: 95,
  avgResponseTarget: 90,
  resolutionTarget: 90,
  pickupTarget: 98,
  enabledMetrics: {
    pickup: true,
    firstResponse: true,
    avgResponse: false,
    resolution: false,
  },
  channelOverrides: {
    whatsapp: { firstResponse: 3, avgResponse: 3, resolution: 20, pickup: 1 },
    livechat: { firstResponse: 1, avgResponse: 1, resolution: 15, pickup: 1 },
    facebook: { firstResponse: 10, avgResponse: 10, resolution: 60, pickup: 3 },
    telegram: { firstResponse: 5, avgResponse: 5, resolution: 30, pickup: 2 },
    b2cbotapi: { firstResponse: 1, avgResponse: 1, resolution: 5, pickup: 1 },
  },
  priorityOverrides: {
    urgent: { firstResponse: 1, avgResponse: 1, resolution: 10, pickup: 1 },
    high: { firstResponse: 3, avgResponse: 3, resolution: 20, pickup: 1 },
    normal: { firstResponse: 5, avgResponse: 5, resolution: 30, pickup: 2 },
    low: { firstResponse: 10, avgResponse: 10, resolution: 60, pickup: 5 },
  },
}

// SLA metric types
export type SLAMetricType = "pickup" | "firstResponse" | "avgResponse" | "resolution"

// Chat data interface for SLA calculations
export interface ChatForSLA {
  provider: string
  priority?: string
  openedAt?: Date | null
  pickedUpAt?: Date | null
  responseAt?: Date | null
  closedAt?: Date | null
}

// SLA compliance result
export interface SLAComplianceResult {
  threshold: number
  actual: number
  compliant: boolean
  metricType: SLAMetricType
}

// Aggregated SLA metrics
export interface SLAMetrics {
  pickup: {
    threshold: number
    target: number
    compliant: number
    total: number
    complianceRate: number
    avgTime: number
  }
  firstResponse: {
    threshold: number
    target: number
    compliant: number
    total: number
    complianceRate: number
    avgTime: number
  }
  avgResponse: {
    threshold: number
    target: number
    compliant: number
    total: number
    complianceRate: number
    avgTime: number
  }
  resolution: {
    threshold: number
    target: number
    compliant: number
    total: number
    complianceRate: number
    avgTime: number
  }
}

// SLA Recalculation types
export interface RecalculationRequest {
  startDate?: string
  endDate?: string
  chatId?: string
  /** @deprecated Use batchSize instead. Number of chats to process per batch (default: 500, max: 2000) */
  limit?: number
  /** Number of chats to process per batch (default: 500, max: 2000) */
  batchSize?: number
}

export interface RecalculationResult {
  success: boolean
  processed: number
  failed: number
  total: number
  duration: number
  enabledMetrics: EnabledMetrics
  /** Number of batches processed */
  batches?: number
  errors?: Array<{
    chatId: string
    error: string
  }>
}

export interface LastRecalculation {
  timestamp: string
  processed: number
  failed: number
  duration: number
}