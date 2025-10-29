import { z } from 'zod'
import { NextRequest } from 'next/server'

// Common validation schemas
export const PaginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => val ? Math.min(Math.max(parseInt(val, 10), 1), 1000) : 50)
    .pipe(z.number().min(1).max(1000)),
  offset: z
    .string()
    .optional()
    .transform((val) => val ? Math.max(parseInt(val, 10), 0) : 0)
    .pipe(z.number().min(0)),
  page: z
    .string()
    .optional()
    .transform((val) => val ? Math.max(parseInt(val, 10), 1) : 1)
    .pipe(z.number().min(1)),
})

export const ChatStatusSchema = z.enum(['open', 'closed', 'pending', 'all']).optional()

export const ChatPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent', 'all']).optional()

export const SyncEntitySchema = z.enum(['contacts', 'chats', 'all'])

export const DateRangeSchema = z.object({
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    })
    .transform((val) => val ? new Date(val) : undefined),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid end date format',
    })
    .transform((val) => val ? new Date(val) : undefined),
})

// Validation helper functions
export function validateSearchParams<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T
): z.infer<T> | { error: string; details: z.ZodError } {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  const result = schema.safeParse(params)

  if (!result.success) {
    return {
      error: 'Invalid request parameters',
      details: result.error
    }
  }

  return result.data
}

export async function validateRequestBody<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T> | { error: string; details: z.ZodError }> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      return {
        error: 'Invalid request body',
        details: result.error
      }
    }

    return result.data
  } catch (error) {
    return {
      error: 'Invalid JSON in request body',
      details: new z.ZodError([{
        code: 'custom',
        message: 'Request body must be valid JSON',
        path: []
      }])
    }
  }
}

// Request sanitization
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .slice(0, 1000) // Limit length
}

export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[^\w\s-_.@]/g, '') // Allow only safe characters
    .slice(0, 100) // Limit search query length
}

// Input validation schemas for specific routes
export const ChatsQuerySchema = z.object({
  status: ChatStatusSchema,
  priority: ChatPrioritySchema,
  limit: z.string().optional(),
  offset: z.string().optional(),
  search: z.string().optional().transform(val => val ? sanitizeSearchQuery(val) : undefined),
  agentId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
}).merge(DateRangeSchema)

export const AgentsQuerySchema = z.object({
  department: z.string().optional().transform(val => val ? sanitizeString(val) : undefined),
  active: z.enum(['true', 'false', 'all']).optional(),
  search: z.string().optional().transform(val => val ? sanitizeSearchQuery(val) : undefined),
}).merge(PaginationSchema)

export const SyncTimeRangePresetSchema = z.enum(['1d', '7d', '30d', '90d', 'custom', 'full'])

// Date range schema for sync operations (keeps strings)
export const DateRangeStringSchema = z.object({
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    }),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid end date format',
    })
})

export const SyncRequestSchema = z.object({
  entityType: SyncEntitySchema,
  options: z.object({
    fullSync: z.boolean().optional(),
    batchSize: z.number().min(10).max(1000).optional(),
    dateRange: DateRangeStringSchema.optional(),
    timeRangePreset: SyncTimeRangePresetSchema.optional(),
  }).optional()
})

export const AnalyticsQuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
  granularity: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
  metrics: z.array(z.enum([
    'response_time',
    'resolution_rate',
    'satisfaction',
    'volume',
    'agent_performance'
  ])).optional(),
}).merge(DateRangeSchema)

// Error response helpers
export function createValidationError(error: z.ZodError) {
  return {
    error: 'Validation failed',
    details: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  }
}

export function isValidationError(result: any): result is { error: string; details: z.ZodError } {
  return result && typeof result === 'object' && 'error' in result && 'details' in result
}