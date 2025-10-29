# B2Chat Analytics Platform

A comprehensive internal analytics solution for B2Chat customer service data, providing real-time insights, performance metrics, and automated synchronization with B2Chat API.

> **📚 Documentation:** All project documentation is now organized in the [/docs](./docs) directory. See the [Documentation Index](./docs/README.md) for a complete guide.

## 🚀 Features

### Core Functionality
- **Real-time Dashboard**: Live metrics and analytics for customer service performance
- **Automated Sync**: Scheduled synchronization with B2Chat API for contacts and chats
- **Agent Analytics**: Performance tracking and effectiveness analysis
- **Chat Analytics**: Conversation metrics, response times, and resolution tracking
- **Contact Management**: Centralized customer contact database with search and filtering
- **Export Capabilities**: Data export to various formats for reporting

### Technical Features
- **Authentication**: Secure access with Clerk authentication
- **Role-based Access**: Manager and Admin roles with different permissions
- **Queue Management**: Intelligent rate limiting for API requests
- **Error Recovery**: Automatic retry logic and error handling
- **Real-time Updates**: Live data refresh with React Query
- **Responsive Design**: Mobile-friendly interface with shadcn/ui components

## 📋 Prerequisites

- Node.js 20+ and npm 10+
- PostgreSQL 15+ installed and running locally
- B2Chat account with API access
- Clerk account for authentication
- Vercel account for deployment (optional)

## 🏠 Local Development Setup

### Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/your-org/b2chat-analytics.git
   cd b2chat-analytics
   npm install
   ```

2. **Create local database**
   ```bash
   npm run db:local:setup
   ```
   This creates the database, applies all migrations, and prepares it for local development.

3. **Configure environment**
   Create `.env.local` for local development:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your local PostgreSQL connection:
   ```env
   # Local PostgreSQL connection (adjust username if needed)
   DATABASE_URL="postgresql://your_username@localhost:5432/b2chat_analytics_dev"
   POSTGRES_URL_NON_POOLING="postgresql://your_username@localhost:5432/b2chat_analytics_dev"
   POSTGRES_PRISMA_URL="postgresql://your_username@localhost:5432/b2chat_analytics_dev"

   # Add your API keys (see .env.example for complete list)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   B2CHAT_USERNAME="your_username"
   B2CHAT_PASSWORD="your_password"
   CLAUDE_API_KEY="sk-ant-..."
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

5. **Sync real data from B2Chat**
   - Sign in to the application
   - Navigate to `/dashboard/sync`
   - Run a manual sync to populate your local database with real data

### Environment Configuration

The application uses Next.js environment variable loading:

- **`.env.local`** (highest priority, gitignored) - Local development overrides
- **`.env.development`** - Development defaults
- **`.env`** (lowest priority, committed) - Production defaults

Create `.env.local` for local development to automatically use your local PostgreSQL database instead of production Supabase.

### Database Management Scripts

