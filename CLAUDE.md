# Claude Development Guide - B2Chat Analytics

This file provides specific instructions for Claude when working on the B2Chat Analytics project.

## 📚 Primary Documentation References

**ALWAYS reference these files before making changes:**
- `/tech_stack_standards.md` - Complete tech stack requirements and approved dependencies
- `/B2Chat/b2chat_dev_docs.md` - B2Chat API documentation and endpoints
- `/B2Chat/best_practices_standards.md` - Development philosophy and React best practices
- `/B2Chat/code_style_standards.md` - Formatting and naming conventions
- `NEXT_STEPS_PLAN.md` - Project roadmap and current phase status
- `INTEGRATION_STATUS.md` - Current API integration status and known issues

## 🔧 Tech Stack Standards

### Key Principles
1. **shadcn/ui Components**: Always use `npx shadcn@latest add <component>` for new UI components
2. **Minimal Dependencies**: Only add dependencies listed in tech_stack_standards.md
3. **Existing Patterns**: Study existing code patterns before implementing new features
4. **TypeScript First**: All code must be properly typed

### Core Technologies
- **Framework**: Next.js 14 with App Router + TypeScript 5.0+
- **Styling**: Tailwind CSS 3.4+ with shadcn/ui components
- **UI Components**: Radix UI primitives + shadcn/ui generated components
- **State Management**: TanStack Query + React useState/useContext
- **Forms**: React Hook Form + Zod validation
- **Database**: PostgreSQL 15+ with Prisma 5.0+ ORM
- **Authentication**: Clerk with middleware + server-side verification
- **Icons**: Lucide React

## 🌐 B2Chat API Integration

### Important API Information
- **Base URL**: `https://api.b2chat.io`
- **Authentication**: OAuth via `/oauth/token` endpoint (NOT `/token`)
- **Credentials**: Username/password from B2Chat admin panel

### Available Endpoints
```bash
✅ /contacts/export  # Export contacts (GET with filters)
✅ /contacts/import  # Import contacts (POST)
✅ /chats/export     # Export chats (GET with filters)
✅ /oauth/token      # Authentication
✅ /health           # Health check
❌ /agents          # Does NOT exist - no agents endpoint
❌ /contacts        # Use /contacts/export instead
❌ /chats           # Use /chats/export instead
```

### Critical Notes
- **No Agents Module**: B2Chat API doesn't provide agents endpoint - remove or mock this functionality
- **Export Endpoints**: Use `/contacts/export` and `/chats/export`, not direct `/contacts` or `/chats`
- **Authentication Fixed**: OAuth endpoint corrected in INTEGRATION_STATUS.md

## 📁 Project Architecture

### File Organization
```
src/
├── app/                 # Next.js App Router (pages + API routes)
├── components/          # Reusable components
│   ├── ui/             # shadcn/ui components (generated)
│   └── providers/      # Context providers (QueryProvider, etc.)
├── hooks/              # Custom React hooks (use-sync, use-sync-config)
├── lib/                # Utilities and configurations
│   ├── b2chat/         # B2Chat API client
│   ├── sync/           # Sync engine and state management
│   └── prisma.ts       # Database client
└── types/              # TypeScript type definitions
```

### Current Implementation Status
- ✅ **Phase 1-4**: Complete foundation, sync engine, dashboard UI
- ✅ **Authentication**: Clerk integration working
- ✅ **Database**: 15 models including contacts, chats, sync states
- ⚠️ **API Client**: Needs endpoint updates (see INTEGRATION_STATUS.md)
- ❌ **Agents**: Remove completely (not supported by B2Chat API)
- 🎯 **Current Phase**: Ready for Phase 5 (Database & Environment Setup)

## 🛠️ Development Workflow

### Essential Commands
```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run lint                   # Code linting

# shadcn/ui Components (PREFERRED METHOD)
npx shadcn@latest add button   # Add new components
npx shadcn@latest add form
npx shadcn@latest add dialog

# Database Management
npm run db:push                # Push schema changes
npm run db:migrate             # Create and run migrations
npm run db:studio              # Open Prisma Studio
npm run db:seed                # Seed with test data
npm run db:reset               # Reset database

# Testing
npm run test                   # Jest unit tests
npm run test:watch             # Jest watch mode
npm run test:e2e               # Playwright end-to-end tests
npm run test:load              # k6 load testing
```

