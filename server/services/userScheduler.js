import cron from 'node-cron';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import Stats from '../models/Stats.js';
import SystemSettings from '../models/SystemSettings.js';
import User from '../models/User.js';
import { getLatestEpisodes } from './rssParser.js';
import { downloadEpisode } from './downloader.js';
import { cleanupOldEpisodes } from './cloudStorage.js';
import { logger } from '../utils/logger.js';
import { initializeDrive } from './cloudStorage.js';
import syncStatus from './syncStatus.js';

// Track which users are currently being processed to avoid overlap
const processingUsers = new Set();

/**
 * Start the per-user scheduler
 * Runs every 15 minutes and checks which users need their podcasts checked
 */
export async function startUserScheduler() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Scheduler tick - checking which users need podcast updates');
    await checkUsersForUpdates();
  });
  
  // Daily statistics update at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily statistics update for all users');
    await updateAllUsersStats();
  });
  
  logger.info('Per-user scheduler started successfully');
  logger.info('Will check for user updates every 15 minutes');
}

/**
 * Check all users and process those whose interval has elapsed
 */
async function checkUsersForUpdates() {
  try {
    const users = await User.find({});
    let enabledCount = 0;
    let processedCount = 0;
    
    for (const user of users) {
      try {
        // Skip if already processing this user
        if (processingUsers.has(user.id)) {
          logger.debug(`User ${user.email} is already being processed, skipping`);
          continue;
        }
        
        // Get user's settings
        const settings = await SystemSettings.getSettings(user.id);
        
        // Skip if user hasn't enabled auto-check
        if (!settings.autoCheckEnabled) {
          continue;
        }
        
        enabledCount++;
        const intervalHours = settings.checkIntervalHours;
        
        // Check if it's time to update this user's podcasts
        const shouldCheck = await shouldCheckUserPodcasts(user.id, intervalHours);
        
        if (shouldCheck) {
          processedCount++;
          logger.info(`Processing user: ${user.email} (interval: ${intervalHours}h)`);
          
          // Process in background (don't await)
          processUserPodcasts(user.id, user.email).catch(err => {
            logger.error(`Error processing podcasts for ${user.email}:`, err);
          });
        }
      } catch (error) {
        logger.error(`Error checking user ${user.email}:`, error);
      }
    }
    
    // Log summary
    if (processedCount > 0) {
      logger.info(`Processed ${processedCount} of ${enabledCount} users with auto-check enabled (${users.length} total users)`);
    } else if (enabledCount > 0) {
      logger.debug(`Checked ${enabledCount} users with auto-check enabled - none needed updates yet`);
    } else {
      logger.debug(`No users have auto-check enabled`);
    }
  } catch (error) {
    logger.error('Error in checkUsersForUpdates:', error);
  }
}

/**
 * Determine if a user's podcasts should be checked based on their interval
 */
async function shouldCheckUserPodcasts(userId, intervalHours) {
  try {
    // Find the most recent podcast check for this user
    const latestPodcast = await Podcast.findOne({ userId })
      .sort({ lastChecked: -1 })
      .select('lastChecked');
    
    if (!latestPodcast || !latestPodcast.lastChecked) {
      // Never checked, should check now
      return true;
    }
    
    const lastChecked = new Date(latestPodcast.lastChecked);
    const now = new Date();
    const hoursSinceLastCheck = (now - lastChecked) / (1000 * 60 * 60);
    
    return hoursSinceLastCheck >= intervalHours;
  } catch (error) {
    logger.error(`Error checking if should update user ${userId}:`, error);
    return false;
  }
}

/**
 * Process all podcasts for a specific user
 * PHASE 1: Discovery - Check all RSS feeds and identify new episodes
 * PHASE 2: Download - Download all new episodes
 */
