"use client"

import { useEffect, useRef, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MessageBubble, type Message } from "./message-bubble"
import { Loader2, Search, Filter, RefreshCw } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"

interface MessageListProps {
  chatId: string
  chatAlias?: string | null
  className?: string
}

interface MessagesResponse {
  messages: Message[]
  pagination: {
    page: number
    limit: number
    totalMessages: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  chat: {
    id: string
    b2chatId: string
    alias?: string | null
  }
}

export function MessageList({ chatId, chatAlias, className }: MessageListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [messageType, setMessageType] = useState<string>("all")
  const [direction, setDirection] = useState<string>("all")
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const shouldScrollToBottomRef = useRef(true)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const fetchMessages = async ({ pageParam = 1 }) => {
    const searchParams = new URLSearchParams({
      page: pageParam.toString(),
      limit: '50',
    })

    if (debouncedSearchTerm) {
      searchParams.append('search', debouncedSearchTerm)
    }

    if (messageType !== 'all') {
      searchParams.append('type', messageType)
    }

    if (direction !== 'all') {
      searchParams.append('incoming', direction === 'incoming' ? 'true' : 'false')
    }

    const response = await fetch(`/api/chats/${chatId}/messages?${searchParams}`)
    if (!response.ok) {
      throw new Error('Failed to fetch messages')
    }

    return response.json() as Promise<MessagesResponse>
  }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: ['messages', chatId, debouncedSearchTerm, messageType, direction],
    queryFn: fetchMessages,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })

  // Auto-scroll to bottom on initial load or when new messages arrive
  useEffect(() => {
    if (shouldScrollToBottomRef.current && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight
        shouldScrollToBottomRef.current = false
      }
    }
  }, [data])

  // Reset shouldScrollToBottom when filters change
  useEffect(() => {
    shouldScrollToBottomRef.current = true
  }, [debouncedSearchTerm, messageType, direction])

  const allMessages = data?.pages.flatMap(page => page.messages) ?? []
  const totalMessages = data?.pages[0]?.pagination.totalMessages ?? 0

  if (status === 'pending') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-sm text-muted-foreground">
          Failed to load messages: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Button onClick={() => refetch()} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="text-lg font-semibold">
            {chatAlias ? `${chatAlias} Messages` : 'Chat Messages'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {totalMessages} {totalMessages === 1 ? 'message' : 'messages'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search-messages">Search messages</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-messages"
                placeholder="Search in messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message type</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="file">Files</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All messages</SelectItem>
                <SelectItem value="incoming">From customer</SelectItem>
                <SelectItem value="outgoing">From agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 h-[600px]" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">
                No messages found
                {debouncedSearchTerm || messageType !== 'all' || direction !== 'all'
                  ? ' for the current filters'
                  : ''
                }
              </p>
            </div>
          ) : (
            <>
              {allMessages.map((message, index) => (
                <MessageBubble
                  key={`${message.id}-${index}`}
                  message={message}
                />
              ))}

              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    size="sm"
                    variant="outline"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Load more messages
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}