### Configuration Files
- `components.json` - shadcn/ui configuration (already set up)
- `tailwind.config.ts` - Tailwind + shadcn theme (managed by shadcn CLI)
- `src/app/globals.css` - CSS variables (managed by shadcn CLI)
- `package.json` - Dependencies and scripts

## 🚨 Common Issues & Solutions

### 1. shadcn/ui Components
- ✅ **Use CLI**: `npx shadcn@latest add <component>`
- ❌ **Don't**: Manually install or create components
- **Note**: CLI has changed from `shadcn-ui@latest` to `shadcn@latest`

### 2. CSS Variables & Styling
- ✅ **Already configured** by shadcn init
- ❌ **Don't**: Manually modify globals.css or tailwind.config.ts
- **Classes work**: `bg-background`, `border-border`, etc.

### 3. TanStack Query Setup
- ✅ **Provider configured** in `src/app/layout.tsx`
- ✅ **QueryClient** available via `QueryProvider`
- **Location**: `src/components/providers/query-provider.tsx`

### 4. B2Chat API Client
- ⚠️ **Needs updates**: Use export endpoints, remove agents
- **File**: `src/lib/b2chat/client.ts`
- **Authentication**: OAuth working correctly

## 📋 Development Guidelines

### Before Making Changes
1. **Check existing patterns** in similar components/files
2. **Review tech stack standards** for approved dependencies
3. **Study current implementation** to understand architecture
4. **Consider B2Chat API limitations** (no agents, export endpoints)

### When Adding Features
1. **Use existing components** when possible
2. **Follow naming conventions** from code_style_standards.md
3. **Add proper TypeScript types** for all new code
4. **Test with real B2Chat API** endpoints
5. **Update this file** if you discover new patterns

### When Fixing Issues
1. **Check INTEGRATION_STATUS.md** for known API issues
2. **Use proper B2Chat endpoints** (/contacts/export, not /contacts)
3. **Remove agents functionality** (API doesn't support it)
4. **Follow error handling patterns** from existing code

## 🎯 Project-Specific Context

### Business Requirements
- **Internal use**: 10-20 concurrent users
- **Analytics focus**: Customer service performance metrics
- **Real-time sync**: Automated B2Chat data synchronization
- **Security**: Internal network, minimal external dependencies

### Key Features Implemented
- **Dashboard**: Real-time analytics with charts and metrics
- **Contact Management**: Sync and display B2Chat contacts
- **Chat Analytics**: Conversation analysis and reporting
- **Data Synchronization**: Automated sync engine with queue management
- **Admin Tools**: Sync configuration and monitoring

### Current Limitations
- **No Agents Data**: B2Chat API doesn't provide agents endpoint
- **Export-only API**: Must use export endpoints for data retrieval
- **Phase 5 Ready**: Need database setup and environment configuration

## 🔄 Next Steps Priority

### Immediate (Phase 5)
1. **Database Setup**: Configure PostgreSQL and run migrations
2. **Environment Variables**: Set up B2Chat API credentials
3. **API Client Updates**: Fix endpoints to use /export versions
4. **Remove Agents**: Clean up non-functional agents module

### Upcoming (Phase 6-7)
1. **Real Data Testing**: Validate sync with actual B2Chat data
2. **Comprehensive Testing**: Unit, integration, e2e tests
3. **Performance Optimization**: Database queries and caching
4. **Security Implementation**: Input validation and error handling

---

## 📝 Notes for Claude

- **Always check** this file before starting work on the project
- **Update this file** when you discover new patterns or solutions
- **Reference documentation files** linked at the top before making architectural decisions
- **Follow the tech stack standards** strictly - don't add unapproved dependencies
- **Remember**: No agents functionality, use B2Chat export endpoints only

**Last Updated**: 2025-09-23
**Current Phase**: Phase 5 - Database & Environment Setup
**Status**: Modal transparency issue resolved via shadcn init