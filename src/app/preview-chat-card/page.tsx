'use client'

import { ChatCard } from '@/components/chats/chat-card'
import { Chat } from '@/types/chat'

export default function ChatCardPreviewPage() {
  // Sample chat data with various states
  const sampleChats: Chat[] = [
    {
      id: '1',
      b2chatId: 'B2C_001',
      customer: 'John Doe',
      contactId: 'contact_001',
      contactEmail: 'john.doe@example.com',
      contactPhone: '+1 (555) 123-4567',
      agent: 'Alice Johnson',
      agentId: 'agent_001',
      status: 'PICKED_UP',
      alias: '@johndoe',
      tags: ['billing', 'urgent', 'vip-customer'],
      priority: 'urgent',
      topic: 'Payment Issue - Credit card declined',
      messages: 12,
      unreadCount: 3,
      resolutionNote: null,
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      lastMessage: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      provider: 'whatsapp',
      contactChatCount: 8,
      isRepeatCustomer: true,
      isVIP: true,
      contactStats: {
        totalChats: 8,
        avgResolutionTimeMinutes: 45,
        satisfactionScore: 92,
      },
    },
    {
      id: '2',
      b2chatId: 'B2C_002',
      customer: 'Sarah Smith',
      contactId: 'contact_002',
      contactEmail: 'sarah.smith@example.com',
      contactPhone: null,
      agent: 'Bob Williams',
      agentId: 'agent_002',
      status: 'CLOSED',
      alias: null,
      tags: ['product-inquiry', 'resolved'],
      priority: 'normal',
      topic: 'Question about product features',
      messages: 8,
      unreadCount: 0,
      resolutionNote: 'Customer satisfied with product demo. Provided detailed documentation.',
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      lastMessage: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      provider: 'facebook',
      contactChatCount: 2,
      isRepeatCustomer: false,
      isVIP: false,
      contactStats: {
        totalChats: 2,
        avgResolutionTimeMinutes: 30,
        satisfactionScore: 85,
      },
    },
    {
      id: '3',
      b2chatId: 'B2C_003',
      customer: 'Michael Chen',
      contactId: null,
      contactEmail: null,
      contactPhone: null,
      agent: null,
      agentId: null,
      status: 'OPENED',
      alias: '@mchen',
      tags: ['technical-support'],
      priority: 'high',
      topic: 'System Integration Help Needed',
      messages: 5,
      unreadCount: 5,
      resolutionNote: null,
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      lastMessage: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      provider: 'telegram',
      isVIP: false,
    },
    {
      id: '4',
      b2chatId: 'B2C_004',
      customer: 'Emma Rodriguez',
      contactId: 'contact_004',
      contactEmail: 'emma.r@company.com',
      contactPhone: '+1 (555) 987-6543',
      agent: 'Charlie Brown',
      agentId: 'agent_003',
      status: 'RESPONDED_BY_AGENT',
      alias: null,
      tags: ['general-inquiry', 'pricing', 'enterprise', 'follow-up'],
      priority: 'low',
      topic: 'Enterprise plan pricing inquiry',
      messages: 15,
      unreadCount: 1,
      resolutionNote: null,
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      lastMessage: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      provider: 'livechat',
      contactChatCount: 3,
      isRepeatCustomer: true,
      isVIP: false,
      contactStats: {
        totalChats: 3,
        avgResolutionTimeMinutes: 65,
        satisfactionScore: 78,
      },
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Chat Card Component Preview</h1>
          <p className="text-muted-foreground">
            Interactive preview of the ChatCard component with various states
          </p>
        </div>

        <div className="space-y-6">
          {sampleChats.map((chat) => (
            <div key={chat.id}>
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                Status: {chat.status} | Priority: {chat.priority}
                {chat.unreadCount > 0 && ` | ${chat.unreadCount} unread`}
              </div>
              <ChatCard
                chat={chat}
                onViewHistory={() => {
                  console.log('View history for:', chat.customer)
                  alert(`Viewing history for ${chat.customer}`)
                }}
                showContactBadge={true}
                showUnreadIndicator={true}
              />
            </div>
          ))}
        </div>

        <div className="mt-12 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold mb-2">Preview Features:</h2>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Urgent priority with VIP status and unread messages</li>
            <li>Closed chat with resolution note</li>
            <li>Unassigned chat with high priority warning</li>
            <li>Low priority chat with multiple tags</li>
            <li>Click "View Messages" to expand message history</li>
            <li>Click "History" or "Analytics" to test navigation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
