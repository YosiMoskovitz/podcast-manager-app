import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, RefreshCw, Shield, ShieldOff, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { downloadRssEpisode, getPodcastRssItems, protectEpisode, removeEpisodeFromDrive } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function PodcastManagement() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { toasts, removeToast, toast } = useToast();
  const [podcast, setPodcast] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeEpisodeData, setRemoveEpisodeData] = useState({ id: null, title: '' });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await getPodcastRssItems(id, { limit: 100 });
      setPodcast(response.data.podcast);
      setItems(response.data.items || []);
    } catch (error) {
      toast.error(t('podcastManagement.messages.loadFailed') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [id]);

  const handleManualDownload = async (guid, title) => {
    if (actionId) return;
    setActionId(guid);
    try {
      await downloadRssEpisode(id, guid);
      toast.success(t('podcastManagement.messages.downloadStarted', { title }));
      setTimeout(fetchItems, 2000);
    } catch (error) {
      toast.error(t('podcastManagement.messages.downloadFailed') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setActionId(null);
    }
  };

  const handleToggleProtect = async (episodeId, nextValue) => {
    if (actionId) return;
    setActionId(episodeId);
    try {
      await protectEpisode(episodeId, nextValue);
      toast.success(nextValue ? t('podcastManagement.messages.protected') : t('podcastManagement.messages.unprotected'));
      fetchItems();
    } catch (error) {
      toast.error(t('podcastManagement.messages.protectFailed') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = (episodeId, title) => {
    if (actionId) return;
    setRemoveEpisodeData({ id: episodeId, title });
    setShowRemoveConfirm(true);
  };

  const executeRemove = async () => {
    setShowRemoveConfirm(false);
    const { id: episodeId, title } = removeEpisodeData;
    setActionId(episodeId);
    try {
      await removeEpisodeFromDrive(episodeId);
      toast.success(t('podcastManagement.messages.removed', { title }));
      fetchItems();
    } catch (error) {
      toast.error(t('podcastManagement.messages.removeFailed') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setActionId(null);
    }
  };

  const getStatus = (item) => {
    if (!item.system) return 'new';
    if (item.system.removedFromSystem) return 'removed';
    return item.system.status || 'pending';
  };

  const statusStyles = useMemo(() => ({
    new: 'bg-gray-100 text-gray-700',
    pending: 'bg-gray-100 text-gray-700',
    downloading: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    removed: 'bg-amber-100 text-amber-800'
  }), []);

  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/podcasts" className="btn btn-secondary">
            {t('podcastManagement.backToPodcasts')}
          </Link>
          <h1 className="text-3xl font-bold">{t('podcastManagement.title')}</h1>
        </div>
        <button onClick={fetchItems} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('podcastManagement.actions.reload')}
        </button>
      </div>

      {podcast && (
        <div className="card mb-8">
          <div className="flex items-start gap-4">
            {podcast.imageUrl ? (
              <img src={podcast.imageUrl} alt={podcast.name} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                {t('podcasts.noImage')}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{podcast.name}</h2>
              <p className="text-sm text-gray-600 truncate">{podcast.author}</p>
              <p className="text-sm text-gray-500">{podcast.description}</p>
            </div>
            <div className="text-sm text-gray-600 text-right">
              <p>{t('podcasts.fields.keepEpisodeCount')}: <span className="font-semibold">{podcast.keepEpisodeCount}</span></p>
              <p>{t('podcasts.fields.downloaded')}: <span className="font-semibold">{podcast.downloadedEpisodes || 0}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map(item => {
          const status = getStatus(item);
          const system = item.system;
          const isProtected = Boolean(system?.protectedFromCleanup);
          const hasDriveFile = Boolean(system?.cloudFileId);

          return (
            <div key={item.rss.guid} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                {item.rss.imageUrl ? (
                  <img src={item.rss.imageUrl} alt={item.rss.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0">
                    {t('podcasts.noImage')}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg mb-1 truncate">{item.rss.title}</h3>
                      <p className="text-sm text-gray-500">
                        {item.rss.pubDate ? new Date(item.rss.pubDate).toLocaleDateString() : t('episodes.unknown')}
                        {item.rss.duration ? ` • ${item.rss.duration}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusStyles[status] || statusStyles.pending}`}>
                        {t(`podcastManagement.status.${status}`)}
                      </span>
                      {isProtected && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
                          {t('podcastManagement.status.protected')}
                        </span>
                      )}
                      {system && (
                        <button
                          onClick={() => handleToggleProtect(system.id, !isProtected)}
                          className="btn btn-secondary flex items-center gap-2"
                        >
                          {isProtected ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                          {isProtected ? t('podcastManagement.actions.unprotect') : t('podcastManagement.actions.protect')}
                        </button>
                      )}
                      {hasDriveFile && system && (
                        <button
                          onClick={() => handleRemove(system.id, item.rss.title)}
                          className="btn btn-danger flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('podcastManagement.actions.removeFromDrive')}
                        </button>
                      )}
                      <button
                        onClick={() => handleManualDownload(item.rss.guid, item.rss.title)}
                        className="btn btn-primary flex items-center gap-2"
                        disabled={actionId === item.rss.guid}
                      >
                        <Download className="w-4 h-4" />
                        {t('podcastManagement.actions.download')}
                      </button>
                    </div>
                  </div>

                  {item.rss.description && (
                    <p className="text-sm text-gray-700 line-clamp-2 mt-2">
                      {item.rss.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">{t('podcastManagement.empty.title')}</p>
          <p className="text-sm">{t('podcastManagement.empty.description')}</p>
        </div>
      )}

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={executeRemove}
        title={t('podcastManagement.confirm.removeFromDrive.title') || 'Remove from Drive'}
        message={t('podcastManagement.confirm.removeFromDrive', { title: removeEpisodeData.title })}
        confirmText={t('podcastManagement.confirm.removeFromDrive.confirm') || 'Remove'}
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={Trash2}
        iconColor="text-red-600"
      />
    </div>
  );
}

export default PodcastManagement;
