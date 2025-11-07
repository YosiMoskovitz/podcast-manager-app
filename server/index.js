// IMPORTANT: This MUST be the first import - it loads and validates environment variables
import './config/env.js';

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { connectDatabase } from './config/database.js';
import { initializeDrive } from './services/cloudStorage.js';
import { startScheduler, triggerManualCheck } from './services/scheduler.js';
import { logger } from './utils/logger.js';

// Import routes
import podcastsRouter from './routes/podcasts.js';
import episodesRouter from './routes/episodes.js';
import statsRouter from './routes/stats.js';
import driveRouter from './routes/drive.js';
import settingsRouter from './routes/settings.js';
import importExportRouter from './routes/import-export.js';
import syncRouter from './routes/sync.js';

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/podcasts', podcastsRouter);
app.use('/api/episodes', episodesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/drive', driveRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/data', importExportRouter);
app.use('/api/sync', syncRouter);

// Trigger manual check
app.post('/api/check-now', async (req, res) => {
  try {
    triggerManualCheck();
    res.json({ message: 'Manual check started' });
  } catch (error) {
    logger.error('Error triggering manual check:', error);
    res.status(500).json({ error: 'Failed to trigger manual check' });
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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    
    // Initialize Google Drive if configured
    initializeDrive();
    
    // Start the scheduler
    startScheduler();
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
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
