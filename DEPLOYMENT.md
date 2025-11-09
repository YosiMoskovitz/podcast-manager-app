# Production Deployment Guide

This guide explains how to deploy the Podcast Manager app to a single server with the backend and frontend together, using a hosted MongoDB service.

## Architecture Overview

**Single-Server Deployment:**
- Frontend (React) → Built as static files, served by Express
- Backend (Node.js/Express) → Runs on single port (e.g., 5000)
- Database (MongoDB) → Hosted externally (MongoDB Atlas or other)

```
┌─────────────────────────────────┐
│   Single Server (e.g., VPS)     │
│                                 │
│  ┌───────────────────────────┐  │
│  │   Node.js Process         │  │
│  │   (Port 5000)             │  │
│  │                           │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  Express Server     │  │  │
│  │  │  - API Routes       │  │  │
│  │  │  - Static Files     │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
            │
            │ MongoDB Connection
            ▼
┌─────────────────────────────────┐
│   MongoDB Atlas / Hosted DB     │
└─────────────────────────────────┘
```

## Prerequisites

1. **Server Requirements:**
   - Linux server (Ubuntu, Debian, etc.) or Windows Server
   - Node.js v16+ installed
   - At least 512MB RAM (1GB+ recommended)
   - 2GB disk space minimum

2. **MongoDB Setup:**
   - MongoDB Atlas account (free tier works) OR
   - Self-hosted MongoDB with remote access
   - Connection string ready

