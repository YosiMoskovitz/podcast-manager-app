# Podcast Manager

A modern full-stack podcast RSS feed manager with automated downloads and cloud storage integration. Built with Node.js, Express, MongoDB, React, and TailwindCSS.

## Features

- 🎙️ **RSS Feed Management** - Add and manage multiple podcast RSS feeds
- ⬇️ **Automated Downloads** - Automatically download new episodes from RSS feeds
- ☁️ **Cloud Storage** - Optional Google Drive integration for episode storage
- 📊 **Statistics Dashboard** - View download statistics and podcast analytics
- ⏰ **Scheduled Checks** - Automatic periodic RSS feed checking
- 🎨 **Modern UI** - Beautiful, responsive interface built with React and TailwindCSS
- 📝 **Episode Management** - Track episode status (pending, downloading, completed, failed)
- 🔄 **Duplicate Detection** - Prevents downloading the same episode twice
- 🗑️ **Cleanup Management** - Automatically remove old episodes based on retention policy

## Tech Stack

### Backend
- Node.js with Express
- MongoDB with Mongoose
- RSS Parser for feed parsing
- Axios for HTTP requests
- Node-cron for scheduled tasks
- Winston for logging
- Google Drive API (optional)

### Frontend
- React 18
- React Router for navigation
- TailwindCSS for styling
- Lucide React for icons
- Recharts for data visualization
- Vite for build tooling

## Architecture Highlights

### 🌊 Zero-Storage Streaming

This app uses a **unique streaming architecture** that sends podcast episodes directly from RSS feeds to Google Drive **without touching your local disk**:

```
Podcast URL → Stream → Google Drive (no local storage!)
```

**Benefits**:
- ✅ Zero disk space used for episodes
- ✅ Faster (single operation vs download+upload)
- ✅ No cleanup needed
- ✅ Perfect for servers with limited storage
- ✅ Can manage unlimited podcasts

See [`STREAMING_ARCHITECTURE.md`](STREAMING_ARCHITECTURE.md) for technical details.

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager
- **Google Drive account** (free accounts work!)

## Installation

1. **Clone the repository**
```bash
cd podcast-manager-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
copy .env.example .env
```

4. **Configure environment variables**

Edit `.env` with your settings:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/podcast-manager

# Server Configuration
PORT=5000
NODE_ENV=development

# Google Drive API (Optional - for cloud storage)
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Download Settings
MAX_CONCURRENT_DOWNLOADS=3
CHECK_INTERVAL_HOURS=6
MAX_EPISODES_PER_CHECK=5
KEEP_EPISODE_COUNT=10

# Storage Provider (google-drive or local)
STORAGE_PROVIDER=local
```

5. **Start MongoDB**

Make sure MongoDB is running on your system:
```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

## Running the Application

### Development Mode (Full Stack)

Run both frontend and backend concurrently:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:3000`

### Production Mode

1. Build the frontend:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

### Individual Services

Run backend only:
```bash
npm run server
```

Run frontend only:
```bash
npm run client
```

## Google Drive Setup (Optional)

Google Drive integration uses **OAuth2** for personal Google accounts (works with free accounts!).

### Quick Setup via UI

The easiest way is through the **Settings page** in the app:

1. Start the app and navigate to **Settings** in the sidebar
2. Follow the 3-step wizard:
   - **Step 1**: Upload your OAuth2 credentials JSON file
   - **Step 2**: Authorize via browser OR upload a token JSON file
   - **Step 3**: Set your Google Drive folder ID

### Manual Setup

#### 1. Create OAuth2 Credentials

- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select an existing one
- Enable the **Google Drive API**
- Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
- Choose **"Web application"** (recommended) or **"Desktop app"**
- If web app, add authorized redirect URI: `http://localhost:3000/settings`
  - For production: `https://your-domain.com/settings`
- Download the JSON file

#### 2. Upload Credentials

**Option A**: Use the Settings page (recommended)
- Navigate to Settings → Google Drive Integration
- Upload your credentials JSON file

**Option B**: API endpoint
```bash
curl -X POST http://localhost:5000/api/drive/credentials \
  -F "file=@path/to/credentials.json"
```

#### 3. Authorize the App

**Option A**: Via browser (recommended)
- In Settings, click "Authorize with Google"
- Sign in and grant permissions
- You'll be redirected back automatically

**Option B**: Upload existing token
- If you have a `token.json` from previous authorization, upload it in Settings

#### 4. Set Folder ID

