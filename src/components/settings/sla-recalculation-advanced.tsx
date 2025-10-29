'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { RecalculationRequest } from '@/types/sla'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { estimateChatCount, validateDateRange } from '@/lib/sla/recalculation-helpers'

const advancedOptionsSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  limit: z.coerce.number().min(1, 'Minimum 1 chat').max(10000, 'Maximum 10,000 chats').optional(),
}).refine(
  (data) => {
    const validation = validateDateRange(data.startDate, data.endDate)
    return validation.valid
  },
  (data) => {
    const validation = validateDateRange(data.startDate, data.endDate)
    return {
      message: validation.error || 'Invalid date range',
      path: ['endDate'],
    }
  }
)

type AdvancedOptionsForm = z.infer<typeof advancedOptionsSchema>

export interface SLARecalculationAdvancedProps {
  defaultRequest: RecalculationRequest
  onRequestChange: (request: RecalculationRequest) => void
  disabled?: boolean
}

export function SLARecalculationAdvanced({
  defaultRequest,
  onRequestChange,
  disabled = false,
}: SLARecalculationAdvancedProps) {
  const [isOpen, setIsOpen] = useState(false)

  const form = useForm<AdvancedOptionsForm>({
    resolver: zodResolver(advancedOptionsSchema),
    defaultValues: {
      startDate: defaultRequest.startDate
        ? new Date(defaultRequest.startDate).toISOString().split('T')[0]
        : '',
      endDate: defaultRequest.endDate
        ? new Date(defaultRequest.endDate).toISOString().split('T')[0]
        : '',
      limit: defaultRequest.limit || 1000,
    },
  })

  const watchedValues = form.watch()
  const estimatedChats =
    watchedValues.startDate && watchedValues.endDate
      ? estimateChatCount(
          new Date(watchedValues.startDate).toISOString(),
          new Date(watchedValues.endDate).toISOString()
        )
      : 0

  const handleApply = (data: AdvancedOptionsForm) => {
    // Convert date inputs to ISO strings
    const startDate = new Date(data.startDate)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(data.endDate)
    endDate.setHours(23, 59, 59, 999)

    onRequestChange({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: data.limit,
    })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} disabled={disabled}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-0 hover:bg-transparent"
          disabled={disabled}
        >
          <span className="text-sm font-medium">Advanced Options</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleApply)} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={disabled}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </FormControl>
                    <FormDescription>
                      First day of the recalculation period
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={disabled}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </FormControl>
                    <FormDescription>
                      Last day of the recalculation period (max 1 year from start)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Max Chats Limit */}
              <FormField
                control={form.control}
                name="limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Chats</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        disabled={disabled}
                        min={1}
                        max={10000}
                        placeholder="1000"
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of chats to process (1-10,000)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estimated Count Display */}
              {estimatedChats > 0 && (
                <div className="rounded-md bg-background/50 border p-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Estimated chats in range: </span>
                    <span className="font-semibold">~{estimatedChats.toLocaleString()}</span>
                  </div>
                  {form.watch('limit') && estimatedChats > (form.watch('limit') || 0) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Will process up to {form.watch('limit')?.toLocaleString()} chats (limit applied)
                    </div>
                  )}
                </div>
              )}

              {/* Apply Button */}
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={disabled || !form.formState.isValid}
              >
                Apply Custom Range
              </Button>
            </div>
          </form>
        </Form>
      </CollapsibleContent>
    </Collapsible>
  )
}
