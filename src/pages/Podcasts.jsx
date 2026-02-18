import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Trash2, Power, PowerOff, Edit, RotateCcw, RefreshCcw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPodcasts, createPodcast, deletePodcast, updatePodcast, refreshPodcast, resetPodcastCounter, startOverPodcast, rebuildPodcastMetadata, searchPodcasts } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function Podcasts() {
  const { t } = useTranslation();
  const { toasts, removeToast, toast } = useToast();
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState(null);
  const [savingPodcast, setSavingPodcast] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newPodcast, setNewPodcast] = useState({ name: '', rssUrl: '', driveFolderName: '', keepEpisodeCount: 10 });
  
  // Search mode states
  const [inputMode, setInputMode] = useState('manual'); // 'manual' or 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchTimeoutRef, setSearchTimeoutRef] = useState(null);
  
  useEffect(() => {
    fetchPodcasts();
  }, []);
  
  useEffect(() => {
    // Cleanup timeout on component unmount or modal close
    return () => {
      if (searchTimeoutRef) {
        clearTimeout(searchTimeoutRef);
      }
    };
  }, [searchTimeoutRef]);
  
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
    // Clear search timeout
    if (searchTimeoutRef) {
      clearTimeout(searchTimeoutRef);
      setSearchTimeoutRef(null);
    }
    
    setShowModal(false);
    setEditingPodcast(null);
    setNewPodcast({ name: '', rssUrl: '', driveFolderName: '', keepEpisodeCount: 10 });
    setInputMode('manual');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const response = await searchPodcasts(query.trim(), 10);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        toast.info(t('podcasts.messages.noSearchResults') || 'No podcasts found');
      }
    } catch (error) {
      toast.error(t('podcasts.messages.searchFailed') + ': ' + (error.response?.data?.error || error.message));
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInputChange = (query) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef) {
      clearTimeout(searchTimeoutRef);
    }
    
    // Clear results immediately if input is empty
    if (!query.trim()) {
      setSearchResults([]);
      setSearchTimeoutRef(null);
      return;
    }
    
    // Debounce search: wait 500ms after user stops typing
    const timeoutId = setTimeout(() => {
      handleSearch(query);
    }, 500);
    
    setSearchTimeoutRef(timeoutId);
  };

  const handleSelectSearchResult = (result) => {
    setNewPodcast({
      name: result.name,
      rssUrl: result.feedUrl,
      driveFolderName: result.name,
      keepEpisodeCount: 10
    });
    setInputMode('manual'); // Switch to manual mode to show the filled form
    setSearchResults([]);
    setSearchQuery('');
  };

  const openConfirmAction = (type, podcast) => {
    setConfirmAction({ type, podcast });
  };

  const closeConfirmAction = () => {
    if (actionLoading) return;
    setConfirmAction(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || actionLoading) return;
    const { type, podcast } = confirmAction;
    setActionLoading(true);
    try {
      if (type === 'delete') {
        await deletePodcast(podcast._id);
        toast.success(t('podcasts.messages.deleteSuccess', { name: podcast.name }));
        fetchPodcasts();
      }
      if (type === 'resetCounter') {
        await resetPodcastCounter(podcast._id);
        toast.success(t('podcasts.messages.resetCounterSuccess', { name: podcast.name }));
      }
      if (type === 'rebuildMetadata') {
        await rebuildPodcastMetadata(podcast._id);
        toast.success(t('podcasts.messages.rebuildMetadataSuccess', { name: podcast.name }));
      }
      if (type === 'startOver') {
        await startOverPodcast(podcast._id);
        toast.success(t('podcasts.messages.startOverSuccess', { name: podcast.name }));
      }
      setShowModal(false);
      setEditingPodcast(null);
      fetchPodcasts();
    } catch (error) {
      let errorMsg = t('podcasts.messages.startOverFailed');
      if (type === 'delete') {
        errorMsg = t('podcasts.messages.deleteFailed');
      }
      if (type === 'resetCounter') {
        errorMsg = t('podcasts.messages.resetCounterFailed');
      }
      if (type === 'rebuildMetadata') {
        errorMsg = t('podcasts.messages.rebuildMetadataFailed');
      }
      toast.error(errorMsg + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };
  
  const handleDelete = (id, name) => {
    openConfirmAction('delete', { _id: id, name });
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
  
  const rssChanged = editingPodcast && newPodcast.rssUrl !== editingPodcast.rssUrl;

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
            <Link to={`/podcasts/${podcast._id}`} className="block">
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
            </Link>
            
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefresh(podcast._id, podcast.name);
                }}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('podcasts.actions.refresh')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(podcast);
                }}
                className="btn btn-secondary flex items-center justify-center"
                title={t('common.edit')}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleEnabled(podcast);
                }}
                className={`btn ${podcast.enabled ? 'btn-primary' : 'bg-gray-400 text-white'} flex items-center justify-center`}
              >
                {podcast.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(podcast._id, podcast.name);
                }}
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingPodcast ? t('podcasts.editTitle') : t('podcasts.addNewTitle')}
            </h2>
            
            {/* Toggle between Manual and Search - only show when adding new */}
            {!editingPodcast && (
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('manual');
                    setSearchResults([]);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    inputMode === 'manual' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {t('podcasts.inputMode.manual') || 'Manual Entry'}
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('search')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    inputMode === 'search' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  {t('podcasts.inputMode.search') || 'Search'}
                </button>
              </div>
            )}

            {/* Search Mode */}
            {inputMode === 'search' && !editingPodcast && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('podcasts.search.label') || 'Search for a podcast'}
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    className="input w-full"
                    placeholder={t('podcasts.search.placeholder') || 'Enter podcast name...'}
                    disabled={searching}
                    autoFocus
                  />
                  {searching && (
                    <p className="text-xs text-gray-500 mt-2">{t('common.searching') || 'Searching...'}</p>
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => handleSelectSearchResult(result)}
                        className="w-full p-3 flex gap-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 text-left"
                      >
                        {result.thumbnailUrl && (
                          <img 
                            src={result.thumbnailUrl} 
                            alt={result.name}
                            className="w-16 h-16 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{result.name}</h4>
                          <p className="text-xs text-gray-600 truncate">{result.author}</p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500">
                            {result.genre && <span>{result.genre}</span>}
                            {result.episodeCount > 0 && (
                              <span>{result.episodeCount} {t('podcasts.fields.episodes') || 'episodes'}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={handleCloseModal} className="btn btn-secondary flex-1">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Manual Mode Form */}
            {inputMode === 'manual' && (
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
                    disabled={savingPodcast}
                  />
                  {editingPodcast && rssChanged && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('podcasts.help.rssUrlChangeWarning')}
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
              {editingPodcast && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('podcasts.advanced.title')}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => openConfirmAction('rebuildMetadata', editingPodcast)}
                      className="btn btn-secondary text-xs flex flex-col items-center justify-center gap-1 py-2 px-2"
                      disabled={savingPodcast || actionLoading}
                    >
                      <RefreshCcw className="w-4 h-4" />
                      <span className="text-center leading-tight">{t('podcasts.actions.rebuildMetadata')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfirmAction('resetCounter', editingPodcast)}
                      className="btn btn-secondary text-xs flex flex-col items-center justify-center gap-1 py-2 px-2"
                      disabled={savingPodcast || actionLoading}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="text-center leading-tight">{t('podcasts.actions.resetCounter')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfirmAction('startOver', editingPodcast)}
                      className="btn btn-danger text-xs flex flex-col items-center justify-center gap-1 py-2 px-2"
                      disabled={savingPodcast || actionLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-center leading-tight">{t('podcasts.actions.startOver')}</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">{t('podcasts.help.advancedActions')}</p>
                </div>
              )}
              </form>
            )}
          </div>
        </div>
      )}

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
          ? t('podcasts.messages.deleteConfirm', { name: confirmAction?.podcast?.name })
          : confirmAction?.type === 'resetCounter'
          ? t('podcasts.confirm.resetCounterMessage', { name: confirmAction?.podcast?.name })
          : confirmAction?.type === 'rebuildMetadata'
            ? t('podcasts.confirm.rebuildMetadataMessage', { name: confirmAction?.podcast?.name })
            : t('podcasts.confirm.startOverMessage', { name: confirmAction?.podcast?.name })
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

export default Podcasts;
