#!/bin/bash

# Podcast Manager - Production Deployment Script
# This script helps deploy the app to a single server

set -e  # Exit on error

echo "🚀 Starting Podcast Manager deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create .env from .env.example and configure it"
    exit 1
fi

# Check NODE_ENV
if ! grep -q "NODE_ENV=production" .env; then
    echo -e "${YELLOW}⚠️  Warning: NODE_ENV is not set to 'production' in .env${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm install --production

# Build frontend
echo -e "${GREEN}🏗️  Building frontend...${NC}"
npm run build

# Check if dist directory was created
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build complete!${NC}"

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}🔄 Restarting with PM2...${NC}"
    
    # Check if app is already running
    if pm2 describe podcast-manager &> /dev/null; then
        pm2 restart podcast-manager
        echo -e "${GREEN}✅ App restarted!${NC}"
    else
        pm2 start npm --name "podcast-manager" -- start
        pm2 save
        echo -e "${GREEN}✅ App started with PM2!${NC}"
        echo -e "${YELLOW}💡 Run 'pm2 startup' to enable auto-start on boot${NC}"
    fi
    
    echo ""
    echo "📊 App status:"
    pm2 status podcast-manager
    
else
    echo -e "${YELLOW}⚠️  PM2 not found. Starting with Node directly...${NC}"
    echo -e "${YELLOW}💡 For production, install PM2: npm install -g pm2${NC}"
    echo ""
    echo "Starting server..."
    NODE_ENV=production node server/index.js
fi

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Check logs: pm2 logs podcast-manager"
echo "  2. Monitor: pm2 monit"
echo "  3. Access app at: http://your-server:5000"
echo "  4. Setup Nginx reverse proxy (see DEPLOYMENT.md)"
echo "  5. Setup SSL with Let's Encrypt (see DEPLOYMENT.md)"
