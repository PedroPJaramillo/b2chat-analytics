// Tag Filter Component with Multi-Select

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tag, X } from 'lucide-react'
import { useChatFilters } from '@/lib/hooks/use-chat-filters'
import { useFilterOptions } from '@/lib/hooks/use-chats'

export function TagFilter() {
  const { filters, toggleTag, clearTags } = useChatFilters()
  const { data: filterOptions, isLoading } = useFilterOptions()

  const availableTags = filterOptions?.tags || [
    'billing',
    'technical',
    'api',
    'vip',
    'urgent',
    'onboarding',
    'support',
    'account',
    'general',
  ]

  const selectedTags = filters.tags || []

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading tags...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filter by Tags (AND logic):</span>
        {selectedTags.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearTags} className="h-7 px-2">
            <X className="mr-1 h-3 w-3" />
            Clear Tags
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag: string) => {
          const isSelected = selectedTags.includes(tag)
          return (
            <Button
              key={tag}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleTag(tag)}
              className={`h-7 ${
                isSelected
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'hover:bg-blue-50'
              }`}
            >
              {tag}
              {isSelected && <X className="ml-1 h-3 w-3" />}
            </Button>
          )
        })}
      </div>

      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Selected:</span>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <span className="text-xs">
            (Showing chats with {selectedTags.length === 1 ? 'this tag' : 'all these tags'})
          </span>
        </div>
      )}
    </div>
  )
}
