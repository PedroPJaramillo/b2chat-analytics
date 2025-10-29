// Active Chats View - Flat list of open/pending chats

'use client'

import { Chat } from '@/types/chat'
import { ChatCard } from './chat-card'
import { ActiveChatsEmpty } from './empty-states'
import { Skeleton } from '@/components/ui/skeleton'
import { filterActiveChats, sortChatsByPriority } from '@/lib/chat-utils'

interface ActiveChatsViewProps {
  chats: Chat[]
  isLoading?: boolean
  onViewHistory?: (contactId: string, contactName: string) => void
  onResetFilters?: () => void
}

export function ActiveChatsView({
  chats,
  isLoading,
  onViewHistory,
  onResetFilters,
}: ActiveChatsViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  // Filter to only show active chats (open/pending)
  const activeChats = filterActiveChats(chats)

  // Sort by priority and last activity
  const sortedChats = sortChatsByPriority(activeChats)

  if (sortedChats.length === 0) {
    return <ActiveChatsEmpty onReset={onResetFilters} />
  }

  return (
    <div className="space-y-4">
      {sortedChats.map((chat) => (
        <ChatCard
          key={chat.id}
          chat={chat}
          onViewHistory={
            chat.contactId
              ? () => onViewHistory?.(chat.contactId!, chat.customer)
              : undefined
          }
          showContactBadge={true}
          showUnreadIndicator={true}
        />
      ))}
    </div>
  )
}
