import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import DriveCredentials from '../models/DriveCredentials.js';
import { getDriveClient, listFilesInFolder, getOrCreatePodcastFolder } from './cloudStorage.js';

export async function verifyDriveConsistency(userId) {
  const drive = getDriveClient();
  const driveConfig = await DriveCredentials.getConfig(userId);
  if (!drive || !driveConfig?.folderId) {
    return { status: 'skipped', reason: 'Drive not configured', podcasts: [] };
  }

  const podcasts = await Podcast.find({ userId });
  const results = [];

  for (const podcast of podcasts) {
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
  const grouped = new Map();
  episodes.forEach(ep => {
    const key = String(ep.podcast);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(ep);
  });
  const PodcastModel = (await import('../models/Podcast.js')).default;
  const { downloadEpisode } = await import('./downloader.js');

  const started = [];
  for (const [podcastId, eps] of grouped) {
    const podcast = await PodcastModel.findById(podcastId);
    for (const ep of eps) {
      // mark pending and clear old cloud fields to force re-upload
      ep.status = 'pending';
      ep.downloaded = false;
      ep.cloudFileId = null;
      ep.cloudUrl = null;
      await ep.save();
      // Pass userId to downloader to ensure download history is recorded correctly
      try {
        const userId = ep.userId || null;
        downloadEpisode(ep, podcast, userId).catch(() => {});
      } catch (err) {
        // swallow - we intentionally fire-and-forget downloads
      }
      started.push(String(ep._id));
    }
  }
  return { startedCount: started.length, episodeIds: started };
}