| Command | Description |
|---------|-------------|
| `npm run db:local:setup` | First-time setup (create + migrate) |
| `npm run db:local:reset` | Reset database with fresh schema (see [Reset Guide](#resetting-local-development-database)) |
| `npm run db:local:fresh` | Drop and recreate from scratch (see [Reset Guide](#resetting-local-development-database)) |
| `npm run db:local:create` | Create local database only |
| `npm run db:local:drop` | Drop local database |
| `npm run db:status` | Check migration status |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

**⚠️ Important**: For a safe local database reset, see the [Resetting Local Development Database](#resetting-local-development-database) section below.

### Switching Between Local and Production

**To use local database:**
- Ensure `.env.local` exists with local connection strings
- Run `npm run dev`

**To use production Supabase:**
- Remove or rename `.env.local`
- Run `npm run dev`

The application automatically uses `.env.local` when present, falling back to `.env`.

### Troubleshooting Local Setup

**"createdb: command not found"**
- PostgreSQL is not in your PATH
- Solution: Add PostgreSQL bin directory to PATH or install PostgreSQL

**"Connection refused"**
- PostgreSQL is not running
- Solution:
  - macOS: `brew services start postgresql`
  - Linux: `sudo systemctl start postgresql`
  - Windows: Start PostgreSQL service

**"Database already exists"**
- Database was created previously
- Solution: Use `npm run db:local:reset` instead of setup

**"Migration failed"**
- Check `DATABASE_URL` in `.env.local` is correct
- Verify PostgreSQL is running
- Ensure database exists: `psql -l | grep b2chat_analytics_dev`

**Dashboard shows no data**
- Navigate to `/dashboard/sync` and run a manual sync
- This will populate your local database with real data from B2Chat API

### Resetting Local Development Database

If you need to completely reset your local database (clear all data and start fresh), follow these steps:

**⚠️ Important**: These commands will ONLY work on your local database if you follow the steps exactly. Skipping steps may accidentally reset production/staging databases.

#### Step-by-Step Reset Process

1. **Navigate to project root**
   ```bash
   cd /path/to/b2chat-analytics
   ```

2. **Temporarily rename .env file** (prevents Prisma from loading production URLs)
   ```bash
   mv .env .env.backup
   ```

3. **Reset the database**
   ```bash
   npx prisma migrate reset --force
   ```
   This will:
   - Drop all tables
   - Recreate tables from migrations
   - Clear all data

4. **Regenerate Prisma Client** (important!)
   ```bash
   npx prisma generate
   ```

5. **Restore .env file**
   ```bash
   mv .env.backup .env
   ```

6. **Verify the reset worked**
   ```bash
   npx dotenv -e .env.local -- tsx scripts/check-raw-data.ts
   ```
   You should see all counts at 0.

#### Alternative: Using dotenv-cli (More Complex)

If you prefer not to rename `.env`, you can use `dotenv-cli`, but note that Prisma has its own environment loading that can override it:

```bash
# Install dotenv-cli if not already installed
npm install -D dotenv-cli

# Run reset with explicit env file
npx dotenv -e .env.local -- npx prisma db push --force-reset

# Regenerate Prisma Client
npx dotenv -e .env.local -- npx prisma generate
```

#### Quick Reset Scripts

For convenience, you can also use:

```bash
# Drop and recreate everything
npm run db:local:fresh

# Reset migrations
npm run db:local:reset
```

**Note**: These npm scripts may not work correctly with `.env.local` due to environment loading precedence. Use the manual steps above for guaranteed local-only reset.

#### Verifying Which Database You're Connected To

Before running any reset, always verify you're pointing to localhost:

```bash
# Check Prisma connection
npx prisma db execute --stdin <<< "SELECT current_database();"

# Expected output should show: b2chat_analytics_dev (not "postgres")
```

Or use the check script:
```bash
npx dotenv -e .env.local -- tsx scripts/check-raw-data.ts
```

Look for:
- ✅ `Database: b2chat_analytics_dev`
- ✅ `Host: localhost`
- ❌ NOT `Host: aws-1-us-east-1.pooler.supabase.com`

## 🛠️ Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.0+
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **UI Components**: shadcn/ui with Radix UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Charts**: Recharts
- **Deployment**: Vercel

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-org/b2chat-analytics.git
cd b2chat-analytics
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Setup
Copy the example environment file and configure:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/b2chat_analytics"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# B2Chat API
B2CHAT_API_URL="https://api.b2chat.io"
B2CHAT_USERNAME="your_username"
B2CHAT_PASSWORD="your_password"
```

### 4. Database Setup
Run Prisma migrations:
```bash
npm run db:push
# OR for production
npm run db:migrate
```

### 5. Development Server
Start the development server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Deploy**:
```bash
./scripts/deploy-vercel.sh
# OR manually
vercel --prod
```

3. **Configure Environment Variables** in Vercel Dashboard or CLI:
```bash
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add B2CHAT_USERNAME
vercel env add B2CHAT_PASSWORD
```

4. **Run Database Migrations**:
```bash
vercel env pull .env.local
npx prisma db push
```

### Docker Deployment (Alternative)

```bash
docker build -t b2chat-analytics .
docker run -p 3000:3000 --env-file .env b2chat-analytics
```

## 📖 Usage

### Initial Setup

1. **Sign In**: Use Clerk authentication to sign in
2. **Configure Sync**: Navigate to Sync page (`/dashboard/sync`)
3. **Set Sync Parameters**: Configure sync frequency and batch size
4. **Run Initial Sync**: Trigger manual sync for contacts and chats
5. **View Analytics**: Explore dashboard for insights

### Key Pages

- **Dashboard** (`/dashboard`): Overview of key metrics and trends
- **Analytics** (`/dashboard/analytics`): Detailed performance analysis
- **Chats** (`/dashboard/chats`): Chat history and conversation details
- **Agents** (`/dashboard/agents`): Agent performance metrics
- **Sync** (`/dashboard/sync`): Sync configuration and logs

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Load testing
npm run test:load
```

### Test B2Chat Integration
```bash
# Test API connection
npx tsx scripts/test-b2chat-api.ts

# Test endpoints
npx tsx scripts/test-b2chat-endpoints.ts

# Test sync functionality
npx tsx scripts/test-sync-functionality.ts
```

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Create and run migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database with test data |
| `npm run db:reset` | Reset database |
| `npm run clean-seed-data` | Remove all seed data |
| `npm run diagnose:agents` | Diagnose agent/department population issues |
| `npm run test:agent-extraction` | Test agent extraction from API data |

## 🔧 Configuration

### Sync Configuration
Configure sync settings in the Sync page or via environment variables:
- `ENABLE_SCHEDULED_SYNC`: Enable/disable automatic sync
- `DEFAULT_PAGINATION_LIMIT`: Records per page (default: 50)
- `MAX_EXPORT_ROWS`: Maximum export rows (default: 10000)

### Feature Flags
Toggle features via environment variables:
- `ENABLE_AI_ANALYSIS`: AI-powered chat analysis
- `ENABLE_NOTIFICATIONS`: Email notifications
- `ENABLE_ATTACHMENTS_BACKUP`: Media file backup

## 📊 Database Schema

The application uses 15 main models:
- **User**: System users (synced from Clerk)
- **Contact**: Customer contacts from B2Chat
- **Chat**: Conversation records
- **Message**: Individual messages within chats
- **Agent**: Customer service agents
- **Department**: Organizational hierarchy
- **SyncLog**: Sync operation history
- **SyncState**: Current sync status
- And more...

See `prisma/schema.prisma` for complete schema.

## 🔒 Security & Authentication

### Authentication Architecture

**⚠️ IMPORTANT: Clerk Metadata is Source of Truth**

User roles are managed in Clerk's `publicMetadata.role` field. The database `users.role` is only a synchronized copy for audit trails.

**✅ ALWAYS use this pattern in API routes:**
```typescript
import { getCurrentUser } from "@/lib/auth"

export async function PUT(request: Request) {
  const user = await getCurrentUser()  // ✅ Reads from Clerk metadata

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "Admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  // ... rest of handler
}
```

**❌ NEVER query database for roles:**
```typescript
// ❌ WRONG - Don't do this
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { role: true }
})
```

**Why?**
- Clerk metadata is the single source of truth
- Database role may be out of sync
- Role changes in Clerk should take effect immediately
- Avoids unnecessary database queries

### Managing User Roles

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to Users → Select user
3. Edit Public Metadata:
   ```json
   {
     "role": "Admin"
   }
   ```
4. Save - role takes effect immediately

See [docs/operations/AUTHENTICATION.md](./docs/operations/AUTHENTICATION.md) for complete guide.

### Security Features

- **Authentication**: Handled by Clerk with JWT tokens
- **Authorization**: Role-based access control (Manager/Admin) via Clerk metadata
- **API Security**: OAuth 2.0 for B2Chat API
- **Data Protection**: Environment variables for sensitive data
- **Input Validation**: Zod schemas for all API inputs
- **Rate Limiting**: Per-endpoint rate limits with in-memory tracking
- **Security Headers**: CSP, X-Frame-Options, HSTS automatically applied

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` format
   - Ensure PostgreSQL is running
   - Verify network access

2. **B2Chat API Errors**
   - Verify credentials in `.env`
   - Check API rate limits
   - Ensure correct endpoint URLs

3. **Build Failures**
   - Run `npm install` to update dependencies
   - Check for TypeScript errors: `npx tsc --noEmit`
   - Clear cache: `rm -rf .next`

4. **Sync Not Working**
   - Check sync configuration in dashboard
   - Verify B2Chat credentials
   - Review sync logs for errors

## 📚 Documentation

**All documentation is organized in the [/docs](./docs) directory:**

### Quick Links
- **[Documentation Index](./docs/README.md)** - Complete documentation guide
- **[Development Guide](./docs/development/CLAUDE.md)** - For developers
- **[Data Model Guide](./docs/development/DATA_MODEL_GUIDE.md)** - Database and API
- **[Deployment Guide](./docs/operations/DEPLOYMENT_CHECKLIST.md)** - Production deployment
- **[User Management](./docs/operations/USER_MANAGEMENT.md)** - User administration
- **[Scripts Documentation](./scripts/README.md)** - Utility scripts
- **[Troubleshooting](./docs/troubleshooting)** - Common issues and fixes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This is an internal proprietary application. All rights reserved.

## 💬 Support

For issues and questions:
- Check documentation in `/docs` folder
- Review `CLAUDE.md` for development guidance
- Contact the development team

---

**Built with ❤️ for B2Chat customer service teams**