"use client"

import { useEffect, useState } from 'react'
import { formatTimeAgo } from '@/lib/chat-utils'

interface TimeAgoProps {
  timestamp: string | Date
  className?: string
}

/**
 * TimeAgo component that safely handles server/client hydration
 *
 * This component prevents hydration errors by:
 * 1. Initially rendering nothing on server
 * 2. Only showing relative time after client-side mount
 * 3. Using suppressHydrationWarning to prevent React warnings
 */
export function TimeAgo({ timestamp, className }: TimeAgoProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR and initial render, show nothing to prevent hydration mismatch
  if (!mounted) {
    return <span className={className}>&nbsp;</span>
  }

  // After mount, show the relative time
  return (
    <span className={className} suppressHydrationWarning>
      {formatTimeAgo(timestamp)}
    </span>
  )
}
