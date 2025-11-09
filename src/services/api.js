import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// Export a normalized base URL without trailing slash for use in direct fetches
export const API_BASE = API_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Send cookies with requests for authentication
});

// Podcasts
export const getPodcasts = () => api.get('/podcasts');
export const getPodcast = (id) => api.get(`/podcasts/${id}`);
export const createPodcast = (data) => api.post('/podcasts', data);
export const updatePodcast = (id, data) => api.put(`/podcasts/${id}`, data);
export const deletePodcast = (id) => api.delete(`/podcasts/${id}`);
export const refreshPodcast = (id) => api.post(`/podcasts/${id}/refresh`);

// Episodes
export const getEpisodes = (params) => api.get('/episodes', { params });
export const getEpisode = (id) => api.get(`/episodes/${id}`);
export const downloadEpisode = (id) => api.post(`/episodes/${id}/download`);
export const deleteEpisode = (id) => api.delete(`/episodes/${id}`);
export const clearAllEpisodes = () => api.delete('/episodes/clear-all/confirm');

// Statistics
export const getCurrentStats = () => api.get('/stats/current');
export const getStatsHistory = (days) => api.get(`/stats/history?days=${days}`);
export const getDownloadHistory = (params) => api.get('/stats/downloads', { params });
export const getPodcastStats = () => api.get('/stats/podcasts');

// System
export const triggerManualCheck = () => api.post('/check-now');
export const getHealth = () => api.get('/health');

// Google Drive
export const getDriveConfig = () => api.get('/drive/config');
export const uploadCredentials = (formData) => api.post('/drive/credentials', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const uploadToken = (formData) => api.post('/drive/token', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getAuthUrl = () => api.get('/drive/auth-url');
export const setFolderId = (data) => api.post('/drive/folder', data);
export const toggleDrive = () => api.post('/drive/toggle');
export const testConnection = () => api.post('/drive/test');
export const resetDriveConfig = () => api.delete('/drive/config');
export const createPodcastsFolder = () => api.post('/drive/create-folder');
export const migratePodcastFolder = (newFolderId) => api.post('/drive/migrate-folder', { newFolderId });

// System Settings
export const getSystemSettings = () => api.get('/settings');
export const updateSystemSettings = (settings) => api.put('/settings', settings);

// Import/Export
export const exportPodcasts = () => api.get('/data/export', { responseType: 'blob' });
export const importPodcasts = (formData) => api.post('/data/import', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Sync Status
export const getSyncStatus = () => api.get('/sync/status');
export const verifyFiles = () => api.post('/sync/verify');
export const resyncEpisodes = (episodeIds) => api.post('/sync/resync', { episodeIds });
export const resyncEpisode = (id) => api.post(`/episodes/${id}/resync`);

export default api;
