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
- Apple Podcasts search for quick discovery

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
- Folder creation, migration, and diagnostics

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

See [docs/project-structure.md](docs/project-structure.md).

## Prerequisites

- **Node.js** 18.x or higher
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

   # Drive OAuth redirect (frontend settings page)
   GOOGLE_DRIVE_CALLBACK_URL=http://localhost:3000/settings
   
   # Frontend URLs
   CLIENT_URL=http://localhost:3000
   FRONTEND_URL=http://localhost:3000

   # Cookie options (optional)
   COOKIE_SAME_SITE=lax
   COOKIE_DOMAIN=
   
   # Encryption Master Key (generate a secure random key)
   ENCRYPTION_MASTER_KEY=your-64-character-hex-key

   # Optional: override API base for the frontend dev proxy
   VITE_API_URL=http://localhost:5000

   # Optional: runtime API URL injection in production
   RUNTIME_API_URL=https://your-domain.example/api
   PROD_PROVIDER=RENDER
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
- Frontend dev server at `http://localhost:3000`

### Production Mode
```bash
# Build the frontend
npm run build

# Start the server (serves both API and static files)
npm start
```

## API Endpoints

See [docs/api-endpoints.md](docs/api-endpoints.md).

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
| `GOOGLE_DRIVE_CALLBACK_URL` | Drive OAuth redirect URL | No |
| `CLIENT_URL` | Frontend URL for CORS | Yes |
| `FRONTEND_URL` | Frontend URL for login redirect | No |
| `COOKIE_SAME_SITE` | Cookie same-site policy (`lax` recommended) | No |
| `COOKIE_DOMAIN` | Cookie domain override | No |
| `ENCRYPTION_MASTER_KEY` | Master encryption key (64 hex chars) | Yes |
| `VITE_API_URL` | Dev proxy API URL override | No |
| `RUNTIME_API_URL` | Production runtime API URL | No |
| `PROD_PROVIDER` | Production provider hint (`RENDER`) | No |

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
