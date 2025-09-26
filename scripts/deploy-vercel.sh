#!/bin/bash

# B2Chat Analytics - Vercel Deployment Script
# This script helps deploy the application to Vercel

set -e

echo "🚀 B2Chat Analytics - Vercel Deployment"
echo "======================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please log in to Vercel..."
    vercel login
fi

# Build the project locally to check for errors
echo "🔨 Building project locally..."
npm run build

# Ask user about environment variables
echo ""
echo "📋 Environment Variables Setup"
echo "Have you set up all required environment variables in Vercel? (y/n)"
read -r env_setup

if [ "$env_setup" != "y" ]; then
    echo ""
    echo "⚠️  Please set up the following environment variables in Vercel:"
    echo ""
    echo "Required:"
    echo "  - DATABASE_URL"
    echo "  - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    echo "  - CLERK_SECRET_KEY"
    echo "  - B2CHAT_USERNAME"
    echo "  - B2CHAT_PASSWORD"
    echo ""
    echo "Optional:"
    echo "  - CLAUDE_API_KEY"
    echo "  - RESEND_API_KEY"
    echo "  - BLOB_READ_WRITE_TOKEN"
    echo ""
    echo "You can set them using:"
    echo "  vercel env add VARIABLE_NAME"
    echo ""
    echo "Or through the Vercel dashboard."
    echo ""
    read -p "Press Enter to continue once environment variables are set..."
fi

# Deploy to preview
echo ""
echo "🌐 Deploying to preview environment..."
vercel

# Ask if user wants to deploy to production
echo ""
echo "✅ Preview deployment successful!"
echo "Deploy to production? (y/n)"
read -r prod_deploy

if [ "$prod_deploy" = "y" ]; then
    echo "🌟 Deploying to production..."
    vercel --prod

    echo ""
    echo "🎉 Production deployment complete!"
    echo ""
    echo "Next steps:"
    echo "1. Visit your production URL"
    echo "2. Sign in with Clerk"
    echo "3. Go to /dashboard/sync to run initial B2Chat sync"
    echo "4. Verify all data is syncing correctly"
    echo ""
    echo "Need help? Check scripts/setup-production.md"
else
    echo ""
    echo "✨ Preview deployment complete!"
    echo "Visit the preview URL to test your application."
    echo "Run 'vercel --prod' when ready to deploy to production."
fi

echo ""
echo "🔧 Useful commands:"
echo "  vercel logs          - View deployment logs"
echo "  vercel env ls        - List environment variables"
echo "  vercel domains       - Manage custom domains"
echo "  vercel --help        - More Vercel commands"