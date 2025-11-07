import { X, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { useState } from 'react';

function VerificationModal({ verificationResult, onClose, onResync }) {
  const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
  const [resyncing, setResyncing] = useState(false);

  if (!verificationResult) return null;

  const { totalMissing, totalExtra, podcasts } = verificationResult;

  const podcastsWithIssues = podcasts.filter(
    p => p.summary.missingCount > 0 || p.summary.extraCount > 0
  );

  const allMissingEpisodes = podcasts.flatMap(p => p.missingInDrive);

  const toggleEpisode = (episodeId) => {
    const newSet = new Set(selectedEpisodes);
    if (newSet.has(episodeId)) {
      newSet.delete(episodeId);
    } else {
      newSet.add(episodeId);
    }
    setSelectedEpisodes(newSet);
  };

  const toggleAllMissing = () => {
    if (selectedEpisodes.size === allMissingEpisodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(allMissingEpisodes.map(e => e.id)));
    }
  };

  const handleResync = async () => {
    if (selectedEpisodes.size === 0) return;
    setResyncing(true);
    try {
      await onResync(Array.from(selectedEpisodes));
      setSelectedEpisodes(new Set());
    } finally {
      setResyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              {totalMissing > 0 ? (
                <>
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
                  File Verification Results
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  All Files Synced
                </>
              )}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {totalMissing > 0
                ? `Found ${totalMissing} episode(s) missing from Drive`
                : 'All episodes are synced to Google Drive'}
              {totalExtra > 0 && ` • ${totalExtra} extra file(s) in Drive`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {totalMissing === 0 && totalExtra === 0 ? (
          <div className="text-center py-8 text-green-600">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg font-semibold">Everything is in sync!</p>
          </div>
        ) : (
          <>
            {totalMissing > 0 && (
              <div className="mb-4 flex gap-3">
                <button
                  onClick={toggleAllMissing}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {selectedEpisodes.size === allMissingEpisodes.length
                    ? 'Deselect All'
                    : 'Select All Missing'}
                </button>
                <button
                  onClick={handleResync}
                  disabled={selectedEpisodes.size === 0 || resyncing}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${resyncing ? 'animate-spin' : ''}`} />
                  {resyncing
                    ? 'Re-syncing...'
                    : `Re-sync Selected (${selectedEpisodes.size})`}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto border rounded-lg">
              <div className="divide-y">
                {podcastsWithIssues.map((podcast) => (
                  <div key={podcast.podcastId} className="p-4">
                    <h3 className="font-bold text-lg mb-2">{podcast.name}</h3>
                    
                    {podcast.warning && (
                      <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                        ⚠️ {podcast.warning}
                      </div>
                    )}
                    {podcast.error && (
                      <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        ❌ {podcast.error}
                      </div>
                    )}
                    
                    {podcast.missingInDrive.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-red-600 mb-2">
                          Missing from Drive ({podcast.missingInDrive.length}):
                        </h4>
                        <div className="space-y-1">
                          {podcast.missingInDrive.map((ep) => (
                            <label
                              key={ep.id}
                              className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedEpisodes.has(ep.id)}
                                onChange={() => toggleEpisode(ep.id)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {ep.title}
                                </div>
                                {ep.cloudFileId && (
                                  <div className="text-xs text-gray-500">
                                    File ID: {ep.cloudFileId}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {podcast.extraOnDrive.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-blue-600 mb-2">
                          Extra files in Drive ({podcast.extraOnDrive.length}):
                        </h4>
                        <div className="space-y-1">
                          {podcast.extraOnDrive.map((file) => (
                            <div
                              key={file.id}
                              className="text-sm p-2 bg-blue-50 rounded"
                            >
                              {file.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerificationModal;
