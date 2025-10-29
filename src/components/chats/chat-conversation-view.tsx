"use client"

import { useChatMessages } from '@/lib/hooks/use-chat-view'
import { calculateChatResponseTimes, formatResponseTime } from '@/lib/chat-response-time'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { RefreshCw, Clock, Image as ImageIcon, File as FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'

// Helper function to validate URLs
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// Helper function to check if URL is internal
function isInternalUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'localhost' || parsed.hostname.includes(window.location.hostname)
  } catch {
    return false
  }
}

interface ChatConversationViewProps {
  chatId: string
  className?: string
}

interface MessageWithResponseTime {
  id: string
  text: string | null
  type: 'text' | 'image' | 'file'
  incoming: boolean
  timestamp: string
  imageUrl?: string | null
  fileUrl?: string | null
  caption?: string | null
  responseTimeMs?: number // Time to respond to previous customer message
}

export function ChatConversationView({ chatId, className }: ChatConversationViewProps) {
  const { data: messagesData, loading, error, refetch } = useChatMessages(chatId)

  // Loading state
  if (loading) {
    return (
      <div className={cn("space-y-4 p-4", className)}>
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-16 w-3/4 ml-auto" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-16 w-2/3 ml-auto" />
        <Skeleton className="h-16 w-3/4" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 space-y-4", className)}>
        <p className="text-sm text-muted-foreground">
          Failed to load messages: {error}
        </p>
        <Button onClick={() => refetch()} size="sm" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  // Empty state
  if (!messagesData || messagesData.messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <p className="text-sm text-muted-foreground">No messages in this chat</p>
      </div>
    )
  }

  const { messages } = messagesData

  // Calculate response times for agent messages
  const messagesWithResponseTime: MessageWithResponseTime[] = []
  let lastCustomerMessageTime: number | null = null

  for (const message of messages) {
    const messageTime = new Date(message.timestamp).getTime()
    const messageWithTime: MessageWithResponseTime = { ...message }

    // Track customer messages
    if (message.incoming) {
      lastCustomerMessageTime = messageTime
      messagesWithResponseTime.push(messageWithTime)
      continue
    }

    // Calculate response time for agent messages
    if (!message.incoming && lastCustomerMessageTime !== null) {
      const responseTime = messageTime - lastCustomerMessageTime
      if (responseTime > 0) {
        messageWithTime.responseTimeMs = responseTime
      }
      lastCustomerMessageTime = null // Reset after calculating
    }

    messagesWithResponseTime.push(messageWithTime)
  }

  // Calculate response time summary
  const responseTimes = messagesWithResponseTime
    .filter(m => !m.incoming && m.responseTimeMs)
    .map(m => m.responseTimeMs!)

  const summaryData = calculateChatResponseTimes(
    messages.map(m => ({
      timestamp: m.timestamp,
      sender: m.incoming ? 'customer' : 'agent'
    }))
  )

  return (
    <div className={cn("space-y-4", className)}>
      <ScrollArea className="h-[500px]">
        <div className="p-4 space-y-4">
          {messagesWithResponseTime.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>

      {/* Response Time Summary */}
      {responseTimes.length > 0 && summaryData.avgResponseTimeMs && (
        <div className="px-4 py-3 bg-muted/50 rounded-lg text-sm text-muted-foreground flex items-center gap-4">
          <Clock className="h-4 w-4" />
          <span className="font-medium">Response Time Summary:</span>
          <span>Avg: {formatResponseTime(summaryData.avgResponseTimeMs)}</span>
          {summaryData.fastestResponseTimeMs && (
            <span>Fastest: {formatResponseTime(summaryData.fastestResponseTimeMs)}</span>
          )}
          {summaryData.slowestResponseTimeMs && (
            <span>Slowest: {formatResponseTime(summaryData.slowestResponseTimeMs)}</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Individual message row
 * Customer messages: Right-aligned
 * Agent messages: Left-aligned with response time
 */
function MessageRow({ message }: { message: MessageWithResponseTime }) {
  const isCustomer = message.incoming
  const timestamp = new Date(message.timestamp)

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.text || 'No content'}
          </div>
        )

      case 'image':
        return (
          <div className="space-y-2">
            {message.imageUrl && isValidUrl(message.imageUrl) ? (
              <Image
                src={message.imageUrl}
                alt={message.caption || 'Image message'}
                width={250}
                height={150}
                className="rounded-lg max-w-[250px]"
                style={{ maxHeight: '150px', objectFit: 'contain' }}
                unoptimized={!isInternalUrl(message.imageUrl)}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = `<div class="flex items-center justify-center bg-muted/50 rounded-lg p-4 w-[200px] h-[120px]">
                      <div class="text-center text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 mx-auto mb-1"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        <p class="text-xs">Image load failed</p>
                      </div>
                    </div>`
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center bg-muted/50 rounded-lg p-4 w-[200px] h-[120px]">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                  <p className="text-xs">Image unavailable</p>
                </div>
              </div>
            )}
            {message.caption && (
              <p className="text-xs text-muted-foreground">{message.caption}</p>
            )}
          </div>
        )

      case 'file':
        return (
          <div className="flex items-center space-x-2 bg-muted/30 rounded-lg p-2 max-w-[200px]">
            <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {message.caption || 'File attachment'}
              </p>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-xs text-muted-foreground">
            Unsupported type: {message.type}
          </div>
        )
    }
  }

  return (
    <div
      className={cn(
        "flex w-full",
        isCustomer ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn("flex flex-col space-y-1 max-w-[75%]")}>
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 shadow-sm",
            isCustomer
              ? "bg-primary/10 text-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {/* Agent label */}
          {!isCustomer && (
            <div className="text-xs font-medium text-muted-foreground mb-1">
              👨‍💼 Agent
            </div>
          )}

          {renderMessageContent()}
        </div>

        {/* Timestamp and response time */}
        <div
          className={cn(
            "text-xs text-muted-foreground px-2 flex items-center gap-1",
            isCustomer ? "justify-end" : "justify-start"
          )}
        >
          <span>{format(timestamp, 'h:mm:ss a')}</span>
          {!isCustomer && message.responseTimeMs && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatResponseTime(message.responseTimeMs)}
              </span>
            </>
          )}
          {isCustomer && (
            <span className="text-muted-foreground/70">[Customer]</span>
          )}
        </div>
      </div>
    </div>
  )
}
