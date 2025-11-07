import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

class SyncStatusTracker extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.currentPodcast = null;
    this.progress = {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      podcasts: []
    };
    this.startTime = null;
  }

  startSync(totalPodcasts) {
    if (this.isRunning) {
      throw new Error('Sync is already running');
    }
    
    this.isRunning = true;
    this.startTime = new Date();
    this.progress = {
      total: totalPodcasts,
      processed: 0,
      succeeded: 0,
      failed: 0,
      podcasts: []
    };
    
    this.emit('sync-started', this.getStatus());
    logger.info('Sync started');
  }

  updatePodcast(podcastName, status, newEpisodes = 0, error = null) {
    if (!this.isRunning) return;
    
    this.currentPodcast = podcastName;
    this.progress.processed++;
    
    const podcastStatus = {
      name: podcastName,
      status,
      newEpisodes,
      error,
      timestamp: new Date()
    };
    
    this.progress.podcasts.push(podcastStatus);
    
    if (status === 'success') {
      this.progress.succeeded++;
    } else if (status === 'failed') {
      this.progress.failed++;
    }
    
    this.emit('podcast-updated', this.getStatus());
    logger.info(`Podcast ${podcastName}: ${status}${newEpisodes ? ` (${newEpisodes} new episodes)` : ''}`);
  }

  endSync() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.currentPodcast = null;
    const duration = new Date() - this.startTime;
    
    this.emit('sync-completed', { ...this.getStatus(), duration });
    logger.info(`Sync completed in ${Math.round(duration / 1000)}s`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentPodcast: this.currentPodcast,
      progress: { ...this.progress },
      startTime: this.startTime
    };
  }

  canStartSync() {
    return !this.isRunning;
  }
}

// Singleton instance
const syncStatus = new SyncStatusTracker();

export default syncStatus;
