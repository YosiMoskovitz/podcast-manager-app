// IMPORTANT: This MUST be the first import - it loads and validates environment variables
import './config/env.js';

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import { startUserScheduler, triggerManualCheckForUser } from './services/userScheduler.js';
import { logger } from './utils/logger.js';
import passport from './config/passport.js';

// Import routes
import authRouter from './routes/auth.js';
import podcastsRouter from './routes/podcasts.js';
import episodesRouter from './routes/episodes.js';
import statsRouter from './routes/stats.js';
import driveRouter from './routes/drive.js';
import settingsRouter from './routes/settings.js';
import importExportRouter from './routes/import-export.js';
import syncRouter from './routes/sync.js';
import { requireAuth } from './middleware/auth.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create necessary directories
const dirs = ['./logs', './downloads'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
if (!process.env.SESSION_SECRET) {
  logger.error('SESSION_SECRET not found in environment variables');
  throw new Error('SESSION_SECRET must be set in .env file');
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // lazy session update (seconds)
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/podcasts', requireAuth, podcastsRouter);
app.use('/api/episodes', requireAuth, episodesRouter);
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/drive', requireAuth, driveRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/data', requireAuth, importExportRouter);
app.use('/api/sync', requireAuth, syncRouter);

// Trigger manual check for logged-in user
app.post('/api/check-now', requireAuth, async (req, res) => {
  try {
    // Trigger check in background
    triggerManualCheckForUser(req.user.id, req.user.email).catch(err => {
      logger.error(`Background check failed for ${req.user.email}:`, err);
    });
    
    res.json({ message: 'Manual check started for your podcasts' });
  } catch (error) {
    logger.error('Error triggering manual check:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // Serve the React app and inject runtime config into index.html so the
  // client can read runtime environment values (avoids baked-in build-time URLs).
  // Simple in-memory cache for injected index.html. We cache per-host when
  // PROD_PROVIDER === 'RENDER' because the API URL is derived from the request
  // origin; otherwise a single global cache entry is used.
  const indexCache = new Map();

  app.get('*', (req, res, next) => {
    const indexPath = path.join(distPath, 'index.html');

    const prodProvider = process.env.PROD_PROVIDER || process.env.VITE_PROD_PROVIDER || null;
    const hostKey = (prodProvider === 'RENDER') ? req.get('host') : 'global';

    // Return cached injected HTML when available
    if (indexCache.has(hostKey)) {
      res.set('Content-Type', 'text/html');
      return res.send(indexCache.get(hostKey));
    }

    // Read and inject config, then cache the result keyed by hostKey
    fs.readFile(indexPath, 'utf8', (err, html) => {
      if (err) return next(err);

      // Compute runtime config
      // Priority for API URL:
      // 1. If PROD_PROVIDER === 'RENDER', use request origin + '/api'
      // 2. Else prefer RUNTIME_API_URL or VITE_API_URL envs
      // 3. Fallback to request origin + '/api'
      let apiUrl = null;
      if (prodProvider === 'RENDER') {
        apiUrl = `${req.protocol}://${req.get('host')}/api`;
      } else if (process.env.RUNTIME_API_URL) {
        apiUrl = process.env.RUNTIME_API_URL;
      } else if (process.env.VITE_API_URL) {
        apiUrl = process.env.VITE_API_URL;
      } else {
        apiUrl = `${req.protocol}://${req.get('host')}/api`;
      }

      const cfg = {
        API_URL: apiUrl,
        PROD_PROVIDER: prodProvider,
        NODE_ENV: process.env.NODE_ENV || null
      };

      // Inject config before closing </head>
      const injected = html.replace('</head>', `  <script>window.__CONFIG__ = ${JSON.stringify(cfg)};</script>\n</head>`);

      // Cache and send
      indexCache.set(hostKey, injected);
      res.set('Content-Type', 'text/html');
      res.send(injected);
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Validate Google OAuth configuration
function validateGoogleOAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.log('⚠️  Google OAuth not configured');
    console.log('   Users will not be able to:');
    console.log('   - Sign in with Google');
    console.log('   - Connect Google Drive');
    console.log('   Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env');
    logger.warn('Google OAuth credentials not configured');
    return false;
  }
  
  console.log('✅ Google OAuth configured');
  logger.info('Google OAuth credentials validated');
  return true;
}

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    
    // Validate Google OAuth (optional but recommended)
    validateGoogleOAuth();
    
    // Start the per-user scheduler
    startUserScheduler();
    
    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📊 API available at http://0.0.0.0:${PORT}/api`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing server');
  process.exit(0);
});

startServer();
