import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';
import { getPodcastStats, getDownloadHistory } from '../services/api';

function Statistics() {
  const { t } = useTranslation();
  const [podcastStats, setPodcastStats] = useState([]);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        getPodcastStats(),
        getDownloadHistory({ limit: 20 })
      ]);
      setPodcastStats(statsRes.data);
      setDownloadHistory(historyRes.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }
  
  const chartData = podcastStats.map(stat => ({
    name: stat.podcast.name.length > 20 ? stat.podcast.name.substring(0, 20) + '...' : stat.podcast.name,
    total: stat.totalEpisodes,
    downloaded: stat.downloaded,
    failed: stat.failed
  }));
  
  const statusData = [
    { name: t('statistics.status.downloaded'), value: podcastStats.reduce((sum, s) => sum + s.downloaded, 0), color: '#10b981' },
    { name: t('statistics.status.failed'), value: podcastStats.reduce((sum, s) => sum + s.failed, 0), color: '#ef4444' },
    { name: t('statistics.status.pending'), value: podcastStats.reduce((sum, s) => sum + (s.totalEpisodes - s.downloaded - s.failed), 0), color: '#6366f1' }
  ];
  
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t('statistics.title')}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">{t('statistics.episodesByPodcast')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="downloaded" fill="#10b981" name={t('statistics.status.downloaded')} />
              <Bar dataKey="failed" fill="#ef4444" name={t('statistics.status.failed')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold mb-4">{t('statistics.overallStatus')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={entry => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">{t('statistics.podcastDetails')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">{t('statistics.table.podcast')}</th>
                <th className="text-right py-3 px-4">{t('statistics.table.totalEpisodes')}</th>
                <th className="text-right py-3 px-4">{t('statistics.table.downloaded')}</th>
                <th className="text-right py-3 px-4">{t('statistics.table.failed')}</th>
                <th className="text-right py-3 px-4">{t('statistics.table.storage')}</th>
              </tr>
            </thead>
            <tbody>
              {podcastStats.map(stat => (
                <tr key={stat.podcast._id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 flex items-center gap-3">
                    {stat.podcast.imageUrl && (
                      <img src={stat.podcast.imageUrl} alt="" className="w-10 h-10 rounded" />
                    )}
                    <span className="font-medium">{stat.podcast.name}</span>
                  </td>
                  <td className="text-right py-3 px-4">{stat.totalEpisodes}</td>
                  <td className="text-right py-3 px-4 text-green-600 font-semibold">{stat.downloaded}</td>
                  <td className="text-right py-3 px-4 text-red-600 font-semibold">{stat.failed}</td>
                  <td className="text-right py-3 px-4">{formatBytes(stat.storage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="card">
        <h2 className="text-xl font-bold mb-4">{t('statistics.recentDownloadHistory')}</h2>
        <div className="space-y-3">
          {downloadHistory.map(history => (
            <div key={history._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium">{history.episode?.title || t('statistics.unknownEpisode')}</p>
                <p className="text-sm text-gray-600">{history.podcast?.name || t('statistics.unknownPodcast')}</p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  history.status === 'completed' ? 'bg-green-100 text-green-700' :
                  history.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {t(`statistics.status.${history.status}`)}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(history.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          
          {downloadHistory.length === 0 && (
            <p className="text-center text-gray-500 py-4">{t('statistics.noDownloadHistory')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Statistics;
