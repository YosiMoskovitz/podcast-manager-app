import express from 'express';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import { parseFeed, getLatestEpisodes } from '../services/rssParser.js';
import { downloadEpisode } from '../services/downloader.js';
import syncStatus from '../services/syncStatus.js';
import { loadUserKey, decryptDocuments, decryptDocument, encryptDocument } from '../middleware/encryption.js';
import { logger } from '../utils/logger.js';
import DownloadHistory from '../models/DownloadHistory.js';
import { initializeDrive, listFilesInFolder, deleteFile } from '../services/cloudStorage.js';

const router = express.Router();

// Apply encryption middleware to all routes
router.use(loadUserKey);

// Get all podcasts
router.get('/', async (req, res) => {
  try {
    const podcasts = await Podcast.find({ userId: req.user.id });
    
    // Decrypt all podcasts
    const decryptedPodcasts = decryptDocuments(podcasts, req.userKey);
    
    // Sort by decrypted name
    decryptedPodcasts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    res.json(decryptedPodcasts);
  } catch (error) {
    logger.error('Error fetching podcasts:', error);
    res.status(500).json({ error: 'Failed to fetch podcasts' });
  }
});

// Get single podcast with episodes
router.get('/:id', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    const episodes = await Episode.find({ podcast: req.params.id, userId: req.user.id })
      .sort({ pubDate: -1 })
      .limit(50);
    
    // Decrypt podcast and episodes
    decryptDocument(podcast, req.userKey);
    decryptDocuments(episodes, req.userKey);
    
    res.json({ podcast, episodes });
  } catch (error) {
    logger.error('Error fetching podcast:', error);
    res.status(500).json({ error: 'Failed to fetch podcast' });
  }
});

// Get RSS items merged with system status
router.get('/:id/rss-items', async (req, res) => {
  try {
    const limit = Math.max(parseInt(req.query.limit, 10) || 50, 1);
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    decryptDocument(podcast, req.userKey);
    if (!podcast.rssUrl) {
      return res.status(400).json({ error: 'Podcast has no RSS URL configured' });
    }

    const rssItems = await getLatestEpisodes(podcast.rssUrl, limit);
    const guids = rssItems.map(item => item.guid).filter(Boolean);
    const episodes = await Episode.find({
      userId: req.user.id,
      podcast: podcast._id,
      guid: { $in: guids }
    });
    const decryptedEpisodes = decryptDocuments(episodes, req.userKey);
    const episodeByGuid = new Map(decryptedEpisodes.map(episode => [episode.guid, episode]));

    const items = rssItems.map(item => {
      const episode = episodeByGuid.get(item.guid);
      const system = episode ? {
        id: episode._id,
        status: episode.status,
        downloaded: episode.downloaded,
        cloudFileId: episode.cloudFileId,
        cloudUrl: episode.cloudUrl,
        removedFromSystem: episode.removedFromSystem,
        removedFromSystemAt: episode.removedFromSystemAt,
        protectedFromCleanup: episode.protectedFromCleanup,
        downloadDate: episode.downloadDate,
        sequenceNumber: episode.sequenceNumber
      } : null;

      return { rss: item, system };
    });

    res.json({ podcast, items });
  } catch (error) {
    logger.error('Error fetching RSS items:', error);
    res.status(500).json({ error: 'Failed to fetch RSS items' });
  }
});

