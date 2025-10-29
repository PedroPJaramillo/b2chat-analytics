// Enhanced Chat Management Page with Three View Modes

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Users, Table as TableIcon } from 'lucide-react'

// Import view components
import { ContactView } from '@/components/chats/contact-view'
import { ActiveChatsView } from '@/components/chats/active-chats-view'
import { MessagesView } from '@/components/chats/messages-view'
import { FilterBar } from '@/components/chats/filter-bar'
import { ContactHistoryPanel } from '@/components/chats/contact-history-panel'
import {
  UnassignedChatsNotification,
  HighPriorityNotification,
} from '@/components/chats/notification-banner'

// Import hooks
import { useChats } from '@/lib/hooks/use-chats'
import { useMessages } from '@/lib/hooks/use-messages'
import { useChatFilters } from '@/lib/hooks/use-chat-filters'
import { useFilterOptions } from '@/lib/hooks/use-chats'

// Import types
import { ViewMode } from '@/types/chat'
import { pageContainerClasses } from '@/lib/ui-utils'

export default function ChatsPage() {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('active')

  // Filter state
  const { filters, resetFilters, setFilter } = useChatFilters()

  // Fetch chats data
  const { data: chatsData, isLoading: chatsLoading } = useChats(filters)
  const chats = useMemo(() => chatsData?.data || [], [chatsData?.data])
  const chatsPagination = chatsData?.pagination

  // Fetch messages data (for Messages View)
  const { data: messagesData, isLoading: messagesLoading } = useMessages(
    viewMode === 'messages' ? filters : { ...filters, limit: 0 }
  )
  const messages = messagesData?.data || []
  const messagesPagination = messagesData?.pagination

  // Fetch filter options
  const { data: filterOptions } = useFilterOptions()

  // Contact history panel
  const [historyContactId, setHistoryContactId] = useState<string | null>(null)
  const [historyContactName, setHistoryContactName] = useState("")
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  // Handlers
  const handleViewHistory = (contactId: string, contactName: string) => {
    setHistoryContactId(contactId)
    setHistoryContactName(contactName)
    setHistoryPanelOpen(true)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page === (filters.page || 1)) return
    setFilter('page', page)
  }

  // Calculate display counts and notifications
  const totalChats = chatsPagination?.total || 0
  const activeChatsCount = chats.filter(c => c.status === 'open' || c.status === 'pending').length
  const contactsCount = new Set(chats.map(c => c.contactId).filter(Boolean)).size

  // Calculate notification triggers
  const notifications = useMemo(() => {
    const unassignedCount = chats.filter(
      c => (c.status === 'open' || c.status === 'pending') && !c.agent
    ).length

    const highPriorityCount = chats.filter(
      c => (c.status === 'open' || c.status === 'pending') &&
           (c.priority === 'urgent' || c.priority === 'high')
    ).length

    return {
      unassignedCount,
      highPriorityCount,
    }
  }, [chats])

  return (
    <div className={pageContainerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Chat Management</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            <MessageSquare className="mr-1 h-3 w-3" />
            {totalChats} Total
          </Badge>
          <Badge variant="outline" className="bg-green-50">
            {activeChatsCount} Active
          </Badge>
        </div>
      </div>

      {/* Notification Banners */}
      <div className="space-y-2">
        {notifications.unassignedCount > 0 && (
          <UnassignedChatsNotification count={notifications.unassignedCount} />
        )}
        {notifications.highPriorityCount > 0 && (
          <HighPriorityNotification count={notifications.highPriorityCount} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
          <CardDescription>
            Manage customer chats with advanced filtering and multiple view modes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Bar */}
          <FilterBar
            viewMode={viewMode}
            agentOptions={filterOptions?.agents || []}
          />

          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="contact" className="gap-2">
                <Users className="h-4 w-4" />
                Contact View
                <Badge variant="secondary" className="ml-1">
                  {contactsCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Active Chats
                <Badge variant="secondary" className="ml-1">
                  {activeChatsCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-2">
                <TableIcon className="h-4 w-4" />
                Messages
                <Badge variant="secondary" className="ml-1">
                  {messagesPagination?.total || 0}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Contact View Tab */}
            <TabsContent value="contact" className="mt-4">
              <ContactView
                chats={chats}
                isLoading={chatsLoading}
                onViewHistory={handleViewHistory}
                onResetFilters={resetFilters}
              />
            </TabsContent>

            {/* Active Chats View Tab */}
            <TabsContent value="active" className="mt-4">
              <ActiveChatsView
                chats={chats}
                isLoading={chatsLoading}
                onViewHistory={handleViewHistory}
                onResetFilters={resetFilters}
              />
            </TabsContent>

            {/* Messages View Tab */}
            <TabsContent value="messages" className="mt-4">
              <MessagesView
                messages={messages}
                isLoading={messagesLoading}
                onResetFilters={resetFilters}
                totalCount={messagesPagination?.total || 0}
                currentPage={filters.page || 1}
                pageSize={filters.limit || 50}
                onPageChange={handlePageChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Contact History Panel */}
      <ContactHistoryPanel
        contactId={historyContactId}
        contactName={historyContactName}
        open={historyPanelOpen}
        onOpenChange={setHistoryPanelOpen}
      />
    </div>
  )
}
