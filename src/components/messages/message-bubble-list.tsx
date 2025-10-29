"use client"

import { useRef, useEffect } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble, type Message } from "./message-bubble"
import { Loader2, RefreshCw } from "lucide-react"

interface MessageBubbleListProps {
  chatId: string
  className?: string
  maxHeight?: string
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
}

/**
 * Simple message list for inline display in chat cards
 * No filters, no search - just messages
 */
export function MessageBubbleList({
  chatId,
  className,
  maxHeight = "550px"
}: MessageBubbleListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const shouldScrollToBottomRef = useRef(true)

  const fetchMessages = async ({ pageParam = 1 }) => {
    const searchParams = new URLSearchParams({
      page: pageParam.toString(),
      limit: '50',
    })

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
    queryKey: ['chat-messages', chatId],
    queryFn: fetchMessages,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (shouldScrollToBottomRef.current && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight
        shouldScrollToBottomRef.current = false
      }
    }
  }, [data])

  const allMessages = data?.pages.flatMap(page => page.messages) ?? []

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
      <ScrollArea style={{ height: maxHeight }} ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">No messages found</p>
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
