# B2Chat Analytics - Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code Preparation
- [ ] All features tested locally
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No linting errors: `npm run lint`
- [ ] Seed data removed: `npm run clean-seed-data`

### ✅ Environment Setup
- [ ] Vercel account created
- [ ] Vercel CLI installed: `npm i -g vercel`
- [ ] Logged into Vercel: `vercel login`

### ✅ Database Setup
- [ ] Production PostgreSQL database provisioned
- [ ] Database connection string obtained
- [ ] Database accessible from Vercel

### ✅ Authentication Setup
- [ ] Clerk account created
- [ ] Clerk app configured for production domain
- [ ] Clerk API keys obtained (production)

### ✅ B2Chat Integration
- [ ] B2Chat admin credentials obtained
- [ ] B2Chat API access verified
- [ ] API rate limits understood

## Environment Variables

### Required Variables ✅
```bash
DATABASE_URL                        # PostgreSQL connection string
POSTGRES_PRISMA_URL                 # For connection pooling
POSTGRES_URL_NON_POOLING           # Direct connection
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   # Clerk public key
CLERK_SECRET_KEY                    # Clerk secret key
B2CHAT_USERNAME                     # B2Chat admin username
B2CHAT_PASSWORD                     # B2Chat admin password
B2CHAT_API_URL                      # https://api.b2chat.io
NODE_ENV                            # production
```

### Optional Variables 🔧
```bash
CLAUDE_API_KEY                      # For AI conversation analysis
RESEND_API_KEY                      # For email notifications
EMAIL_FROM                          # From email address
BLOB_READ_WRITE_TOKEN              # For file uploads
SYSTEM_TIMEZONE                     # America/Bogota
DISPLAY_TIMEZONE                    # America/Bogota
ENABLE_SCHEDULED_SYNC              # true
ENABLE_AI_ANALYSIS                 # true
```

## Deployment Steps

### 1. Initial Deployment
```bash
# Clone/navigate to project
cd b2chat-analytics

# Install dependencies
npm install

# Build locally to verify
npm run build

# Deploy to Vercel
./scripts/deploy-vercel.sh
# OR manually:
vercel
```

### 2. Environment Variables Setup
```bash
# Add required variables one by one
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add B2CHAT_USERNAME
vercel env add B2CHAT_PASSWORD

# Or use Vercel dashboard
```

### 3. Database Migration
```bash
# Pull environment variables locally
vercel env pull .env.local

# Apply database schema
npx prisma db push

# OR create migration
npx prisma migrate deploy
```

### 4. Production Deployment
```bash
# Deploy to production
vercel --prod
```

## Post-Deployment Verification

### ✅ Application Health
- [ ] Site loads successfully
- [ ] Authentication works (Clerk sign-in)
- [ ] Dashboard displays without errors
- [ ] No console errors in browser

### ✅ Database Connection
- [ ] Database connection successful
- [ ] Prisma client working
- [ ] Tables created properly
- [ ] No seed data present

### ✅ B2Chat Integration
- [ ] B2Chat API connection works
- [ ] Sync page accessible at `/dashboard/sync`
- [ ] Can trigger manual sync
- [ ] Sync logs show success

### ✅ Core Functionality
- [ ] Dashboard shows empty state (no data)
- [ ] Can run contacts sync
- [ ] Can run chats sync
- [ ] Agents extracted from chat data
- [ ] Metrics calculate correctly

## Performance & Security

### ✅ Performance
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals pass
- [ ] Database queries optimized
- [ ] Images optimized

### ✅ Security
- [ ] HTTPS enforced
- [ ] Environment variables secure
- [ ] No sensitive data in logs
- [ ] API rate limiting in place
- [ ] Input validation working

## Monitoring Setup

### ✅ Vercel Analytics
- [ ] Vercel Analytics enabled
- [ ] Performance monitoring active
- [ ] Error tracking configured

### ✅ Application Monitoring
- [ ] Sync operation monitoring
- [ ] Database performance monitoring
- [ ] B2Chat API rate limit monitoring
- [ ] User authentication monitoring

## Domain Configuration (Optional)

### ✅ Custom Domain
- [ ] Domain purchased/configured
- [ ] DNS records updated
- [ ] SSL certificate active
- [ ] Clerk updated with production domain

## Backup & Recovery

### ✅ Data Backup
- [ ] Database backup strategy
- [ ] Regular backup schedule
- [ ] Backup restoration tested

### ✅ Disaster Recovery
- [ ] Deployment rollback plan
- [ ] Database recovery plan
- [ ] Environment variables backup

## Maintenance

### ✅ Regular Tasks
- [ ] Dependency updates scheduled
- [ ] Security updates planned
- [ ] Performance monitoring active
- [ ] Log rotation configured

## Troubleshooting

### Common Issues
1. **Build Failures**: Check TypeScript errors, missing dependencies
2. **Database Errors**: Verify connection string, Prisma schema
3. **Authentication Issues**: Check Clerk configuration, domain settings
4. **Sync Failures**: Verify B2Chat credentials, API rate limits
5. **Performance Issues**: Check database queries, optimize images

### Support Resources
- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Clerk Documentation: [clerk.com/docs](https://clerk.com/docs)
- B2Chat API Documentation: `b2chat_dev_docs.md`
- Project Documentation: `README.md`, `CLAUDE.md`

---

## Quick Deployment Commands

```bash
# Full deployment process
npm run build
vercel login
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add B2CHAT_USERNAME
vercel env add B2CHAT_PASSWORD
vercel --prod

# Post-deployment setup
vercel env pull .env.local
npx prisma db push
```

## Success Criteria ✅

Your deployment is successful when:
- [ ] Application loads without errors
- [ ] Users can sign in with Clerk
- [ ] Dashboard shows "No Data - Run B2Chat Sync"
- [ ] Sync operations work and populate data
- [ ] Real metrics display after sync
- [ ] No more mock/seed data visible

---

**Need Help?** Check `scripts/setup-production.md` for detailed instructions.