// Manual download episode from RSS item (create if missing)
router.post('/:id/download-rss', async (req, res) => {
  try {
    const { guid } = req.body;
    if (!guid) return res.status(400).json({ error: 'RSS guid is required' });

    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    decryptDocument(podcast, req.userKey);
    if (!podcast.rssUrl) {
      return res.status(400).json({ error: 'Podcast has no RSS URL configured' });
    }

    const feedData = await parseFeed(podcast.rssUrl);
    const rssItem = feedData.episodes.find(item => item.guid === guid);
    if (!rssItem) {
      return res.status(404).json({ error: 'Episode not found in RSS feed' });
    }
    if (!rssItem.audioUrl) {
      return res.status(400).json({ error: 'Episode has no audio URL in RSS feed' });
    }

    let episode = await Episode.findOne({ userId: req.user.id, podcast: podcast._id, guid: rssItem.guid });

    if (!episode) {
      episode = new Episode({
        userId: req.user.id,
        podcast: podcast._id,
        guid: rssItem.guid,
        pubDate: rssItem.pubDate,
        duration: rssItem.duration,
        fileSize: rssItem.fileSize,
        status: 'pending',
        downloaded: false
      });

      episode.title = rssItem.title;
      episode.description = rssItem.description;
      episode.audioUrl = rssItem.audioUrl;
      episode.imageUrl = rssItem.imageUrl;
      episode.originalFileName = rssItem.originalFileName || rssItem.title;
      episode.encrypt(req.userKey);
      await episode.save();
    }

    if (episode.downloaded && episode.cloudFileId) {
      return res.status(400).json({ error: 'Episode already stored in Drive' });
    }

    if (!syncStatus.canStartSync()) {
      return res.status(409).json({ error: 'Another sync operation is already in progress' });
    }

    syncStatus.startSync(0);
    syncStatus.startDownloadPhase(1);

    downloadEpisode(episode, podcast, req.user.id)
      .then(() => {
        syncStatus.updateEpisode(rssItem.title, podcast.name, 'success');
        syncStatus.endSync();
      })
      .catch(err => {
        logger.error('Manual RSS download failed:', err);
        syncStatus.updateEpisode(rssItem.title, podcast.name, 'failed', err.message);
        syncStatus.endSync();
      });

    res.json({ message: 'Download started', episodeId: episode._id });
  } catch (error) {
    logger.error('Error starting RSS download:', error);
    res.status(500).json({ error: 'Failed to start RSS download' });
  }
});

// Create new podcast
router.post('/', async (req, res) => {
  try {
    const { name, rssUrl, folderName, driveFolderName, keepEpisodeCount } = req.body;
    
    // Validate RSS feed
    const feedData = await parseFeed(rssUrl);
    
    // Create podcast with virtual fields
    const podcast = new Podcast({
      userId: req.user.id,
      keepEpisodeCount: keepEpisodeCount || 10
    });
    
    // Set virtual fields (will be encrypted on save)
    podcast.name = name;
    podcast.rssUrl = rssUrl;
    podcast.description = feedData.description;
    podcast.imageUrl = feedData.imageUrl;
    podcast.author = feedData.author;
    podcast.folderName = folderName || name.replace(/[^a-z0-9]/gi, '_');
    podcast.driveFolderName = driveFolderName || name;
    
    // Encrypt before saving
    encryptDocument(podcast, req.userKey);
    await podcast.save();
    
    // Decrypt for response
    decryptDocument(podcast, req.userKey);
    
    logger.info(`Created podcast: ${name}`);
    res.status(201).json(podcast);
  } catch (error) {
    logger.error('Error creating podcast:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update podcast
router.put('/:id', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Update virtual fields
    if (req.body.rssUrl) {
      decryptDocument(podcast, req.userKey);
      if (req.body.rssUrl !== podcast.rssUrl) {
        const feedData = await parseFeed(req.body.rssUrl);
        podcast.description = feedData.description;
        podcast.imageUrl = feedData.imageUrl;
        podcast.author = feedData.author;
      }
    }

    Object.keys(req.body).forEach(key => {
      podcast[key] = req.body[key];
    });
    
    // Encrypt and save
    encryptDocument(podcast, req.userKey);
    await podcast.save();
    
    // Decrypt for response
    decryptDocument(podcast, req.userKey);
    
    res.json(podcast);
  } catch (error) {
    logger.error('Error updating podcast:', error);
    res.status(500).json({ error: 'Failed to update podcast' });
  }
});

// Delete podcast
router.delete('/:id', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Decrypt for logging
    decryptDocument(podcast, req.userKey);
    const podcastName = podcast.name;
    
    // Delete podcast and episodes
    await Podcast.findByIdAndDelete(req.params.id);
    await Episode.deleteMany({ podcast: req.params.id, userId: req.user.id });
    
    logger.info(`Deleted podcast: ${podcastName}`);
    res.json({ message: 'Podcast deleted successfully' });
  } catch (error) {
    logger.error('Error deleting podcast:', error);
    res.status(500).json({ error: 'Failed to delete podcast' });
  }
});

