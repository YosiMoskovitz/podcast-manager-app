import cron from 'node-cron';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import Stats from '../models/Stats.js';
import SystemSettings from '../models/SystemSettings.js';
import { getLatestEpisodes } from './rssParser.js';
import { downloadEpisode } from './downloader.js';
import { cleanupOldEpisodes } from './cloudStorage.js';
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
        logger.info(`Checking podcast: ${podcast.name}`);
        
        const episodes = await getLatestEpisodes(podcast.rssUrl, maxEpisodes);
        let newCount = 0;
        
        // Add new episodes to database
        for (const episodeData of episodes) {
          const exists = await Episode.findOne({ guid: episodeData.guid });
          if (!exists) {
            const episode = await Episode.create({
              ...episodeData,
              podcast: podcast._id
            });
            newCount++;
            
            // Auto-download new episodes (streams directly to Drive)
            try {
              await downloadEpisode(episode, podcast);
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
