import { useEffect, useState } from 'react';
import { Download, CheckCircle, XCircle, Clock, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getEpisodes, downloadEpisode, removeEpisodeFromDrive, resyncEpisode } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function Episodes() {
  const { t } = useTranslation();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeEpisodeData, setRemoveEpisodeData] = useState({ id: null, title: '' });
  const { toasts, removeToast, toast } = useToast();
  
  useEffect(() => {
    fetchEpisodes();
  }, [filter]);
  
  const fetchEpisodes = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await getEpisodes(params);
      setEpisodes(response.data);
    } catch (error) {
      console.error('Failed to fetch episodes:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDownload = async (id, title) => {
    try {
      await downloadEpisode(id);
      toast.success(t('episodes.messages.downloadStarted', { title }));
      setTimeout(fetchEpisodes, 2000);
    } catch (error) {
      toast.error(t('episodes.messages.downloadFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const handleResync = async (id, title) => {
    try {
      await resyncEpisode(id);
      toast.success(t('episodes.messages.resyncStarted', { title }));
      setTimeout(fetchEpisodes, 2000);
    } catch (error) {
      toast.error(t('episodes.messages.resyncFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemove = (id, title) => {
    setRemoveEpisodeData({ id, title });
    setShowRemoveConfirm(true);
  };

  const executeRemove = async () => {
    setShowRemoveConfirm(false);
    const { id, title } = removeEpisodeData;
    try {
      await removeEpisodeFromDrive(id);
      toast.success(t('episodes.messages.removed', { title }));
      setTimeout(fetchEpisodes, 1000);
    } catch (error) {
      toast.error(t('episodes.messages.removeFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };
  
  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'bg-gray-100 text-gray-700', icon: Clock },
      downloading: { color: 'bg-blue-100 text-blue-700', icon: Download },
      completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-700', icon: XCircle }
    };
    
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {t(`episodes.status.${status}`)}
      </span>
    );
  };

  const getRemovedBadge = () => (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
      {t('episodes.status.removed')}
    </span>
  );

  const getProtectedBadge = () => (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
      <Shield className="w-4 h-4" />
      {t('episodes.status.protected')}
    </span>
  );
  
  const formatDate = (dateString) => {
    if (!dateString) return t('episodes.unknown');
    return new Date(dateString).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  const formatDuration = (duration) => {
    if (!duration) return '';
    return duration;
  };
  
  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }
  
  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t('episodes.title')}</h1>
        
        <div className="flex gap-2">
          {['all', 'pending', 'completed', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`btn ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
            >
              {t(`episodes.filters.${status}`)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-4">
        {episodes.map(episode => (
          <div key={episode._id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              {episode.podcast?.imageUrl && (
                <img 
                  src={episode.podcast.imageUrl} 
                  alt={episode.podcast.name} 
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0" 
                />
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg mb-1 truncate">{episode.title}</h3>
                    <p className="text-sm text-gray-600 mb-1">{episode.podcast?.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(episode.pubDate)} 
                      {episode.duration && ` • ${formatDuration(episode.duration)}`}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {episode.removedFromSystem && getRemovedBadge()}
                    {episode.protectedFromCleanup && getProtectedBadge()}
                    {getStatusBadge(episode.status)}
                    {episode.status === 'pending' && (
                      <button
                        onClick={() => handleDownload(episode._id, episode.title)}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {t('episodes.actions.download')}
                      </button>
                    )}
                    {(episode.downloaded && !episode.cloudFileId) && (
                      <button
                        onClick={() => handleResync(episode._id, episode.title)}
                        className="btn btn-secondary flex items-center gap-2"
                        title={t('episodes.titles.resync')}
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('episodes.actions.resync')}
                      </button>
                    )}

                    {episode.cloudFileId && (
                      <button
                        onClick={() => handleRemove(episode._id, episode.title)}
                        className="btn btn-danger flex items-center gap-2"
                        title={t('episodes.titles.removeFromDrive')}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('episodes.actions.removeFromDrive')}
                      </button>
                    )}

                    {episode.status === 'failed' && (
                      <button
                        onClick={() => handleResync(episode._id, episode.title)}
                        className="btn btn-secondary flex items-center gap-2"
                        title={t('episodes.titles.retry')}
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('episodes.actions.retry')}
                      </button>
                    )}
                  </div>
                </div>
                
                {episode.description && (
                  <p className="text-sm text-gray-700 line-clamp-2 mt-2">
                    {episode.description}
                  </p>
                )}
                
                {episode.errorMessage && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {t('episodes.error')}: {episode.errorMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {episodes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">{t('episodes.noEpisodes')}</p>
          <p className="text-sm">{t('episodes.noEpisodesDescription')}</p>
        </div>
      )}

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={executeRemove}
        title={t('episodes.confirm.removeFromDrive.title') || 'Remove from Drive'}
        message={t('episodes.confirm.removeFromDrive', { title: removeEpisodeData.title })}
        confirmText={t('episodes.confirm.removeFromDrive.confirm') || 'Remove'}
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={Trash2}
        iconColor="text-red-600"
      />
    </div>
  );
}

export default Episodes;
