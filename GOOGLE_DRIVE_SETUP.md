# Google Drive Setup Guide

This guide will help you set up Google Drive integration for the Podcast Manager app using OAuth2 (works with **free Google accounts**!).

## Why OAuth2 Instead of Service Accounts?

- ✅ **Works with free Google accounts** (Service accounts don't support Drive uploads for free users)
- ✅ **Personal Drive access** - Uploads go to YOUR Drive
- ✅ **Easy user setup** - Just upload files and click authorize
- ✅ **Secure** - Credentials are encrypted in MongoDB

## Setup Steps

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Create Project"** or select an existing one
3. Note your project name for later

### Step 2: Enable Google Drive API

1. In your project, go to **"APIs & Services"** > **"Library"**
2. Search for **"Google Drive API"**
3. Click on it and click **"Enable"**

### Step 3: Create OAuth2 Credentials

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** > **"OAuth 2.0 Client ID"**

3. **If first time**: You'll need to configure OAuth consent screen:
   - Click **"Configure Consent Screen"**
   - Choose **"External"** (unless you have a Google Workspace)
   - Fill in app name: `Podcast Manager`
   - Add your email as developer contact
   - Click **"Save and Continue"**
   - Skip scopes (click **"Save and Continue"**)
   - Add yourself as a test user
   - Click **"Save and Continue"**

4. **Create OAuth Client**:
   - Application type: Choose **"Desktop app"** OR **"Web application"**
   - Name: `Podcast Manager Desktop` (or any name you like)
   
   **If you chose Web application**, add authorized redirect URI:
   ```
   http://localhost:3000/settings
   ```
   
   For production, use your deployed frontend URL:
   ```
   https://your-domain.com/settings
   ```
   
5. Click **"Create"**
6. **Download the JSON file** (keep this safe!)

### Step 4: Configure in the App

#### Option A: Use the Settings Page (Easiest! ✨)

1. Start your Podcast Manager app:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in your browser

3. Click **"Settings"** in the sidebar

4. Follow the 3-step wizard:

   **Step 1: Upload Credentials**
   - Click "Upload credentials.json"
   - Select the JSON file you downloaded from Google Cloud
   - Wait for "Uploaded" checkmark

   **Step 2: Authorize**
   - Click **"Authorize with Google"** button
   - A new tab will open with Google sign-in
   - Sign in with your Google account
   - Click **"Allow"** to grant permissions
   - You'll be redirected back automatically

   **Step 3: Set Folder**
   - Create a folder in your Google Drive (e.g., "Podcasts")
   - Open that folder and copy the ID from the URL:
     ```
     https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J  <-- This is the folder ID
     ```
   - Paste the folder ID in the input field
   - Click **"Save"**

5. Click **"Test Connection"** to verify everything works

6. Toggle **"Enable Drive Upload"** to activate

Done! 🎉 New episodes will now automatically upload to your Google Drive!

#### Option B: Upload Existing Token (Advanced)

If you already have a `token.json` file from a previous authorization:

1. Go to Settings
2. Upload your `credentials.json` first (Step 1)
3. In Step 2, use **Option B** and upload your `token.json` file
4. Continue with Step 3 (Set Folder)

## Troubleshooting

### "Invalid credentials file format"
- Make sure you downloaded the **OAuth 2.0 Client ID** credentials, not API key or service account
- The JSON should contain `client_id` and `client_secret` fields

### "Authorization failed"
- Make sure you added yourself as a test user in OAuth consent screen
- Try using "Desktop app" instead of "Web application" type
- Check that redirect URI matches exactly: `http://localhost:5000/api/drive/callback`

### "Connection failed: Invalid Credentials"
- Your token may have expired. Click **"Authorize with Google"** again
- Make sure the Google Drive API is enabled in your project

### "No folder ID configured"
- You need to set a folder ID in Step 3
- Make sure you copied the folder ID correctly from the Drive URL

### "Upload disabled"
- Make sure you toggled **"Enable Drive Upload"** in Settings
- Check that status shows "Active" (green badge)

## Security Notes

- **Encryption**: All credentials and tokens are encrypted in MongoDB using AES-256
- **Local Only**: The app runs locally on your machine
- **No Cloud Server**: Your credentials never leave your computer
- **Your Drive**: Files upload to YOUR personal Google Drive
- **Revoke Access**: You can revoke access anytime from [Google Account Settings](https://myaccount.google.com/permissions)

## File Organization

Podcasts are uploaded to your Drive folder with this structure:
```
Your Folder/
├── 2025-01-15-Episode_Title_1.mp3
├── 2025-01-16-Episode_Title_2.mp3
└── ...
```

Each episode includes:
- Date in filename (YYYY-MM-DD format)
- Sanitized episode title
- .mp3 extension

## Retention Policy

The app automatically manages storage:
- Keeps only N latest episodes per podcast (configurable, default: 10)
- Automatically deletes older episodes from Drive
- Saves you from running out of Drive space!

## Advanced: Manual API Usage

If you prefer using API endpoints directly:

```bash
# Upload credentials
curl -X POST http://localhost:5000/api/drive/credentials \
  -F "file=@/path/to/credentials.json"

# Get authorization URL
curl http://localhost:5000/api/drive/auth-url

# Set folder ID
curl -X POST http://localhost:5000/api/drive/folder \
  -H "Content-Type: application/json" \
  -d '{"folderId": "your-folder-id"}'

# Test connection
curl -X POST http://localhost:5000/api/drive/test

# Enable/disable
curl -X POST http://localhost:5000/api/drive/toggle
```

## Need Help?

Check the logs:
```bash
# View logs
cat logs/combined.log

# Watch logs in real-time
tail -f logs/combined.log
```

Look for messages mentioning "Google Drive" or "OAuth" for troubleshooting.

Happy podcasting! 🎙️📚
