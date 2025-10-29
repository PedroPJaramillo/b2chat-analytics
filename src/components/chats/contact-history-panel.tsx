"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useContactHistory } from '@/lib/hooks/use-contact-history'
import {
  Mail,
  Phone,
  Building,
  MessageSquare,
  Clock,
  Tag,
  TrendingUp,
  User,
  ExternalLink,
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { format } from 'date-fns'
import { TimeAgo } from '@/components/ui/time-ago'
import { formatResponseTime, getResponseTimeBadgeClass } from '@/lib/chat-response-time'
import { ChatConversationView } from './chat-conversation-view'
import { cn } from '@/lib/utils'

interface ContactHistoryPanelProps {
  contactId: string | null
  contactName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onJumpToChat?: (chatId: string) => void
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'closed':
    case 'resolved':
      return 'bg-gray-100 text-gray-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'low':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const formatDate = (timestamp: string) => {
  try {
    return format(new Date(timestamp), 'MMM d, yyyy HH:mm')
  } catch {
    return timestamp
  }
}

export function ContactHistoryPanel({
  contactId,
  contactName,
  open,
  onOpenChange,
  onJumpToChat
}: ContactHistoryPanelProps) {
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null)

  // Mobile collapsible sections (Feature 010 - Chunk 9)
  const [showStats, setShowStats] = useState(true)

  const { data, isLoading, error } = useContactHistory(contactId)

  const handleToggleChat = (chatId: string) => {
    setExpandedChatId(prev => prev === chatId ? null : chatId)
  }

  // Keyboard navigation support (Feature 010 - Chunk 9)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] p-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 border-b">
          <DialogTitle className="text-lg md:text-2xl flex items-center gap-2">
            <User className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
            <span className="truncate">Contact History: {contactName}</span>
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Complete conversation history and statistics
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="px-4 md:px-6 py-3 md:py-4 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        )}

        {error && (
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4 text-red-800">
              <p className="font-medium text-sm md:text-base">Failed to load contact history</p>
              <p className="text-xs md:text-sm mt-1">{error.message}</p>
            </div>
          </div>
        )}

        {data && (
          <ScrollArea className="h-[calc(90vh-7rem)] md:h-[calc(90vh-8rem)]">
            <div className="px-4 md:px-6 py-3 md:py-4 space-y-4 md:space-y-6">
              {/* Contact Information */}
              <div className="bg-muted/50 rounded-lg p-3 md:p-4 space-y-2">
                <h3 className="font-semibold text-base md:text-lg">{data.contact.name}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm">
                  {data.contact.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{data.contact.email}</span>
                    </div>
                  )}
                  {data.contact.mobile && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{data.contact.mobile}</span>
                    </div>
                  )}
                  {data.contact.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{data.contact.phone}</span>
                    </div>
                  )}
                  {data.contact.company && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building className="h-4 w-4" />
                      <span>{data.contact.company}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistics (Collapsible on mobile - Feature 010 Chunk 9) */}
              <div>
                <button
                  onClick={() => setShowStats(!showStats)}
                  className="w-full flex items-center justify-between mb-3 hover:opacity-75 transition-opacity"
                  aria-expanded={showStats}
                  aria-label="Toggle statistics section"
                >
                  <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                    Statistics
                  </h3>
                  <div className="md:hidden">
                    {showStats ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {showStats && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <div className="text-2xl font-bold text-blue-900">
                      {data.stats.totalChats}
                    </div>
                    <div className="text-xs text-blue-700 mt-1">Total Chats</div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <div className="text-2xl font-bold text-green-900">
                      {data.stats.openChats}
                    </div>
                    <div className="text-xs text-green-700 mt-1">Open</div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                    <div className="text-2xl font-bold text-yellow-900">
                      {data.stats.pendingChats}
                    </div>
                    <div className="text-xs text-yellow-700 mt-1">Pending</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">
                      {data.stats.closedChats}
                    </div>
                    <div className="text-xs text-gray-700 mt-1">Closed</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {data.stats.avgResolutionTime > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Avg resolution time:</span>
                      <span className="font-medium">
                        {data.stats.avgResolutionTime} minutes
                      </span>
                    </div>
                  )}

                  {data.stats.mostContactedAgent && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Most contacted agent:</span>
                      <span className="font-medium">
                        {data.stats.mostContactedAgent.name} ({data.stats.mostContactedAgent.count} chats)
                      </span>
                    </div>
                  )}

                  {data.stats.commonTags.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <span className="text-muted-foreground">Common tags:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {data.stats.commonTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>

              {/* Chat Timeline */}
              <div>
                <h3 className="font-semibold text-base md:text-lg mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
                  Chat Timeline
                </h3>

                {/* Chat Cards (Mobile optimized - Feature 010 Chunk 9) */}
                <div className="space-y-4">
                  {data?.chats.map((chat, index) => (
                    <div
                      key={chat.id}
                      className="relative pl-6 md:pl-8 pb-4 border-l-2 border-muted last:border-l-0 last:pb-0"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-background ${
                          chat.status === 'open'
                            ? 'bg-green-500'
                            : chat.status === 'pending'
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                        }`}
                      />

                      <div className="bg-card border rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm md:text-base truncate">{chat.topic}</h4>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {formatDate(chat.createdAt)}
                              {' • '}
                              <TimeAgo timestamp={chat.createdAt} />
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 flex-shrink-0">
                            <Badge className={cn(getStatusColor(chat.status), "text-xs px-2 py-0.5")}>
                              {chat.status}
                            </Badge>
                            <Badge className={cn(getPriorityColor(chat.priority), "text-xs px-2 py-0.5")}>
                              {chat.priority}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{chat.agent}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            <span>{chat.messages} messages</span>
                          </div>
                          {chat.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{Math.round(chat.duration / 60)} min</span>
                            </div>
                          )}
                        </div>

                        {chat.tags && chat.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {chat.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] md:text-xs px-1.5 py-0.5">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Response Time Display (Feature 010) */}
                        {chat.firstResponseTimeMs && (
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                            <span className="text-xs md:text-sm text-muted-foreground">Response time:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] md:text-xs px-1.5 py-0.5",
                                getResponseTimeBadgeClass(chat.responseTimeIndicator || 'good')
                              )}
                            >
                              {formatResponseTime(chat.firstResponseTimeMs)}
                            </Badge>
                            {chat.avgResponseTimeMs && chat.avgResponseTimeMs !== chat.firstResponseTimeMs && (
                              <span className="text-[10px] md:text-xs text-muted-foreground">
                                (avg: {formatResponseTime(chat.avgResponseTimeMs)})
                              </span>
                            )}
                          </div>
                        )}

                        {/* Message Preview (Feature 010) */}
                        {chat.messagePreview && chat.messagePreview.length > 0 && (
                          <div className="mt-3 pt-3 border-t space-y-1.5 md:space-y-2">
                            <div className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1 md:mb-2">
                              Recent messages:
                            </div>
                            {chat.messagePreview.map((msg) => (
                              <div
                                key={msg.id}
                                className={cn(
                                  "flex items-start gap-1.5 md:gap-2 text-xs md:text-sm",
                                  msg.incoming ? "text-blue-900 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
                                )}
                              >
                                <ArrowRight className={cn(
                                  "h-3.5 w-3.5 md:h-4 md:w-4 mt-0.5 flex-shrink-0",
                                  msg.incoming ? "text-blue-500 rotate-180" : "text-gray-400"
                                )} />
                                <div className="flex-1 line-clamp-2">
                                  <span className="font-medium text-[10px] md:text-xs">
                                    {msg.incoming ? 'Customer: ' : 'Agent: '}
                                  </span>
                                  {msg.text || <span className="italic text-muted-foreground">(media message)</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Expand/Collapse Button (Feature 010) */}
                        <div className="mt-3 pt-3 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleChat(chat.id)}
                            className="gap-2 min-h-[44px] sm:min-h-0 text-xs md:text-sm"
                            aria-expanded={expandedChatId === chat.id}
                            aria-label={expandedChatId === chat.id ? 'Hide full conversation' : 'Show full conversation'}
                          >
                            {expandedChatId === chat.id ? (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Hide Full Conversation
                              </>
                            ) : (
                              <>
                                <ChevronRight className="h-4 w-4" />
                                Show Full Conversation
                              </>
                            )}
                          </Button>

                          {onJumpToChat && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onJumpToChat(chat.id)
                                onOpenChange(false)
                              }}
                              className="gap-2 min-h-[44px] sm:min-h-0 text-xs md:text-sm"
                              aria-label="View full chat in main view"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Chat
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Conversation View (Feature 010) */}
                      {expandedChatId === chat.id && (
                        <div className="mt-3 md:mt-4 bg-muted/30 rounded-lg border p-3 md:p-4">
                          <h4 className="text-xs md:text-sm font-medium mb-2 md:mb-3 flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            Full Conversation ({chat.messages} messages)
                          </h4>
                          <ChatConversationView chatId={chat.id} />
                        </div>
                      )}
                    </div>
                  ))}

                  {data && data.chats.length === 0 && (
                    <div className="text-center py-6 md:py-8 text-muted-foreground text-sm md:text-base">
                      No chat history found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}