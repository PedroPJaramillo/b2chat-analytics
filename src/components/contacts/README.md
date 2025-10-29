# Contact Tags Component

Feature 002: Display contact tags from B2Chat with assignment timestamps.

## Overview

The `ContactTags` component displays tags assigned to contacts in B2Chat. Each tag includes:
- **name**: The tag label (user-defined in B2Chat, e.g., "VIP", "Premium")
- **assigned_at**: Unix timestamp when the tag was assigned

## Components

### ContactTags

Main component for displaying contact tags with full details.

```tsx
import { ContactTags } from '@/components/contacts/contact-tags'

// Example usage
<ContactTags
  tags={contact.tags}
  maxVisible={3}        // Show 3 tags, rest in overflow (optional, default: 3)
  showIcon={true}       // Show tag icon (optional, default: true)
  className="ml-2"      // Additional classes (optional)
/>
```

**Features:**
- Displays up to `maxVisible` tags as badges
- Remaining tags shown in "+N" overflow badge with tooltip
- Each tag has a tooltip showing when it was assigned
- Color-coded badges for common tags (VIP, Premium, Urgent, etc.)
- Null-safe: returns null if no tags
- Sorted by assignment date (most recent first)

### ContactTagsCompact

Compact variant showing just the tag count.

```tsx
import { ContactTagsCompact } from '@/components/contacts/contact-tags'

// Example usage - ideal for list views
<ContactTagsCompact tags={contact.tags} />
```

**Features:**
- Shows tag count badge with tag icon
- Tooltip lists all tags with assignment dates
- More space-efficient for dense layouts

## Examples

### In a Contact Card

```tsx
import { ContactTags } from '@/components/contacts/contact-tags'
import { Card } from '@/components/ui/card'

export function ContactCard({ contact }: { contact: ContactInfo }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{contact.name}</h3>
          <p className="text-sm text-muted-foreground">{contact.email}</p>
        </div>
        <ContactTags tags={contact.tags} maxVisible={2} />
      </div>
    </Card>
  )
}
```

### In a Chat List Item

```tsx
import { ContactTagsCompact } from '@/components/contacts/contact-tags'

export function ChatListItem({ chat }: { chat: Chat }) {
  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <span className="font-medium">{chat.customer}</span>
        <ContactTagsCompact tags={chat.contactTags} />
      </div>
      {/* ... other chat info */}
    </div>
  )
}
```

### In Contact Details Panel

```tsx
import { ContactTags } from '@/components/contacts/contact-tags'

export function ContactDetailsPanel({ contact }: { contact: ContactInfo }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Contact Information</h2>
        <dl className="space-y-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Name</dt>
            <dd>{contact.name}</dd>
          </div>
          {/* ... other fields */}
          {contact.tags && contact.tags.length > 0 && (
            <div>
              <dt className="text-sm font-medium text-muted-foreground mb-1">Tags</dt>
              <dd>
                <ContactTags
                  tags={contact.tags}
                  maxVisible={5}
                  showIcon={false}
                />
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
```

## Data Structure

Tags are stored as JSON in the database:

```typescript
interface ContactTag {
  name: string        // Tag label (e.g., "VIP", "Premium")
  assigned_at: number // Unix timestamp in seconds
}

// Example from database
{
  "tags": [
    { "name": "VIP", "assigned_at": 1706644084 },
    { "name": "Premium", "assigned_at": 1706648900 }
  ]
}
```

## Tag Colors

The component automatically applies colors to common tags:

| Tag Pattern | Color |
|-------------|-------|
| Contains "vip" | Purple |
| Contains "premium" | Amber |
| Contains "urgent" | Red |
| Contains "priority" | Orange |
| Contains "lead" | Green |
| Contains "follow" | Blue |
| Other | Gray (default) |

Colors are case-insensitive and match substrings.

## Dynamic Tags

B2Chat users can create new tags dynamically without any code changes. The component handles any tag name gracefully, applying default styling to unrecognized tags.

## API Integration

Tags are automatically synced from B2Chat via the transform engine:

```typescript
// Tags are synced from B2Chat API
const contact = await prisma.contact.findUnique({
  where: { b2chatId: '123' },
  select: {
    tags: true, // Returns: [{ name: "VIP", assigned_at: 1706644084 }]
  }
})
```

## Accessibility

- All badges have appropriate ARIA labels
- Tooltip content is keyboard accessible
- Color contrast meets WCAG AA standards
- Icons have descriptive alt text

## Performance

- Tags are sorted client-side (minimal overhead)
- Tooltip content lazy-loaded on hover
- Component re-renders only when tags prop changes
- No external API calls - works with cached data
