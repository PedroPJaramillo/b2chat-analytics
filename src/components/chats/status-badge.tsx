// Status Badge Component - Feature 001: Full 8-status support

'use client'

import { Badge } from '@/components/ui/badge'
import { ChatStatus } from '@/types/chat'
import { getStatusColor, getStatusLabel, getStatusIcon } from '@/lib/chat-utils'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: ChatStatus
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatusBadge({
  status,
  showIcon = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  }

  return (
    <Badge
      className={cn(
        getStatusColor(status),
        sizeClasses[size],
        'font-medium border transition-colors',
        className
      )}
      variant="outline"
    >
      {showIcon && (
        <span className="mr-1.5" aria-hidden="true">
          {getStatusIcon(status)}
        </span>
      )}
      {getStatusLabel(status)}
    </Badge>
  )
}

/**
 * Compact status indicator (just dot + color)
 */
export function StatusIndicator({
  status,
  className,
}: {
  status: ChatStatus
  className?: string
}) {
  const colorClass = getStatusColor(status).split(' ')[0] // Get just bg color
  const dotColor = colorClass.replace('bg-', 'bg-').replace('-50', '-500')

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title={getStatusLabel(status)}
    >
      <span className={cn('w-2 h-2 rounded-full', dotColor)} />
      <span className="text-sm text-slate-600">{getStatusLabel(status)}</span>
    </span>
  )
}

/**
 * Status badge with tooltip showing full lifecycle position
 */
export function StatusBadgeWithTooltip({
  status,
  createdAt,
  openedAt,
  pickedUpAt,
  responseAt,
  closedAt,
  pollStartedAt,
  pollCompletedAt,
  pollAbandonedAt,
}: {
  status: ChatStatus
  createdAt?: string | null
  openedAt?: string | null
  pickedUpAt?: string | null
  responseAt?: string | null
  closedAt?: string | null
  pollStartedAt?: string | null
  pollCompletedAt?: string | null
  pollAbandonedAt?: string | null
}) {
  const lifecycleSteps = [
    { label: 'Created', timestamp: createdAt, status: 'OPENED' },
    { label: 'Opened', timestamp: openedAt, status: 'OPENED' },
    { label: 'Picked Up', timestamp: pickedUpAt, status: 'PICKED_UP' },
    { label: 'Responded', timestamp: responseAt, status: 'RESPONDED_BY_AGENT' },
    { label: 'Closed', timestamp: closedAt, status: 'CLOSED' },
    { label: 'Survey Started', timestamp: pollStartedAt, status: 'COMPLETING_POLL' },
    { label: 'Survey Completed', timestamp: pollCompletedAt, status: 'COMPLETED_POLL' },
    { label: 'Survey Abandoned', timestamp: pollAbandonedAt, status: 'ABANDONED_POLL' },
  ].filter(step => step.timestamp)

  return (
    <div className="group relative inline-block">
      <StatusBadge status={status} />

      {/* Tooltip on hover */}
      <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 p-3 bg-white border border-slate-200 rounded-lg shadow-lg">
        <h4 className="text-xs font-semibold text-slate-700 mb-2">Status Timeline</h4>
        <div className="space-y-1.5">
          {lifecycleSteps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <span className={cn(
                'flex-shrink-0 w-2 h-2 rounded-full mt-1',
                step.status === status ? 'bg-green-500' : 'bg-slate-300'
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-slate-600 font-medium">{step.label}</div>
                <div className="text-slate-400 text-[10px]">
                  {new Date(step.timestamp!).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
