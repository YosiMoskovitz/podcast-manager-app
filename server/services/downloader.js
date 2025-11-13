import axios from 'axios';
import { logger } from '../utils/logger.js';
import Episode from '../models/Episode.js';
import Podcast from '../models/Podcast.js';
import DownloadHistory from '../models/DownloadHistory.js';
import { uploadStreamToDrive } from './cloudStorage.js';

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
    
    // Calculate episode number based on pub date (newer = higher number)
    // Count how many episodes for this podcast have a later or equal pub date
    const newerEpisodesCount = await Episode.countDocuments({
      podcast: podcast._id,
      pubDate: { $gte: episode.pubDate || new Date() }
    });
    
    const episodeNumber = newerEpisodesCount;
    
    // Store sequence number in episode
    episode.sequenceNumber = episodeNumber;
    await episode.save();
    
    // Update podcast's max counter if this is higher
    if (episodeNumber > podcast.episodeCounter) {
      podcast.episodeCounter = episodeNumber;
      await podcast.save();
    }
    
    // Generate filename with episode number prefix (e.g., 001-Title.mp3)
    // Keep Unicode letters (including Hebrew), numbers, spaces, and common punctuation
    const sanitizedTitle = episode.title
      .replace(/[\\/:*?"<>|]/g, '_')  // Replace only invalid filename characters
      .replace(/\s+/g, '_')             // Replace spaces with underscores
      .substring(0, 100);
    const paddedNumber = String(episodeNumber).padStart(3, '0');
    const filename = `${paddedNumber}-${sanitizedTitle}.mp3`;
    
    // Upload stream directly to Google Drive (no local storage)
    // IMPORTANT: forward userId so cloudStorage can load the correct Drive config
    const uploadResult = await uploadStreamToDrive(response.data, filename, podcast, userId);
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    // Update episode with Drive info
    await Episode.findByIdAndUpdate(episode._id, {
      status: 'completed',
      downloaded: true,
      downloadDate: endTime,
      cloudFileId: uploadResult.fileId,
      cloudUrl: uploadResult.webViewLink,
      fileSize: uploadResult.size
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
