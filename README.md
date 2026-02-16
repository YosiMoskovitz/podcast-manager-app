# Podcast Manager App

A full-stack web application for managing podcast RSS feeds with automated downloads and cloud storage integration. Built with React, Node.js, Express, and MongoDB.

## Features

### 🎙️ Podcast Management
- Add and manage podcast RSS feeds
- Automatic episode discovery and updates
- Episode tracking and download history
- Dedicated podcast management page with RSS feed view
- Manual episode download, removal, and protection from cleanup
- Import/export functionality for backup and migration

### 📥 Automated Downloads
- Scheduled automatic checking for new episodes
- User-specific download schedules
- Manual sync triggers
- Download verification and integrity checks
- Keep-count cleanup with removed episode tracking

### ☁️ Cloud Storage Integration
- Google Drive integration for storing downloaded episodes
- Folder browser for organizing content
- Encrypted credential storage
- Automatic upload after download

### 🔒 Security & Privacy
- Google OAuth 2.0 authentication
- User-specific encryption keys
- Encrypted sensitive data storage
- Session-based authentication with MongoDB store

### 📊 Statistics & Monitoring
- Download statistics and history
- Storage usage tracking
- System health monitoring
- Activity logs

### 🌐 Internationalization
- Multi-language support (English, Hebrew)
- Browser language detection
- Easy language switching

## Tech Stack

### Frontend
- **React 18** - UI library
- **React Router** - Client-side routing
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Recharts** - Data visualization
- **i18next** - Internationalization

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM
- **Passport.js** - Authentication (Google OAuth 2.0)
- **Winston** - Logging

### Key Libraries
- **node-cron** - Scheduled tasks
- **rss-parser** - RSS feed parsing
- **googleapis** - Google Drive API
- **axios** - HTTP client
- **multer** - File upload handling

## Project Structure

```
podcast-manager-app/
├── server/                 # Backend code
│   ├── config/            # Configuration files
│   │   ├── database.js    # MongoDB connection
│   │   ├── env.js         # Environment variables
│   │   └── passport.js    # Authentication strategy
│   ├── middleware/        # Express middleware
│   │   ├── auth.js        # Authentication middleware
│   │   └── encryption.js  # Encryption middleware
│   ├── models/            # Mongoose models
│   │   ├── Podcast.js
│   │   ├── Episode.js
│   │   ├── User.js
│   │   ├── DownloadHistory.js
│   │   ├── DriveCredentials.js
│   │   ├── SystemSettings.js
│   │   ├── Stats.js
│   │   └── UserEncryptionKey.js
│   ├── routes/            # API routes
│   │   ├── auth.js
│   │   ├── podcasts.js
│   │   ├── episodes.js
│   │   ├── drive.js
│   │   ├── settings.js
│   │   ├── stats.js
│   │   ├── sync.js
│   │   └── import-export.js
│   ├── services/          # Business logic
│   │   ├── cloudStorage.js
│   │   ├── downloader.js
│   │   ├── encryption.js
│   │   ├── rssParser.js
│   │   ├── scheduler.js
│   │   ├── syncStatus.js
│   │   ├── userKeyManager.js
│   │   ├── userScheduler.js
│   │   └── verifier.js
│   ├── utils/
│   │   └── logger.js      # Winston logger configuration
│   └── index.js           # Server entry point
├── src/                   # Frontend code
│   ├── components/        # React components
│   │   ├── Layout.jsx
│   │   ├── Toast.jsx
│   │   ├── ConfirmModal.jsx
│   │   ├── DriveFolderBrowser.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   ├── SyncProgressModal.jsx
│   │   └── VerificationModal.jsx
│   ├── contexts/          # React contexts
│   │   ├── AuthContext.jsx
│   │   └── LanguageContext.jsx
│   ├── hooks/             # Custom React hooks
│   │   └── useToast.js
│   ├── locales/           # Translation files
│   │   ├── en.json
│   │   └── he.json
│   ├── pages/             # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Podcasts.jsx
│   │   ├── PodcastManagement.jsx
│   │   ├── Episodes.jsx
│   │   ├── Statistics.jsx
│   │   ├── Settings.jsx
│   │   └── Login.jsx
│   ├── services/
│   │   └── api.js         # API client
│   ├── utils/
│   │   └── apiUrl.js      # API URL configuration
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # React entry point
│   ├── i18n.js            # i18n configuration
│   └── index.css          # Global styles
├── downloads/             # Downloaded episode files
├── logs/                  # Application logs
├── .env                   # Environment variables (not in repo)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── Dockerfile
└── README.md
```

## Prerequisites