3. **Domain (Optional but Recommended):**
   - Domain name pointing to your server
   - SSL certificate (Let's Encrypt recommended)

## Deployment Steps

### 1. Prepare MongoDB

**Option A: MongoDB Atlas (Recommended)**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist your server's IP address (or 0.0.0.0/0 for testing)
5. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/podcast-manager
   ```

**Option B: Self-Hosted MongoDB**

1. Ensure MongoDB is accessible from your deployment server
2. Configure authentication if not already done
3. Get connection string:
   ```
   mongodb://username:password@host:27017/podcast-manager
   ```

### 2. Prepare Your Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Create app directory
mkdir -p /opt/podcast-manager
cd /opt/podcast-manager
```

### 3. Deploy Application Files

**Option A: Git Clone**
```bash
git clone <your-repo-url> .
```

**Option B: Manual Upload**
```bash
# Upload your project files to /opt/podcast-manager
# Using scp, rsync, or FTP
```

### 4. Install Dependencies

```bash
npm install --production
```

### 5. Build Frontend

```bash
npm run build
```

This creates a `dist/` directory with production-ready static files.

### 6. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit with production values
nano .env
```

**Production `.env` example:**
```env
# MongoDB Atlas connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/podcast-manager

# Server Configuration
PORT=5000
NODE_ENV=production
CLIENT_URL=https://yourdomain.com

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
GOOGLE_DRIVE_CALLBACK_URL=https://yourdomain.com/settings

# Session & Encryption (IMPORTANT: Generate secure values!)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your-random-64-character-string-here
ENCRYPTION_KEY=your-random-64-character-hex-string-here

# Download Settings
MAX_CONCURRENT_DOWNLOADS=3
CHECK_INTERVAL_HOURS=6
MAX_EPISODES_PER_CHECK=5
KEEP_EPISODE_COUNT=10
```

**IMPORTANT Security Notes:**
- Generate unique `SESSION_SECRET` and `ENCRYPTION_KEY` values
- Never commit `.env` to version control
- Keep database credentials secure

### 7. Start Application with PM2

```bash
# Start the app
pm2 start npm --name "podcast-manager" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it provides (usually needs sudo)
```

**Useful PM2 commands:**
```bash
pm2 status              # Check app status
pm2 logs podcast-manager # View logs
pm2 restart podcast-manager # Restart app
pm2 stop podcast-manager    # Stop app
pm2 delete podcast-manager  # Remove from PM2
```

### 8. Setup Reverse Proxy (Recommended)

**Using Nginx:**

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/podcast-manager
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/podcast-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Setup SSL with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

### 10. Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow SSH (if not already)
sudo ufw allow 22

# Enable firewall
sudo ufw enable
```

## Verification

1. **Check app is running:**
   ```bash
   pm2 status
   curl http://localhost:5000/api/health
   ```

2. **Access the application:**
   - Visit `http://yourdomain.com` (or `http://your-server-ip:5000`)
   - You should see the login page

3. **Check logs:**
   ```bash
   pm2 logs podcast-manager
   # Or check log files
   tail -f logs/combined.log
   ```

## Updating the Application

```bash
# Navigate to app directory
cd /opt/podcast-manager

# Pull latest changes (if using git)
git pull

# Install dependencies
npm install --production

# Rebuild frontend
npm run build

# Restart app
pm2 restart podcast-manager
```

## Backup Strategy

### Database Backups (MongoDB Atlas)
- MongoDB Atlas provides automatic backups on paid tiers
- For free tier, manually export data periodically

### Application Data Backups
```bash
# Backup downloads directory (if using local storage)
tar -czf podcast-backups-$(date +%Y%m%d).tar.gz /opt/podcast-manager/downloads

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz /opt/podcast-manager/logs
```

### Environment Variables Backup
```bash
# Securely backup .env file
cp /opt/podcast-manager/.env /secure/backup/location/.env.backup
```

## Monitoring

### Basic Health Checks
```bash
# Check if app is running
pm2 status

# Monitor resource usage
pm2 monit

# Check logs
pm2 logs --lines 100
```

### Setup Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Troubleshooting

### App won't start
```bash
# Check logs
pm2 logs podcast-manager --err

# Common issues:
# 1. Missing .env file
# 2. Invalid MongoDB connection string
# 3. Port already in use
# 4. Missing dependencies
```

### Can't connect to MongoDB
```bash
# Test connection
node -e "require('mongoose').connect('your-connection-string').then(() => console.log('✓ Connected')).catch(e => console.error('✗ Failed:', e.message))"
```

### Frontend not loading
```bash
# Ensure build completed
ls -la dist/

# Rebuild if necessary
npm run build

# Check NODE_ENV
echo $NODE_ENV  # Should be 'production'
```

### Google OAuth not working
- Update redirect URIs in Google Cloud Console
- Use HTTPS in production (required for OAuth)
- Verify `GOOGLE_CALLBACK_URL` matches your domain

## Performance Optimization

### 1. Enable Compression
Add to `server/index.js`:
```javascript
import compression from 'compression';
app.use(compression());
```

Install:
```bash
npm install compression
```

### 2. Configure PM2 Cluster Mode
```bash
pm2 start npm --name "podcast-manager" -i max -- start
```

### 3. Database Indexing
Ensure proper indexes are created (usually automatic with Mongoose)

## Security Checklist

- ✅ Use HTTPS in production
- ✅ Set `NODE_ENV=production`
- ✅ Use strong `SESSION_SECRET` and `ENCRYPTION_KEY`
- ✅ Keep dependencies updated: `npm audit fix`
- ✅ Configure firewall properly
- ✅ Don't expose MongoDB to internet (use MongoDB Atlas or VPN)
- ✅ Regular backups
- ✅ Keep server OS updated

## Cost Estimation

**Minimal Setup:**
- MongoDB Atlas: Free (512MB storage)
- VPS (DigitalOcean, Linode, etc.): $5-10/month
- Domain: $10-15/year
- SSL: Free (Let's Encrypt)

**Total: ~$5-10/month**

## Alternative Deployment Options

### Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server/index.js"]
```

### Platform as a Service (PaaS)
- **Render.com**: Easy deployment, free tier available
- **Railway.app**: Simple setup with automatic deployments
- **Heroku**: Classic PaaS option
- **Fly.io**: Modern edge deployment

## Support

If you encounter issues:
1. Check logs: `pm2 logs podcast-manager`
2. Verify environment variables in `.env`
3. Test MongoDB connection separately
4. Check server resources: `htop` or `pm2 monit`

---

**Last Updated:** 2025-11-09
