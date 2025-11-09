import express from 'express';
import syncStatus from '../services/syncStatus.js';
import { logger } from '../utils/logger.js';
import { verifyDriveConsistency, resyncEpisodesByIds } from '../services/verifier.js';

const router = express.Router();

// Get current sync status
router.get('/status', (req, res) => {
  try {
    const status = syncStatus.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// Verify DB vs Drive files
router.post('/verify', async (req, res) => {
  try {
    const result = await verifyDriveConsistency(req.user.id);
    res.json(result);
  } catch (error) {
    logger.error('Error verifying files:', error);
    res.status(500).json({ error: error.message || 'Failed to verify files' });
  }
});

// Re-sync specific episodes
router.post('/resync', async (req, res) => {
  try {
    const { episodeIds } = req.body || {};
    if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
      return res.status(400).json({ error: 'episodeIds array is required' });
    }
    const result = await resyncEpisodesByIds(episodeIds);
    res.json(result);
  } catch (error) {
    logger.error('Error resyncing episodes:', error);
    res.status(500).json({ error: error.message || 'Failed to re-sync episodes' });
  }
});

export default router;
