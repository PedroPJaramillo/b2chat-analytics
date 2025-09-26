# Claude Development Guide - B2Chat Analytics

This file provides specific instructions for Claude when working on the B2Chat Analytics project.

## 📚 Primary Documentation References

**ALWAYS reference these files before making changes:**
- `README.md` - Project overview, setup, and deployment instructions
- `/tech_stack_standards.md` - Complete tech stack requirements and approved dependencies
- `/B2Chat/b2chat_dev_docs.md` - B2Chat API documentation and endpoints
- `/B2Chat/best_practices_standards.md` - Development philosophy and React best practices
- `/B2Chat/code_style_standards.md` - Formatting and naming conventions
- `DEPLOYMENT_CHECKLIST.md` - Deployment steps and production configuration

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
✅ /agents          # Extracted from chat data (no direct API endpoint)
❌ /contacts        # Use /contacts/export instead
❌ /chats           # Use /chats/export instead
```

### Critical Notes
- **Agents Data**: Extracted from chat responses (agent field) - no direct API endpoint
- **Export Endpoints**: Use `/contacts/export` and `/chats/export`, not direct `/contacts` or `/chats`
- **Authentication**: OAuth endpoint working correctly at `/oauth/token`

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
- ✅ **Phase 1-5**: Complete foundation, sync engine, dashboard UI, database setup
- ✅ **Authentication**: Clerk integration fully working
- ✅ **Database**: 15 models with complete schema and migrations
- ✅ **API Client**: Updated with correct export endpoints
- ✅ **Agents**: Implemented via extraction from chat data
- ✅ **Dashboard**: Full analytics with charts, metrics, and real-time data
- ✅ **Sync Engine**: Complete with queue management and error handling
- 🎯 **Current Phase**: Ready for production deployment

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
- ✅ **Updated**: Using correct export endpoints
- **File**: `src/lib/b2chat/client.ts`
- **Authentication**: OAuth working correctly
- **Agents**: Extracted from chat data responses

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
1. **Check API implementation** in `src/lib/b2chat/client.ts`
2. **Use proper B2Chat endpoints** (/contacts/export, not /contacts)
3. **Agents data** is extracted from chat responses
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
- **Agents API**: No direct endpoint - extracted from chat data
- **Export-only API**: Must use export endpoints for data retrieval
- **Production Ready**: Requires environment variables and deployment

## 🔄 Next Steps Priority

### Immediate (Production Deployment)
1. **Environment Setup**: Configure all production environment variables
2. **Deploy to Vercel**: Use deployment checklist and scripts
3. **Database Migration**: Apply schema to production database
4. **Verify Integration**: Test with real B2Chat data

### Post-Deployment
1. **Monitor Performance**: Check sync operations and API usage
2. **User Training**: Document user workflows and features
3. **Optimize Queries**: Based on real usage patterns
4. **Add Features**: Based on user feedback

---

## 📝 Notes for Claude

- **Always check** this file before starting work on the project
- **Update this file** when you discover new patterns or solutions
- **Reference documentation files** linked at the top before making architectural decisions
- **Follow the tech stack standards** strictly - don't add unapproved dependencies
- **Remember**: Agents extracted from chat data, use B2Chat export endpoints
- **Project Status**: Production-ready, pending deployment

**Last Updated**: 2025-09-25
**Current Phase**: Production Deployment Ready
**Recent Updates**: Complete dashboard, sync engine, and all core features implemented