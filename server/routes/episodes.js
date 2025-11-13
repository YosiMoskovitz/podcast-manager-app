import express from 'express';
import Episode from '../models/Episode.js';
import Podcast from '../models/Podcast.js';
import { downloadEpisode } from '../services/downloader.js';
import { logger } from '../utils/logger.js';
import syncStatus from '../services/syncStatus.js';

const router = express.Router();

// Get all episodes with filters
router.get('/', async (req, res) => {
  try {
    const { podcast, status, limit = 50 } = req.query;
    
    const filter = { userId: req.user.id };
    if (podcast) filter.podcast = podcast;
    if (status) filter.status = status;
    
    const episodes = await Episode.find(filter)
      .populate('podcast', 'name imageUrl')
      .sort({ pubDate: -1 })
      .limit(parseInt(limit));
    
    res.json(episodes);
  } catch (error) {
    logger.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

// Get single episode
router.get('/:id', async (req, res) => {
  try {
    const episode = await Episode.findOne({ _id: req.params.id, userId: req.user.id }).populate('podcast');
    
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    res.json(episode);
  } catch (error) {
    logger.error('Error fetching episode:', error);
    res.status(500).json({ error: 'Failed to fetch episode' });
  }
});

// Download episode
router.post('/:id/download', async (req, res) => {
  try {
    const episode = await Episode.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    if (episode.downloaded) {
      return res.status(400).json({ error: 'Episode already downloaded' });
    }
    
    // Get podcast object (not just populated reference)
    const podcast = await Podcast.findOne({ _id: episode.podcast, userId: req.user.id });
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Check if sync is already running
    if (!syncStatus.canStartSync()) {
      return res.status(409).json({ error: 'Another sync operation is already in progress' });
    }
    
    // Start sync tracking for single episode download
    syncStatus.startSync(0); // 0 podcasts to check
    syncStatus.startDownloadPhase(1); // 1 episode
    
    // Start download with tracking
    downloadEpisode(episode, podcast, req.user.id)
      .then(() => {
        syncStatus.updateEpisode(episode.title, podcast.name, 'success');
        syncStatus.endSync();
      })
      .catch(err => {
        logger.error('Download/upload failed:', err);
        syncStatus.updateEpisode(episode.title, podcast.name, 'failed', err.message);
        syncStatus.endSync();
      });
    
    res.json({ message: 'Download started', episodeId: episode._id });
  } catch (error) {
    logger.error('Error starting download:', error);
    res.status(500).json({ error: 'Failed to start download' });
  }
});

// Re-sync episode (force upload again)
router.post('/:id/resync', async (req, res) => {
  try {
    const episode = await Episode.findOne({ _id: req.params.id, userId: req.user.id });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    const podcast = await Podcast.findOne({ _id: episode.podcast, userId: req.user.id });
    if (!podcast) return res.status(404).json({ error: 'Podcast not found' });

    // Check if sync is already running
    if (!syncStatus.canStartSync()) {
      return res.status(409).json({ error: 'Another sync operation is already in progress' });
    }

    // Reset minimal fields to trigger fresh upload
    episode.status = 'pending';
    episode.downloaded = false;
    episode.cloudFileId = null;
    episode.cloudUrl = null;
    await episode.save();

    // Start sync tracking for single episode resync
    syncStatus.startSync(0); // 0 podcasts to check
    syncStatus.startDownloadPhase(1); // 1 episode
    
    downloadEpisode(episode, podcast, req.user.id)
      .then(() => {
        syncStatus.updateEpisode(episode.title, podcast.name, 'success');
        syncStatus.endSync();
      })
      .catch(err => {
        logger.error('Re-sync failed:', err);
        syncStatus.updateEpisode(episode.title, podcast.name, 'failed', err.message);
        syncStatus.endSync();
      });

    res.json({ message: 'Re-sync started', episodeId: episode._id });
  } catch (error) {
    logger.error('Error re-syncing episode:', error);
    res.status(500).json({ error: 'Failed to re-sync episode' });
  }
});

// Delete episode
router.delete('/:id', async (req, res) => {
  try {
    const episode = await Episode.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    logger.info(`Deleted episode: ${episode.title}`);
    res.json({ message: 'Episode deleted successfully' });
  } catch (error) {
    logger.error('Error deleting episode:', error);
    res.status(500).json({ error: 'Failed to delete episode' });
  }
});

// Clear all episodes data (for fresh sync restart)
router.delete('/clear-all/confirm', async (req, res) => {
  try {
    logger.info('Starting clear all episodes operation');
    
    // Import cloudStorage dynamically to avoid circular dependency
    const { getDriveClient } = await import('../services/cloudStorage.js');
    const DriveCredentials = (await import('../models/DriveCredentials.js')).default;
    
    const drive = getDriveClient();
    const driveConfig = await DriveCredentials.getConfig(req.user.id);
    const mainFolderId = driveConfig?.folderId;
    
    let deletedFilesCount = 0;
    let errors = [];
    
    // Delete all files from Google Drive podcast folders if Drive is configured
    if (drive && mainFolderId) {
      try {
        logger.info('Deleting files from Google Drive...');
        
        // Get all podcast folders
        const foldersResponse = await drive.files.list({
          q: `'${mainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
          pageSize: 100
        });
        
        // For each podcast folder, delete all files inside
        for (const folder of foldersResponse.data.files || []) {
          try {
            const filesResponse = await drive.files.list({
              q: `'${folder.id}' in parents and trashed=false`,
              fields: 'files(id, name)',
              spaces: 'drive',
              pageSize: 1000
            });
            
            for (const file of filesResponse.data.files || []) {
              try {
                await drive.files.delete({ fileId: file.id });
                deletedFilesCount++;
                logger.info(`Deleted file: ${file.name} from ${folder.name}`);
              } catch (fileError) {
                logger.error(`Failed to delete file ${file.id}:`, fileError);
                errors.push({ file: file.name, error: fileError.message });
              }
            }
          } catch (folderError) {
            logger.error(`Failed to process folder ${folder.id}:`, folderError);
            errors.push({ folder: folder.name, error: folderError.message });
          }
        }
      } catch (driveError) {
        logger.error('Error accessing Google Drive:', driveError);
        errors.push({ drive: 'main', error: driveError.message });
      }
    }
    
    // Delete all episodes from database for this user
    const deleteResult = await Episode.deleteMany({ userId: req.user.id });
    logger.info(`Deleted ${deleteResult.deletedCount} episodes from database`);
    
    // Reset podcast drive folder IDs (so they can be recreated) for this user
    const updateResult = await Podcast.updateMany({ userId: req.user.id }, { $unset: { driveFolderId: 1 } });
    logger.info(`Reset driveFolderId for ${updateResult.modifiedCount} podcasts`);
    
    res.json({
      message: 'All episodes cleared successfully',
      episodesDeleted: deleteResult.deletedCount,
      filesDeleted: deletedFilesCount,
      podcastsReset: updateResult.modifiedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error('Error clearing all episodes:', error);
    res.status(500).json({ error: 'Failed to clear episodes: ' + error.message });
  }
});

export default router;
