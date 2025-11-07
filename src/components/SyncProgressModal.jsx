import { CheckCircle, XCircle, Loader, Clock, X } from 'lucide-react';

function SyncProgressModal({ syncStatus, onClose }) {
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
            {!syncStatus.isRunning && onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
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

export default SyncProgressModal;
