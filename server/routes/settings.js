import express from 'express';
import SystemSettings from '../models/SystemSettings.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get system settings
router.get('/', async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json(settings);
  } catch (error) {
    logger.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

// Update system settings
router.put('/', async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    
    // Update allowed fields
    const allowedFields = [
      'maxEpisodesPerCheck',
      'maxConcurrentDownloads',
      'checkIntervalHours',
      'defaultKeepEpisodeCount'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });
    
    await settings.save();
    
    logger.info('System settings updated');
    res.json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    logger.error('Error updating system settings:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

export default router;
