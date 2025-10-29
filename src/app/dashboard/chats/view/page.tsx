"use client"

import { ChatViewTable } from "@/components/chats/chat-view-table"
import { pageContainerClasses } from "@/lib/ui-utils"

export default function ChatViewPage() {
  return (
    <div className={pageContainerClasses}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Chat View</h2>
          <p className="text-muted-foreground">
            Review chat conversations and analyze agent response times
          </p>
        </div>
      </div>

      {/* Chat View Table */}
      <ChatViewTable />
    </div>
  )
}
