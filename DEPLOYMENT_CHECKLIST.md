# Production Deployment Checklist

Use this checklist when deploying to production.

## Pre-Deployment

### 1. MongoDB Setup
- [ ] Created MongoDB Atlas account (or have hosted MongoDB ready)
- [ ] Created database cluster
- [ ] Created database user with password
- [ ] Added IP whitelist (server IP or 0.0.0.0/0 for testing)
- [ ] Copied connection string

### 2. Google OAuth Setup
- [ ] Created project in Google Cloud Console
- [ ] Enabled Google Drive API
- [ ] Created OAuth 2.0 Client ID
- [ ] Added authorized redirect URIs:
  - [ ] `https://yourdomain.com/api/auth/google/callback`
  - [ ] `https://yourdomain.com/settings`
- [ ] Copied Client ID and Client Secret

### 3. Server/VPS Ready
- [ ] Have server access (SSH)
- [ ] Node.js v16+ installed
- [ ] Domain pointing to server (optional but recommended)

## Deployment Steps

### 4. Upload Code to Server
- [ ] Cloned repository OR uploaded files to server
- [ ] Located in directory (e.g., `/opt/podcast-manager`)

### 5. Configuration
- [ ] Created `.env` file from `.env.example`
- [ ] Set `NODE_ENV=production`
- [ ] Set `MONGODB_URI` with Atlas connection string
- [ ] Set `CLIENT_URL` to your domain
- [ ] Set `GOOGLE_CLIENT_ID`
- [ ] Set `GOOGLE_CLIENT_SECRET`
- [ ] Generated and set `SESSION_SECRET` (64 chars)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Generated and set `ENCRYPTION_KEY` (64 chars)
- [ ] Updated OAuth callback URLs to production domain

### 6. Build & Start
- [ ] Ran `npm install --production`
- [ ] Ran `npm run build` (creates `dist/` folder)
- [ ] Verified `dist/` folder exists and contains files
- [ ] Started with PM2: `pm2 start npm --name "podcast-manager" -- start`
- [ ] Ran `pm2 save`
- [ ] Ran `pm2 startup` and followed instructions

### 7. Nginx Setup (Optional but Recommended)
- [ ] Installed Nginx
- [ ] Created Nginx config in `/etc/nginx/sites-available/podcast-manager`
- [ ] Enabled site: `ln -s /etc/nginx/sites-available/podcast-manager /etc/nginx/sites-enabled/`
- [ ] Tested config: `nginx -t`
- [ ] Restarted Nginx: `systemctl restart nginx`

### 8. SSL Setup (Recommended)
- [ ] Installed Certbot
- [ ] Ran `certbot --nginx -d yourdomain.com`
- [ ] Verified HTTPS works

### 9. Firewall
- [ ] Opened port 80 (HTTP)
- [ ] Opened port 443 (HTTPS)
- [ ] Opened port 22 (SSH)
- [ ] Enabled firewall

## Post-Deployment Verification

### 10. Health Checks
- [ ] App running in PM2: `pm2 status`
- [ ] Health endpoint works: `curl http://localhost:5000/api/health`
- [ ] Can access app in browser
- [ ] Can sign in with Google
- [ ] Can add a test podcast
- [ ] Can refresh feed and see episodes
- [ ] Google Drive integration works (if configured)

### 11. Monitoring
- [ ] Checked logs: `pm2 logs podcast-manager`
- [ ] Set up log rotation: `pm2 install pm2-logrotate`
- [ ] Verified PM2 starts on boot

### 12. Security Review
- [ ] `.env` file has secure secrets (not defaults)
- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] Using HTTPS (not HTTP)
- [ ] MongoDB not exposed to public internet
- [ ] Firewall properly configured
- [ ] Server OS updated: `apt update && apt upgrade`

## Backup Plan

### 13. Backup Strategy
- [ ] Documented how to backup MongoDB (Atlas auto-backup or manual export)
- [ ] Backed up `.env` file to secure location
- [ ] Documented how to restore from backup

## Documentation

### 14. Document Your Setup
- [ ] Noted server IP/domain
- [ ] Noted MongoDB connection details (securely)
- [ ] Noted Google OAuth project name
- [ ] Created runbook for common operations

## Common Commands Reference

```bash
# Check app status
pm2 status
pm2 logs podcast-manager

# Restart app
pm2 restart podcast-manager

# Stop app
pm2 stop podcast-manager

# View real-time monitoring
pm2 monit

# Update app
cd /opt/podcast-manager
git pull  # or upload new files
npm install --production
npm run build
pm2 restart podcast-manager

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx

# Check SSL certificate
sudo certbot certificates

# View logs
tail -f logs/combined.log
pm2 logs podcast-manager --lines 100
```

## Troubleshooting Checklist

If something doesn't work:

- [ ] Checked PM2 logs: `pm2 logs podcast-manager --err`
- [ ] Verified `.env` exists and has correct values
- [ ] Tested MongoDB connection separately
- [ ] Checked `dist/` folder exists (run `npm run build`)
- [ ] Verified `NODE_ENV=production`
- [ ] Checked firewall allows traffic
- [ ] Verified domain DNS points to server
- [ ] Checked SSL certificate is valid
- [ ] Reviewed application logs in `logs/` directory
- [ ] Checked disk space: `df -h`
- [ ] Checked memory: `free -h`

## Emergency Rollback

If you need to quickly rollback:

```bash
# Stop current version
pm2 stop podcast-manager

# Restore previous code
git checkout <previous-commit>
# or restore from backup

# Rebuild
npm install --production
npm run build

# Restart
pm2 restart podcast-manager
```

## Success Criteria

You're done when:

✅ App is accessible at your domain  
✅ HTTPS is working  
✅ Google login works  
✅ Can create podcasts and download episodes  
✅ PM2 shows app running and healthy  
✅ Logs are clean (no errors)  
✅ Google Drive upload works (if configured)  
✅ App survives server restart (PM2 auto-starts)  

---

**Estimated Time:** 30-90 minutes (depending on experience)

**Need Help?** Review `DEPLOYMENT.md` for detailed instructions.
