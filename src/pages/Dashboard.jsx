import { useEffect, useState, useRef } from 'react';
import { Radio, Download, CheckCircle, XCircle, RefreshCw, HardDrive, Cloud, AlertTriangle, FileSearch, AlertCircle, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentStats, triggerManualCheck, getDriveConfig, getSyncStatus, verifyFiles, resyncEpisodes, getEpisodes } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import SyncProgressModal from '../components/SyncProgressModal';
import VerificationModal from '../components/VerificationModal';

function Dashboard() {
  const { t } = useTranslation();
  const { toasts, removeToast, toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [driveStatus, setDriveStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [failedEpisodes, setFailedEpisodes] = useState([]);
  const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
  const pollInterval = useRef(null);
  
  useEffect(() => {
    fetchStats();
    fetchDriveStatus();
    checkSyncStatus();
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);
  
  const fetchStats = async () => {
    try {
      const response = await getCurrentStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDriveStatus = async () => {
    try {
      const response = await getDriveConfig();
      setDriveStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch Drive status:', error);
    }
  };
  
  const checkSyncStatus = async () => {
    try {
      const response = await getSyncStatus();
      setSyncStatus(response.data);
      
      // If sync is running, start polling
      if (response.data.isRunning && !pollInterval.current) {
        const seenRunning = { current: false };
        pollInterval.current = setInterval(async () => {
          const statusResponse = await getSyncStatus();
          setSyncStatus(statusResponse.data);
          if (statusResponse.data.isRunning) {
            seenRunning.current = true;
          }
          
          // Stop polling when sync completes (and we saw it running at least once)
          if (!statusResponse.data.isRunning && (seenRunning.current || statusResponse.data.progress?.podcasts?.length)) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
            fetchStats(); // Refresh stats
          }
        }, 1000); // Poll every second
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };
  
  const handleManualCheck = async () => {
    // Check if sync is already running
    if (syncStatus?.isRunning) {
      toast.warning(t('dashboard.sync.alreadyRunning'));
      return;
    }
    
    setChecking(true);
    try {
      await triggerManualCheck();
      toast.success(t('dashboard.sync.started'));
      // Optimistically show modal while backend starts
      setSyncStatus({ 
        isRunning: true, 
        phase: 'discovery',
        progress: { 
          totalPodcasts: 0, 
          podcastsChecked: 0, 
          podcastsSucceeded: 0, 
          podcastsFailed: 0, 
          podcasts: [],
          totalEpisodes: 0,
          episodesDownloaded: 0,
          episodesSucceeded: 0,
          episodesFailed: 0,
          episodes: []
        }, 
        startTime: new Date().toISOString() 
      });
      // Start polling for progress regardless of immediate status
      const startTime = Date.now();
      if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
      pollInterval.current = setInterval(async () => {
        try {
          const statusResponse = await getSyncStatus();
          setSyncStatus(statusResponse.data);
          // Keep polling until sync is done AND we have progress data, or timeout after 30s
          if (!statusResponse.data.isRunning && (statusResponse.data.progress?.podcasts?.length || Date.now() - startTime > 30000)) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
            fetchStats();
            // Modal will stay open because we have progress data
          }
        } catch {}
      }, 1000);
    } catch (error) {
      console.error('Failed to trigger check:', error);
      const errorMsg = error.response?.data?.error || error.message;
      if (errorMsg.includes('already running')) {
        toast.warning(t('dashboard.sync.alreadyRunning'));
      } else {
        toast.error(t('dashboard.sync.failed') + ': ' + errorMsg);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleVerifyFiles = async () => {
    setVerifying(true);
    try {
      const result = await verifyFiles();
      setVerificationResult(result.data);
      if (result.data.totalMissing > 0) {
        toast.warning(t('dashboard.verification.missingFiles', { count: result.data.totalMissing }));
      } else {
        toast.success(t('dashboard.verification.allSynced'));
      }
    } catch (error) {
      console.error('Failed to verify files:', error);
      toast.error(t('dashboard.verification.failed') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setVerifying(false);
    }
  };

  const handleResyncEpisodes = async (episodeIds) => {
    try {
      await resyncEpisodes(episodeIds);
      toast.success(t('dashboard.messages.resyncStarted', { count: episodeIds.length }));
      setVerificationResult(null);
      // Wait a bit then re-check
      setTimeout(() => {
        fetchStats();
      }, 2000);
    } catch (error) {
      toast.error(t('dashboard.messages.resyncFailed') + ': ' + (error.response?.data?.error || error.message));
      throw error;
    }
  };

  // Handler used by SyncProgressModal to request a bulk retry
  const handleBulkRetryRequest = async (episodeIds) => {
    try {
      if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
        toast.warning(t('dashboard.messages.noFailedEpisodesSelected'));
        return;
      }
      const result = await resyncEpisodes(episodeIds);
      const count = result.data?.startedCount ?? episodeIds.length;
      toast.success(t('dashboard.messages.resyncStarted', { count }));
      // Trigger stats refresh
      fetchStats();
      return result.data;
    } catch (error) {
      toast.error(t('dashboard.messages.bulkResyncFailed') + ': ' + (error.response?.data?.error || error.message));
      throw error;
    }
  };

  // Open retry dialog and fetch failed episodes
  const openRetryDialog = async () => {
    setShowRetryDialog(true);
    setRetryingFailed(true);
    try {
      const response = await getEpisodes({ status: 'failed', limit: 1000 });
      const episodes = response.data || [];
      setFailedEpisodes(episodes);
      setSelectedEpisodes(new Set(episodes.map(e => e._id)));
    } catch (error) {
      console.error('Failed to load failed episodes:', error);
      toast.error(t('dashboard.messages.loadFailedEpisodesFailed'));
      setFailedEpisodes([]);
      setSelectedEpisodes(new Set());
    } finally {
      setRetryingFailed(false);
    }
  };

  // Toggle episode selection
  const toggleEpisodeSelection = (episodeId) => {
    setSelectedEpisodes(prev => {
      const updated = new Set(prev);
      if (updated.has(episodeId)) {
        updated.delete(episodeId);
      } else {
        updated.add(episodeId);
      }
      return updated;
    });
  };

  // Retry selected failed episodes
  const retrySelectedEpisodes = async () => {
    const episodeIds = Array.from(selectedEpisodes);
    if (episodeIds.length === 0) {
      toast.warning(t('dashboard.messages.noEpisodesSelected'));
      return;
    }
    setRetryingFailed(true);
    try {
      await resyncEpisodes(episodeIds);
      toast.success(t('dashboard.messages.resyncStarted', { count: episodeIds.length }));
      setShowRetryDialog(false);
      fetchStats();
    } catch (error) {
      toast.error(t('dashboard.messages.retryFailed') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setRetryingFailed(false);
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }
  
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <SyncProgressModal 
        syncStatus={syncStatus} 
        onClose={() => setSyncStatus(null)}
        onBulkRetryRequest={handleBulkRetryRequest}
      />
      <VerificationModal
        verificationResult={verificationResult}
        onClose={() => setVerificationResult(null)}
        onResync={handleResyncEpisodes}
      />
      
      {/* Retry Failed Episodes Dialog */}
      {showRetryDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{t('dashboard.retry.title')}</h2>
              <button 
                onClick={() => setShowRetryDialog(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              {t('dashboard.retry.description')}
            </p>
            
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => setSelectedEpisodes(new Set(failedEpisodes.map(e => e._id)))}
                className="btn btn-sm btn-secondary"
              >
                {t('dashboard.actions.selectAll')}
              </button>
              <button 
                onClick={() => setSelectedEpisodes(new Set())}
                className="btn btn-sm btn-secondary"
              >
                {t('dashboard.actions.clearAll')}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto border rounded-lg mb-4">
              {retryingFailed && failedEpisodes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
                  {t('dashboard.retry.loading')}
                </div>
              ) : failedEpisodes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  {t('dashboard.retry.noFailed')}
                </div>
              ) : (
                <div className="divide-y">
                  {failedEpisodes.map((episode) => (
                    <label 
                      key={episode._id} 
                      className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedEpisodes.has(episode._id)}
                        onChange={() => toggleEpisodeSelection(episode._id)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{episode.title}</div>
                        <div className="text-sm text-gray-500">
                          {episode.podcast?.name} • {new Date(episode.pubDate).toLocaleDateString()}
                        </div>
                        {episode.errorMessage && (
                          <div className="text-xs text-red-600 mt-1">{episode.errorMessage}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {t('dashboard.retry.selected', { count: selectedEpisodes.size, total: failedEpisodes.length })}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowRetryDialog(false)}
                  className="btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  onClick={retrySelectedEpisodes}
                  disabled={retryingFailed || selectedEpisodes.size === 0}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {retryingFailed ? t('dashboard.actions.starting') : `${t('dashboard.actions.retrySelected')} (${selectedEpisodes.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <div className="flex gap-3">
          {stats?.failedDownloads > 0 && (
            <button 
              onClick={openRetryDialog}
              disabled={retryingFailed}
              className="btn bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2 disabled:opacity-50"
            >
              <AlertCircle className="w-5 h-5" />
              {t('dashboard.actions.retryFailed')} ({stats.failedDownloads})
            </button>
          )}
          <button 
            onClick={handleVerifyFiles}
            disabled={verifying}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <FileSearch className={`w-5 h-5 ${verifying ? 'animate-pulse' : ''}`} />
            {verifying ? t('dashboard.actions.verifying') : t('dashboard.actions.verifyFiles')}
          </button>
          <button 
            onClick={handleManualCheck}
            disabled={checking || syncStatus?.isRunning}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${(checking || syncStatus?.isRunning) ? 'animate-spin' : ''}`} />
            {syncStatus?.isRunning ? t('dashboard.sync.inProgress') : checking ? t('dashboard.actions.checking') : t('dashboard.actions.checkNow')}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Radio}
          label={t('dashboard.stats.activePodcasts')}
          value={stats?.totalPodcasts || 0}
          subtitle={`${stats?.activePodcasts || 0} ${t('podcasts.status.active')}`}
          color="text-primary"
        />
        <StatCard
          icon={Download}
          label={t('dashboard.stats.totalEpisodes')}
          value={stats?.totalEpisodes || 0}
          subtitle={`${stats?.downloadedEpisodes || 0} ${t('dashboard.stats.downloaded')}`}
          color="text-blue-500"
        />
        <StatCard
          icon={CheckCircle}
          label={t('dashboard.stats.downloadsToday')}
          value={stats?.downloadsToday || 0}
          subtitle={`${stats?.pendingDownloads || 0} ${t('dashboard.stats.pending')}`}
          color="text-green-500"
        />
        <StatCard
          icon={HardDrive}
          label={t('dashboard.stats.storageUsed')}
          value={formatBytes(stats?.totalStorageUsed)}
          subtitle={`${stats?.failedDownloads || 0} ${t('dashboard.stats.failed')}`}
          color="text-purple-500"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">{t('dashboard.stats.quickStats')}</h2>
          <div className="space-y-3">
            <StatRow label={t('dashboard.stats.activePodcasts')} value={stats?.activePodcasts} total={stats?.totalPodcasts} />
            <StatRow label={t('dashboard.stats.downloadedEpisodes')} value={stats?.downloadedEpisodes} total={stats?.totalEpisodes} />
            <StatRow label={t('dashboard.stats.successRate')} value={stats?.totalEpisodes - (stats?.failedDownloads || 0)} total={stats?.totalEpisodes} />
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold mb-4">{t('dashboard.stats.systemStatus')}</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="font-medium">{t('dashboard.stats.backend')}</span>
              <span className="text-green-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {t('dashboard.stats.online')}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="font-medium">{t('dashboard.stats.database')}</span>
              <span className="text-blue-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {t('dashboard.drive.connected')}
              </span>
            </div>
            {driveStatus && (
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                driveStatus.status === 'active' 
                  ? 'bg-green-50' 
                  : driveStatus.status === 'not_configured'
                  ? 'bg-gray-50'
                  : 'bg-yellow-50'
              }`}>
                <span className="font-medium">Google Drive</span>
                {driveStatus.status === 'active' ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> {t('dashboard.drive.connected')}
                  </span>
                ) : driveStatus.status === 'not_configured' ? (
                  <a href="/settings" className="text-gray-600 hover:text-gray-800 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> {t('dashboard.drive.notConnected')}
                  </a>
                ) : (
                  <a href="/settings" className="text-yellow-600 hover:text-yellow-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {driveStatus.status === 'needs_authorization' ? t('dashboard.drive.needsAuth') : t('dashboard.drive.error')}
                  </a>
                )}
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">{t('dashboard.stats.lastUpdated')}</span>
              <span className="text-gray-600 text-sm">
                {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtitle, color }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm mb-1">{label}</p>
          <p className="text-3xl font-bold mb-1">{value}</p>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <Icon className={`w-10 h-10 ${color} opacity-80`} />
      </div>
    </div>
  );
}

function StatRow({ label, value, total }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-gray-600">{value} / {total}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default Dashboard;
