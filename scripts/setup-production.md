# Production Deployment Setup Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **PostgreSQL Database**: Set up a production database (Vercel Postgres, Supabase, or Neon)
3. **Clerk Account**: Set up authentication at [clerk.com](https://clerk.com)
4. **B2Chat Credentials**: Admin username/password from B2Chat admin panel

## Step 1: Database Setup

### Option A: Vercel Postgres (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Create Postgres database
vercel postgres create b2chat-analytics-db
```

### Option B: External PostgreSQL
Use Supabase, Neon, or any PostgreSQL provider and get the connection string.

## Step 2: Environment Variables

Copy the following environment variables to your Vercel project:

### Required Variables:
```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database?pgbouncer=true&connect_timeout=15
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# B2Chat API
B2CHAT_API_URL=https://api.b2chat.io
B2CHAT_USERNAME=your_b2chat_username
B2CHAT_PASSWORD=your_b2chat_password

# System Configuration
SYSTEM_TIMEZONE=America/Bogota
DISPLAY_TIMEZONE=America/Bogota
NODE_ENV=production
```

### Optional Variables:
```bash
# Claude AI (for conversation analysis)
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-sonnet-20240229

# Email Service (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# File Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Feature Flags
ENABLE_SCHEDULED_SYNC=true
ENABLE_AI_ANALYSIS=true
ENABLE_NOTIFICATIONS=true
```

## Step 3: Deploy to Vercel

### Method 1: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add B2CHAT_USERNAME
vercel env add B2CHAT_PASSWORD
# ... add all other variables

# Deploy to production
vercel --prod
```

### Method 2: Git Integration
1. Push your code to GitHub/GitLab
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Step 4: Database Migration

After deployment, run database migrations:

```bash
# Using Vercel CLI
vercel env pull .env.local
npx prisma db push

# Or create a migration
npx prisma migrate deploy
```

## Step 5: Initial Setup

1. **Access the deployment**: Visit your Vercel URL
2. **Sign in with Clerk**: Create your admin account
3. **Configure B2Chat sync**: Go to `/dashboard/sync`
4. **Run initial sync**: Sync contacts and chats
5. **Verify data**: Check dashboard metrics

## Step 6: Domain Setup (Optional)

1. **Add custom domain** in Vercel dashboard
2. **Configure DNS** with your domain provider
3. **Update Clerk settings** with production domain

## Troubleshooting

### Build Issues
- Check environment variables are set correctly
- Verify Node.js version (20+ required)
- Review build logs in Vercel dashboard

### Database Issues
- Ensure database URL is correct
- Check database connection from Vercel function
- Verify Prisma schema is up to date

### Authentication Issues
- Update Clerk configuration with production URL
- Check Clerk webhook settings
- Verify API keys are for production environment

### B2Chat Sync Issues
- Test B2Chat credentials manually
- Check API rate limits
- Review sync logs in dashboard

## Security Checklist

- [ ] All environment variables use production values
- [ ] Database has proper access controls
- [ ] Clerk is configured for production domain
- [ ] API keys are production-ready
- [ ] No development/test credentials in production
- [ ] HTTPS is enforced
- [ ] Regular backups are configured

## Monitoring

1. **Vercel Analytics**: Monitor performance
2. **Clerk Dashboard**: Track authentication
3. **Database Monitoring**: Check query performance
4. **Application Logs**: Monitor sync operations
5. **B2Chat API**: Monitor rate limits and errors

## Maintenance

- **Database Backups**: Set up regular backups
- **Dependency Updates**: Keep packages updated
- **Monitoring**: Set up alerts for failures
- **Performance**: Monitor response times
- **Security**: Regular security audits