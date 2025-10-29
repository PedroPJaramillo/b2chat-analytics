# Technical Stack

## Application Framework
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.0+
- **Runtime**: Node.js 20+ with npm 10+

## Database
- **Primary Database**: PostgreSQL 15+
- **ORM**: Prisma 6.16.2
- **Migration Strategy**: Prisma Migrate
- **Connection Pooling**: Prisma connection pooling

## Frontend Stack
- **React Version**: React 18
- **State Management**: TanStack Query (React Query) v5.28.0
- **CSS Framework**: Tailwind CSS 3.4.1
- **UI Component Library**: shadcn/ui with Radix UI primitives
- **Animation**: Framer Motion 12.23.22
- **Charts**: Recharts 2.12.2
- **Table Components**: TanStack Table v8.15.0
- **Form Handling**: React Hook Form 7.63.0 with Zod validation
- **Date Utilities**: date-fns 3.6.0
- **Icons**: Lucide React 0.367.0

## Authentication & Authorization
- **Provider**: Clerk 6.32.2
- **Authentication Method**: JWT tokens with automatic refresh
- **Role Management**: Clerk publicMetadata (Manager/Admin roles)
- **Session Management**: Server-side session validation

## API Integration
- **B2Chat API**: Custom REST client with OAuth 2.0
- **Claude API**: AI conversation analysis integration
- **Rate Limiting**: Custom queue implementation for B2Chat (5 req/sec, 10,000/day)
- **Error Handling**: Retry logic with exponential backoff

## Monitoring & Error Tracking
- **Error Tracking**: Sentry 10.15.0 (Next.js integration)
- **Logging**: Pino 9.13.0 with pino-pretty 13.1.1
- **Sentry Integration**: pino-sentry 0.15.0

## File Storage
- **Asset Storage**: Vercel Blob 0.22.0
- **Use Cases**: PDF report generation and storage

## Database Schema
- **Total Models**: 15 main models
- **Key Entities**:
  - User (synced from Clerk)
  - Contact, Chat, Message, Agent, Department
  - SyncLog, SyncState, SyncCheckpoint
  - EffectivenessAnalysis, ChatAnalysis
  - SystemSettings, Export, Report

## Hosting & Deployment
- **Application Hosting**: Vercel
- **Database Hosting**: Managed PostgreSQL (production)
- **Asset Hosting**: Vercel Blob Storage
- **Deployment Solution**: Vercel CLI with automated builds
- **Environment Management**: Vercel environment variables

## Development Tools
- **Package Manager**: npm 10+
- **TypeScript Config**: Strict mode with path aliases (@/)
- **Linting**: ESLint 8 with Next.js config
- **Code Repository**: Git (local, not yet pushed to remote)

## Testing Infrastructure
- **Unit Testing**: Jest 29.7.0 with jsdom environment
- **React Testing**: Testing Library (React 15.0.2, Jest DOM 6.4.2)
- **E2E Testing**: Playwright 1.43.0
- **Load Testing**: k6 for performance testing
- **Test Runner**: tsx 4.7.2 for TypeScript execution

## Build & Development
- **Build Tool**: Next.js built-in (Turbopack in dev)
- **Type Checking**: TypeScript compiler with incremental builds
- **PostCSS**: PostCSS 8 for CSS processing
- **CSS Utilities**: clsx 2.1.1, tailwind-merge 3.3.1, class-variance-authority 0.7.1

## Styling System
- **Base Framework**: Tailwind CSS 3.4.1
- **Animation Plugin**: tailwindcss-animate 1.0.7
- **Component Variants**: class-variance-authority for component APIs
- **Color System**: CSS variables for theming (light/dark mode support)

## Data Validation
- **Schema Validation**: Zod 3.25.76
- **Form Validation**: React Hook Form + Zod resolver
- **API Validation**: Zod schemas for all API inputs/outputs

## Utilities
- **UUID Generation**: uuid 13.0.0
- **Type Utilities**: TypeScript utility types + custom types
