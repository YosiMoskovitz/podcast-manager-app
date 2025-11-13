import cron from 'node-cron';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import Stats from '../models/Stats.js';
import SystemSettings from '../models/SystemSettings.js';
import { getLatestEpisodes } from './rssParser.js';
import { downloadEpisode } from './downloader.js';
import { cleanupOldEpisodes } from './cloudStorage.js';
import userKeyManager from './userKeyManager.js';
import { logger } from '../utils/logger.js';
import syncStatus from './syncStatus.js';

export async function startScheduler() {
  // Get settings from database
  const settings = await SystemSettings.getSettings();
  const checkInterval = settings.checkIntervalHours;
  
  // Run every N hours (default: 6 hours)
  const cronExpression = `0 */${checkInterval} * * *`;
  
  logger.info(`Starting scheduler: checking feeds every ${checkInterval} hours`);
  
  cron.schedule(cronExpression, async () => {
    logger.info('Starting scheduled podcast check');
    await checkAndDownloadPodcasts();
  });
  
  // Daily statistics update at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Updating daily statistics');
    await updateDailyStats();
  });
  
  logger.info('Scheduler started successfully');
}

export async function checkAndDownloadPodcasts() {
  // Check if sync is already running
  if (!syncStatus.canStartSync()) {
    logger.warn('Sync already in progress, skipping');
    throw new Error('Sync is already running');
  }
  
  try {
    // Get max episodes from database settings
    const settings = await SystemSettings.getSettings();
    const maxEpisodes = settings.maxEpisodesPerCheck;
    
    const podcasts = await Podcast.find({ enabled: true });
    
    // Start sync tracking
    syncStatus.startSync(podcasts.length);
    
    logger.info(`Checking ${podcasts.length} active podcasts (max ${maxEpisodes} episodes per podcast)`);
    
    for (const podcast of podcasts) {
      try {
        // Load user's encryption key for this podcast
        const userKey = await userKeyManager.getUserKey(podcast.userId);
        
        // Decrypt podcast to get RSS URL
        podcast.decrypt(userKey);
        
        // Skip podcasts without RSS URL
        if (!podcast.rssUrl) {
          logger.warn(`Skipping podcast ${podcast.name}: No RSS URL configured`);
          continue;
        }
        
        logger.info(`Checking podcast: ${podcast.name}`);
        
        const episodes = await getLatestEpisodes(podcast.rssUrl, maxEpisodes);
        let newCount = 0;
        
        // Add new episodes to database and collect them for batch assignment
        const newEpisodesForPodcast = [];
        for (const episodeData of episodes) {
          const exists = await Episode.findOne({ guid: episodeData.guid });
          if (!exists) {
            const episode = new Episode({
              userId: podcast.userId,
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
            
            // Encrypt before saving
            episode.encrypt(userKey);
            await episode.save();
            
            newCount++;
            newEpisodesForPodcast.push(episode);
          }
        }

        // If we have new episodes, reserve a contiguous block and assign sequenceNumbers
        if (newEpisodesForPodcast.length > 0) {
          try {
            // Reserve numbers from Podcast atomically
            const { start } = await Podcast.reserveSequenceBlock(podcast._id, newEpisodesForPodcast.length);

            // Sort by pubDate desc so higher sequence = older index (matching existing logic)
            newEpisodesForPodcast.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));

            const bulkOps = [];
            for (let i = 0; i < newEpisodesForPodcast.length; i++) {
              const seq = start + i;
              bulkOps.push({
                updateOne: {
                  filter: { _id: newEpisodesForPodcast[i]._id },
                  update: { $set: { sequenceNumber: seq } }
                }
              });
              // also set local value so subsequent code can use it
              newEpisodesForPodcast[i].sequenceNumber = seq;
            }
            if (bulkOps.length > 0) await Episode.bulkWrite(bulkOps);
          } catch (err) {
            logger.error(`Failed to reserve/assign sequence numbers for ${podcast.name}:`, err);
          }

          // Auto-download new episodes (streams directly to Drive)
          for (const episode of newEpisodesForPodcast) {
            try {
              await downloadEpisode(episode, podcast, podcast.userId);
            } catch (downloadError) {
              logger.error(`Failed to download/upload ${episode.title}:`, downloadError);
            }
          }
        }
        
        // Update podcast metadata
        await Podcast.findByIdAndUpdate(podcast._id, {
          lastChecked: new Date(),
          totalEpisodes: await Episode.countDocuments({ podcast: podcast._id }),
          downloadedEpisodes: await Episode.countDocuments({ 
            podcast: podcast._id, 
            downloaded: true 
          })
        });
        
        // Cleanup old episodes if needed
        if (podcast.keepEpisodeCount > 0) {
          await cleanupOldEpisodes(podcast, podcast.keepEpisodeCount);
        }
        
        // Update sync status
        syncStatus.updatePodcast(podcast.name, 'success', newCount);
        
        if (newCount > 0) {
          logger.info(`Found ${newCount} new episodes for ${podcast.name}`);
        }
        
      } catch (error) {
        logger.error(`Error processing podcast ${podcast.name}:`, error);
        syncStatus.updatePodcast(podcast.name, 'failed', 0, error.message);
      }
    }
    
    logger.info('Scheduled podcast check completed');
    
  } catch (error) {
    logger.error('Error in scheduled podcast check:', error);
  } finally {
    // End sync tracking
    syncStatus.endSync();
  }
}

async function updateDailyStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalPodcasts = await Podcast.countDocuments();
    const activePodcasts = await Podcast.countDocuments({ enabled: true });
    const totalEpisodes = await Episode.countDocuments();
    const downloadedEpisodes = await Episode.countDocuments({ downloaded: true });
    const failedDownloads = await Episode.countDocuments({ status: 'failed' });
    
    const storageResult = await Episode.aggregate([
      { $match: { fileSize: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]);
    const totalStorageUsed = storageResult[0]?.total || 0;
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const downloadsToday = await Episode.countDocuments({
      downloadDate: { $gte: yesterday }
    });
    
    await Stats.findOneAndUpdate(
      { date: today },
      {
        date: today,
        totalPodcasts,
        activePodcasts,
        totalEpisodes,
        downloadedEpisodes,
        failedDownloads,
        totalStorageUsed,
        downloadsToday,
        lastCheckRun: new Date()
      },
      { upsert: true, new: true }
    );
    
    logger.info('Daily statistics updated');
    
  } catch (error) {
    logger.error('Error updating daily statistics:', error);
  }
}

// Manual trigger for checking podcasts
export async function triggerManualCheck() {
  logger.info('Manual podcast check triggered');
  await checkAndDownloadPodcasts();
}