async function processUserPodcasts(userId, userEmail) {
  // Mark user as being processed
  processingUsers.add(userId);
  
  try {
    logger.info(`Starting podcast check for user: ${userEmail}`);
    
    // Initialize Drive for this user if they have it configured
    await initializeDrive(userId);
    
    // Get user's settings
    const settings = await SystemSettings.getSettings(userId);
    const maxEpisodes = settings.maxEpisodesPerCheck;
    
    // Get user's active podcasts
    const podcasts = await Podcast.find({ userId, enabled: true });
    
    if (podcasts.length === 0) {
      logger.info(`No active podcasts for user: ${userEmail}`);
      return;
    }
    
    logger.info(`Checking ${podcasts.length} podcasts for ${userEmail} (max ${maxEpisodes} episodes each)`);
    
    // Start sync status tracking - DISCOVERY PHASE
    syncStatus.startSync(podcasts.length);
    
    // ============================================
    // PHASE 1: DISCOVERY - Check RSS & Create Episodes
    // ============================================
    const newEpisodesToDownload = [];
    
    for (const podcast of podcasts) {
      try {
        logger.info(`[${userEmail}] Checking RSS: ${podcast.name}`);
        
        // Get latest episodes from RSS feed
        const episodes = await getLatestEpisodes(podcast.rssUrl, maxEpisodes);
        let newCount = 0;
        
        // Add new episodes to database (but don't download yet)
        for (const episodeData of episodes) {
          const exists = await Episode.findOne({ 
            guid: episodeData.guid,
            userId 
          });
          
          if (!exists) {
            const episode = await Episode.create({
              userId,
              ...episodeData,
              podcast: podcast._id,
              status: 'pending', // Mark as pending for download
              downloaded: false
            });
            newCount++;
            
            // Add to download queue
            newEpisodesToDownload.push({
              episode,
              podcast
            });
          }
        }
        
        // Update podcast metadata
        await Podcast.findByIdAndUpdate(podcast._id, {
          lastChecked: new Date(),
          totalEpisodes: await Episode.countDocuments({ 
            podcast: podcast._id, 
            userId 
          }),
          downloadedEpisodes: await Episode.countDocuments({ 
            podcast: podcast._id, 
            userId,
            downloaded: true 
          })
        });
        
        // Update sync status for this podcast
        syncStatus.updatePodcast(podcast.name, 'success', newCount);
        
        if (newCount > 0) {
          logger.info(`[${userEmail}] Found ${newCount} new episodes for ${podcast.name}`);
        }
        
      } catch (error) {
        logger.error(`[${userEmail}] Error checking ${podcast.name}:`, error);
        // Update sync status with error
        syncStatus.updatePodcast(podcast.name, 'failed', 0, error.message);
      }
    }
    
    logger.info(`[${userEmail}] Discovery phase completed. Found ${newEpisodesToDownload.length} new episodes to download`);
    
    // ============================================
    // PHASE 2: DOWNLOAD - Download all new episodes
    // ============================================
    if (newEpisodesToDownload.length > 0) {
      syncStatus.startDownloadPhase(newEpisodesToDownload.length);
      
      for (const { episode, podcast } of newEpisodesToDownload) {
        try {
          logger.info(`[${userEmail}] Downloading: ${episode.title} (${podcast.name})`);
          await downloadEpisode(episode, podcast, userId);
          
          // Update sync status for this episode
          syncStatus.updateEpisode(episode.title, podcast.name, 'success');
          
        } catch (downloadError) {
          logger.error(`[${userEmail}] Failed to download ${episode.title}:`, downloadError);
          // Update sync status with error
          syncStatus.updateEpisode(episode.title, podcast.name, 'failed', downloadError.message);
        }
      }
      
      // Cleanup old episodes for each podcast if configured
      for (const podcast of podcasts) {
        if (podcast.keepEpisodeCount > 0) {
          try {
            await cleanupOldEpisodes(podcast, podcast.keepEpisodeCount);
          } catch (cleanupError) {
            logger.error(`[${userEmail}] Error cleaning up old episodes for ${podcast.name}:`, cleanupError);
          }
        }
      }
    }
    
    logger.info(`[${userEmail}] Podcast sync completed. Downloaded ${newEpisodesToDownload.length} episodes`);
    
  } catch (error) {
    logger.error(`Error processing podcasts for ${userEmail}:`, error);
  } finally {
    // End sync status tracking
    syncStatus.endSync();
    // Remove user from processing set
    processingUsers.delete(userId);
  }
}

/**
 * Update daily statistics for all users
 */
async function updateAllUsersStats() {
  try {
    const users = await User.find({});
    
    for (const user of users) {
      try {
        await updateUserDailyStats(user.id);
      } catch (error) {
        logger.error(`Error updating stats for ${user.email}:`, error);
      }
    }
    
    logger.info('Daily statistics updated for all users');
  } catch (error) {
    logger.error('Error updating all users stats:', error);
  }
}

/**
 * Update daily statistics for a specific user
 */
async function updateUserDailyStats(userId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalPodcasts = await Podcast.countDocuments({ userId });
    const activePodcasts = await Podcast.countDocuments({ userId, enabled: true });
    const totalEpisodes = await Episode.countDocuments({ userId });
    const downloadedEpisodes = await Episode.countDocuments({ userId, downloaded: true });
    const failedDownloads = await Episode.countDocuments({ userId, status: 'failed' });
    
    const storageResult = await Episode.aggregate([
      { $match: { userId: userId, fileSize: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]);
    const totalStorageUsed = storageResult[0]?.total || 0;
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const downloadsToday = await Episode.countDocuments({
      userId,
      downloadDate: { $gte: yesterday }
    });
    
    await Stats.findOneAndUpdate(
      { userId, date: today },
      {
        userId,
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
    
  } catch (error) {
    logger.error(`Error updating daily stats for user ${userId}:`, error);
  }
}

/**
 * Manually trigger podcast check for a specific user
 */
export async function triggerManualCheckForUser(userId, userEmail) {
  if (processingUsers.has(userId)) {
    throw new Error('A check is already in progress for this user');
  }
  
  // Check if sync is already running (global check)
  if (!syncStatus.canStartSync()) {
    throw new Error('Sync is already running');
  }
  
  logger.info(`Manual podcast check triggered for user: ${userEmail}`);
  await processUserPodcasts(userId, userEmail);
}

/**
 * Check if a user's podcasts are currently being processed
 */
export function isUserBeingProcessed(userId) {
  return processingUsers.has(userId);
}
