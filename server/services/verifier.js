import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import DriveCredentials from '../models/DriveCredentials.js';
import { getDriveClient, listFilesInFolder, getOrCreatePodcastFolder } from './cloudStorage.js';
import syncStatus from './syncStatus.js';
import { logger } from '../utils/logger.js';
import userKeyManager from './userKeyManager.js';

export async function verifyDriveConsistency(userId) {
  const drive = getDriveClient();
  const driveConfig = await DriveCredentials.getConfig(userId);
  if (!drive || !driveConfig?.folderId) {
    return { status: 'skipped', reason: 'Drive not configured', podcasts: [] };
  }

  // Get user's encryption key to decrypt podcasts
  const userKey = await userKeyManager.getUserKey(userId);

  const podcasts = await Podcast.find({ userId });
  const results = [];

  for (const podcast of podcasts) {
    // Decrypt podcast to access name and other fields
    podcast.decrypt(userKey);
    
    // Ensure folder exists (do not create if none to avoid noise)
    const folderId = podcast.driveFolderId || null;
    if (!folderId) {
      // No folder ID in database - check if any episodes claim to be downloaded
      const downloadedEpisodes = await Episode.find({ podcast: podcast._id, downloaded: true });
      if (downloadedEpisodes.length > 0) {
        results.push({ 
          podcastId: podcast._id, 
          name: podcast.name, 
          missingInDrive: downloadedEpisodes.map(ep => ({ id: ep._id, title: ep.title, cloudFileId: ep.cloudFileId || null })), 
          extraOnDrive: [], 
          summary: { missingCount: downloadedEpisodes.length, extraCount: 0 },
          warning: 'No Drive folder ID stored for this podcast'
        });
      } else {
        results.push({ podcastId: podcast._id, name: podcast.name, missingInDrive: [], extraOnDrive: [], summary: { missingCount: 0, extraCount: 0 } });
      }
      continue;
    }

    let files = [];
    try {
      files = await listFilesInFolder(folderId);
    } catch (error) {
      if (error.code === 404 || error.message?.includes('File not found')) {
        // Folder doesn't exist in Drive anymore
        const downloadedEpisodes = await Episode.find({ podcast: podcast._id, downloaded: true });
        results.push({
          podcastId: podcast._id,
          name: podcast.name,
          missingInDrive: downloadedEpisodes.map(ep => ({ id: ep._id, title: ep.title, cloudFileId: ep.cloudFileId || null })),
          extraOnDrive: [],
          summary: { missingCount: downloadedEpisodes.length, extraCount: 0 },
          error: 'Podcast folder no longer exists in Drive (folder will be recreated on next upload)'
        });
        continue;
      }
      throw error; // Re-throw unexpected errors
    }

    const fileIdSet = new Set(files.map(f => f.id));

    const episodes = await Episode.find({ podcast: podcast._id });

    const missingInDrive = episodes
      .filter(ep => ep.downloaded)
      .filter(ep => !ep.cloudFileId || !fileIdSet.has(ep.cloudFileId))
      .map(ep => ({ id: ep._id, title: ep.title, cloudFileId: ep.cloudFileId || null }));

    const episodeFileIds = new Set(episodes.filter(ep => ep.cloudFileId).map(ep => ep.cloudFileId));
    const extraOnDrive = files
      .filter(f => !episodeFileIds.has(f.id))
      .map(f => ({ id: f.id, name: f.name }));

    results.push({
      podcastId: podcast._id,
      name: podcast.name,
      missingInDrive,
      extraOnDrive,
      summary: { missingCount: missingInDrive.length, extraCount: extraOnDrive.length },
    });
  }

  const totalMissing = results.reduce((acc, r) => acc + r.summary.missingCount, 0);
  const totalExtra = results.reduce((acc, r) => acc + r.summary.extraCount, 0);

  return { status: 'ok', totalMissing, totalExtra, podcasts: results };
}

export async function resyncEpisodesByIds(episodeIds) {
  const episodes = await Episode.find({ _id: { $in: episodeIds } });
  if (episodes.length === 0) {
    return { startedCount: 0, episodeIds: [] };
  }
  
  // Check if sync is already running
  if (!syncStatus.canStartSync()) {
    throw new Error('Another sync operation is already in progress');
  }
  
  // Group episodes by podcast
  const grouped = new Map();
  episodes.forEach(ep => {
    const key = String(ep.podcast);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(ep);
  });
  
  const PodcastModel = (await import('../models/Podcast.js')).default;
  const { downloadEpisode } = await import('./downloader.js');

  // Get user's encryption key
  const userId = episodes[0]?.userId;
  const userKey = await userKeyManager.getUserKey(userId);

  // Start sync tracking for retry operation
  // We skip discovery phase and go straight to download
  syncStatus.startSync(0); // 0 podcasts to check
  syncStatus.startDownloadPhase(episodes.length);
  
  logger.info(`Starting retry/resync for ${episodes.length} episodes`);

  const started = [];
  try {
    for (const [podcastId, eps] of grouped) {
      const podcast = await PodcastModel.findById(podcastId);
      if (!podcast) {
        logger.warn(`Podcast ${podcastId} not found, skipping episodes`);
        continue;
      }
      
      // Decrypt podcast to access its fields
      podcast.decrypt(userKey);
      
      for (const ep of eps) {
        // mark pending and clear old cloud fields to force re-upload
        ep.status = 'pending';
        ep.downloaded = false;
        ep.cloudFileId = null;
        ep.cloudUrl = null;
        await ep.save();
        
        // Download and track progress
        try {
          const userId = ep.userId || null;
          await downloadEpisode(ep, podcast, userId);
          syncStatus.updateEpisode(ep.title, podcast.name, 'success');
          started.push(String(ep._id));
        } catch (err) {
          logger.error(`Failed to resync episode ${ep.title}:`, err);
          syncStatus.updateEpisode(ep.title, podcast.name, 'failed', err.message);
        }
      }
    }
  } finally {
    syncStatus.endSync();
  }
  
  logger.info(`Retry/resync completed: ${started.length} succeeded, ${episodes.length - started.length} failed`);
  return { startedCount: started.length, episodeIds: started };
}