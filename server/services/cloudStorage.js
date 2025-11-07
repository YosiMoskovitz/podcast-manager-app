import { google } from 'googleapis';
import { logger } from '../utils/logger.js';
import DriveCredentials from '../models/DriveCredentials.js';
import Episode from '../models/Episode.js';

let driveClient = null;
let oauth2Client = null;

export function getDriveClient() {
  return driveClient;
}

export async function initializeDrive() {
  try {
    const config = await DriveCredentials.getConfig();
    if (!config.clientId || !config.clientSecret) {
      logger.warn('Google Drive credentials not configured. Upload disabled.');
      return null;
    }
    if (!config.accessToken) {
      logger.warn('Google Drive not authorized. Please authorize the app.');
      return null;
    }
    oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri || 'http://localhost:5000/api/drive/callback');
    oauth2Client.setCredentials({ access_token: config.accessToken, refresh_token: config.refreshToken, expiry_date: config.tokenExpiry ? config.tokenExpiry.getTime() : null });
    oauth2Client.on('tokens', async (tokens) => {
      logger.info('Google Drive tokens refreshed');
      if (tokens.access_token) config.accessToken = tokens.access_token;
      if (tokens.refresh_token) config.refreshToken = tokens.refresh_token;
      if (tokens.expiry_date) config.tokenExpiry = new Date(tokens.expiry_date);
      await config.save();
    });
    driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    config.status = 'active';
    config.lastSync = new Date();
    await config.save();
    logger.info('Google Drive client initialized with OAuth2');
    return driveClient;
  } catch (error) {
    logger.error('Failed to initialize Google Drive:', error);
    return null;
  }
}

export async function createFolder(folderName, parentFolderId) {
  if (!driveClient) return null;
  try {
    const response = await driveClient.files.create({ requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: parentFolderId ? [parentFolderId] : [] }, fields: 'id, name' });
    logger.info('Created folder: ' + folderName + ' (' + response.data.id + ')');
    return response.data.id;
  } catch (error) {
    logger.error('Failed to create folder ' + folderName + ':', error);
    throw error;
  }
}

export async function getOrCreatePodcastFolder(podcastName, mainFolderId) {
  if (!driveClient) throw new Error('Drive client not initialized');
  try {
    // Search for existing folder with podcast name in the main Podcasts folder
    const searchResponse = await driveClient.files.list({
      q: `name='${podcastName.replace(/'/g, "\\'")}'  and mimeType='application/vnd.google-apps.folder' and '${mainFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      // Folder exists, return its ID
      const folderId = searchResponse.data.files[0].id;
      logger.info(`Using existing folder for podcast "${podcastName}": ${folderId}`);
      return folderId;
    } else {
      // Create new folder
      const response = await driveClient.files.create({
        requestBody: {
          name: podcastName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mainFolderId]
        },
        fields: 'id, name'
      });
      const folderId = response.data.id;
      logger.info(`Created new folder for podcast "${podcastName}": ${folderId}`);
      return folderId;
    }
  } catch (error) {
    logger.error(`Failed to get/create folder for podcast "${podcastName}":`, error);
    throw error;
  }
}

async function verifyFolderExists(folderId) {
  if (!driveClient) return false;
  try {
    await driveClient.files.get({ fileId: folderId, fields: 'id, name, trashed' });
    return true;
  } catch (error) {
    if (error.code === 404) {
      return false;
    }
    throw error;
  }
}

export async function uploadStreamToDrive(stream, filename, podcast) {
  if (!driveClient) throw new Error('Drive client not initialized. Please configure Google Drive in Settings.');
  try {
    const config = await DriveCredentials.getConfig();
    const mainFolderId = config.folderId;
    if (!mainFolderId) throw new Error('No Google Drive folder ID configured');
    
    // Get or create podcast-specific folder
    let podcastFolderId = podcast.driveFolderId;
    
    // If we have a folder ID, verify it still exists in Drive
    if (podcastFolderId) {
      const folderExists = await verifyFolderExists(podcastFolderId);
      if (!folderExists) {
        logger.warn(`Podcast folder ${podcastFolderId} for "${podcast.name}" no longer exists in Drive. Creating new folder.`);
        podcastFolderId = null; // Force recreation
      }
    }
    
    // If no folder ID or folder doesn't exist, get or create it
    if (!podcastFolderId) {
      podcastFolderId = await getOrCreatePodcastFolder(podcast.name, mainFolderId);
      // Update podcast with folder ID
      podcast.driveFolderId = podcastFolderId;
      await podcast.save();
    }
    
    logger.info('Streaming to Google Drive: ' + filename + ' -> ' + podcast.name + ' (folder: ' + podcastFolderId + ')');
    const response = await driveClient.files.create({ 
      requestBody: { name: filename, parents: [podcastFolderId] }, 
      media: { mimeType: 'audio/mpeg', body: stream }, 
      fields: 'id, name, webViewLink, size' 
    });
    logger.info('Stream upload successful: ' + filename + ' (' + response.data.id + ')');
    return { fileId: response.data.id, webViewLink: response.data.webViewLink };
  } catch (error) {
    logger.error('Stream upload failed for ' + filename + ':', error);
    throw error;
  }
}

export async function listFilesInFolder(folderId) {
  if (!driveClient) throw new Error('Drive client not initialized');
  try {
    const files = [];
    let pageToken = null;
    do {
      const resp = await driveClient.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, size, mimeType)',
        spaces: 'drive',
        pageSize: 1000,
        pageToken,
      });
      files.push(...(resp.data.files || []));
      pageToken = resp.data.nextPageToken || null;
    } while (pageToken);
    return files;
  } catch (error) {
    logger.error('Failed to list files for folder ' + folderId + ':', error);
    throw error;
  }
}

export async function deleteFile(fileId) {
  if (!driveClient) return;
  try {
    await driveClient.files.delete({ fileId });
    logger.info('Deleted file from Drive: ' + fileId);
  } catch (error) {
    logger.error('Failed to delete file ' + fileId + ':', error);
    throw error;
  }
}

export async function cleanupOldEpisodes(podcast, keepCount) {
  try {
    const episodes = await Episode.find({ podcast: podcast._id, cloudFileId: { $exists: true, $ne: null } }).sort({ pubDate: -1 }).skip(keepCount);
    for (const episode of episodes) {
      if (episode.cloudFileId) {
        await deleteFile(episode.cloudFileId);
        await Episode.findByIdAndUpdate(episode._id, { cloudFileId: null, cloudUrl: null });
      }
    }
    logger.info('Cleaned up ' + episodes.length + ' old episodes for ' + podcast.name);
  } catch (error) {
    logger.error('Failed to cleanup old episodes for ' + podcast.name + ':', error);
  }
}
