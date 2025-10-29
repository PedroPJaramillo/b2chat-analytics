# Claude Development Guide for B2Chat Analytics

This document contains important patterns, learnings, and best practices for working with Claude on this project.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Key Learnings](#key-learnings)
4. [Common Patterns](#common-patterns)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Tech Stack:**
- Next.js 14+ (App Router)
- TypeScript
- shadcn/ui components
- Prisma ORM
- Clerk authentication
- TanStack Query (React Query)
- Tailwind CSS

**Project Structure:**
```
src/
├── app/                    # Next.js app router pages
│   └── dashboard/
│       ├── settings/       # Settings pages (route groups)
│       └── [other pages]/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── settings/           # Settings-specific components
│   └── [other]/
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
└── types/                  # TypeScript type definitions
```

---

## Architecture Decisions

### 1. Form Handling: Multiple Independent Forms vs Single Unified Form

**Problem:** Settings page with multiple sections - should they be one form or separate?

**Decision:** **Multiple Independent Forms** (not nested)

**Reasoning:**
- ✅ Different data domains (notifications, display, SLA, etc.)
- ✅ Different permissions (some admin-only)
- ✅ Better error isolation
- ✅ Users can save sections independently
- ✅ Clearer UX with separate save buttons per section

**Key Rule:** Forms must be **siblings, not nested**. HTML doesn't allow `<form>` inside `<form>`.

**Implementation Pattern:**
```tsx
// ❌ BAD: Nested forms cause hydration errors
<Form {...parentForm}>
  <form onSubmit={parentSubmit}>
    <SectionComponent /> {/* This has its own <form> inside */}
  </form>
</Form>

// ✅ GOOD: Sibling forms
<Form {...parentForm}>
  <form onSubmit={parentSubmit}>
    {/* General settings */}
  </form>
</Form>
<SectionComponent /> {/* Has its own independent form */}
```

### 2. Settings Navigation: Tabs vs Sidebar

**Problem:** 9+ settings sections - how to organize navigation?

**Decision:** **Sidebar Navigation with Route-Based Pages**

**Reasoning:**
- ✅ Better for 9+ sections (tabs best for 3-5)
- ✅ Supports hierarchy (General/Admin/System grouping)
- ✅ Always visible options
- ✅ Mobile-friendly (shadcn Sidebar has built-in Sheet)
- ✅ Deep linkable URLs
- ✅ Code-splitting per route (better performance)

**Implementation Pattern:**
```tsx
// Use shadcn Sidebar component
import { Sidebar, SidebarProvider, SidebarInset } from "@/components/ui/sidebar"

<SidebarProvider>
  <Sidebar>
    {/* Navigation items */}
  </Sidebar>
  <SidebarInset>
    {children} {/* Route-based content */}
  </SidebarInset>
</SidebarProvider>
```

### 3. Component Organization: When to Split into Separate Pages

**Decision:** Split into separate route-based pages when:
1. Section has independent form/state
2. Section is logically distinct
3. Deep linking would be useful
4. Better code organization needed
5. Want code-splitting benefits

**File Structure Pattern:**
```
src/app/dashboard/settings/
├── layout.tsx              # Shared sidebar layout
├── page.tsx                # Redirect to default section
├── profile/page.tsx        # Each section = separate route
├── notifications/page.tsx
└── [other-sections]/page.tsx
```

---

## Key Learnings

### 1. Batch Size Configuration (Centralized Config Pattern)

**Problem:** Batch size hardcoded as `100` in multiple files.

**Solution:** Use centralized configuration with database override capability.

**Pattern:**
```typescript
// 1. Central config with defaults
// src/lib/sync/config.ts
export const DEFAULT_CONFIG = {
  batchSize: 100,
  // ... other config
}

export async function getSyncConfig() {
  // Fetch from database, fallback to defaults
  const dbConfig = await prisma.systemSetting.findMany(...)
  return { ...DEFAULT_CONFIG, ...dbConfig }
}

// 2. React hook for client-side
// src/hooks/use-sync-config.ts
export function useSyncConfig() {
  const { data } = useQuery({
    queryKey: ['sync-config'],
    queryFn: () => fetch('/api/sync/config').then(r => r.json())
  })
  return { config: data }
}

// 3. Use in components
const { config } = useSyncConfig()
const batchSize = config.batchSize // Always use this, never hardcode
```

**Benefits:**
- ✅ Single source of truth
- ✅ Database-configurable at runtime
- ✅ Type-safe
- ✅ Easy to change globally

### 2. React Hydration Errors

**Common Cause:** Nested forms, mismatched server/client HTML

**How to Debug:**
1. Look for `<form>` inside `<form>`
2. Check for conditional rendering that differs server/client
3. Verify component tree structure in browser DevTools

**Fix Pattern:**
```tsx
// Move conflicting components outside parent form
<Form {...form1}>
  <form>{/* Form 1 content */}</form>
</Form>
{/* Sibling form - NOT nested */}
<Form {...form2}>
  <form>{/* Form 2 content */}</form>
</Form>
```

### 3. shadcn/ui Component Installation

**Always use CLI for official components:**
```bash
npx shadcn@latest add [component-name]
```

**After installation, fix import paths:**
```typescript
// shadcn may generate incorrect paths like:
import { cn } from "@/components/lib/utils"  // ❌ Wrong

// Fix to:
import { cn } from "@/lib/utils"  // ✅ Correct
```

**Check these common issues:**
- Import paths (should match your project structure)
- CSS variable conflicts in globals.css
- Missing dependencies

### 4. Permission Handling in Routes

**Pattern for Admin-Only Pages:**
```typescript
// src/app/dashboard/settings/admin-section/page.tsx
"use client"

import { useUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default function AdminPage() {
  const { user } = useUser()
  const isAdmin = user?.publicMetadata?.role === "Admin"

  // Redirect non-admins immediately
  if (!isAdmin) {
    redirect("/dashboard/settings/profile")
  }

  return (/* Admin content */)
}
```

**Show/Hide in Sidebar:**
```typescript
// Hide admin sections from non-admin users
{settingsNav.map((group) => {
  if (group.adminOnly && !isAdmin) return null
  return <SidebarGroup>...</SidebarGroup>
})}
```

### 5. Testing Strategy

**Order of Tests:**
1. **TypeScript compilation** - `npx tsc --noEmit`
2. **Build test** - `npm run build`
3. **Manual testing** - Navigate through UI
4. **Permission testing** - Test as admin and regular user
5. **Mobile testing** - Resize browser, test touch interactions

**Key Test Points:**
- [ ] No console errors/warnings
- [ ] No hydration errors
- [ ] Forms save correctly
- [ ] URL navigation works
- [ ] Admin permissions enforced
- [ ] Mobile responsive
- [ ] Loading states display
- [ ] Error states handled

---

## Common Patterns

### 1. Settings Page Template

```typescript
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useToast } from "@/hooks/use-toast"
import { useSettings } from "@/hooks/use-settings"

const schema = z.object({
  // Define your fields
})

type FormValues = z.infer<typeof schema>

export default function SettingsPage() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { /* defaults */ },
    values: settings?.section || undefined, // Auto-populate from API
  })

  const onSubmit = async (data: FormValues) => {
    const success = await saveSettings({
      ...settings,
      section: data,
    })

    if (success) {
      toast({ title: "Saved", description: "Settings updated." })
    } else {
      toast({ title: "Failed", description: "Error saving.", variant: "destructive" })
    }
  }

  if (loading) return <Skeleton />

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Section Title</h3>
        <p className="text-sm text-muted-foreground">Description</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Form fields */}
            </CardContent>
          </Card>

          <div className="flex items-center space-x-4">
            <Button type="submit" disabled={!form.formState.isDirty || saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
```

### 2. Server-Side Layout with Auth

```typescript
// src/app/dashboard/settings/layout.tsx
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function SettingsLayout({ children }) {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const isAdmin = sessionClaims?.metadata?.role === "Admin"

  return (
    <div>
      <SidebarProvider>
        <Sidebar isAdmin={isAdmin} />
        <Content>{children}</Content>
      </SidebarProvider>
    </div>
  )
}
```

### 3. Custom Hook Pattern

```typescript
// src/hooks/use-[feature].ts
"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useFeature() {
  const queryClient = useQueryClient()

  // Fetch data
  const { data, isLoading } = useQuery({
    queryKey: ['feature'],
    queryFn: async () => {
      const res = await fetch('/api/feature')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  // Mutation
  const mutation = useMutation({
    mutationFn: async (newData) => {
      const res = await fetch('/api/feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature'] })
    },
  })

  return {
    data,
    loading: isLoading,
    saving: mutation.isPending,
    save: mutation.mutateAsync,
  }
}
```

---

## Best Practices

### Code Organization

1. **File Naming:**
   - Components: PascalCase (`SettingsSidebar.tsx`)
   - Hooks: camelCase with `use` prefix (`use-sync-config.ts`)
   - Pages: lowercase (`page.tsx`)
   - Types: PascalCase (`types/sla.ts`)

2. **Import Order:**
   ```typescript
   // 1. React/Next imports
   import { useState } from "react"
   import { redirect } from "next/navigation"

   // 2. Third-party libraries
   import { useForm } from "react-hook-form"
   import { z } from "zod"

   // 3. UI components
   import { Button } from "@/components/ui/button"
   import { Card } from "@/components/ui/card"

   // 4. Custom components
   import { SettingsSidebar } from "@/components/settings/settings-sidebar"

   // 5. Hooks
   import { useToast } from "@/hooks/use-toast"

   // 6. Utils/Lib
   import { cn } from "@/lib/utils"

   // 7. Icons
   import { Save, RotateCcw } from "lucide-react"
   ```

3. **Component Structure:**
   ```typescript
   // 1. Interfaces/Types
   interface Props { }
   type FormValues = z.infer<typeof schema>

   // 2. Schemas/Constants
   const schema = z.object({ })

   // 3. Component
   export default function Component() {
     // 3a. Hooks
     const { user } = useUser()
     const form = useForm()

     // 3b. State
     const [loading, setLoading] = useState(false)

     // 3c. Effects
     useEffect(() => { }, [])

     // 3d. Handlers
     const handleSubmit = () => { }

     // 3e. Render logic
     if (loading) return <Skeleton />

     // 3f. Main render
     return (...)
   }
   ```

### Performance

1. **Use React Query for server state**
   - Automatic caching
   - Automatic refetching
   - Loading/error states
   - Optimistic updates

2. **Code splitting with route-based pages**
   - Each settings page = separate bundle
   - Only loads what user visits

3. **Memoization when needed**
   ```typescript
   const expensiveValue = useMemo(() => calculate(), [deps])
   const callback = useCallback(() => {}, [deps])
   ```

### Type Safety

1. **Always define types for forms:**
   ```typescript
   const schema = z.object({ name: z.string() })
   type FormValues = z.infer<typeof schema>
   ```

2. **Use discriminated unions for state:**
   ```typescript
   type Status =
     | { type: 'loading' }
     | { type: 'success', data: Data }
     | { type: 'error', error: Error }
   ```

3. **Avoid `any`** - use `unknown` and type guards

### Accessibility

1. **Use semantic HTML**
   - `<button>` for actions
   - `<a>` for navigation
   - `<form>` for forms

2. **Labels for inputs**
   ```tsx
   <FormField>
     <FormLabel>Email</FormLabel>
     <FormControl>
       <Input type="email" />
     </FormControl>
   </FormField>
   ```

3. **Loading states**
   ```tsx
   <Button disabled={loading}>
     {loading ? <Loader2 className="animate-spin" /> : "Save"}
   </Button>
   ```

---

## Troubleshooting

### Common Issues

#### 1. Hydration Errors

**Symptoms:** "Text content does not match server-rendered HTML"

**Causes:**
- Nested forms
- Conditional rendering based on client-only state
- Date/time rendering (server vs client timezone)

**Solutions:**
- Move forms to be siblings
- Use `useEffect` to set client-only state
- Suppress hydration warnings (last resort):
  ```tsx
  <div suppressHydrationWarning>{clientOnlyContent}</div>
  ```

#### 2. Uncontrolled to Controlled Input Warning

**Symptoms:** "A component is changing an uncontrolled input to be controlled"

**Cause:**
- Form initialized without `defaultValues`
- Input fields start with `undefined` values (uncontrolled)
- When data loads, fields get values (controlled)
- React warns about this state change

**Solution:**
Always provide `defaultValues` in `useForm` for required fields:

```tsx
// ❌ BAD: No defaultValues
const form = useForm<FormType>({
  resolver: zodResolver(schema),
  values: serverData || undefined,  // Can be undefined initially
})

// ✅ GOOD: With defaultValues
const form = useForm<FormType>({
  resolver: zodResolver(schema),
  defaultValues: {
    requiredField1: "default",
    requiredField2: 0,
    // ... all required fields
  },
  values: serverData || undefined,  // Overwrites defaults when loaded
})
```

**Why this works:**
- `defaultValues` provides initial controlled state
- `values` updates the form when server data loads
- Fields are always controlled (never undefined)
- React stays happy ✅

**Alternative for optional number inputs:**
```tsx
<Input
  type="number"
  {...field}
  value={field.value || ""}  // Prevents undefined
  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
/>
```

#### 3. TypeScript Path Errors

**Symptoms:** "Cannot find module '@/components/...'"

**Solutions:**
1. Check `tsconfig.json` has path mappings:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

2. Restart TypeScript server in VSCode

#### 3. shadcn Component Import Errors

**Symptoms:** Component not found after installation

**Solutions:**
1. Check import path matches your project structure
2. Verify component file exists in `src/components/ui/`
3. Run `npx shadcn@latest add [component]` again if missing

#### 4. Form Not Saving

**Debug steps:**
1. Check network tab - is API called?
2. Check API response - success or error?
3. Check form state - is `isDirty` true?
4. Check validation - any errors?
5. Check mutation state - `isPending`, `isError`

**Common fix:**
```typescript
// Ensure form is controlled
const form = useForm({
  values: settings?.section || undefined, // ← Important!
})
```

#### 5. Permission Issues

**Symptoms:** Admin sees everything / Regular user sees admin sections

**Check:**
1. Auth metadata structure:
   ```typescript
   user?.publicMetadata?.role === "Admin"
   ```

2. Server-side auth in layout:
   ```typescript
   const { sessionClaims } = await auth()
   const isAdmin = sessionClaims?.metadata?.role === "Admin"
   ```

3. Client-side redirect:
   ```typescript
   if (!isAdmin) redirect("/dashboard/settings/profile")
   ```

---

## Quick Reference

### File Locations

| What | Where |
|------|-------|
| UI Components | `src/components/ui/` |
| Settings Components | `src/components/settings/` |
| Settings Pages | `src/app/dashboard/settings/[section]/page.tsx` |
| Custom Hooks | `src/hooks/` |
| API Routes | `src/app/api/` |
| Types | `src/types/` |
| Utils | `src/lib/` |

### Commands

```bash
# Development
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build

# Install shadcn component
npx shadcn@latest add [component-name]

# Database
npx prisma generate
npx prisma db push
npx prisma studio
```

### Useful Patterns

```typescript
// Conditional rendering
{isAdmin && <AdminSection />}
{loading ? <Skeleton /> : <Content />}

// Error boundary
try {
  await saveData()
} catch (error) {
  toast({ title: "Error", variant: "destructive" })
}

// Form field
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Label</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormDescription>Help text</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## Version History

- **2024-10-15**: Initial creation
  - Added form handling patterns
  - Added settings navigation architecture
  - Added centralized configuration pattern
  - Added testing strategy
  - Added common troubleshooting solutions

---

## Contributing

When adding new features or patterns to this project:

1. Update this document with new learnings
2. Follow existing patterns unless there's a compelling reason to change
3. Test TypeScript compilation before committing
4. Document any new architectural decisions
5. Add examples of new patterns

---

**Last Updated:** October 15, 2024
