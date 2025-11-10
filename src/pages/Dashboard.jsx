import { useEffect, useState, useRef } from 'react';
import { Radio, Download, CheckCircle, XCircle, RefreshCw, HardDrive, Cloud, AlertTriangle, FileSearch } from 'lucide-react';
import { getCurrentStats, triggerManualCheck, getDriveConfig, getSyncStatus, verifyFiles, resyncEpisodes } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import SyncProgressModal from '../components/SyncProgressModal';
import VerificationModal from '../components/VerificationModal';

function Dashboard() {
  const { toasts, removeToast, toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [driveStatus, setDriveStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
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
      toast.warning('Sync is already in progress');
      return;
    }
    
    setChecking(true);
    try {
      await triggerManualCheck();
      toast.success('Manual check started!');
      // Optimistically show modal while backend starts
      setSyncStatus(prev => prev || { isRunning: true, progress: { total: 0, processed: 0, succeeded: 0, failed: 0, podcasts: [] }, startTime: new Date().toISOString() });
      // Start polling for progress regardless of immediate status
      const startTime = Date.now();
      if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
      pollInterval.current = setInterval(async () => {
        try {
          const statusResponse = await getSyncStatus();
          setSyncStatus(statusResponse.data);
          if (!statusResponse.data.isRunning && (statusResponse.data.progress?.podcasts?.length || Date.now() - startTime > 30000)) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
            fetchStats();
          }
        } catch {}
      }, 1000);
    } catch (error) {
      console.error('Failed to trigger check:', error);
      const errorMsg = error.response?.data?.error || error.message;
      if (errorMsg.includes('already running')) {
        toast.warning('Sync is already in progress');
      } else {
        toast.error('Failed to start manual check: ' + errorMsg);
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
        toast.warning(`Found ${result.data.totalMissing} episode(s) missing from Drive`);
      } else {
        toast.success('All files are synced!');
      }
    } catch (error) {
      console.error('Failed to verify files:', error);
      toast.error('Failed to verify files: ' + (error.response?.data?.error || error.message));
    } finally {
      setVerifying(false);
    }
  };

  const handleResyncEpisodes = async (episodeIds) => {
    try {
      await resyncEpisodes(episodeIds);
      toast.success(`Re-sync started for ${episodeIds.length} episode(s)`);
      setVerificationResult(null);
      // Wait a bit then re-check
      setTimeout(() => {
        fetchStats();
      }, 2000);
    } catch (error) {
      toast.error('Failed to re-sync: ' + (error.response?.data?.error || error.message));
      throw error;
    }
  };

  // Handler used by SyncProgressModal to request a bulk retry
  const handleBulkRetryRequest = async (episodeIds) => {
    try {
      if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
        toast.warning('No failed episodes selected for retry');
        return;
      }
      const result = await resyncEpisodes(episodeIds);
      const count = result.data?.startedCount ?? episodeIds.length;
      toast.success(`Re-sync started for ${count} episode(s)`);
      // Trigger stats refresh
      fetchStats();
      return result.data;
    } catch (error) {
      toast.error('Failed to start bulk re-sync: ' + (error.response?.data?.error || error.message));
      throw error;
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-3">
          <button 
            onClick={handleVerifyFiles}
            disabled={verifying}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <FileSearch className={`w-5 h-5 ${verifying ? 'animate-pulse' : ''}`} />
            {verifying ? 'Verifying...' : 'Verify Files'}
          </button>
          <button 
            onClick={handleManualCheck}
            disabled={checking || syncStatus?.isRunning}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${(checking || syncStatus?.isRunning) ? 'animate-spin' : ''}`} />
            {syncStatus?.isRunning ? 'Syncing...' : checking ? 'Starting...' : 'Check Now'}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Radio}
          label="Total Podcasts"
          value={stats?.totalPodcasts || 0}
          subtitle={`${stats?.activePodcasts || 0} active`}
          color="text-primary"
        />
        <StatCard
          icon={Download}
          label="Total Episodes"
          value={stats?.totalEpisodes || 0}
          subtitle={`${stats?.downloadedEpisodes || 0} downloaded`}
          color="text-blue-500"
        />
        <StatCard
          icon={CheckCircle}
          label="Downloads Today"
          value={stats?.downloadsToday || 0}
          subtitle={`${stats?.pendingDownloads || 0} pending`}
          color="text-green-500"
        />
        <StatCard
          icon={HardDrive}
          label="Storage Used"
          value={formatBytes(stats?.totalStorageUsed)}
          subtitle={`${stats?.failedDownloads || 0} failed`}
          color="text-purple-500"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Quick Stats</h2>
          <div className="space-y-3">
            <StatRow label="Active Podcasts" value={stats?.activePodcasts} total={stats?.totalPodcasts} />
            <StatRow label="Downloaded Episodes" value={stats?.downloadedEpisodes} total={stats?.totalEpisodes} />
            <StatRow label="Success Rate" value={stats?.totalEpisodes - (stats?.failedDownloads || 0)} total={stats?.totalEpisodes} />
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="font-medium">Backend</span>
              <span className="text-green-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Online
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="font-medium">Database</span>
              <span className="text-blue-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Connected
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
                    <Cloud className="w-4 h-4" /> Connected
                  </span>
                ) : driveStatus.status === 'not_configured' ? (
                  <a href="/settings" className="text-gray-600 hover:text-gray-800 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Not Configured
                  </a>
                ) : (
                  <a href="/settings" className="text-yellow-600 hover:text-yellow-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {driveStatus.status === 'needs_authorization' ? 'Needs Auth' : 'Error'}
                  </a>
                )}
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Last Updated</span>
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
