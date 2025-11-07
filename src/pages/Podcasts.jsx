import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Power, PowerOff } from 'lucide-react';
import { getPodcasts, createPodcast, deletePodcast, updatePodcast, refreshPodcast } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

function Podcasts() {
  const { toasts, removeToast, toast } = useToast();
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPodcast, setNewPodcast] = useState({ name: '', rssUrl: '', keepEpisodeCount: 10 });
  
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
    try {
      await createPodcast(newPodcast);
      setShowModal(false);
      setNewPodcast({ name: '', rssUrl: '', keepEpisodeCount: 10 });
      toast.success('Podcast created successfully');
      fetchPodcasts();
    } catch (error) {
      toast.error('Failed to create podcast: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete podcast "${name}"? This will also delete all episodes.`)) return;
    
    try {
      await deletePodcast(id);
      toast.success(`Deleted podcast "${name}"`);
      fetchPodcasts();
    } catch (error) {
      toast.error('Failed to delete podcast: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleToggleEnabled = async (podcast) => {
    try {
      await updatePodcast(podcast._id, { enabled: !podcast.enabled });
      toast.success(`Podcast ${!podcast.enabled ? 'enabled' : 'disabled'}`);
      fetchPodcasts();
    } catch (error) {
      toast.error('Failed to update podcast: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleRefresh = async (id, name) => {
    try {
      const response = await refreshPodcast(id);
      toast.success(`Refreshed "${name}": ${response.data.newCount} new episodes found`);
      fetchPodcasts();
    } catch (error) {
      toast.error('Failed to refresh podcast: ' + (error.response?.data?.error || error.message));
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }
  
  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Podcasts</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Podcast
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
                  No Image
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{podcast.name}</h3>
                <p className="text-sm text-gray-600 truncate">{podcast.author}</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-4 line-clamp-2">{podcast.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-gray-600">Episodes:</span>
                <span className="font-semibold ml-2">{podcast.totalEpisodes || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">Downloaded:</span>
                <span className="font-semibold ml-2">{podcast.downloadedEpisodes || 0}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleRefresh(podcast._id, podcast.name)}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
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
          <p className="text-lg mb-2">No podcasts yet</p>
          <p className="text-sm">Click "Add Podcast" to get started</p>
        </div>
      )}
      
      {/* Add Podcast Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Add New Podcast</h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Podcast Name</label>
                  <input
                    type="text"
                    required
                    value={newPodcast.name}
                    onChange={(e) => setNewPodcast({ ...newPodcast, name: e.target.value })}
                    className="input"
                    placeholder="My Favorite Podcast"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RSS Feed URL</label>
                  <input
                    type="url"
                    required
                    value={newPodcast.rssUrl}
                    onChange={(e) => setNewPodcast({ ...newPodcast, rssUrl: e.target.value })}
                    className="input"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Keep Episode Count</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newPodcast.keepEpisodeCount}
                    onChange={(e) => setNewPodcast({ ...newPodcast, keepEpisodeCount: parseInt(e.target.value) })}
                    className="input"
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600">
                      Number of recent episodes to keep in cloud storage
                    </p>
                    <p className="text-xs font-medium text-blue-600">
                      💡 Tip: Set to <strong>0</strong> to keep all episodes (unlimited)
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button type="submit" className="btn btn-primary flex-1">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Podcasts;
