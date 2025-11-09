# Deployment Changes Summary

## What Changed?

Your app is now ready for **single-server production deployment** where the backend and frontend run together on one server.

## Key Changes Made

### 1. **server/index.js** - Added Static File Serving
- In production mode (`NODE_ENV=production`), Express now serves the built React app
- All non-API routes are handled by the React app
- Frontend and backend run on the same port (no CORS issues!)

### 2. **.env.example** - Updated with Production Notes
- Added MongoDB Atlas connection string examples
- Added notes about production configuration
- Clarified `CLIENT_URL` should match your domain in production

### 3. **README.md** - Updated Production Instructions
- Added clear production build steps
- Referenced the comprehensive deployment guide

### 4. **New Files Created**

#### `DEPLOYMENT.md` (Comprehensive Guide)
Complete step-by-step guide covering:
- MongoDB Atlas setup
- Server preparation
- Environment configuration
- PM2 process management
- Nginx reverse proxy setup
- SSL with Let's Encrypt
- Security checklist
- Troubleshooting
- Backup strategies
- Cost estimation (~$5-10/month)

#### `deploy.sh` (Deployment Script)
Quick deployment script that:
- Checks for .env file
- Installs dependencies
- Builds frontend
- Starts/restarts with PM2
- Shows deployment status

## Quick Start for Production

### Option 1: Manual Steps

```bash
# 1. Build frontend
npm run build

# 2. Update .env
# - Set NODE_ENV=production
# - Set MONGODB_URI to your hosted MongoDB
# - Set CLIENT_URL to your domain

# 3. Start server
npm start

# Or with PM2 (recommended):
pm2 start npm --name "podcast-manager" -- start
```

### Option 2: Use Deployment Script

```bash
chmod +x deploy.sh
./deploy.sh
```

## Architecture Overview

**Before (Development):**
```
Frontend (Vite Dev Server) :3000  ──┐
                                    ├──> API proxy ──> Backend :5000
Backend (Express) :5000  ───────────┘
```

**After (Production):**
```
Single Server :5000
├── Express Backend (API routes /api/*)
└── Static Files (React build from /dist)
```

## Environment Variables for Production

**Required changes in `.env`:**

```env
# Change these for production:
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/podcast-manager
CLIENT_URL=https://yourdomain.com

# Update OAuth callbacks:
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
GOOGLE_DRIVE_CALLBACK_URL=https://yourdomain.com/settings
```

## What You Need

### Minimal Requirements
1. **VPS/Server** - Ubuntu, Debian, or similar
2. **MongoDB Atlas** - Free tier works (https://mongodb.com/cloud/atlas)
3. **Domain** (optional but recommended)
4. **SSL Certificate** (free with Let's Encrypt)

### Recommended Services
- **Server:** DigitalOcean, Linode, Vultr (~$5-10/month)
- **Database:** MongoDB Atlas Free Tier (512MB)
- **Domain:** Namecheap, Cloudflare (~$10/year)

## Common Deployment Platforms

### Traditional VPS (Best Control)
- DigitalOcean, Linode, AWS EC2, Google Cloud
- Use `DEPLOYMENT.md` guide
- Install Node.js, PM2, Nginx

### Platform as a Service (Easiest)
- **Render.com** - Free tier, auto-deploy from Git
- **Railway.app** - Simple setup, good free tier
- **Fly.io** - Edge deployment
- **Heroku** - Classic option (paid now)

### Docker (Portable)
See Dockerfile example in `DEPLOYMENT.md`

## Testing Production Build Locally

```bash
# Build frontend
npm run build

# Set production mode
$env:NODE_ENV="production"  # PowerShell
# or
export NODE_ENV=production  # Bash

# Start server
npm start

# Visit http://localhost:5000
```

## Verification Checklist

After deployment, verify:

- [ ] App loads at your domain
- [ ] Can sign in with Google
- [ ] Can add podcasts
- [ ] Episodes download successfully
- [ ] Google Drive integration works
- [ ] Logs are being written
- [ ] PM2 shows app running
- [ ] Health check works: `curl https://yourdomain.com/api/health`

## Troubleshooting Quick Reference

**App won't start:**
```bash
pm2 logs podcast-manager --err
# Check .env file exists
# Verify MongoDB connection string
```

**Frontend shows blank page:**
```bash
# Ensure build completed
ls -la dist/

# Rebuild
npm run build

# Check NODE_ENV is 'production'
```

**Can't connect to MongoDB:**
```bash
# Test connection
node -e "require('mongoose').connect('YOUR_URI').then(() => console.log('OK')).catch(e => console.error(e.message))"
```

**CORS errors:**
- Ensure `CLIENT_URL` in `.env` matches your domain
- In production, frontend and backend should be on same domain (no CORS needed)

## Security Notes

⚠️ **IMPORTANT:**
1. Generate secure secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Never commit `.env` to Git
3. Use HTTPS in production (required for Google OAuth)
4. Keep dependencies updated: `npm audit fix`
5. Don't expose MongoDB to the internet

## Next Steps

1. **Read `DEPLOYMENT.md`** for full deployment guide
2. **Setup MongoDB Atlas** account
3. **Get a VPS** (DigitalOcean, Linode, etc.)
4. **Configure domain** to point to server
5. **Run deployment script** on server
6. **Setup Nginx + SSL** for HTTPS

## Support

If you run into issues:
1. Check `pm2 logs podcast-manager`
2. Review `DEPLOYMENT.md` troubleshooting section
3. Verify `.env` configuration
4. Test MongoDB connection separately

## Estimated Time to Deploy

- **With VPS:** 30-60 minutes
- **With PaaS (Render/Railway):** 10-20 minutes
- **First time with Nginx + SSL:** 45-90 minutes

---

**Files to review:**
- `DEPLOYMENT.md` - Complete deployment guide
- `deploy.sh` - Quick deployment script
- `.env.example` - Example configuration
- `README.md` - Updated with production info
