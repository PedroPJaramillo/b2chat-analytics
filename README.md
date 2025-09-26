# B2Chat Analytics Platform

A comprehensive internal analytics solution for B2Chat customer service data, providing real-time insights, performance metrics, and automated synchronization with B2Chat API.

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
- PostgreSQL 15+
- B2Chat account with API access
- Clerk account for authentication
- Vercel account for deployment (optional)

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

## 🔒 Security

- **Authentication**: Handled by Clerk with JWT tokens
- **Authorization**: Role-based access control (Manager/Admin)
- **API Security**: OAuth 2.0 for B2Chat API
- **Data Protection**: Environment variables for sensitive data
- **Input Validation**: Zod schemas for all API inputs

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

- **Development Guide**: See `CLAUDE.md` for development instructions
- **Deployment Guide**: See `DEPLOYMENT_CHECKLIST.md` for deployment steps
- **API Documentation**: See `/b2chat_dev_docs.md` for B2Chat API details
- **Scripts Documentation**: See `scripts/setup-production.md`

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