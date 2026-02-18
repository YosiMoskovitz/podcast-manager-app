import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Shield, ShieldOff, Trash2, Edit, Power, PowerOff, RotateCcw, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { downloadRssEpisode, getPodcastRssItems, protectEpisode, removeEpisodeFromDrive, updatePodcast, deletePodcast, resetPodcastCounter, rebuildPodcastMetadata, startOverPodcast, refreshPodcast } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function PodcastManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toasts, removeToast, toast } = useToast();
  const [podcast, setPodcast] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeEpisodeData, setRemoveEpisodeData] = useState({ id: null, title: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', rssUrl: '', driveFolderName: '', keepEpisodeCount: 10 });
  const [savingPodcast, setSavingPodcast] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [advancedActionLoading, setAdvancedActionLoading] = useState(false);

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

  const handleEdit = () => {
    if (!podcast) return;
    setEditForm({
      name: podcast.name,
      rssUrl: podcast.rssUrl,
      driveFolderName: podcast.driveFolderName,
      keepEpisodeCount: podcast.keepEpisodeCount
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (savingPodcast) return;
    setSavingPodcast(true);
    try {
      await updatePodcast(id, editForm);
      toast.success(t('podcasts.messages.updateSuccess'));
      setShowEditModal(false);
      fetchItems();
    } catch (error) {
      toast.error(t('podcasts.messages.updateFailed') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setSavingPodcast(false);
    }
  };

  const handleDelete = () => {
    setConfirmAction({ type: 'delete', podcast: { _id: id, name: podcast?.name } });
  };

  const handleToggleEnabled = async () => {
    if (!podcast) return;
    try {
      await updatePodcast(id, { enabled: !podcast.enabled });
      const status = !podcast.enabled ? t('podcasts.actions.enabled') : t('podcasts.actions.disabled');
      toast.success(t('podcasts.messages.toggleSuccess', { status }));
      fetchItems();
    } catch (error) {
      toast.error(t('podcasts.messages.toggleFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRefreshPodcast = async () => {
    if (!podcast) return;
    try {
      const response = await refreshPodcast(id);
      toast.success(t('podcasts.messages.refreshSuccess', { name: podcast.name, count: response.data.newCount }));
      fetchItems();
    } catch (error) {
      toast.error(t('podcasts.messages.refreshFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const openConfirmAction = (type) => {
    setConfirmAction({ type, podcast: { _id: id, name: podcast?.name } });
  };

  const closeConfirmAction = () => {
    if (advancedActionLoading) return;
    setConfirmAction(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || advancedActionLoading) return;
    const { type } = confirmAction;
    setAdvancedActionLoading(true);
    try {
      if (type === 'delete') {
        await deletePodcast(id);
        toast.success(t('podcasts.messages.deleteSuccess', { name: podcast?.name }));
        navigate('/podcasts');
        return;
      }
      if (type === 'resetCounter') {
        await resetPodcastCounter(id);
        toast.success(t('podcasts.messages.resetCounterSuccess', { name: podcast?.name }));
      }
      if (type === 'rebuildMetadata') {
        await rebuildPodcastMetadata(id);
        toast.success(t('podcasts.messages.rebuildMetadataSuccess', { name: podcast?.name }));
      }
      if (type === 'startOver') {
        await startOverPodcast(id);
        toast.success(t('podcasts.messages.startOverSuccess', { name: podcast?.name }));
      }
      fetchItems();
    } catch (error) {
      let errorMsg = t('podcasts.messages.startOverFailed');
      if (type === 'delete') errorMsg = t('podcasts.messages.deleteFailed');
      if (type === 'resetCounter') errorMsg = t('podcasts.messages.resetCounterFailed');
      if (type === 'rebuildMetadata') errorMsg = t('podcasts.messages.rebuildMetadataFailed');
      toast.error(errorMsg + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setAdvancedActionLoading(false);
      setConfirmAction(null);
    }
  };

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
        <button 
          onClick={fetchItems} 
          className="btn btn-secondary flex items-center gap-2"
        >
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
          
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <button
              onClick={handleRefreshPodcast}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t('podcasts.actions.refresh')}
            </button>
            <button
              onClick={handleEdit}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              {t('common.edit')}
            </button>
            <button
              onClick={handleToggleEnabled}
              className={`btn ${podcast.enabled ? 'btn-primary' : 'bg-gray-400 text-white'} flex items-center gap-2`}
            >
              {podcast.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              {podcast.enabled ? t('podcasts.actions.disable') : t('podcasts.actions.enable')}
            </button>
            <button
              onClick={handleDelete}
              className="btn btn-danger flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('common.delete')}
            </button>
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
        title={t('podcastManagement.actions.removeFromDrive') || 'Remove from Drive'}
        message={t('podcastManagement.confirm.removeFromDrive', { title: removeEpisodeData.title })}
        confirmText={t('common.delete') || 'Remove'}
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={Trash2}
        iconColor="text-red-600"
      />

      {/* Edit Podcast Modal */}
      {showEditModal && podcast && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{t('podcasts.editTitle')}</h2>
            <form onSubmit={handleSaveEdit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('podcasts.fields.name')}</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setEditForm({ 
                        ...editForm, 
                        name,
                        driveFolderName: !editForm.driveFolderName || editForm.driveFolderName === editForm.name 
                          ? name 
                          : editForm.driveFolderName
                      });
                    }}
                    className="input"
                    placeholder={t('podcasts.placeholders.name')}
                    disabled={savingPodcast}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('podcasts.fields.rssUrl')}</label>
                  <input
                    type="url"
                    required
                    value={editForm.rssUrl}
                    onChange={(e) => setEditForm({ ...editForm, rssUrl: e.target.value })}
                    className="input"
                    placeholder={t('podcasts.placeholders.rssUrl')}
                    disabled={savingPodcast}
                  />
                  {editForm.rssUrl !== podcast.rssUrl && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('podcasts.help.rssUrlChangeWarning')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('podcasts.fields.driveFolderName')}</label>
                  <input
                    type="text"
                    value={editForm.driveFolderName}
                    onChange={(e) => setEditForm({ ...editForm, driveFolderName: e.target.value })}
                    className="input"
                    placeholder={t('podcasts.placeholders.driveFolderName')}
                    disabled={savingPodcast}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('podcasts.help.driveFolderName')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('podcasts.fields.keepEpisodeCount')}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.keepEpisodeCount}
                    onChange={(e) => setEditForm({ ...editForm, keepEpisodeCount: parseInt(e.target.value) })}
                    className="input"
                    disabled={savingPodcast}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600">
                      {t('podcasts.help.keepEpisodeCount')}
                    </p>
                    <p className="text-xs font-medium text-blue-600" dangerouslySetInnerHTML={{ __html: t('podcasts.help.keepEpisodeCountTip') }} />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button type="submit" className="btn btn-primary flex-1" disabled={savingPodcast}>
                  {savingPodcast ? (t('podcasts.actions.saving') || t('common.saving')) : t('common.save')}
                </button>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1" disabled={savingPodcast}>
                  {t('common.cancel')}
                </button>
              </div>
              
              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('podcasts.advanced.title')}</h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      openConfirmAction('rebuildMetadata');
                    }}
                    className="btn btn-secondary text-xs flex flex-col items-center justify-center gap-1 py-2 px-2"
                    disabled={savingPodcast || advancedActionLoading}
                  >
                    <RefreshCcw className="w-4 h-4" />
                    <span className="text-center leading-tight">{t('podcasts.actions.rebuildMetadata')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      openConfirmAction('resetCounter');
                    }}
                    className="btn btn-secondary text-xs flex flex-col items-center justify-center gap-1 py-2 px-2"
                    disabled={savingPodcast || advancedActionLoading}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="text-center leading-tight">{t('podcasts.actions.resetCounter')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      openConfirmAction('startOver');
                    }}
                    className="btn btn-danger text-xs flex flex-col items-center justify-center gap-1 py-2 px-2"
                    disabled={savingPodcast || advancedActionLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-center leading-tight">{t('podcasts.actions.startOver')}</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">{t('podcasts.help.advancedActions')}</p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={closeConfirmAction}
        onConfirm={handleConfirmAction}
        title={confirmAction?.type === 'delete'
          ? 'Delete Podcast'
          : confirmAction?.type === 'resetCounter'
          ? t('podcasts.confirm.resetCounterTitle')
          : confirmAction?.type === 'rebuildMetadata'
            ? t('podcasts.confirm.rebuildMetadataTitle')
            : t('podcasts.confirm.startOverTitle')
        }
        message={confirmAction?.type === 'delete'
          ? t('podcasts.messages.deleteConfirm', { name: podcast?.name })
          : confirmAction?.type === 'resetCounter'
          ? t('podcasts.confirm.resetCounterMessage', { name: podcast?.name })
          : confirmAction?.type === 'rebuildMetadata'
            ? t('podcasts.confirm.rebuildMetadataMessage', { name: podcast?.name })
            : t('podcasts.confirm.startOverMessage', { name: podcast?.name })
        }
        confirmText={confirmAction?.type === 'delete'
          ? t('common.delete') || 'Delete'
          : confirmAction?.type === 'resetCounter'
          ? t('podcasts.actions.resetCounter')
          : confirmAction?.type === 'rebuildMetadata'
            ? t('podcasts.actions.rebuildMetadata')
            : t('podcasts.actions.startOver')
        }
        cancelText={t('common.cancel')}
        confirmButtonClass={confirmAction?.type === 'delete' || confirmAction?.type === 'startOver' ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'}
        icon={confirmAction?.type === 'delete' ? Trash2 : undefined}
        iconColor={confirmAction?.type === 'delete' ? 'text-red-600' : undefined}
      />
    </div>
  );
}

export default PodcastManagement;
