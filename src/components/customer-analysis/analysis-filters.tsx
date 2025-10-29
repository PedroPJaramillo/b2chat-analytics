/**
 * Analysis Filters Component
 * Date range, agent, and department filter form
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { analysisFiltersSchema, type AnalysisFiltersFormData } from '@/lib/customer-analysis/filter-schema'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { CalendarIcon, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useFilterOptions } from '@/hooks/use-customer-analysis'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

interface AnalysisFiltersProps {
  onSubmit: (data: AnalysisFiltersFormData) => void
  isSubmitting?: boolean
}

export function AnalysisFilters({ onSubmit, isSubmitting }: AnalysisFiltersProps) {
  const { data: filterOptions, isLoading, error } = useFilterOptions()
  const departments = filterOptions?.departments ?? []
  const agents = filterOptions?.agents ?? []

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AnalysisFiltersFormData>({
    resolver: zodResolver(analysisFiltersSchema),
    defaultValues: {
      dateStart: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      dateEnd: format(new Date(), 'yyyy-MM-dd'),
      agentIds: [],
      departmentIds: [],
    },
  })

  const selectedAgentIds = watch('agentIds') || []
  const selectedDepartmentIds = watch('departmentIds') || []
  const dateStart = watch('dateStart')
  const dateEnd = watch('dateEnd')

  const handleAgentToggle = (agentId: string) => {
    const current = selectedAgentIds
    if (current.includes(agentId)) {
      setValue(
        'agentIds',
        current.filter((id) => id !== agentId)
      )
    } else {
      setValue('agentIds', [...current, agentId])
    }
  }

  const handleDepartmentToggle = (departmentId: string) => {
    const current = selectedDepartmentIds
    if (current.includes(departmentId)) {
      setValue(
        'departmentIds',
        current.filter((id) => id !== departmentId)
      )
    } else {
      setValue('departmentIds', [...current, departmentId])
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load filter options. Please try again.</AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6 border rounded-lg">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-24" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Analysis Filters</h3>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateStart">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="dateStart"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateStart && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateStart ? format(new Date(dateStart), 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateStart ? new Date(dateStart) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setValue('dateStart', format(date, 'yyyy-MM-dd'))
                  }
                }}
                disabled={(date) => {
                  const today = new Date()
                  const earliestDate = filterOptions?.dateRangeLimits?.earliestChatDate
                    ? new Date(filterOptions.dateRangeLimits.earliestChatDate)
                    : new Date(today.getFullYear() - 1, 0, 1)
                  return date > today || date < earliestDate
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.dateStart && (
            <p className="text-sm text-destructive">{errors.dateStart.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateEnd">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="dateEnd"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateEnd && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateEnd ? format(new Date(dateEnd), 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateEnd ? new Date(dateEnd) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setValue('dateEnd', format(date, 'yyyy-MM-dd'))
                  }
                }}
                disabled={(date) => {
                  const today = new Date()
                  return date > today
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.dateEnd && <p className="text-sm text-destructive">{errors.dateEnd.message}</p>}
        </div>
      </div>

      {/* Department Filter */}
      {departments.length > 0 && (
        <div className="space-y-2">
          <Label>Departments (Optional)</Label>
          <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center space-x-2 py-2">
                <Checkbox
                  id={`dept-${dept.id}`}
                  checked={selectedDepartmentIds.includes(dept.id)}
                  onCheckedChange={() => handleDepartmentToggle(dept.id)}
                />
                <Label
                  htmlFor={`dept-${dept.id}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {dept.name}
                </Label>
              </div>
            ))}
          </div>
          {selectedDepartmentIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedDepartmentIds.length} department(s) selected
            </p>
          )}
        </div>
      )}

      {/* Agent Filter */}
      {agents.length > 0 && (
        <div className="space-y-2">
          <Label>Agents (Optional)</Label>
          <ScrollArea className="h-48 border rounded-md p-3">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center space-x-2 py-2">
                <Checkbox
                  id={`agent-${agent.id}`}
                  checked={selectedAgentIds.includes(agent.id)}
                  onCheckedChange={() => handleAgentToggle(agent.id)}
                />
                <Label
                  htmlFor={`agent-${agent.id}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {agent.name}
                  <span className="text-xs text-muted-foreground ml-2">
                    ({agent.departmentName})
                  </span>
                </Label>
              </div>
            ))}
          </ScrollArea>
          {selectedAgentIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedAgentIds.length} agent(s) selected
            </p>
          )}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? 'Triggering Analysis...' : 'Run Analysis'}
        </Button>
      </div>
    </form>
  )
}
