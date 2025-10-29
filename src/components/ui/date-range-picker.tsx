// Date Range Picker Component - Feature 011
// Reusable date range picker with presets and custom range selection

'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface DateRange {
  start: Date
  end: Date
}

interface DateRangePickerProps {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

const DATE_PRESETS = [
  {
    label: 'Today',
    getValue: () => ({
      start: new Date(),
      end: new Date(),
    }),
  },
  {
    label: 'Last 7 days',
    getValue: () => ({
      start: subDays(new Date(), 7),
      end: new Date(),
    }),
  },
  {
    label: 'Last 30 days',
    getValue: () => ({
      start: subDays(new Date(), 30),
      end: new Date(),
    }),
  },
  {
    label: 'This month',
    getValue: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
  },
]

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Select date range',
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<Partial<DateRange>>({})

  // Reset temp range when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setTempRange(value || {})
    }
  }, [isOpen, value])

  const handlePresetClick = (preset: DateRange) => {
    onChange(preset)
    setIsOpen(false)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return

    if (!tempRange.start || (tempRange.start && tempRange.end)) {
      // Start new selection
      setTempRange({ start: date, end: undefined })
    } else {
      // Complete selection
      const range =
        date >= tempRange.start
          ? { start: tempRange.start, end: date }
          : { start: date, end: tempRange.start }

      onChange(range)
      setIsOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(undefined)
  }

  const formatDateRange = (range: DateRange) => {
    try {
      const startFormatted = format(range.start, 'MMM d, yyyy')
      const endFormatted = format(range.end, 'MMM d, yyyy')
      return `${startFormatted} - ${endFormatted}`
    } catch (error) {
      return placeholder
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDateRange(value) : placeholder}
          {value && (
            <X
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-3 space-y-1">
            <div className="text-sm font-medium mb-2">Presets</div>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handlePresetClick(preset.getValue())}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={{
                from: tempRange.start,
                to: tempRange.end,
              }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onChange({ start: range.from, end: range.to })
                  setIsOpen(false)
                } else if (range?.from) {
                  setTempRange({ start: range.from, end: undefined })
                }
              }}
              numberOfMonths={2}
              defaultMonth={value?.start || new Date()}
            />

            {/* Action buttons */}
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTempRange({})
                  onChange(undefined)
                  setIsOpen(false)
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
