import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

class SyncStatusTracker extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.phase = null; // 'discovery' or 'download'
    this.currentPodcast = null;
    this.currentEpisode = null;
    this.progress = {
      // Discovery phase
      totalPodcasts: 0,
      podcastsChecked: 0,
      podcastsSucceeded: 0,
      podcastsFailed: 0,
      podcasts: [],
      
      // Download phase
      totalEpisodes: 0,
      episodesDownloaded: 0,
      episodesSucceeded: 0,
      episodesFailed: 0,
      episodes: []
    };
    this.startTime = null;
    this.discoveryEndTime = null;
  }

  startSync(totalPodcasts) {
    if (this.isRunning) {
      throw new Error('Sync is already running');
    }
    
    this.isRunning = true;
    this.phase = 'discovery';
    this.startTime = new Date();
    this.discoveryEndTime = null;
    this.progress = {
      totalPodcasts,
      podcastsChecked: 0,
      podcastsSucceeded: 0,
      podcastsFailed: 0,
      podcasts: [],
      totalEpisodes: 0,
      episodesDownloaded: 0,
      episodesSucceeded: 0,
      episodesFailed: 0,
      episodes: []
    };
    
    this.emit('sync-started', this.getStatus());
    logger.info('Sync started - discovery phase');
  }

  updatePodcast(podcastName, status, newEpisodes = 0, error = null) {
    if (!this.isRunning || this.phase !== 'discovery') return;
    
    this.currentPodcast = podcastName;
    this.progress.podcastsChecked++;
    
    const podcastStatus = {
      name: podcastName,
      status,
      newEpisodes,
      error,
      timestamp: new Date()
    };
    
    this.progress.podcasts.push(podcastStatus);
    
    if (status === 'success') {
      this.progress.podcastsSucceeded++;
      this.progress.totalEpisodes += newEpisodes;
    } else if (status === 'failed') {
      this.progress.podcastsFailed++;
    }
    
    this.emit('podcast-updated', this.getStatus());
    logger.info(`Podcast ${podcastName}: ${status}${newEpisodes ? ` (${newEpisodes} new episodes)` : ''}`);
  }

  startDownloadPhase(totalEpisodes) {
    if (!this.isRunning) return;
    
    this.phase = 'download';
    this.discoveryEndTime = new Date();
    this.progress.totalEpisodes = totalEpisodes;
    
    this.emit('download-phase-started', this.getStatus());
    logger.info(`Discovery complete. Starting download phase - ${totalEpisodes} episodes to download`);
  }

  updateEpisode(episodeTitle, podcastName, status, error = null) {
    if (!this.isRunning || this.phase !== 'download') return;
    
    this.currentEpisode = episodeTitle;
    this.currentPodcast = podcastName;
    this.progress.episodesDownloaded++;
    
    const episodeStatus = {
      title: episodeTitle,
      podcast: podcastName,
      status,
      error,
      timestamp: new Date()
    };
    
    this.progress.episodes.push(episodeStatus);
    
    if (status === 'success') {
      this.progress.episodesSucceeded++;
    } else if (status === 'failed') {
      this.progress.episodesFailed++;
    }
    
    this.emit('episode-updated', this.getStatus());
    logger.info(`Episode ${episodeTitle} (${podcastName}): ${status}`);
  }


  endSync() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.phase = null;
    this.currentPodcast = null;
    this.currentEpisode = null;
    const duration = new Date() - this.startTime;
    
    this.emit('sync-completed', { ...this.getStatus(), duration });
    logger.info(`Sync completed in ${Math.round(duration / 1000)}s`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      phase: this.phase,
      currentPodcast: this.currentPodcast,
      currentEpisode: this.currentEpisode,
      progress: { ...this.progress },
      startTime: this.startTime,
      discoveryEndTime: this.discoveryEndTime
    };
  }

  canStartSync() {
    return !this.isRunning;
  }
}

// Singleton instance
const syncStatus = new SyncStatusTracker();

export default syncStatus;
