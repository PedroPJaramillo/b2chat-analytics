"use client"

import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExternalLink, AlertCircle } from 'lucide-react'
import { useChats } from '@/lib/hooks/use-chats'
import { format } from 'date-fns'
import type { ChatDirectionFilter, OfficeHoursFilter } from '@/types/filters'

interface ChatDrillDownModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekStart: string // ISO date: "2025-10-13"
  dayOfWeek: number // 0-6
  hour: number // 0-23
  dayName: string // "Monday"
  agentId?: string
  directionFilter: ChatDirectionFilter
  officeHoursFilter: OfficeHoursFilter
}

// Helper to format hour for display
function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
}

// Helper to format response time
function formatResponseTime(start: string, response: string): string {
  const diff = new Date(response).getTime() - new Date(start).getTime()
  if (diff < 60000) return `${Math.round(diff / 1000)}s`
  if (diff < 3600000) return `${(diff / 60000).toFixed(1)}m`
  return `${(diff / 3600000).toFixed(1)}h`
}

export function ChatDrillDownModal({
  open,
  onOpenChange,
  weekStart,
  dayOfWeek,
  hour,
  dayName,
  agentId,
  directionFilter,
  officeHoursFilter
}: ChatDrillDownModalProps) {
  const router = useRouter()

  // Fetch chats for this specific time slot
  const { data: chatsData, isLoading } = useChats({
    weekStart,
    dayOfWeek,
    hourOfDay: hour,
    agent: agentId,
    limit: 50,
    sortBy: 'lastActivity',
    sortOrder: 'desc'
  })

  const chats = chatsData?.data || []
  const totalChats = chatsData?.pagination?.total || 0

  // Calculate average response time for this slot
  const chatsWithResponseTime = chats.filter(c => c.startTime && c.lastMessage)
  const avgResponseTime = chatsWithResponseTime.length > 0
    ? chatsWithResponseTime.reduce((sum, chat) => {
        const diff = new Date(chat.lastMessage).getTime() - new Date(chat.startTime).getTime()
        return sum + diff
      }, 0) / chatsWithResponseTime.length
    : 0

  const avgResponseTimeFormatted = avgResponseTime > 0
    ? avgResponseTime < 60000
      ? `${Math.round(avgResponseTime / 1000)}s`
      : avgResponseTime < 3600000
      ? `${(avgResponseTime / 60000).toFixed(1)}m`
      : `${(avgResponseTime / 3600000).toFixed(1)}h`
    : 'N/A'

  // Handler to navigate to full chats page with filters
  const handleViewAllChats = () => {
    const params = new URLSearchParams()
    params.append('weekStart', weekStart)
    params.append('dayOfWeek', dayOfWeek.toString())
    params.append('hourOfDay', hour.toString())

    if (agentId && agentId !== 'all') {
      params.append('agent', agentId)
    }

    router.push(`/dashboard/chats?${params.toString()}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dayName} at {formatHour(hour)}
          </DialogTitle>
          <DialogDescription>
            Analyzing chats from {format(new Date(weekStart), 'MMM d, yyyy')} week
            {agentId && agentId !== 'all' && ' (filtered by selected agent)'}
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="flex gap-4 py-2 border-b">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Total Chats</span>
            <span className="text-2xl font-bold">{totalChats}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Avg Response Time</span>
            <span className="text-2xl font-bold">{avgResponseTimeFormatted}</span>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading chats...</div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No chats found for this time slot</p>
          </div>
        )}

        {/* Chats Table */}
        {!isLoading && chats.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chats.map(chat => (
                  <TableRow key={chat.id}>
                    <TableCell className="font-medium">
                      {chat.customer}
                      {chat.isVIP && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          VIP
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {chat.agent || <span className="text-muted-foreground">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          chat.status === 'open'
                            ? 'default'
                            : chat.status === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {chat.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          chat.priority === 'urgent'
                            ? 'destructive'
                            : chat.priority === 'high'
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {chat.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {chat.startTime && chat.lastMessage
                        ? formatResponseTime(chat.startTime, chat.lastMessage)
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(chat.createdAt), 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {totalChats > 50 && `Showing first 50 of ${totalChats} chats`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {chats.length > 0 && (
              <Button onClick={handleViewAllChats}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View All in Chats Page
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
