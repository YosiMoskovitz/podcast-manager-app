import { CheckCircle, XCircle, Loader, Clock, X, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getEpisodes } from '../services/api';

function SyncProgressModal({ syncStatus, onClose, onBulkRetryRequest }) {
  // Show modal if sync is running OR if there's recent progress data
  if (!syncStatus || (!syncStatus.isRunning && !syncStatus.progress?.podcasts?.length)) return null;

  const { progress, currentPodcast, startTime } = syncStatus;
  const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  
  const elapsed = startTime ? Math.round((new Date() - new Date(startTime)) / 1000) : 0;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">
              {syncStatus.isRunning ? 'Syncing Podcasts' : 'Sync Complete'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {syncStatus.isRunning ? 'Processing' : 'Processed'} {progress.processed} of {progress.total} podcasts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              {elapsed}s
            </div>
            {!syncStatus.isRunning && (
              <div className="flex items-center gap-2">
                {/* Retry failed episodes button */}
                {progress.failed > 0 && (
                  <RetryButton progress={progress} onClose={onClose} onBulkRetryRequest={onBulkRetryRequest} />
                )}
                {onClose && (
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Progress</span>
            <span className="text-gray-600">{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-primary h-3 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        
        {/* Current Podcast */}
        {currentPodcast && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-900">Processing: {currentPodcast}</span>
          </div>
        )}
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{progress.succeeded}</div>
            <div className="text-xs text-green-700">Succeeded</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
            <div className="text-xs text-red-700">Failed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{progress.total - progress.processed}</div>
            <div className="text-xs text-gray-700">Remaining</div>
          </div>
        </div>
        
        {/* Podcast List */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          <div className="divide-y max-h-64">
            {progress.podcasts.slice().reverse().map((podcast, index) => (
              <div key={index} className="p-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{podcast.name}</div>
                  {podcast.newEpisodes > 0 && (
                    <div className="text-xs text-gray-500">
                      {podcast.newEpisodes} new episode{podcast.newEpisodes > 1 ? 's' : ''}
                    </div>
                  )}
                  {podcast.error && (
                    <div className="text-xs text-red-600 truncate">{podcast.error}</div>
                  )}
                </div>
                <div className="ml-3 flex-shrink-0">
                  {podcast.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RetryButton({ progress, onClose, onBulkRetryRequest }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedEpisodes, setFailedEpisodes] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!isDialogOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await getEpisodes({ status: 'failed', limit: 1000 });
        if (cancelled) return;
        setFailedEpisodes(resp.data || []);
        setSelected(new Set((resp.data || []).map(e => e._id)));
      } catch (err) {
        console.error('Failed to load failed episodes:', err);
        setFailedEpisodes([]);
        setSelected(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDialogOpen]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id); else copy.add(id);
      return copy;
    });
  };

  const selectAll = () => setSelected(new Set(failedEpisodes.map(e => e._id)));
  const clearAll = () => setSelected(new Set());

  const handleConfirm = async () => {
    const ids = Array.from(selected);
    setLoading(true);
    try {
      // Delegate actual resync request to parent (so Dashboard can show toasts and refresh stats)
      if (onBulkRetryRequest) {
        await onBulkRetryRequest(ids);
      }
      setIsDialogOpen(false);
      if (onClose) onClose();
    } catch (err) {
      console.error('Bulk retry failed:', err);
      // Parent will show toast; keep dialog open for retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setIsDialogOpen(true)}
        className="btn btn-secondary flex items-center gap-2"
        title="Retry failed episode downloads"
      >
        <RefreshCw className="w-4 h-4" />
        {`Retry Failed (${progress.failed})`}
      </button>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow p-4 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Retry Failed Episodes</h3>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="btn btn-sm">Select All</button>
                <button onClick={clearAll} className="btn btn-sm">Clear</button>
                <button onClick={() => setIsDialogOpen(false)} className="text-gray-500 hover:text-gray-700">Close</button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {loading && <div className="text-sm text-gray-500">Loading failed episodes...</div>}
              {!loading && failedEpisodes.length === 0 && (
                <div className="text-sm text-gray-500">No failed episodes found.</div>
              )}
              {!loading && failedEpisodes.map(ep => (
                <label key={ep._id} className="flex items-center gap-3 p-2 border rounded">
                  <input type="checkbox" checked={selected.has(ep._id)} onChange={() => toggleSelect(ep._id)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ep.title}</div>
                    <div className="text-xs text-gray-500 truncate">{ep.podcast?.name} • {new Date(ep.pubDate).toLocaleDateString()}</div>
                    {ep.errorMessage && <div className="text-xs text-red-600 truncate">{ep.errorMessage}</div>}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setIsDialogOpen(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleConfirm} disabled={loading || selected.size === 0} className="btn btn-primary">
                {loading ? 'Starting...' : `Retry Selected (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyncProgressModal;
