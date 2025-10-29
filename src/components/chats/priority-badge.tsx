// Priority Badge Component

import { Badge } from '@/components/ui/badge'
import { ChatPriority } from '@/types/chat'
import { AlertCircle, ArrowUp, Minus, ArrowDown } from 'lucide-react'

interface PriorityBadgeProps {
  priority: ChatPriority
  showIcon?: boolean
  className?: string
}

const PRIORITY_ICONS = {
  urgent: AlertCircle,
  high: ArrowUp,
  normal: Minus,
  low: ArrowDown,
}

const PRIORITY_LABELS = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

const PRIORITY_STYLES = {
  urgent: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  high: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  normal: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  low: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
}

export function PriorityBadge({ priority, showIcon = true, className }: PriorityBadgeProps) {
  const Icon = PRIORITY_ICONS[priority]
  const label = PRIORITY_LABELS[priority]
  const styleClass = PRIORITY_STYLES[priority]

  return (
    <Badge
      className={`${styleClass} px-2.5 py-0.5 text-xs font-medium border transition-colors ${className || ''}`}
      variant="outline"
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  )
}
