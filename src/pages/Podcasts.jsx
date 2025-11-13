import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Power, PowerOff, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPodcasts, createPodcast, deletePodcast, updatePodcast, refreshPodcast } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

function Podcasts() {
  const { t } = useTranslation();
  const { toasts, removeToast, toast } = useToast();
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState(null);
  const [savingPodcast, setSavingPodcast] = useState(false);
  const [newPodcast, setNewPodcast] = useState({ name: '', rssUrl: '', driveFolderName: '', keepEpisodeCount: 10 });
  
  useEffect(() => {
    fetchPodcasts();
  }, []);
  
  const fetchPodcasts = async () => {
    try {
      const response = await getPodcasts();
      setPodcasts(response.data);
    } catch (error) {
      console.error('Failed to fetch podcasts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = async (e) => {
    e.preventDefault();
    if (savingPodcast) return;
    setSavingPodcast(true);
    try {
      if (editingPodcast) {
        await updatePodcast(editingPodcast._id, newPodcast);
        toast.success(t('podcasts.messages.updateSuccess'));
      } else {
        await createPodcast(newPodcast);
        toast.success(t('podcasts.messages.createSuccess'));
      }
      setShowModal(false);
      setEditingPodcast(null);
      setNewPodcast({ name: '', rssUrl: '', driveFolderName: '', keepEpisodeCount: 10 });
      fetchPodcasts();
    } catch (error) {
      const errorMsg = editingPodcast ? t('podcasts.messages.updateFailed') : t('podcasts.messages.createFailed');
      toast.error(errorMsg + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setSavingPodcast(false);
    }
  };

  const handleEdit = (podcast) => {
    setEditingPodcast(podcast);
    setNewPodcast({
      name: podcast.name,
      rssUrl: podcast.rssUrl,
      driveFolderName: podcast.driveFolderName,
      keepEpisodeCount: podcast.keepEpisodeCount
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPodcast(null);
    setNewPodcast({ name: '', rssUrl: '', driveFolderName: '', keepEpisodeCount: 10 });
  };
  
  const handleDelete = async (id, name) => {
    if (!window.confirm(t('podcasts.messages.deleteConfirm', { name }))) return;
    
    try {
      await deletePodcast(id);
      toast.success(t('podcasts.messages.deleteSuccess', { name }));
      fetchPodcasts();
    } catch (error) {
      toast.error(t('podcasts.messages.deleteFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleToggleEnabled = async (podcast) => {
    try {
      await updatePodcast(podcast._id, { enabled: !podcast.enabled });
      const status = !podcast.enabled ? t('podcasts.actions.enabled') : t('podcasts.actions.disabled');
      toast.success(t('podcasts.messages.toggleSuccess', { status }));
      fetchPodcasts();
    } catch (error) {
      toast.error(t('podcasts.messages.toggleFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleRefresh = async (id, name) => {
    try {
      const response = await refreshPodcast(id);
      toast.success(t('podcasts.messages.refreshSuccess', { name, count: response.data.newCount }));
      fetchPodcasts();
    } catch (error) {
      toast.error(t('podcasts.messages.refreshFailed') + ': ' + (error.response?.data?.error || error.message));
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }
  
  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t('podcasts.title')}</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          {t('podcasts.addNew')}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {podcasts.map(podcast => (
          <div key={podcast._id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4 mb-4">
              {podcast.imageUrl ? (
                <img src={podcast.imageUrl} alt={podcast.name} className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                  {t('podcasts.noImage')}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{podcast.name}</h3>
                <p className="text-sm text-gray-600 truncate">{podcast.author}</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-4 line-clamp-2">{podcast.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{t('podcasts.fields.episodes')}:</span>
                <span className="font-semibold">{podcast.totalEpisodes || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{t('podcasts.fields.downloaded')}:</span>
                <span className="font-semibold">{podcast.downloadedEpisodes || 0}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleRefresh(podcast._id, podcast.name)}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('podcasts.actions.refresh')}
              </button>
              <button
                onClick={() => handleEdit(podcast)}
                className="btn btn-secondary flex items-center justify-center"
                title={t('common.edit')}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleEnabled(podcast)}
                className={`btn ${podcast.enabled ? 'btn-primary' : 'bg-gray-400 text-white'} flex items-center justify-center`}
              >
                {podcast.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleDelete(podcast._id, podcast.name)}
                className="btn btn-danger flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {podcasts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">{t('podcasts.noPodcasts')}</p>
          <p className="text-sm">{t('podcasts.noPodcastsDescription')}</p>
        </div>
      )}
      
      {/* Add/Edit Podcast Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingPodcast ? t('podcasts.editTitle') : t('podcasts.addNewTitle')}
            </h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('podcasts.fields.name')}</label>
                  <input
                    type="text"
                    required
                    value={newPodcast.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setNewPodcast({ 
                        ...newPodcast, 
                        name,
                        // Auto-populate driveFolderName if it's empty or matches the old name
                        driveFolderName: !newPodcast.driveFolderName || newPodcast.driveFolderName === newPodcast.name 
                          ? name 
                          : newPodcast.driveFolderName
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
                    value={newPodcast.rssUrl}
                    onChange={(e) => setNewPodcast({ ...newPodcast, rssUrl: e.target.value })}
                    className="input"
                    placeholder={t('podcasts.placeholders.rssUrl')}
                    disabled={editingPodcast !== null || savingPodcast}
                  />
                  {editingPodcast && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('podcasts.help.rssUrlNoEdit')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('podcasts.fields.driveFolderName')}</label>
                  <input
                    type="text"
                    value={newPodcast.driveFolderName}
                    onChange={(e) => setNewPodcast({ ...newPodcast, driveFolderName: e.target.value })}
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
                    value={newPodcast.keepEpisodeCount}
                    onChange={(e) => setNewPodcast({ ...newPodcast, keepEpisodeCount: parseInt(e.target.value) })}
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
                  {savingPodcast ? (t('podcasts.actions.saving') || t('common.saving')) : (editingPodcast ? t('common.save') : t('podcasts.actions.create'))}
                </button>
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary flex-1" disabled={savingPodcast}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Podcasts;
