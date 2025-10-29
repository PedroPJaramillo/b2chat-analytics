"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useResponseTimeDrilldown } from "@/hooks/use-response-time-drilldown"
import { useRouter } from "next/navigation"
import type { ChatDirectionFilter, OfficeHoursFilter } from "@/types/filters"

interface ResponseTimeDrillDownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekStart: string
  dayOfWeek: number
  hour: number
  agentId: string
  directionFilter: ChatDirectionFilter
  officeHoursFilter: OfficeHoursFilter
}

export function ResponseTimeDrillDownDialog({
  open,
  onOpenChange,
  weekStart,
  dayOfWeek,
  hour,
  agentId,
  directionFilter,
  officeHoursFilter
}: ResponseTimeDrillDownDialogProps) {
  const router = useRouter()

  const { data, loading, error } = useResponseTimeDrilldown({
    weekStart,
    dayOfWeek,
    hour,
    agentId,
    directionFilter,
    officeHoursFilter
  })

  const handleViewAllChats = () => {
    if (!data) return

    // Navigate to Chats page with pre-applied filters
    const params = new URLSearchParams({
      startDate: data.timeSlotStart,
      endDate: data.timeSlotEnd,
      sortBy: 'responseTime',
      sortOrder: 'desc'
    })

    if (agentId && agentId !== 'all') {
      params.append('agent', agentId)
    }

    router.push(`/dashboard/chats?${params.toString()}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {data ? `${data.dayName} ${data.hourRange} - Response Time Details` : 'Loading...'}
          </DialogTitle>
          <DialogDescription>
            Detailed statistics for this time slot
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div data-testid="loading-skeleton">
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {error && (
          <div className="text-destructive">Error loading data: {error}</div>
        )}

        {data && (
          <ScrollArea className="max-h-[calc(90vh-8rem)]">
            {/* Summary Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Chats</div>
                    <div className="text-2xl font-bold">{data.summary.totalChats}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Response Time</div>
                    <div className="text-2xl font-bold">{data.summary.avgResponseTime}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Weekly Comparison</div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      {data.summary.comparisonToWeekly}
                      <Badge variant={data.summary.performanceIndicator}>
                        {data.summary.performanceLabel}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chat Distribution Card */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Chat Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {data.distribution.length > 0 ? (
                  <div className="flex gap-4 flex-wrap">
                    {data.distribution.map(item => (
                      <div key={item.status} className="flex items-center gap-2">
                        <Badge variant="outline">{item.status}</Badge>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No distribution data</div>
                )}
              </CardContent>
            </Card>

            {/* Agent Breakdown Table (conditional - only if not filtered by single agent) */}
            {agentId === 'all' && data.agentBreakdown.length > 1 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Agent Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Chats</TableHead>
                        <TableHead className="text-right">Avg Response Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.agentBreakdown.map((agent, index) => (
                        <TableRow key={agent.agentId || `unassigned-${index}`}>
                          <TableCell>{agent.agentName || 'Unassigned'}</TableCell>
                          <TableCell className="text-right">{agent.chatCount}</TableCell>
                          <TableCell className="text-right font-mono">{agent.avgResponseTime}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Slowest Chats Table */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Slowest Chats</CardTitle>
              </CardHeader>
              <CardContent>
                {data.slowestChats.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Response Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.slowestChats.map(chat => (
                        <TableRow key={chat.chatId}>
                          <TableCell>{chat.customerName}</TableCell>
                          <TableCell>{chat.agentName || 'Unassigned'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{chat.channel}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{chat.responseTime}</TableCell>
                          <TableCell>
                            <Badge>{chat.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground">No chats in this time slot</div>
                )}
              </CardContent>
            </Card>

            {/* Action Button */}
            <div className="flex justify-end mt-4">
              <Button onClick={handleViewAllChats}>
                View All Chats
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
