# Tech Stack

## Context

Global tech stack defaults for Agent OS projects, overridable in project-specific `.agent-os/product/tech-stack.md`.

- App Framework: Next.js 15 with App Router
- Language: TypeScript 5.0+
- Runtime: Node.js 20 LTS
- Package Manager: npm 10+
- Primary Database: PostgreSQL 15+
- ORM: Prisma 6.16.2
- JavaScript Framework: React 18
- Build Tool: Next.js built-in (Turbopack in dev)
- Import Strategy: ES modules with TypeScript path aliases (@/)
- CSS Framework: Tailwind CSS 3.4.1
- UI Components: shadcn/ui with Radix UI primitives
- Animation Library: Framer Motion 12.23.22
- State Management: TanStack Query (React Query) v5.28.0
- Form Handling: React Hook Form 7.63.0 with Zod validation
- Font Provider: Next.js Font Optimization
- Icons: Lucide React 0.367.0
- Charts: Recharts 2.12.2
- Authentication: Clerk 6.32.2
- Error Tracking: Sentry 10.15.0
- Logging: Pino 9.13.0 with pino-pretty
- Application Hosting: Vercel
- Database Hosting: Managed PostgreSQL
- Database Backups: Automated via hosting provider
- Asset Storage: Vercel Blob Storage
- CI/CD Platform: Vercel (automatic deployments)
- CI/CD Trigger: Git push to repository
- Tests: Jest 29.7.0 (unit), Playwright 1.43.0 (E2E)
- Production Environment: main branch
- Development Environment: Local with .env.local
