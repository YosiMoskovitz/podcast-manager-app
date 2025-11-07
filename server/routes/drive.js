import express from 'express';
import { getDriveClient, listFilesInFolder } from '../services/cloudStorage.js';
import multer from 'multer';
import { google } from 'googleapis';
import DriveCredentials from '../models/DriveCredentials.js';
import { initializeDrive } from '../services/cloudStorage.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get current Drive configuration status
router.get('/config', async (req, res) => {
  try {
    const config = await DriveCredentials.getConfig();
    
    res.json({
      hasCredentials: !!config.clientId,
      hasToken: !!config.accessToken,
      status: config.status,
      folderId: config.folderId,
      enabled: config.enabled,
      errorMessage: config.errorMessage,
      lastSync: config.lastSync
    });
  } catch (error) {
    logger.error('Error fetching Drive config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Upload OAuth2 credentials JSON file
router.post('/credentials', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const credentialsData = JSON.parse(req.file.buffer.toString());
    
    // Support both web and installed app credential formats
    const credentials = credentialsData.web || credentialsData.installed;
    
    if (!credentials || !credentials.client_id || !credentials.client_secret) {
      return res.status(400).json({ error: 'Invalid credentials file format' });
    }
    
    const config = await DriveCredentials.getConfig();
    
    // Store credentials
    config.clientId = credentials.client_id;
    config.clientSecret = credentials.client_secret;
    config.redirectUri = credentials.redirect_uris ? credentials.redirect_uris[0] : 'http://localhost:5000/api/drive/callback';
    config.credentialsJson = JSON.stringify(credentialsData);
    config.status = 'credentials_uploaded';
    
    await config.save();
    
    logger.info('Google Drive credentials uploaded successfully');
    
    res.json({ 
      message: 'Credentials uploaded successfully',
      status: config.status 
    });
  } catch (error) {
    logger.error('Error uploading credentials:', error);
    res.status(500).json({ error: 'Failed to upload credentials: ' + error.message });
  }
});

// Upload OAuth2 token JSON file (from OAuth playground or previous authorization)
router.post('/token', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const tokenData = JSON.parse(req.file.buffer.toString());
    
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Invalid token file format' });
    }
    
    const config = await DriveCredentials.getConfig();
    
    if (!config.clientId) {
      return res.status(400).json({ error: 'Please upload credentials first' });
    }
    
    // Store token
    config.accessToken = tokenData.access_token;
    config.refreshToken = tokenData.refresh_token;
    config.tokenExpiry = tokenData.expiry_date ? new Date(tokenData.expiry_date) : null;
    config.tokenJson = JSON.stringify(tokenData);
    config.status = 'active';
    config.enabled = true;
    
    await config.save();
    
    // Initialize Drive client
    await initializeDrive();
    
    logger.info('Google Drive token uploaded successfully');
    
    res.json({ 
      message: 'Token uploaded successfully. Google Drive is now active!',
      status: config.status 
    });
  } catch (error) {
    logger.error('Error uploading token:', error);
    res.status(500).json({ error: 'Failed to upload token: ' + error.message });
  }
});

// Get authorization URL
router.get('/auth-url', async (req, res) => {
  try {
    const config = await DriveCredentials.getConfig();
    
    if (!config.clientId || !config.clientSecret) {
      return res.status(400).json({ error: 'Please upload credentials file first' });
    }
    
    // Use frontend URL as redirect URI (works for both dev and production)
    const redirectUri = process.env.FRONTEND_URL || 'http://localhost:3000/settings';
    
    // Create temporary OAuth2 client for auth URL generation
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      redirectUri
    );
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    });
    
    // Store the redirect URI used
    config.redirectUri = redirectUri;
    config.status = 'needs_authorization';
    await config.save();
    
    res.json({ authUrl });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    logger.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate authorization URL',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Exchange authorization code for tokens (called from frontend)
router.post('/exchange-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }
    
    const config = await DriveCredentials.getConfig();
    
    if (!config.clientId || !config.clientSecret) {
      return res.status(400).json({ error: 'OAuth credentials not configured' });
    }
    
    // Create OAuth2 client with the redirect URI we used
    const redirectUri = config.redirectUri || (process.env.FRONTEND_URL || 'http://localhost:3000/settings');
    
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      redirectUri
    );
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens
    config.accessToken = tokens.access_token;
    config.refreshToken = tokens.refresh_token;
    config.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    config.tokenJson = JSON.stringify(tokens);
    config.status = 'active';
    config.enabled = true;
    
    await config.save();
    
    // Initialize Drive client
    await initializeDrive();
    
    logger.info('Google Drive authorized successfully via code exchange');
    
    res.json({ 
      message: 'Authorization successful',
      status: 'active'
    });
  } catch (error) {
    logger.error('Error exchanging code:', error);
    res.status(500).json({ error: 'Failed to exchange authorization code: ' + error.message });
  }
});

