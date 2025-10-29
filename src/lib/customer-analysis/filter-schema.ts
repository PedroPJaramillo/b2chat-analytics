/**
 * Zod validation schemas for customer analysis filters
 */

import { z } from 'zod'

// Date validation helpers
const MAX_RANGE_DAYS = 90

export const analysisFiltersSchema = z
  .object({
    dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
    dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
    agentIds: z.array(z.string()).max(50, 'Maximum 50 agents allowed').optional(),
    departmentIds: z.array(z.string()).max(20, 'Maximum 20 departments allowed').optional(),
    contactIds: z.array(z.string()).max(100, 'Maximum 100 contacts allowed').optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.dateStart)
      const end = new Date(data.dateEnd)
      return start <= end
    },
    {
      message: 'End date must be after or equal to start date',
      path: ['dateEnd'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.dateStart)
      const end = new Date(data.dateEnd)
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= MAX_RANGE_DAYS
    },
    {
      message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
      path: ['dateEnd'],
    }
  )

export type AnalysisFiltersFormData = z.infer<typeof analysisFiltersSchema>
