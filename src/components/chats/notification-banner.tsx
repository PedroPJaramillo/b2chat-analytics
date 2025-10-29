// Notification Banner Component for Context Alerts

'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { X, AlertCircle, Bell, Info, AlertTriangle } from 'lucide-react'
import { LucideIcon } from 'lucide-react'

type BannerVariant = 'info' | 'warning' | 'error' | 'success'

interface NotificationBannerProps {
  variant: BannerVariant
  icon?: LucideIcon
  children: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

const VARIANT_STYLES = {
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-900',
    icon: 'text-blue-600',
    defaultIcon: Info,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: 'text-amber-600',
    defaultIcon: AlertTriangle,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-900',
    icon: 'text-red-600',
    defaultIcon: AlertCircle,
  },
  success: {
    container: 'bg-green-50 border-green-200 text-green-900',
    icon: 'text-green-600',
    defaultIcon: Bell,
  },
}

export function NotificationBanner({
  variant,
  icon,
  children,
  dismissible = true,
  onDismiss,
  className,
}: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  const variantConfig = VARIANT_STYLES[variant]
  const Icon = icon || variantConfig.defaultIcon

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  return (
    <Alert
      className={`${variantConfig.container} ${className || ''} animate-in slide-in-from-top-2 duration-300`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${variantConfig.icon} flex-shrink-0 mt-0.5`} />
        <AlertDescription className="flex-1 text-sm font-medium">
          {children}
        </AlertDescription>
        {dismissible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  )
}

// Specific banner components for common use cases
export function UnassignedChatsNotification({ count, onDismiss }: { count: number; onDismiss?: () => void }) {
  return (
    <NotificationBanner variant="warning" onDismiss={onDismiss}>
      <strong>{count}</strong> {count === 1 ? 'chat has' : 'chats have'} been left unassigned and may need attention.
    </NotificationBanner>
  )
}

export function HighPriorityNotification({ count, onDismiss }: { count: number; onDismiss?: () => void }) {
  return (
    <NotificationBanner variant="error" onDismiss={onDismiss}>
      <strong>{count}</strong> high-priority or urgent {count === 1 ? 'chat is' : 'chats are'} currently pending.
    </NotificationBanner>
  )
}

export function OverdueChatsNotification({ count, onDismiss }: { count: number; onDismiss?: () => void }) {
  return (
    <NotificationBanner variant="warning" icon={AlertCircle} onDismiss={onDismiss}>
      <strong>{count}</strong> {count === 1 ? 'chat has' : 'chats have'} exceeded the expected response time.
    </NotificationBanner>
  )
}