// Set Drive folder ID
router.post('/folder', async (req, res) => {
  try {
    const { folderId } = req.body;
    
    if (!folderId) {
      return res.status(400).json({ error: 'Folder ID is required' });
    }
    
    const config = await DriveCredentials.getConfig();
    config.folderId = folderId;
    await config.save();
    
    logger.info(`Google Drive folder ID set: ${folderId}`);
    
    res.json({ message: 'Folder ID updated successfully' });
  } catch (error) {
    logger.error('Error setting folder ID:', error);
    res.status(500).json({ error: 'Failed to set folder ID' });
  }
});

// Toggle Drive enabled/disabled
router.post('/toggle', async (req, res) => {
  try {
    const config = await DriveCredentials.getConfig();
    config.enabled = !config.enabled;
    await config.save();
    
    logger.info(`Google Drive ${config.enabled ? 'enabled' : 'disabled'}`);
    
    res.json({ 
      message: `Google Drive ${config.enabled ? 'enabled' : 'disabled'}`,
      enabled: config.enabled 
    });
  } catch (error) {
    logger.error('Error toggling Drive:', error);
    res.status(500).json({ error: 'Failed to toggle Drive' });
  }
});

// Test Drive connection
router.post('/test', async (req, res) => {
  try {
    const config = await DriveCredentials.getConfig();
    
    if (!config.accessToken) {
      return res.status(400).json({ error: 'Not authorized' });
    }
    
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Try to get user info
    const response = await drive.about.get({ fields: 'user' });
    
    config.status = 'active';
    config.lastSync = new Date();
    await config.save();
    
    res.json({ 
      message: 'Connection successful!',
      user: response.data.user.displayName
    });
  } catch (error) {
    logger.error('Drive connection test failed:', error);
    
    const config = await DriveCredentials.getConfig();
    config.status = 'error';
    config.errorMessage = error.message;
    await config.save();
    
    res.status(500).json({ error: 'Connection failed: ' + error.message });
  }
});

// Create or find "Podcasts" folder in Drive root
router.post('/create-folder', async (req, res) => {
  try {
    const config = await DriveCredentials.getConfig();
    
    if (!config.accessToken) {
      return res.status(400).json({ error: 'Not authorized' });
    }
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // First, check if "Podcasts" folder already exists in root
    const searchResponse = await drive.files.list({
      q: "name='Podcasts' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive'
    });
    
    let folderId, webViewLink, message, isNew;
    
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      // Folder already exists, use it
      const existingFolder = searchResponse.data.files[0];
      folderId = existingFolder.id;
      webViewLink = existingFolder.webViewLink;
      message = 'Found existing Podcasts folder';
      isNew = false;
      
      logger.info(`Using existing Podcasts folder: ${folderId}`);
    } else {
      // Create new "Podcasts" folder in root
      const folderMetadata = {
        name: 'Podcasts',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root']
      };
      
      const createResponse = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id, name, webViewLink'
      });
      
      folderId = createResponse.data.id;
      webViewLink = createResponse.data.webViewLink;
      message = 'Podcasts folder created successfully';
      isNew = true;
      
      logger.info(`Created new Podcasts folder: ${folderId}`);
    }
    
    // Save folder ID to config
    config.folderId = folderId;
    await config.save();
    
    res.json({ 
      message,
      folderId,
      folderName: 'Podcasts',
      webViewLink,
      isNew
    });
  } catch (error) {
    logger.error('Failed to create/find Podcasts folder:', error);
    res.status(500).json({ error: 'Failed to access folder: ' + error.message });
  }
});