// Refresh podcast feed
router.post('/:id/refresh', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Decrypt to get RSS URL
    decryptDocument(podcast, req.userKey);
    
    // Validate RSS URL exists
    if (!podcast.rssUrl) {
      return res.status(400).json({ error: 'Podcast has no RSS URL configured' });
    }
    
    const episodes = await getLatestEpisodes(podcast.rssUrl, 10);
    let newCount = 0;
    
    for (const episodeData of episodes) {
      const exists = await Episode.findOne({ guid: episodeData.guid });
      if (!exists) {
        const episode = new Episode({
          userId: req.user.id,
          podcast: podcast._id,
          guid: episodeData.guid,
          pubDate: episodeData.pubDate,
          duration: episodeData.duration,
          fileSize: episodeData.fileSize,
          status: episodeData.status
        });
        
        // Set virtual fields
        episode.title = episodeData.title;
        episode.description = episodeData.description;
        episode.audioUrl = episodeData.audioUrl;
        episode.imageUrl = episodeData.imageUrl;
        
        // Encrypt and save
        encryptDocument(episode, req.userKey);
        await episode.save();
        newCount++;
      }
    }
    
    await Podcast.findByIdAndUpdate(podcast._id, { lastChecked: new Date() });
    
    logger.info(`Refreshed ${podcast.name}: ${newCount} new episodes`);
    res.json({ message: `Found ${newCount} new episodes`, newCount });
  } catch (error) {
    logger.error('Error refreshing podcast:', error);
    res.status(500).json({ error: 'Failed to refresh podcast' });
  }
});

// Rebuild podcast metadata from RSS feed
router.post('/:id/rebuild-metadata', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });

    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    decryptDocument(podcast, req.userKey);

    if (!podcast.rssUrl) {
      return res.status(400).json({ error: 'Podcast has no RSS URL configured' });
    }

    const feedData = await parseFeed(podcast.rssUrl);
    podcast.description = feedData.description;
    podcast.imageUrl = feedData.imageUrl;
    podcast.author = feedData.author;

    encryptDocument(podcast, req.userKey);
    await podcast.save();

    decryptDocument(podcast, req.userKey);

    res.json({ message: 'Podcast metadata rebuilt successfully', podcast });
  } catch (error) {
    logger.error('Error rebuilding podcast metadata:', error);
    res.status(500).json({ error: 'Failed to rebuild podcast metadata' });
  }
});

// Reset episode counter for a podcast
router.post('/:id/reset-counter', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });

    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    const updateResult = await Episode.updateMany(
      { podcast: podcast._id, userId: req.user.id },
      { $unset: { sequenceNumber: 1 } }
    );

    podcast.episodeCounter = 0;
    await podcast.save();

    res.json({
      message: 'Episode counter reset successfully',
      clearedSequenceNumbers: updateResult.modifiedCount
    });
  } catch (error) {
    logger.error('Error resetting episode counter:', error);
    res.status(500).json({ error: 'Failed to reset episode counter' });
  }
});

// Start over for a podcast (clear episodes and optionally Drive files)
router.post('/:id/start-over', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });

    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    decryptDocument(podcast, req.userKey);

    let deletedFilesCount = 0;
    const errors = [];

    try {
      const drive = await initializeDrive(req.user.id);
      if (drive && podcast.driveFolderId) {
        const files = await listFilesInFolder(podcast.driveFolderId);
        for (const file of files) {
          try {
            await deleteFile(file.id);
            deletedFilesCount++;
          } catch (fileError) {
            logger.error(`Failed to delete file ${file.id}:`, fileError);
            errors.push({ file: file.name, error: fileError.message });
          }
        }
      }
    } catch (driveError) {
      logger.error('Error accessing Google Drive during start-over:', driveError);
      errors.push({ drive: 'main', error: driveError.message });
    }

    const episodesResult = await Episode.deleteMany({ podcast: podcast._id, userId: req.user.id });
    const historyResult = await DownloadHistory.deleteMany({ podcast: podcast._id, userId: req.user.id });

    await Podcast.findByIdAndUpdate(podcast._id, {
      totalEpisodes: 0,
      downloadedEpisodes: 0,
      episodeCounter: 0,
      lastChecked: null
    });

    logger.info(`Start over completed for podcast: ${podcast.name}`);

    res.json({
      message: 'Podcast reset successfully',
      episodesDeleted: episodesResult.deletedCount,
      downloadHistoryDeleted: historyResult.deletedCount,
      filesDeleted: deletedFilesCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error('Error starting over podcast:', error);
    res.status(500).json({ error: 'Failed to start over podcast' });
  }
});

export default router;