- **Node.js** 16.x or higher
- **MongoDB** 4.x or higher (local or Atlas)
- **Google Cloud Project** with OAuth 2.0 credentials and Drive API enabled
- **npm** or **yarn**

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd podcast-manager-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/podcast-manager
   
   # Session Secret (generate a random string)
   SESSION_SECRET=your-secure-random-session-secret
   
   # Google OAuth 2.0
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   
   # Frontend URL
   CLIENT_URL=http://localhost:5173
   
   # Encryption Master Key (generate a secure random key)
   MASTER_ENCRYPTION_KEY=your-32-character-encryption-key
   ```

4. **Set up Google OAuth 2.0**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
   - Copy Client ID and Client Secret to `.env` file

5. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

## Running the Application

### Development Mode
```bash
# Run both frontend and backend concurrently
npm run dev
```

This will start:
- Backend server at `http://localhost:5000`
- Frontend dev server at `http://localhost:5173`

### Production Mode
```bash
# Build the frontend
npm run build

# Start the server (serves both API and static files)
npm start
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - Logout

### Podcasts
- `GET /api/podcasts` - Get all podcasts
- `GET /api/podcasts/:id` - Get podcast with latest episodes
- `POST /api/podcasts` - Add new podcast
- `PUT /api/podcasts/:id` - Update podcast
- `DELETE /api/podcasts/:id` - Delete podcast
- `POST /api/podcasts/:id/refresh` - Refresh a podcast feed
- `POST /api/podcasts/:id/rebuild-metadata` - Rebuild metadata from RSS
- `POST /api/podcasts/:id/reset-counter` - Reset numbering for a podcast
- `POST /api/podcasts/:id/start-over` - Start over (delete episodes and Drive files)
- `GET /api/podcasts/:id/rss-items` - RSS items merged with system status
- `POST /api/podcasts/:id/download-rss` - Manual download from RSS item

### Episodes
- `GET /api/episodes` - Get episodes (with filters)
- `GET /api/episodes/:id` - Get episode details
- `POST /api/episodes/:id/download` - Download episode
- `POST /api/episodes/:id/resync` - Re-upload episode to Drive
- `POST /api/episodes/:id/protect` - Protect/unprotect episode from cleanup
- `POST /api/episodes/:id/remove` - Remove episode from Drive (keep record)
- `DELETE /api/episodes/:id` - Delete episode record
- `DELETE /api/episodes/clear-all/confirm` - Clear all episodes

### Drive Integration
- `GET /api/drive/config` - Get Drive configuration
- `POST /api/drive/credentials` - Upload OAuth credentials
- `POST /api/drive/token` - Upload OAuth token
- `GET /api/drive/auth-url` - Get OAuth authorization URL
- `POST /api/drive/exchange-code` - Exchange OAuth code for tokens
- `POST /api/drive/folder` - Set Drive folder
- `POST /api/drive/toggle` - Enable/disable Drive
- `POST /api/drive/test` - Test Drive connection
- `POST /api/drive/create-folder` - Create main Podcasts folder
- `POST /api/drive/create-custom-folder` - Create a custom folder
- `POST /api/drive/migrate-folder` - Migrate to a new folder
- `GET /api/drive/folders` - Browse Drive folders
- `GET /api/drive/diagnostic/files` - Diagnostic listing
- `DELETE /api/drive/config` - Reset Drive configuration

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

### Statistics
- `GET /api/stats/current` - Current stats
- `GET /api/stats/history?days=7` - Historical stats
- `GET /api/stats/downloads` - Download history
- `GET /api/stats/podcasts` - Podcast stats summary

### Sync
- `GET /api/sync/status` - Get sync status
- `POST /api/sync/verify` - Verify DB vs Drive files
- `POST /api/sync/resync` - Re-sync episodes by ID
- `POST /api/check-now` - Manually trigger a podcast check

### Import/Export
- `GET /api/data/export` - Export data
- `POST /api/data/import` - Import data

## Features in Detail

### Scheduled Downloads
The app uses `node-cron` to automatically check for new episodes based on user-defined schedules:
- Hourly, daily, or weekly checks
- User-specific schedules
- Automatic download and upload to Google Drive

### Encryption
Sensitive data is encrypted using AES-256-GCM:
- User-specific encryption keys
- Master key for system-level encryption
- Encrypted Google Drive credentials

### Verification System
Downloaded files are verified to ensure integrity:
- File size validation
- Metadata verification
- Automatic retry on failure

## Docker Support

Build and run with Docker:

```bash
# Build the image
docker build -t podcast-manager .

# Run the container
docker run -p 5000:5000 --env-file .env podcast-manager
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Yes |
| `NODE_ENV` | Environment (development/production) | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `SESSION_SECRET` | Session encryption secret | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | Yes |
| `CLIENT_URL` | Frontend URL for CORS | Yes |
| `MASTER_ENCRYPTION_KEY` | Master encryption key (32 chars) | Yes |

## Logging

Logs are stored in the `logs/` directory:
- `error.log` - Error level logs
- `combined.log` - All logs
- Console output in development mode

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.