- Create a folder in your Google Drive
- Copy the folder ID from the URL (e.g., `drive.google.com/drive/folders/FOLDER_ID_HERE`)
- Enter it in the Settings page

#### 5. Enable Upload

- Toggle "Enable Drive Upload" in Settings
- Test the connection with the "Test Connection" button

## Usage

1. **Access the Application**
   - Open `http://localhost:3000` in your browser

2. **Add a Podcast**
   - Click "Add Podcast" button
   - Enter podcast name and RSS feed URL
   - Set how many episodes to keep
   - Click "Create"

3. **Manage Podcasts**
   - View all your podcasts on the Podcasts page
   - Refresh feeds manually to check for new episodes
   - Enable/disable podcasts
   - Delete podcasts and their episodes

4. **View Episodes**
   - Navigate to the Episodes page
   - Filter by status (all, pending, completed, failed)
   - Manually download individual episodes

5. **Monitor Statistics**
   - View download statistics on the Dashboard
   - Check detailed podcast analytics on the Statistics page
   - View download history

6. **Automated Operations**
   - RSS feeds are automatically checked every 6 hours (configurable)
   - New episodes are automatically downloaded
   - Old episodes are cleaned up based on retention policy

## API Endpoints

### Podcasts
- `GET /api/podcasts` - Get all podcasts
- `GET /api/podcasts/:id` - Get single podcast with episodes
- `POST /api/podcasts` - Create new podcast
- `PUT /api/podcasts/:id` - Update podcast
- `DELETE /api/podcasts/:id` - Delete podcast
- `POST /api/podcasts/:id/refresh` - Manually refresh podcast feed

### Episodes
- `GET /api/episodes` - Get all episodes with filters
- `GET /api/episodes/:id` - Get single episode
- `POST /api/episodes/:id/download` - Download episode
- `DELETE /api/episodes/:id` - Delete episode

### Statistics
- `GET /api/stats/current` - Get current statistics
- `GET /api/stats/history` - Get historical statistics
- `GET /api/stats/downloads` - Get download history
- `GET /api/stats/podcasts` - Get per-podcast statistics

### System
- `POST /api/check-now` - Trigger manual feed check
- `GET /api/health` - Health check endpoint

## Project Structure

```
podcast-manager-app/
├── server/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── models/
│   │   ├── Podcast.js           # Podcast schema
│   │   ├── Episode.js           # Episode schema
│   │   ├── DownloadHistory.js   # Download history schema
│   │   └── Stats.js             # Statistics schema
│   ├── routes/
│   │   ├── podcasts.js          # Podcast routes
│   │   ├── episodes.js          # Episode routes
│   │   └── stats.js             # Statistics routes
│   ├── services/
│   │   ├── rssParser.js         # RSS feed parser
│   │   ├── downloader.js        # Episode downloader
│   │   ├── cloudStorage.js      # Google Drive integration
│   │   └── scheduler.js         # Cron job scheduler
│   ├── utils/
│   │   └── logger.js            # Winston logger
│   └── index.js                 # Express server entry point
├── src/
│   ├── components/
│   │   └── Layout.jsx           # App layout with navigation
│   ├── pages/
│   │   ├── Dashboard.jsx        # Dashboard page
│   │   ├── Podcasts.jsx         # Podcasts management
│   │   ├── Episodes.jsx         # Episodes list
│   │   └── Statistics.jsx       # Statistics page
│   ├── services/
│   │   └── api.js               # API client
│   ├── App.jsx                  # Main app component
│   ├── main.jsx                 # React entry point
│   └── index.css                # Tailwind styles
├── downloads/                   # Local episode storage
├── logs/                        # Application logs
├── .env                         # Environment variables
├── package.json                 # Dependencies
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
└── README.md                   # This file
```

## Troubleshooting

### MongoDB Connection Failed
- Ensure MongoDB is running on your system
- Check the `MONGODB_URI` in your `.env` file
- Verify MongoDB service is started

### Google Drive Upload Fails
- Verify service account credentials are correct
- Ensure folder is shared with service account email
- Check folder ID is correct in environment variables

### Downloads Not Starting
- Check logs in `logs/` directory
- Verify RSS feed URL is accessible
- Check network connectivity

### Frontend Not Loading
- Ensure both backend and frontend servers are running
- Check browser console for errors
- Verify API URL in frontend matches backend port

## License

ISC

## Author

Created as a modern JavaScript alternative to the Python podcast-downloader

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
