import { useTranslation } from 'react-i18next';

function SyncIndicator({ syncStatus, onClick }) {
  const { t } = useTranslation();

  if (!syncStatus || !syncStatus.isRunning) {
    return (
      <div 
        className="relative w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
        onClick={onClick}
        title={t('dashboard.sync.noActiveSync')}
      >
        <span className="text-gray-500 font-medium">0</span>
      </div>
    );
  }

  const { progress, phase } = syncStatus;
  
  // Calculate percentage based on current phase
  let percentage = 0;
  let episodesCount = 0;
  
  if (phase === 'discovery') {
    percentage = progress.totalPodcasts > 0 ? Math.round((progress.podcastsChecked / progress.totalPodcasts) * 100) : 0;
    episodesCount = progress.totalEpisodes || 0;
  } else if (phase === 'download') {
    percentage = progress.totalEpisodes > 0 ? Math.round((progress.episodesDownloaded / progress.totalEpisodes) * 100) : 0;
    episodesCount = progress.episodesDownloaded || 0;
  }

  const circumference = 2 * Math.PI * 28; // radius = 28 for w-16 (64px) with some padding
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className="relative w-16 h-16 cursor-pointer group"
      onClick={onClick}
      title={`${t('dashboard.sync.episodesSynced')}: ${episodesCount} (${percentage}%)`}
    >
      {/* Background circle */}
      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="#e5e7eb"
          strokeWidth="4"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="#3b82f6"
          strokeWidth="4"
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
          {episodesCount}
        </span>
      </div>
    </div>
  );
}

export default SyncIndicator;