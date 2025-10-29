/**
 * Contact Tags Component
 *
 * Feature 002: Displays contact tags from B2Chat with assignment timestamps
 *
 * Tags structure: [{ name: "VIP", assigned_at: 1706644084 }]
 * - name: Tag label (user-defined in B2Chat)
 * - assigned_at: Unix timestamp when tag was assigned
 */

'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tag } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export interface ContactTag {
  name: string
  assigned_at: number // Unix timestamp (seconds)
}

interface ContactTagsProps {
  tags: ContactTag[] | null | undefined
  maxVisible?: number
  showIcon?: boolean
  className?: string
}

/**
 * Format Unix timestamp to readable date
 */
function formatTagDate(unixTimestamp: number): string {
  try {
    // Convert seconds to milliseconds for JavaScript Date
    const date = new Date(unixTimestamp * 1000)

    if (isNaN(date.getTime())) {
      return 'Unknown date'
    }

    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}

/**
 * Get badge color for tag (can be customized based on tag name)
 */
function getTagColor(tagName: string): string {
  const lowerName = tagName.toLowerCase()

  // Predefined colors for common tags
  if (lowerName.includes('vip')) return 'bg-purple-100 text-purple-800 border-purple-200'
  if (lowerName.includes('premium')) return 'bg-amber-100 text-amber-800 border-amber-200'
  if (lowerName.includes('urgent')) return 'bg-red-100 text-red-800 border-red-200'
  if (lowerName.includes('priority')) return 'bg-orange-100 text-orange-800 border-orange-200'
  if (lowerName.includes('lead')) return 'bg-green-100 text-green-800 border-green-200'
  if (lowerName.includes('follow')) return 'bg-blue-100 text-blue-800 border-blue-200'

  // Default color for other tags
  return 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Single tag badge with tooltip showing assignment date
 */
function ContactTagBadge({ tag }: { tag: ContactTag }) {
  const assignedDate = formatTagDate(tag.assigned_at)
  const colorClass = getTagColor(tag.name)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-xs font-medium cursor-help ${colorClass}`}
          >
            {tag.name}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            <span className="font-semibold">Tag assigned</span>
            <br />
            {assignedDate}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Display contact tags with optional icon and overflow handling
 */
export function ContactTags({
  tags,
  maxVisible = 3,
  showIcon = true,
  className = '',
}: ContactTagsProps) {
  // Handle empty or null tags
  if (!tags || tags.length === 0) {
    return null
  }

  // Sort tags by assignment date (most recent first)
  const sortedTags = [...tags].sort((a, b) => b.assigned_at - a.assigned_at)

  // Split into visible and overflow tags
  const visibleTags = sortedTags.slice(0, maxVisible)
  const overflowTags = sortedTags.slice(maxVisible)
  const hasOverflow = overflowTags.length > 0

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {showIcon && (
        <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      )}

      {/* Visible tags */}
      {visibleTags.map((tag, index) => (
        <ContactTagBadge key={`${tag.name}-${index}`} tag={tag} />
      ))}

      {/* Overflow indicator with tooltip */}
      {hasOverflow && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-xs font-medium cursor-help bg-gray-50 text-gray-600 border-gray-300"
              >
                +{overflowTags.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-semibold mb-2">More tags:</p>
                {overflowTags.map((tag, index) => (
                  <div key={`overflow-${tag.name}-${index}`} className="text-xs">
                    <span className="font-medium">{tag.name}</span>
                    <span className="text-muted-foreground">
                      {' • '}
                      {formatTagDate(tag.assigned_at)}
                    </span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

/**
 * Compact variant - just shows tag count with tooltip
 */
export function ContactTagsCompact({ tags }: { tags: ContactTag[] | null | undefined }) {
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs font-medium cursor-help bg-gray-50 text-gray-700 border-gray-200"
          >
            <Tag className="h-3 w-3 mr-1" />
            {tags.length}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-semibold mb-2">Contact tags:</p>
            {tags
              .sort((a, b) => b.assigned_at - a.assigned_at)
              .map((tag, index) => (
                <div key={`compact-${tag.name}-${index}`} className="text-xs">
                  <span className="font-medium">{tag.name}</span>
                  <span className="text-muted-foreground">
                    {' • '}
                    {formatTagDate(tag.assigned_at)}
                  </span>
                </div>
              ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
