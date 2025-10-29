// Reusable Chat Card Component

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  MessageSquare,
  Clock,
  User,
  Tag as TagIcon,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { Chat } from '@/types/chat'
import { PriorityBadge } from './priority-badge'
import { MessageBubbleList } from '@/components/messages/message-bubble-list'
import { TimeAgo } from '@/components/ui/time-ago'
import {
  getStatusColor,
  getPriorityCardStyle,
  getChannelName,
  formatDurationMinutes,
} from '@/lib/chat-utils'

interface ChatCardProps {
  chat: Chat
  onViewHistory?: () => void
  showContactBadge?: boolean
  showUnreadIndicator?: boolean
}

export function ChatCard({
  chat,
  onViewHistory,
  showContactBadge = true,
  showUnreadIndicator = true,
}: ChatCardProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const priorityStyle = getPriorityCardStyle(chat.priority)
  const hasUnread = chat.unreadCount > 0

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`${priorityStyle} ${hasUnread ? 'ring-2 ring-blue-400' : ''} transition-all duration-200 hover:shadow-lg`}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold leading-relaxed">{chat.customer}</h3>
                {hasUnread && showUnreadIndicator && (
                  <Badge variant="default" className="bg-blue-600 px-2.5 py-0.5">
                    {chat.unreadCount} new
                  </Badge>
                )}
                {chat.isVIP && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 px-2.5 py-0.5">
                    ⭐ VIP
                  </Badge>
                )}
                {chat.isRepeatCustomer && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 px-2.5 py-0.5">
                    Repeat Customer
                  </Badge>
                )}
              </div>

              {/* Contact Info */}
              {chat.contactId && (chat.contactEmail || chat.contactPhone) && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {chat.contactEmail && <div>{chat.contactEmail}</div>}
                  {chat.contactPhone && <div>{chat.contactPhone}</div>}
                </div>
              )}

              {chat.alias && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <User className="mr-1.5 h-3.5 w-3.5" />
                  {chat.alias}
                </div>
              )}

              {chat.topic && (
                <p className="text-sm text-muted-foreground leading-relaxed">{chat.topic}</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              {/* Contact Stats */}
              {chat.contactStats && (
                <div className="text-xs text-right text-muted-foreground space-y-0.5 mb-2">
                  <div>{chat.contactStats.totalChats} total chats</div>
                  {chat.contactStats.avgResolutionTimeMinutes > 0 && (
                    <div>Avg resolution: {formatDurationMinutes(chat.contactStats.avgResolutionTimeMinutes)}</div>
                  )}
                  {chat.contactStats.satisfactionScore !== undefined && (
                    <div>{chat.contactStats.satisfactionScore}% satisfaction</div>
                  )}
                </div>
              )}

              {/* Status and Priority badges */}
              <div className="flex gap-2">
                <Badge className={`${getStatusColor(chat.status)} px-2.5 py-0.5 text-xs font-medium border transition-colors`} variant="outline">
                  <span className="mr-1.5">•</span>
                  {chat.status}
                </Badge>
                <PriorityBadge priority={chat.priority} />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center text-muted-foreground">
              <User className="mr-1.5 h-4 w-4" />
              <span>{chat.agent || 'Unassigned'}</span>
            </div>

            <div className="flex items-center text-muted-foreground">
              <MessageSquare className="mr-1.5 h-4 w-4" />
              <span>{chat.messages} messages</span>
            </div>

            <div className="flex items-center text-muted-foreground">
              <Clock className="mr-1.5 h-4 w-4" />
              <TimeAgo timestamp={chat.lastMessage} />
            </div>

            <div className="flex items-center text-muted-foreground">
              <span>{getChannelName(chat.provider)}</span>
            </div>
          </div>

          {/* Tags */}
          {chat.tags && chat.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {chat.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2.5 py-0.5">
                  {tag}
                </Badge>
              ))}
              {chat.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                  +{chat.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Resolution Note (if closed) */}
          {chat.status === 'closed' && chat.resolutionNote && (
            <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3 leading-relaxed">
              {chat.resolutionNote}
            </div>
          )}

          {/* Agent Unavailable Warning */}
          {chat.status === 'open' && !chat.agent && (
            <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Chat has been unassigned</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                aria-label={isExpanded ? 'Hide messages' : 'View messages'}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Messages
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4" />
                    View Messages
                  </>
                )}
              </Button>
            </CollapsibleTrigger>

            {onViewHistory && chat.contactId && showContactBadge && (
              <>
                <Button variant="ghost" size="sm" onClick={onViewHistory} className="gap-1.5">
                  <History className="h-4 w-4" />
                  History ({chat.contactChatCount || 0})
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/dashboard/analytics?contactId=${chat.contactId}`)}
                  className="gap-1.5"
                >
                  <TrendingUp className="h-4 w-4" />
                  Analytics
                </Button>
              </>
            )}
          </div>

          {/* Expanded Messages Section */}
          <CollapsibleContent className="space-y-2">
            <div className="border-t pt-4">
              <MessageBubbleList
                chatId={chat.id}
                maxHeight="550px"
              />
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  )
}