// Reset Drive configuration
router.delete('/config', async (req, res) => {
  try {
    const config = await DriveCredentials.getConfig();
    
    config.clientId = null;
    config.clientSecret = null;
    config.redirectUri = null;
    config.accessToken = null;
    config.refreshToken = null;
    config.tokenExpiry = null;
    config.credentialsJson = null;
    config.tokenJson = null;
    config.folderId = null;
    config.enabled = false;
    config.status = 'not_configured';
    config.errorMessage = null;
    
    await config.save();
    
    logger.info('Google Drive configuration reset');
    
    res.json({ message: 'Configuration reset successfully' });
  } catch (error) {
    logger.error('Error resetting config:', error);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

// List folders in Google Drive (for folder browser)
router.get('/folders', async (req, res) => {
  try {
    const { parent = 'root' } = req.query;
    
    const config = await DriveCredentials.getConfig();
    
    if (!config.accessToken) {
      return res.status(400).json({ error: 'Not authorized' });
    }
    
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // List only folders
    const response = await drive.files.list({
      q: `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
      pageSize: 100,
      orderBy: 'name'
    });
    
    res.json({ folders: response.data.files || [] });
  } catch (error) {
    logger.error('Failed to list folders:', error);
    res.status(500).json({ error: 'Failed to list folders: ' + error.message });
  }
});

// Create a custom folder in Google Drive
router.post('/create-custom-folder', async (req, res) => {
  try {
    const { name, parentId = 'root' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    const config = await DriveCredentials.getConfig();
    
    if (!config.accessToken) {
      return res.status(400).json({ error: 'Not authorized' });
    }
    
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Create folder
    const folderMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };
    
    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name, webViewLink'
    });
    
    logger.info(`Created custom folder: ${name} (${response.data.id})`);
    
    res.json({
      message: 'Folder created successfully',
      folderId: response.data.id,
      folderName: response.data.name,
      webViewLink: response.data.webViewLink
    });
  } catch (error) {
    logger.error('Failed to create custom folder:', error);
    res.status(500).json({ error: 'Failed to create folder: ' + error.message });
  }
});

// Migrate main podcast folder to a new location
router.post('/migrate-folder', async (req, res) => {
  try {
    const { newFolderId } = req.body;
    
    if (!newFolderId) {
      return res.status(400).json({ error: 'New folder ID is required' });
    }
    
    const config = await DriveCredentials.getConfig();
    const oldFolderId = config.folderId;
    
    if (!config.accessToken) {
      return res.status(400).json({ error: 'Not authorized' });
    }
    
    if (!oldFolderId) {
      // No old folder, just set the new one
      config.folderId = newFolderId;
      await config.save();
      return res.json({ 
        message: 'Folder set successfully (no migration needed)',
        migrated: 0
      });
    }
    
    if (oldFolderId === newFolderId) {
      return res.status(400).json({ error: 'New folder is the same as the current folder' });
    }
    
    logger.info(`Starting migration from folder ${oldFolderId} to ${newFolderId}`);
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Verify new folder exists
    try {
      await drive.files.get({ 
        fileId: newFolderId, 
        fields: 'id, name, mimeType, trashed' 
      });
    } catch (error) {
      return res.status(400).json({ error: 'New folder not found or not accessible' });
    }
    
    // Get all podcast folders from old location
    const foldersResponse = await drive.files.list({
      q: `'${oldFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 100
    });
    
    const podcastFolders = foldersResponse.data.files || [];
    let migratedCount = 0;
    let errors = [];
    
    // Import models
    const Podcast = (await import('../models/Podcast.js')).default;
    
    // Move each podcast folder to new location
    for (const folder of podcastFolders) {
      try {
        // Move folder by updating its parent
        await drive.files.update({
          fileId: folder.id,
          addParents: newFolderId,
          removeParents: oldFolderId,
          fields: 'id, name, parents'
        });
        
        migratedCount++;
        logger.info(`Migrated folder: ${folder.name} (${folder.id})`);
        
        // Update podcast record to maintain the folder reference
        await Podcast.updateOne(
          { driveFolderId: folder.id },
          { driveFolderId: folder.id }
        );
      } catch (folderError) {
        logger.error(`Failed to migrate folder ${folder.name}:`, folderError);
        errors.push({ folder: folder.name, error: folderError.message });
      }
    }
    
    // Update config with new folder ID
    config.folderId = newFolderId;
    await config.save();
    
    logger.info(`Migration complete: ${migratedCount} folders migrated`);
    
    res.json({
      message: 'Folder migration completed',
      oldFolderId,
      newFolderId,
      migrated: migratedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error('Folder migration failed:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

// DIAGNOSTIC: List all files in Podcasts folder and subfolders
router.get('/diagnostic/files', async (req, res) => {
  try {
    const drive = getDriveClient();
    if (!drive) {
      return res.status(400).json({ error: 'Drive not initialized' });
    }

    const config = await DriveCredentials.getConfig();
    const mainFolderId = config.folderId;
    
    if (!mainFolderId) {
      return res.status(400).json({ error: 'No main folder ID configured' });
    }

    // Get main folder info
    const mainFolder = await drive.files.get({ 
      fileId: mainFolderId, 
      fields: 'id, name, webViewLink' 
    });

    // List all subfolders (podcast folders)
    const subfolders = await drive.files.list({
      q: `'${mainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 100
    });

    const structure = {
      mainFolder: {
        id: mainFolder.data.id,
        name: mainFolder.data.name,
        webViewLink: mainFolder.data.webViewLink
      },
      podcasts: []
    };

    // For each podcast folder, list files
    for (const folder of subfolders.data.files || []) {
      try {
        const files = await listFilesInFolder(folder.id);
        structure.podcasts.push({
          id: folder.id,
          name: folder.name,
          fileCount: files.length,
          files: files.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            mimeType: f.mimeType
          }))
        });
      } catch (error) {
        structure.podcasts.push({
          id: folder.id,
          name: folder.name,
          error: error.message
        });
      }
    }

    res.json(structure);
  } catch (error) {
    logger.error('Diagnostic failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
