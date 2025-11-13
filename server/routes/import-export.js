import express from 'express';
import multer from 'multer';
import Podcast from '../models/Podcast.js';
import SystemSettings from '../models/SystemSettings.js';
import { logger } from '../utils/logger.js';
import { parseFeed } from '../services/rssParser.js';
import { loadUserKey, decryptDocuments, decryptDocument, encryptDocument } from '../middleware/encryption.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply encryption middleware to all routes
router.use(loadUserKey);

// Export podcasts to JSON
router.get('/export', async (req, res) => {
  try {
    const podcasts = await Podcast.find({ userId: req.user.id });
    const settings = await SystemSettings.getSettings(req.user.id);
    
    // Decrypt all podcasts
    const decryptedPodcasts = decryptDocuments(podcasts, req.userKey);
    
    const exportData = {
      podcasts: decryptedPodcasts.map(p => ({
        name: p.name,
        rss_url: p.rssUrl,
        folder_name: p.folderName,
        enabled: p.enabled,
        keep_count: p.keepEpisodeCount
      })),
      settings: {
        check_interval_hours: settings.checkIntervalHours,
        max_episodes_per_check: settings.maxEpisodesPerCheck,
        max_concurrent_downloads: settings.maxConcurrentDownloads,
        default_keep_count: settings.defaultKeepEpisodeCount
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=podcasts.json');
    res.json(exportData);
    
    logger.info('Exported podcast data');
  } catch (error) {
    logger.error('Error exporting podcasts:', error);
    res.status(500).json({ error: 'Failed to export podcasts' });
  }
});

// Import podcasts from JSON
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const data = JSON.parse(req.file.buffer.toString());
    
    if (!data.podcasts || !Array.isArray(data.podcasts)) {
      return res.status(400).json({ error: 'Invalid file format: missing podcasts array' });
    }
    
    let imported = 0;
    let skipped = 0;
    let errors = [];
    
    // Import podcasts
    for (const podcastData of data.podcasts) {
      try {
        // Check if podcast already exists for this user
        const existing = await Podcast.findOne({ 
          userId: req.user.id,
          encryptedRssUrl: { $exists: true }
        });
        
        // If we have existing podcasts, we need to check them manually
        // since RSS URLs are encrypted
        if (existing) {
          const allPodcasts = await Podcast.find({ userId: req.user.id });
          const decryptedPodcasts = decryptDocuments(allPodcasts, req.userKey);
          const duplicate = decryptedPodcasts.find(p => p.rssUrl === podcastData.rss_url);
          
          if (duplicate) {
            skipped++;
            continue;
          }
        }
        
        // Validate RSS feed
        let feedData;
        try {
          feedData = await parseFeed(podcastData.rss_url);
        } catch (error) {
          logger.error(`Error parsing RSS feed ${podcastData.rss_url}:`, error);
          errors.push(`Failed to parse RSS feed for "${podcastData.name}": ${error.message}`);
          continue;
        }
        
        // Create podcast with virtual fields
        const podcast = new Podcast({
          userId: req.user.id,
          enabled: podcastData.enabled !== false,
          keepEpisodeCount: podcastData.keep_count || 10
        });
        
        // Set virtual fields (will be encrypted on save)
        podcast.name = podcastData.name;
        podcast.rssUrl = podcastData.rss_url;
        podcast.description = feedData.description;
        podcast.imageUrl = feedData.imageUrl;
        podcast.author = feedData.author;
        podcast.folderName = podcastData.folder_name || podcastData.name.replace(/[^a-z0-9]/gi, '_');
        podcast.driveFolderName = podcastData.name;
        
        // Encrypt before saving
        encryptDocument(podcast, req.userKey);
        await podcast.save();
        
        imported++;
      } catch (error) {
        logger.error(`Error importing podcast "${podcastData.name}":`, error);
        errors.push(`Failed to import "${podcastData.name}": ${error.message}`);
      }
    }
    
    // Import settings if provided
    if (data.settings) {
      try {
        const settings = await SystemSettings.getSettings(req.user.id);
        
        if (data.settings.check_interval_hours) {
          settings.checkIntervalHours = data.settings.check_interval_hours;
        }
        if (data.settings.max_episodes_per_check) {
          settings.maxEpisodesPerCheck = data.settings.max_episodes_per_check;
        }
        if (data.settings.max_concurrent_downloads) {
          settings.maxConcurrentDownloads = data.settings.max_concurrent_downloads;
        }
        if (data.settings.default_keep_count !== undefined) {
          settings.defaultKeepEpisodeCount = data.settings.default_keep_count;
        }
        
        await settings.save();
      } catch (error) {
        logger.error('Error importing settings:', error);
      }
    }
    
    logger.info(`Import completed: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);
    
    res.json({
      message: 'Import completed',
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    logger.error('Error importing podcasts:', error);
    res.status(500).json({ error: 'Failed to import podcasts: ' + error.message });
  }
});

export default router;
