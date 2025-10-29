"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Repeat2 } from "lucide-react"
import { TimeAgo } from '@/components/ui/time-ago'

interface PreviousChat {
  id: string
  b2chatId: string
  topic: string
  status: string
  createdAt: string
  closedAt: string | null
  messageCount: number
}

interface ContactBadgeProps {
  contactChatCount: number
  contactPreviousChats?: PreviousChat[]
  currentChatId: string
  onViewHistory?: () => void
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'active':
      return 'text-green-600'
    case 'closed':
    case 'resolved':
      return 'text-gray-600'
    case 'pending':
      return 'text-yellow-600'
    default:
      return 'text-gray-600'
  }
}

export function ContactBadge({
  contactChatCount,
  contactPreviousChats = [],
  currentChatId,
  onViewHistory
}: ContactBadgeProps) {
  if (contactChatCount <= 1) {
    // First-time customer
    return (
      <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-200">
        First Contact
      </Badge>
    )
  }

  // Find current chat position
  const currentChatIndex = contactPreviousChats.findIndex(chat => chat.id === currentChatId)
  const chatNumber = currentChatIndex >= 0 ? currentChatIndex + 1 : contactChatCount

  // Get other chats (exclude current)
  const otherChats = contactPreviousChats.filter(chat => chat.id !== currentChatId)
  const otherChatsCount = contactChatCount - 1

  // Get most recent previous chat
  const mostRecentPreviousChat = otherChats[0]

  return (
    <div className="inline-flex items-center gap-1.5 ml-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1.5">
              <Repeat2 className="h-3.5 w-3.5 text-purple-600" />
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                Chat #{chatNumber} of {contactChatCount}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-semibold text-sm">Repeat Customer</p>
              <p className="text-xs text-muted-foreground">
                This contact has {contactChatCount} total chats
              </p>

              {mostRecentPreviousChat && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-medium mb-1">Last chat:</p>
                  <p className="text-xs">
                    <span className="font-medium">{mostRecentPreviousChat.topic}</span>
                  </p>
                  <p className="text-xs">
                    <span className={getStatusColor(mostRecentPreviousChat.status)}>
                      {mostRecentPreviousChat.status}
                    </span>
                    {' • '}
                    <TimeAgo timestamp={mostRecentPreviousChat.createdAt} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mostRecentPreviousChat.messageCount} messages
                  </p>
                </div>
              )}

              {otherChatsCount > 1 && onViewHistory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewHistory()
                  }}
                  className="text-xs text-primary hover:underline font-medium pt-1 block w-full text-left"
                >
                  View {otherChatsCount} other chat{otherChatsCount > 1 ? 's' : ''} from this contact
                </button>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}