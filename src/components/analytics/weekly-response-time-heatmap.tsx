"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { addDays, subDays, format } from "date-fns"
import { useWeeklyResponseTimes } from "@/hooks/use-weekly-response-times"
import type { ChatDirectionFilter, OfficeHoursFilter } from "@/types/filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ResponseTimeDrillDownDialog } from "./response-time-drill-down-dialog"

interface Agent {
  id: string
  name: string
}

interface WeeklyResponseTimeHeatmapProps {
  directionFilter: ChatDirectionFilter
  officeHoursFilter: OfficeHoursFilter
  agents: Agent[]
}

// Helper function to get most recent Monday
function getMostRecentMonday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = (dayOfWeek + 6) % 7 // Days since last Monday
  const monday = subDays(today, daysFromMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Helper function to format week range for display
function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const startStr = format(weekStart, 'MMM d')
  const endStr = format(weekEnd, 'MMM d, yyyy')
  return `${startStr} - ${endStr}`
}

// Helper function to format hour for display
function formatHour(hour: number): string {
  const period = hour >= 12 ? 'P' : 'A'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}${period}`
}

export function WeeklyResponseTimeHeatmap({
  directionFilter,
  officeHoursFilter,
  agents
}: WeeklyResponseTimeHeatmapProps) {
  // State for week and agent selection
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(getMostRecentMonday())
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all')

  // State for drill-down modal
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [drillDownData, setDrillDownData] = useState<{
    dayOfWeek: number
    hour: number
    dayName: string
  } | null>(null)

  // Format week start as ISO date string for API
  const weekStartISO = format(selectedWeekStart, 'yyyy-MM-dd')

  // Fetch weekly response time data
  const { data, loading, error, refetch } = useWeeklyResponseTimes({
    weekStart: weekStartISO,
    agentId: selectedAgentId,
    directionFilter,
    officeHoursFilter
  })

  // Navigation handlers
  const handlePreviousWeek = () => {
    setSelectedWeekStart(prev => subDays(prev, 7))
  }

  const handleNextWeek = () => {
    setSelectedWeekStart(prev => addDays(prev, 7))
  }

  const handleAgentChange = (value: string) => {
    setSelectedAgentId(value)
  }

  // Handler for cell click to open drill-down modal
  const handleCellClick = (dayOfWeek: number, hour: number, dayName: string, count: number) => {
    // Only open modal if there's data for this time slot
    if (count > 0) {
      setDrillDownData({ dayOfWeek, hour, dayName })
      setDrillDownOpen(true)
    }
  }

  // Color intensity calculation
  const colorMap = useMemo(() => {
    if (!data) return new Map()

    // Get all non-zero response times for normalization
    const times = data.data
      .filter(d => d.count > 0)
      .map(d => d.avgMs)

    if (times.length === 0) return new Map()

    const maxTime = Math.max(...times)
    const minTime = Math.min(...times)

    const map = new Map<string, string>()
    data.data.forEach(slot => {
      const key = `${slot.dayOfWeek}-${slot.hour}`
      if (slot.count === 0) {
        map.set(key, 'bg-gray-100')
      } else {
        const normalized = maxTime > minTime
          ? (slot.avgMs - minTime) / (maxTime - minTime)
          : 0

        if (normalized < 0.33) {
          map.set(key, 'bg-green-200 hover:bg-green-300')
        } else if (normalized < 0.66) {
          map.set(key, 'bg-yellow-200 hover:bg-yellow-300')
        } else {
          map.set(key, 'bg-red-200 hover:bg-red-300')
        }
      }
    })

    return map
  }, [data])

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Response Time Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Response Time Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // No data
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Response Time Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">No data available</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Weekly Response Time Heatmap</CardTitle>
          <div className="flex items-center gap-4">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousWeek}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[180px] text-center">
                {formatWeekRange(selectedWeekStart)}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextWeek}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Agent Selector */}
            <Select value={selectedAgentId} onValueChange={handleAgentChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents?.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Empty cell for day labels column */}
                  <TableHead className="w-12 sticky left-0 bg-background z-10"></TableHead>

                  {/* Hour labels (24 columns) */}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <TableHead key={hour} className="text-center w-8 px-1 text-[10px]">
                      {formatHour(hour)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                  const dayName = dayNames[dayIndex]

                  return (
                    <TableRow key={dayIndex}>
                      {/* Day label */}
                      <TableCell className="font-medium text-sm sticky left-0 bg-background z-10">
                        {dayName.substring(0, 3)}
                      </TableCell>

                      {/* Hour cells (24 columns) */}
                      {Array.from({ length: 24 }, (_, hour) => {
                        // Find the data point for this specific day and hour
                        const hourData = data.data.find(
                          d => d.dayOfWeek === dayIndex && d.hour === hour
                        )

                        const colorClass = colorMap.get(`${dayIndex}-${hour}`) || 'bg-gray-100'

                        return (
                          <TableCell key={hour} className="p-0.5 w-8">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`h-10 w-full rounded transition-colors ${colorClass} ${
                                    hourData && hourData.count > 0 ? 'cursor-pointer' : 'cursor-default'
                                  }`}
                                  onClick={() => handleCellClick(dayIndex, hour, dayName, hourData?.count || 0)}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {dayName} {formatHour(hour)}
                                  </div>
                                  {hourData && hourData.count > 0 ? (
                                    <>
                                      <div>Avg: {hourData.avg}</div>
                                      <div>Chats: {hourData.count}</div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Click to view details
                                      </div>
                                    </>
                                  ) : (
                                    <div>No data available</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-200 rounded" />
            <span>Fast</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-200 rounded" />
            <span>Average</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-200 rounded" />
            <span>Slow</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-100 rounded" />
            <span>No data</span>
          </div>
        </div>

        {/* Summary Stats */}
        {data.summary && data.summary.totalChats > 0 && (
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-2 border-t">
            <div>
              <span className="font-medium">{data.summary.totalChats}</span> chats
            </div>
            <div>
              Avg: <span className="font-medium">{data.summary.overallAvg}</span>
            </div>
            {data.summary.fastestHour && (
              <div>
                Fastest: <span className="font-medium">{data.summary.fastestHour.avg}</span>
              </div>
            )}
            {data.summary.slowestHour && (
              <div>
                Slowest: <span className="font-medium">{data.summary.slowestHour.avg}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Drill-Down Dialog */}
      {drillDownData && (
        <ResponseTimeDrillDownDialog
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          weekStart={weekStartISO}
          dayOfWeek={drillDownData.dayOfWeek}
          hour={drillDownData.hour}
          agentId={selectedAgentId}
          directionFilter={directionFilter}
          officeHoursFilter={officeHoursFilter}
        />
      )}
    </Card>
  )
}
