// Contact View Component - Groups chats by customer

'use client'

import { useState } from 'react'
import { Chat } from '@/types/chat'
import { ChatCard } from './chat-card'
import { ContactViewEmpty } from './empty-states'
import { Skeleton } from '@/components/ui/skeleton'
import { groupChatsByContact } from '@/lib/chat-utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ContactViewProps {
  chats: Chat[]
  isLoading?: boolean
  onViewHistory?: (contactId: string, contactName: string) => void
  onResetFilters?: () => void
}

export function ContactView({
  chats,
  isLoading,
  onViewHistory,
  onResetFilters,
}: ContactViewProps) {
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  if (chats.length === 0) {
    return <ContactViewEmpty onReset={onResetFilters} />
  }

  // Group chats by contact
  const chatsByContact = groupChatsByContact(chats)

  // Convert to array and sort by most recent activity
  const sortedContacts = Array.from(chatsByContact.entries())
    .map(([contactId, contactChats]) => {
      // Find most recent chat
      const mostRecent = contactChats.reduce((latest, current) =>
        new Date(current.lastMessage) > new Date(latest.lastMessage) ? current : latest
      )

      return {
        contactId,
        chats: contactChats,
        mostRecent,
      }
    })
    .sort((a, b) =>
      new Date(b.mostRecent.lastMessage).getTime() -
      new Date(a.mostRecent.lastMessage).getTime()
    )

  const toggleContact = (contactId: string) => {
    const newExpanded = new Set(expandedContacts)
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId)
    } else {
      newExpanded.add(contactId)
    }
    setExpandedContacts(newExpanded)
  }

  return (
    <div className="space-y-4">
      {sortedContacts.map(({ contactId, chats: contactChats, mostRecent }) => {
        const isExpanded = expandedContacts.has(contactId)
        const hasHistory = contactChats.length > 1

        return (
          <div key={contactId} className="space-y-2">
            {/* Most Recent Chat */}
            <ChatCard
              chat={mostRecent}
              onViewHistory={
                mostRecent.contactId
                  ? () => onViewHistory?.(mostRecent.contactId!, mostRecent.customer)
                  : undefined
              }
              showContactBadge={true}
              showUnreadIndicator={true}
            />

            {/* Historical Chats (Collapsible) */}
            {hasHistory && (
              <Collapsible open={isExpanded} onOpenChange={() => toggleContact(contactId)}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="mr-1 h-4 w-4" />
                        Hide {contactChats.length - 1} previous chat
                        {contactChats.length - 1 > 1 ? 's' : ''}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 h-4 w-4" />
                        Show {contactChats.length - 1} previous chat
                        {contactChats.length - 1 > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-2 mt-2">
                  {contactChats
                    .filter((chat) => chat.id !== mostRecent.id)
                    .sort((a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                    .map((chat) => (
                      <div key={chat.id} className="ml-4 opacity-80">
                        <ChatCard
                          chat={chat}
                          showContactBadge={false}
                          showUnreadIndicator={false}
                        />
                      </div>
                    ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )
      })}
    </div>
  )
}
