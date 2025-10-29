// Empty State Components for Chat Views

import { MessageSquare, Users, Inbox, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onReset?: () => void
}

export function ContactViewEmpty({ onReset }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No customers match your filters</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Try adjusting your filters or search criteria to see more results
      </p>
      {onReset && (
        <Button variant="outline" onClick={onReset}>
          <Filter className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  )
}

export function ActiveChatsEmpty({ onReset }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No active conversations</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        {onReset
          ? 'No chats match your current filters'
          : 'All conversations are currently closed or there are no open chats'}
      </p>
      {onReset && (
        <Button variant="outline" onClick={onReset}>
          <Filter className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  )
}

export function MessagesViewEmpty({ onReset }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No messages found</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        {onReset
          ? 'No messages match your current filters'
          : 'There are no messages to display'}
      </p>
      {onReset && (
        <Button variant="outline" onClick={onReset}>
          <Filter className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  )
}
