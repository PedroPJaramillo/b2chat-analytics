'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DateRangePickerProps {
  dateRange?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  maxDays?: number;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  onChange,
  maxDays = 90,
  className,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(dateRange);
  const [preset, setPreset] = React.useState<string>('30');

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const today = new Date();
    let newRange: DateRange | undefined;

    switch (value) {
      case 'today':
        newRange = {
          from: today,
          to: today,
        };
        break;
      case '7':
        newRange = {
          from: addDays(today, -6),
          to: today,
        };
        break;
      case '30':
        newRange = {
          from: addDays(today, -29),
          to: today,
        };
        break;
      case '90':
        newRange = {
          from: addDays(today, -89),
          to: today,
        };
        break;
      case 'custom':
        // Keep current date range
        return;
      default:
        newRange = undefined;
    }

    setDate(newRange);
    onChange?.(newRange);
  };

  const handleDateChange = (newDate: DateRange | undefined) => {
    if (newDate?.from && newDate?.to) {
      const diffTime = Math.abs(newDate.to.getTime() - newDate.from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > maxDays) {
        // Don't allow selection beyond max days
        return;
      }
    }

    setDate(newDate);
    setPreset('custom');
    onChange?.(newDate);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="7">Last 7 Days</SelectItem>
          <SelectItem value="30">Last 30 Days</SelectItem>
          <SelectItem value="90">Last 90 Days</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'w-[300px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateChange}
            numberOfMonths={2}
            disabled={(date) => {
              // Disable future dates
              return date > new Date();
            }}
          />
          {maxDays && (
            <div className="p-3 border-t">
              <p className="text-xs text-muted-foreground">
                Maximum range: {maxDays} days
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
