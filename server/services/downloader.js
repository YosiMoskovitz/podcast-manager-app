import axios from 'axios';
import { logger } from '../utils/logger.js';
import Episode from '../models/Episode.js';
import Podcast from '../models/Podcast.js';
import DownloadHistory from '../models/DownloadHistory.js';
import { uploadStreamToDrive } from './cloudStorage.js';
import userKeyManager from './userKeyManager.js';
import { sanitizeFullFilename } from '../utils/sanitizeFilename.js';
import { addID3Metadata, downloadPodcastImage } from './metadataService.js';

// Helper function to retry download on network errors
async function downloadWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        method: 'get',
        url,
        responseType: 'stream',
        timeout: 7200000, // 2 hours in milliseconds
        maxRedirects: 5,
        // Keep connection alive for long downloads
        httpAgent: new (await import('http')).Agent({ keepAlive: true }),
        httpsAgent: new (await import('https')).Agent({ keepAlive: true })
      });
      return response;
    } catch (error) {
      const isRetryable = error.code === 'ECONNRESET' || 
                          error.code === 'ETIMEDOUT' || 
                          error.code === 'ENOTFOUND' ||
                          error.code === 'EAI_AGAIN' ||
                          (error.response && error.response.status >= 500);
      
      if (isRetryable && attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        logger.warn(`Download attempt ${attempt} failed with ${error.code}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

export async function downloadEpisode(episode, podcast, userId) {
  const startTime = new Date();
  
  try {
    // Load user's encryption key
    const userKey = await userKeyManager.getUserKey(userId);
    
    // Decrypt episode to get audio URL and title
    episode.decrypt(userKey);
    
    // Decrypt podcast to get name and author for metadata tagging
    podcast.decrypt(userKey);
    
    logger.info(`Starting download: ${episode.title}`);
    
    // Update episode status
    await Episode.findByIdAndUpdate(episode._id, { status: 'downloading' });
    
    // Create download history record
    const history = await DownloadHistory.create({
      userId,
      episode: episode._id,
      podcast: podcast._id,
      status: 'started',
      startTime
    });
    
    // Stream the file directly from URL with retry logic
    const response = await downloadWithRetry(episode.audioUrl);
    
    // Use existing sequenceNumber if already assigned (reserved by scheduler)
    if (typeof episode.sequenceNumber === 'number' && !isNaN(episode.sequenceNumber)) {
      // ensure podcast counter is up-to-date
      if (episode.sequenceNumber > podcast.episodeCounter) {
        podcast.episodeCounter = episode.sequenceNumber;
        await podcast.save();
      }
    } else {
      // Calculate episode number based on pub date (newer = higher number)
      const newerEpisodesCount = await Episode.countDocuments({
        podcast: podcast._id,
        pubDate: { $gte: episode.pubDate || new Date() }
      });
      let episodeNumber = newerEpisodesCount;

      // Try to set the computed number; if a duplicate-key occurs, fall back to atomic increment
      try {
        const updated = await Episode.findByIdAndUpdate(episode._id, { $set: { sequenceNumber: episodeNumber } }, { new: true });
        episode = updated; // update local instance
      } catch (err) {
        // Duplicate key or other errors: reserve a unique number via atomic increment
        const updatedPodcast = await Podcast.findByIdAndUpdate(podcast._id, { $inc: { episodeCounter: 1 } }, { new: true });
        episodeNumber = updatedPodcast.episodeCounter;
        await Episode.findByIdAndUpdate(episode._id, { $set: { sequenceNumber: episodeNumber } });
        episode.sequenceNumber = episodeNumber;
        // ensure podcast object reflects new counter
        podcast.episodeCounter = updatedPodcast.episodeCounter;
      }
    }
    
    // Generate filename with sequence number prefix (e.g., 001-Original Title.mp3)
    // Preserve the original episode title (including spaces and emoji) when uploading to Drive.
    // Only remove control characters and trim to a reasonable length to avoid issues.
    const rawTitle = (episode.title || '').normalize && (episode.title || '').normalize('NFC').trim() || String(episode.title || '').trim();
    const cleanedTitle = rawTitle.replace(/[\u0000-\u001F\u007F]/g, ''); // strip control chars
    // Ensure we have a numeric sequence available (may have been assigned above or in DB)
    const seqNumber = (typeof episode.sequenceNumber === 'number' && !isNaN(episode.sequenceNumber)) ? episode.sequenceNumber : (podcast.episodeCounter || 0);
    const paddedNumber = String(seqNumber).padStart(3, '0');
    // Do not truncate the title: preserve the full cleaned title (user requested no truncation)
    // Sanitize filename for Android/FAT32 compatibility (replace restricted chars with hyphens)
    const unsanitizedFilename = `${paddedNumber}-${cleanedTitle}.mp3`;
    const filename = sanitizeFullFilename(unsanitizedFilename);
    
    // Add ID3 metadata tags (album=podcast name, song=episode title) for proper display on Android/music players
    let audioStream = response.data;
    try {
      // Download episode or podcast image to attach as album art
      // Prioritize episode-specific image if available, fallback to podcast image
      let albumArtBuffer = null;
      const imageUrl = episode.imageUrl || podcast.imageUrl;
      if (imageUrl) {
        albumArtBuffer = await downloadPodcastImage(imageUrl);
      }

      const metadataTagged = await addID3Metadata(audioStream, {
        title: `${paddedNumber}-${cleanedTitle}`,
        album: podcast.name,
        artist: podcast.author || podcast.name,
        trackNumber: seqNumber,
        albumArt: albumArtBuffer,
        genre: 'Podcast'
      });
      audioStream = metadataTagged;
    } catch (metadataError) {
      logger.warn(`Failed to add ID3 metadata to ${filename}, uploading without metadata:`, metadataError);
      // Continue with untagged stream on error
    }
    
    // Upload stream directly to Google Drive (no local storage)
    // IMPORTANT: forward userId so cloudStorage can load the correct Drive config
    const uploadResult = await uploadStreamToDrive(audioStream, filename, podcast, userId);
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    // Prepare encrypted updates
    const episodeUpdates = {
      status: 'completed',
      downloaded: true,
      downloadDate: endTime,
      cloudFileId: uploadResult.fileId,
      cloudUrl: uploadResult.webViewLink,
      fileSize: uploadResult.size,
      removedFromSystem: false,
      removedFromSystemAt: null
    };
    
    // Create a temporary episode object for encrypting originalFileName
    const tempEpisode = new Episode(episodeUpdates);
    tempEpisode.originalFileName = sanitizeFullFilename(`${cleanedTitle}.mp3`);
    tempEpisode.encrypt(userKey);
    
    // Update episode with encrypted data
    await Episode.findByIdAndUpdate(episode._id, {
      ...episodeUpdates,
      encryptedOriginalFileName: tempEpisode.encryptedOriginalFileName
    });
    
    // Update history
    await DownloadHistory.findByIdAndUpdate(history._id, {
      status: 'completed',
      endTime,
      duration,
      bytesDownloaded: uploadResult.size,
      uploadedToCloud: true,
      cloudUploadTime: endTime
    });
    
    logger.info(`Stream completed: ${episode.title} (${uploadResult.size} bytes in ${duration}s) -> Drive: ${uploadResult.fileId}`);
    
    return { success: true, fileId: uploadResult.fileId, bytesDownloaded: uploadResult.size };
    
  } catch (error) {
    logger.error(`Download failed for ${episode.title}:`, error);
    
    const endTime = new Date();
    
    await Episode.findByIdAndUpdate(episode._id, {
      status: 'failed',
      errorMessage: error.message
    });
    
    await DownloadHistory.create({
      userId,
      episode: episode._id,
      podcast: episode.podcast,
      status: 'failed',
      startTime,
      endTime,
      duration: (endTime - startTime) / 1000,
      errorMessage: error.message
    });
    
    throw error;
  }
}

export async function downloadMultipleEpisodes(episodes, podcastFolderName, maxConcurrent = 3) {
  const results = [];
  
  for (let i = 0; i < episodes.length; i += maxConcurrent) {
    const batch = episodes.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(ep => downloadEpisode(ep, podcastFolderName))
    );
    results.push(...batchResults);
  }
  
  return results;
}
