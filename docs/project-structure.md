# Project Structure

```
podcast-manager-app/
├── docs/                  # Project docs
│   └── podcast-status.md
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
│   │   ├── metadataService.js
│   │   ├── podcastSearch.js
│   │   ├── rssParser.js
│   │   ├── scheduler.js
│   │   ├── syncStatus.js
│   │   ├── userKeyManager.js
│   │   ├── userScheduler.js
│   │   └── verifier.js
│   ├── utils/
│   │   ├── logger.js      # Winston logger configuration
│   │   └── sanitizeFilename.js
│   └── index.js           # Server entry point
├── src/                   # Frontend code
│   ├── components/        # React components
│   │   ├── Layout.jsx
│   │   ├── Toast.jsx
│   │   ├── ConfirmModal.jsx
│   │   ├── DriveFolderBrowser.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   ├── SyncIndicator.jsx
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
├── postcss.config.js
├── vite.config.js
├── tailwind.config.js
├── Dockerfile
└── README.md
```