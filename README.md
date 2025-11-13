# Podcast Manager App

A full-stack web application for managing podcast RSS feeds with automated downloads, cloud storage synchronization, and multi-language support.

## Features

### Core Functionality
- **RSS Feed Management** - Subscribe to and manage podcast RSS feeds
- **Automated Downloads** - Schedule automatic episode downloads per user
- **Cloud Storage Integration** - Sync episodes to Google Drive with folder browsing
- **Episode Management** - Track, download, and organize podcast episodes
- **Statistics Dashboard** - View download history and usage statistics
- **Multi-language Support** - Built-in internationalization (English & Hebrew)

### Authentication & Security
- Google OAuth 2.0 authentication via Passport.js
- Secure session management with MongoDB store
- Encrypted credential storage for cloud services
- User-specific podcast and episode management

### User Experience
- Responsive modern UI built with React and Tailwind CSS
- Real-time sync progress tracking
- Toast notifications for user feedback
- Confirmation modals for critical actions
- Interactive data visualizations with Recharts

## Tech Stack

### Frontend
- **Framework**: React 18.2
- **Routing**: React Router DOM 6.20
- **Styling**: Tailwind CSS with PostCSS
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Charts**: Recharts
- **i18n**: i18next + react-i18next
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js (v20.18.0+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Passport.js (Google OAuth 2.0)
- **Sessions**: express-session with connect-mongo
- **Scheduling**: node-cron
- **RSS Parsing**: rss-parser
- **Cloud Storage**: Google APIs (Drive v3)
- **Logging**: Winston
- **File Uploads**: Multer

## Project Structure

```
podcast-manager-app/
├── server/                      # Backend Node.js/Express server
│   ├── config/                  # Configuration files
│   │   ├── database.js         # MongoDB connection
│   │   ├── env.js              # Environment validation
│   │   └── passport.js         # OAuth strategy
│   ├── middleware/             # Express middleware
│   │   └── auth.js             # Authentication middleware
│   ├── models/                 # Mongoose models
│   │   ├── User.js
│   │   ├── Podcast.js
│   │   ├── Episode.js
│   │   ├── DownloadHistory.js
│   │   ├── DriveCredentials.js
│   │   ├── SystemSettings.js
│   │   └── Stats.js
│   ├── routes/                 # API routes
│   │   ├── auth.js
│   │   ├── podcasts.js
│   │   ├── episodes.js
│   │   ├── drive.js
│   │   ├── sync.js
│   │   ├── stats.js
│   │   ├── settings.js
│   │   └── import-export.js
│   ├── services/               # Business logic
│   │   ├── rssParser.js        # RSS feed parsing
│   │   ├── downloader.js       # Episode downloads
│   │   ├── cloudStorage.js     # Google Drive integration
│   │   ├── userScheduler.js    # Per-user scheduling
│   │   ├── syncStatus.js       # Sync state management
│   │   └── verifier.js         # File verification
│   ├── utils/                  # Utilities
│   │   └── logger.js           # Winston logger
│   └── index.js                # Server entry point
├── src/                        # Frontend React application
│   ├── components/             # Reusable components
│   │   ├── Layout.jsx
│   │   ├── Toast.jsx
│   │   ├── ConfirmModal.jsx
│   │   ├── SyncProgressModal.jsx
│   │   ├── DriveFolderBrowser.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   └── VerificationModal.jsx
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.jsx
│   │   └── LanguageContext.jsx
│   ├── hooks/                  # Custom hooks
│   │   └── useToast.js
│   ├── locales/                # Translation files
│   │   ├── en.json
│   │   └── he.json
│   ├── pages/                  # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Podcasts.jsx
│   │   ├── Episodes.jsx
│   │   ├── Statistics.jsx
│   │   ├── Settings.jsx
│   │   └── Login.jsx
│   ├── services/               # Frontend services
│   │   └── api.js              # API client
│   ├── utils/                  # Frontend utilities
│   │   └── apiUrl.js           # API URL configuration
│   ├── App.jsx                 # App component
│   ├── main.jsx                # React entry point
│   ├── i18n.js                 # i18next configuration
│   └── index.css               # Global styles
├── downloads/                  # Episode download directory
├── logs/                       # Application logs
├── Dockerfile                  # Docker configuration
├── deploy.sh                   # Deployment script
├── package.json                # Dependencies & scripts
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
├── postcss.config.js           # PostCSS configuration
└── index.html                  # HTML template
```

## Installation

### Prerequisites
- Node.js v20.18.0 or higher
- MongoDB database (local or cloud)
- Google Cloud Platform project with OAuth 2.0 credentials and Drive API enabled

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd podcast-manager-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/podcast-manager
   
   # Security
   SESSION_SECRET=your-session-secret-key
   ENCRYPTION_KEY=your-32-character-encryption-key
   
   # Google OAuth 2.0
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   
   # Application
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173
   
   # Production (optional)
   PROD_PROVIDER=render  # or 'fly' for Fly.io
   RUNTIME_API_URL=https://your-production-domain.com
   ```

4. **Set up Google Cloud Platform**
   - Create a project in [Google Cloud Console](https://console.cloud.google.com)
   - Enable Google Drive API
   - Configure OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - Development: `http://localhost:5000/api/auth/google/callback`
     - Production: `https://your-domain.com/api/auth/google/callback`

## Usage

### Development Mode

Run both frontend and backend concurrently:
```bash
npm run dev
```

Or run separately:
```bash
# Backend only (port 5000)
npm run server

# Frontend only (port 5173)
npm run client
```

Access the application at `http://localhost:5173`

### Production Mode

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Start the server**
   ```bash
   npm start
   ```

The server will serve the built frontend from the `dist/` directory.

### Docker Deployment

```bash
docker build -t podcast-manager .
docker run -p 5000:5000 --env-file .env podcast-manager
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/check` - Check authentication status
- `POST /api/auth/logout` - Logout user

### Podcasts
- `GET /api/podcasts` - List user's podcasts
- `POST /api/podcasts` - Add new podcast
- `PUT /api/podcasts/:id` - Update podcast
- `DELETE /api/podcasts/:id` - Remove podcast
- `POST /api/podcasts/refresh-all` - Refresh all feeds

### Episodes
- `GET /api/episodes` - List episodes (with filters)
- `POST /api/episodes/:id/download` - Download episode
- `DELETE /api/episodes/:id` - Delete episode
- `POST /api/episodes/:id/verify` - Verify episode file

### Google Drive
- `GET /api/drive/auth-status` - Check Drive authorization
- `GET /api/drive/auth-url` - Get Drive OAuth URL
- `POST /api/drive/callback` - Handle Drive OAuth callback
- `POST /api/drive/revoke` - Revoke Drive access
- `GET /api/drive/folders` - Browse Drive folders

### Sync & Settings
- `POST /api/sync/upload` - Upload episode to Drive
- `GET /api/sync/status` - Get sync status
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

### Statistics
- `GET /api/stats` - Get user statistics

### Import/Export
- `GET /api/import-export/export` - Export data
- `POST /api/import-export/import` - Import data

## Key Features Explained

### Automated Scheduling
- Per-user cron schedules for RSS feed checking
- Configurable check intervals (hourly, daily, weekly)
- Automatic episode downloads based on user preferences

### Cloud Storage Sync
- Selective episode upload to Google Drive
- Folder browser for choosing destination
- Progress tracking during sync operations
- Automatic retry mechanism

### Multi-language Support
- Language detection based on browser settings
- Manual language switching (English/Hebrew)
- RTL support for Hebrew
- Comprehensive translation coverage

### Security
- OAuth 2.0 authentication
- Encrypted storage of cloud credentials
- Secure session management
- Protected API routes with authentication middleware

## Development

### Code Structure
- **Models**: Mongoose schemas for data persistence
- **Services**: Business logic isolated from routes
- **Middleware**: Request processing and authentication
- **Context Providers**: React state management
- **Hooks**: Reusable React logic

### Logging
Winston logger configured for:
- Console output in development
- File rotation in production (`logs/` directory)
- Error tracking and debugging

### Error Handling
- Global error handlers on both frontend and backend
- User-friendly error messages
- Detailed logging for debugging

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `SESSION_SECRET` | Yes | Secret for session encryption |
| `ENCRYPTION_KEY` | Yes | 32-character key for credential encryption |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Yes | OAuth redirect URI |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | Environment (development/production) |
| `CLIENT_URL` | No | Frontend URL for CORS |
| `PROD_PROVIDER` | No | Production platform (render/fly) |
| `RUNTIME_API_URL` | No | Production API URL |

## License

ISC

## Contributing

Contributions are welcome! Please ensure code quality and test coverage before submitting pull requests.
