import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Trash2, FolderPlus, Settings as SettingsIcon, Download, FileUp, FolderSync, Folder } from 'lucide-react';
import { getDriveConfig, uploadCredentials, uploadToken, getAuthUrl, setFolderId, toggleDrive, testConnection, resetDriveConfig, createPodcastsFolder, getSystemSettings, updateSystemSettings, exportPodcasts, importPodcasts, clearAllEpisodes, migratePodcastFolder } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import DriveFolderBrowser from '../components/DriveFolderBrowser';
import { getApiBaseUrl } from '../utils/apiUrl';

function Settings() {
  const [searchParams] = useSearchParams();
  const { toasts, removeToast, toast } = useToast();
  const { t } = useTranslation();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [folderId, setFolderIdInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [useCustomFolder, setUseCustomFolder] = useState(false);
  const [systemSettings, setSystemSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [newFolderId, setNewFolderId] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearFinalConfirm, setShowClearFinalConfirm] = useState(false);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [folderBrowserMode, setFolderBrowserMode] = useState('select'); // 'select' or 'migrate'
  
  useEffect(() => {
    // Check for OAuth callback with code
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    
    if (code) {
      handleOAuthCallback(code);
    } else if (success) {
      toast.success(t('settings.drive.status.authorized'));
      window.history.replaceState({}, '', '/settings');
      fetchConfig();
    } else if (error) {
      toast.error(t('settings.drive.status.authFailed', { error }));
      window.history.replaceState({}, '', '/settings');
      fetchConfig();
    } else {
      // Only fetch config if no URL params
      fetchConfig();
    }
    
    fetchSystemSettings();
  }, []);
  
  const handleOAuthCallback = async (code) => {
    try {
      setLoading(true);
      // Send code to backend to exchange for tokens
      const response = await fetch(`${getApiBaseUrl()}/drive/exchange-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include session cookie
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(t('settings.drive.status.authorized'));
        window.history.replaceState({}, '', '/settings');
        await fetchConfig();
      } else {
        toast.error(t('settings.drive.status.authFailed', { error: data.error || t('common.unknownError') }));
        window.history.replaceState({}, '', '/settings');
      }
    } catch (error) {
      toast.error(t('settings.drive.status.authFailed', { error: error.message }));
      window.history.replaceState({}, '', '/settings');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchConfig = async () => {
    try {
      const response = await getDriveConfig();
      setConfig(response.data);
      setFolderIdInput(response.data.folderId || '');
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSystemSettings = async () => {
    try {
      const response = await getSystemSettings();
      setSystemSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
    }
  };
  
  const handleSaveSystemSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSystemSettings(systemSettings);
      toast.success(t('settings.system.saveSuccess'));
      fetchSystemSettings();
    } catch (error) {
      toast.error(t('settings.system.saveFailed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setSavingSettings(false);
    }
  };
  
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await exportPodcasts();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'podcasts.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('settings.system.exportSuccess'));
    } catch (error) {
      toast.error(t('settings.system.exportFailed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setExporting(false);
    }
  };
  
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await importPodcasts(formData);
      const result = response.data;
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(t('settings.system.importCompletedWithErrors', { imported: result.imported, skipped: result.skipped, errors: result.errors.length }));
      } else {
        toast.success(t('settings.system.importSuccess', { imported: result.imported, skipped: result.skipped }));
      }
      
      fetchSystemSettings();
    } catch (error) {
      toast.error(t('settings.system.importFailed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };
  
  const handleCredentialsUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await uploadCredentials(formData);
      toast.success(response.data.message);
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.drive.advanced.uploadCredentialsFailed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };
  
  const handleTokenUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await uploadToken(formData);
      toast.success(response.data.message);
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.drive.advanced.uploadTokenFailed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };
  
  const handleAuthorize = async () => {
    try {
      const response = await getAuthUrl();
      // Open in same window so we can capture the redirect
      window.location.href = response.data.authUrl;
    } catch (error) {
      toast.error(t('settings.drive.connect.getAuthUrlFailed', { error: (error.response?.data?.error || error.message) }));
    }
  };
  
  const handleCreateFolder = async () => {
    setCreatingFolder(true);
    try {
      const response = await createPodcastsFolder();
      setFolderIdInput(response.data.folderId);
      
      if (response.data.isNew) {
        toast.success(t('settings.drive.folder.createSuccess'));
      } else {
        toast.success(t('settings.drive.folder.foundExisting'));
      }
      
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.drive.folder.accessFailed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setCreatingFolder(false);
    }
  };
  
  const handleSetFolder = async () => {
    if (!folderId.trim()) {
      toast.warning(t('settings.drive.folder.enterFolderId'));
      return;
    }
    
    try {
      await setFolderId({ folderId: folderId.trim() });
      toast.success(t('settings.drive.folder.saved'));
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.drive.folder.accessFailed', { error: (error.response?.data?.error || error.message) }));
    }
  };
  
  const handleFolderSelect = async (folder) => {
    setShowFolderBrowser(false);
    
    if (folderBrowserMode === 'migrate') {
      // Migration mode - just store the folder ID for migration
      setNewFolderId(folder.id);
    } else {
      // Initial selection mode - immediately set as main folder
      try {
        await setFolderId({ folderId: folder.id, folderName: folder.name });
        toast.success(t('settings.drive.folder.selectedSuccess', { name: folder.name }));
        fetchConfig();
      } catch (error) {
        toast.error(t('settings.drive.folder.accessFailed', { error: (error.response?.data?.error || error.message) }));
      }
    }
  };
  
  const handleToggle = async () => {
    try {
      const response = await toggleDrive();
      toast.success(response.data.message);
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.drive.actions.toggleFailed', { error: (error.response?.data?.error || error.message) }));
    }
  };
  
  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await testConnection();
      toast.success(t('settings.drive.status.testSuccess', { message: response.data.message, user: response.data.user }));
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.drive.status.testFailed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setTesting(false);
    }
  };
  
  const handleReset = () => {
    setShowResetConfirm(true);
  };
  
  const executeReset = async () => {
    setShowResetConfirm(false);
      try {
      await resetDriveConfig();
      toast.success(t('settings.drive.status.resetSuccess'));
      setFolderIdInput('');
      setUseCustomFolder(false);
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.drive.status.resetFailed', { error: (error.response?.data?.error || error.message) }));
    }
  };
  
  const handleClearAllEpisodes = async () => {
    setClearing(true);
      try {
      const response = await clearAllEpisodes();
      const result = response.data;

      toast.success(t('settings.data.clear.resultMessage', { episodesDeleted: result.episodesDeleted, filesDeleted: result.filesDeleted, podcastsReset: result.podcastsReset }));

      if (result.errors && result.errors.length > 0) {
        toast.warning(t('settings.data.clear.cleanupErrors', { count: result.errors.length }));
      }
    } catch (error) {
      toast.error(t('settings.data.clear.failed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setClearing(false);
      setShowClearFinalConfirm(false);
    }
  };
  
  const handleMigrateFolder = async () => {
    if (!newFolderId.trim()) {
      toast.warning(t('settings.data.migrate.enterNewFolder'));
      return;
    }

    if (newFolderId.trim() === config?.folderId) {
      toast.warning(t('settings.data.migrate.sameAsCurrent'));
      return;
    }
    
    setShowMigrateConfirm(true);
  };
  
  const executeMigration = async () => {
    setMigrating(true);
    setShowMigrateConfirm(false);
    try {
      const response = await migratePodcastFolder(newFolderId.trim());
      const result = response.data;
      
      toast.success(
        result.migrated > 0
          ? t('settings.data.migrate.success', { migrated: result.migrated })
          : result.message
      );

      if (result.errors && result.errors.length > 0) {
        toast.warning(t('settings.data.migrate.errors', { count: result.errors.length }));
      }
      
      setNewFolderId('');
      fetchConfig();
    } catch (error) {
      toast.error(t('settings.data.migrate.failed', { error: (error.response?.data?.error || error.message) }));
    } finally {
      setMigrating(false);
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }
  
  const getStatusBadge = () => {
    const badges = {
      not_configured: { key: 'settings.drive.status.not_configured', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
      credentials_uploaded: { key: 'settings.drive.status.credentials_uploaded', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      needs_authorization: { key: 'settings.drive.status.needs_authorization', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
      active: { key: 'settings.drive.status.active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      error: { key: 'settings.drive.status.error', color: 'bg-red-100 text-red-700', icon: AlertCircle }
    };

    const badge = badges[config?.status] || badges.not_configured;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium ${badge.color}`}>
        <Icon className="w-5 h-5" />
        {t(badge.key)}
      </span>
    );
  };
  
  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
  <h1 className="text-3xl font-bold mb-8">{t('settings.title')}</h1>
      
      {/* System Settings */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">{t('settings.system.title')}</h2>
            <p className="text-gray-600">{t('settings.system.subtitle')}</p>
          </div>
        </div>
        
        {systemSettings && (
          <div className="space-y-6">
            {/* Auto-Check Toggle */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemSettings.autoCheckEnabled || false}
                  onChange={(e) => setSystemSettings({ ...systemSettings, autoCheckEnabled: e.target.checked })}
                  className="mt-1 w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <div className="flex-1">
                  <span className="font-semibold text-gray-900">{t('settings.system.autoCheck.label')}</span>
                  <p className="text-sm text-gray-600 mt-1">
                    {systemSettings && t('settings.system.autoCheck.description', { hours: systemSettings.checkIntervalHours })}
                    {!systemSettings?.autoCheckEnabled && (
                      <span className="block mt-2 font-medium text-blue-700">
                        {t('settings.system.autoCheck.disabled')}
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('settings.system.maxEpisodes.label')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={systemSettings.maxEpisodesPerCheck}
                  onChange={(e) => setSystemSettings({ ...systemSettings, maxEpisodesPerCheck: parseInt(e.target.value) })}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.system.maxEpisodes.description')}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('settings.system.checkInterval.label')}
                  {!systemSettings?.autoCheckEnabled && (
                    <span className="text-gray-400 text-xs ml-2">{t('settings.system.checkInterval.requiresAutoCheck')}</span>
                  )}
                </label>
                <select
                  value={systemSettings.checkIntervalHours}
                  onChange={(e) => setSystemSettings({ ...systemSettings, checkIntervalHours: parseInt(e.target.value) })}
                  className="input"
                  disabled={!systemSettings.autoCheckEnabled}
                >
                  <option value="1">{t('settings.system.checkInterval.options.1')}</option>
                  <option value="2">{t('settings.system.checkInterval.options.2')}</option>
                  <option value="4">{t('settings.system.checkInterval.options.4')}</option>
                  <option value="6">{t('settings.system.checkInterval.options.6')}</option>
                  <option value="12">{t('settings.system.checkInterval.options.12')}</option>
                  <option value="24">{t('settings.system.checkInterval.options.24')}</option>
                  <option value="48">{t('settings.system.checkInterval.options.48')}</option>
                  <option value="168">{t('settings.system.checkInterval.options.168')}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.system.checkInterval.description')}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('settings.system.maxConcurrent.label')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={systemSettings.maxConcurrentDownloads}
                  onChange={(e) => setSystemSettings({ ...systemSettings, maxConcurrentDownloads: parseInt(e.target.value) })}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.system.maxConcurrent.description')}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('settings.system.defaultKeep.label')}
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={systemSettings.defaultKeepEpisodeCount}
                  onChange={(e) => setSystemSettings({ ...systemSettings, defaultKeepEpisodeCount: parseInt(e.target.value) })}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.system.defaultKeep.description')}
                </p>
              </div>
            </div>
            
            <div className="flex justify-between pt-4 border-t">
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? t('settings.system.actions.exporting') : t('settings.system.actions.export')}
                </button>
                <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
                  <FileUp className="w-4 h-4" />
                  {importing ? t('settings.system.actions.importing') : t('settings.system.actions.import')}
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                    disabled={importing}
                  />
                </label>
              </div>
                <button
                  onClick={handleSaveSystemSettings}
                  disabled={savingSettings}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {savingSettings ? t('settings.system.actions.saving') : t('settings.system.actions.save')}
                </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('settings.drive.title')}</h2>
            <p className="text-gray-600">{t('settings.drive.subtitle')}</p>
          </div>
          {config?.hasToken ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium bg-green-100 text-green-700">
              <CheckCircle className="w-5 h-5" />
              {t('settings.drive.connected')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium bg-gray-100 text-gray-700">
              <AlertCircle className="w-5 h-5" />
              {t('settings.drive.notConnected')}
            </span>
          )}
        </div>
        
        {config?.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">{t('toast.error')}</p>
              <p className="text-sm text-red-700">{config.errorMessage}</p>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Connect or Configure Drive */}
          {!config?.hasToken ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-3">{t('settings.drive.connect.title')}</h3>
                <p className="text-gray-600 mb-6">{t('settings.drive.connect.description')}</p>
                <button 
                  onClick={handleAuthorize}
                  disabled={!config?.hasCredentials}
                  className="btn btn-primary flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('settings.drive.connect.button')}
                </button>
                {!config?.hasCredentials && (
                  <p className="text-sm text-gray-500 mt-3">{t('settings.drive.connect.note')}</p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Drive Connected - Show Folder Configuration */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">{t('settings.drive.connected')}</p>
                    <p className="text-sm text-green-700">{t('settings.drive.subtitle')}</p>
                  </div>
                </div>
              </div>
              
              {/* Folder Configuration - MOVED TO TOP */}
              <div className="border rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold mb-4">{t('settings.drive.folder.title')}</h3>
                
                {!config?.folderId ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-900">{t('settings.drive.folder.required')}</p>
                        <p className="text-sm text-yellow-700">
                          {t('settings.drive.folder.requiredDescription')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <button
                        onClick={handleCreateFolder}
                        disabled={creatingFolder}
                        className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                      >
                        <FolderPlus className={`w-4 h-4 ${creatingFolder ? 'animate-spin' : ''}`} />
                        {creatingFolder ? t('settings.drive.folder.creating') : t('settings.drive.folder.create')}
                      </button>
                      
                      <button
                        onClick={() => {
                          setFolderBrowserMode('select');
                          setShowFolderBrowser(true);
                        }}
                        className="btn btn-secondary flex items-center gap-2 w-full"
                      >
                        <Folder className="w-4 h-4" />
                        {t('settings.drive.folder.browse')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">{t('settings.drive.folder.selected')}</p>
                          <p className="text-lg font-bold text-blue-700">{config.folderName || t('podcasts.noImagePlaceholder')}</p>
                        </div>
                        <button
                          onClick={() => {
                            setFolderBrowserMode('select');
                            setShowFolderBrowser(true);
                          }}
                          className="btn btn-secondary flex items-center gap-2"
                        >
                          <Folder className="w-4 h-4" />
                          {t('settings.drive.folder.change')}
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500">{t('settings.drive.folder.description')}</p>
                  </>
                )}
              </div>
          
          {/* Actions */}
            <div className="flex gap-3">
            <button 
              onClick={handleTest}
              disabled={testing}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? t('settings.drive.actions.testing') : t('settings.drive.actions.test')}
            </button>
            
            <button 
              onClick={handleReset}
              className="btn btn-danger flex items-center gap-2 ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              {t('settings.drive.actions.disconnect')}
            </button>
          </div>
            </>
          )}
        </div>
      </div>
      
      {/* Advanced Settings - Only show when connected */}
      {config?.hasToken && (
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-gray-600" />
          <div>
            <h2 className="text-2xl font-bold">{t('settings.drive.advanced.title')}</h2>
            <p className="text-gray-600">{t('settings.drive.advanced.subtitle')}</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Legacy Upload Options - Collapsed by default */}
          <details className="border rounded-lg">
            <summary className="px-6 py-4 cursor-pointer hover:bg-gray-50 font-medium">
              {t('settings.drive.advanced.legacyTitle')}
            </summary>
            <div className="px-6 pb-6 space-y-4 border-t">
              <p className="text-sm text-gray-600 mt-4">{t('settings.drive.advanced.legacyDescription')}</p>
              <label className="btn btn-secondary cursor-pointer flex items-center gap-2 w-fit">
                <Upload className="w-4 h-4" />
                {t('settings.drive.advanced.uploadCredentials')}
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={handleCredentialsUpload}
                />
              </label>
              <label className="btn btn-secondary cursor-pointer flex items-center gap-2 w-fit">
                <Upload className="w-4 h-4" />
                {t('settings.drive.advanced.uploadToken')}
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={handleTokenUpload}
                />
              </label>
            </div>
          </details>
        </div>
      </div>
      )}
      
      {/* Data Management Section */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-6 h-6 text-red-600" />
          <div>
            <h2 className="text-2xl font-bold">{t('settings.data.title')}</h2>
            <p className="text-gray-600">{t('settings.data.subtitle')}</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Clear All Episodes */}
          <div className="border border-red-200 rounded-lg p-6 bg-red-50">
            <h3 className="text-lg font-bold mb-2 text-red-900">{t('settings.data.clear.title')}</h3>
            <p className="text-sm text-red-700 mb-4">{t('settings.data.clear.description')}</p>
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing}
              className="btn bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className={`w-4 h-4 ${clearing ? 'animate-spin' : ''}`} />
              {clearing ? t('settings.data.clear.clearing') : t('settings.data.clear.button')}
            </button>
          </div>
          
          {/* Migrate Folder */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-bold mb-2">{t('settings.data.migrate.title')}</h3>
            <p className="text-sm text-gray-600 mb-4">{t('settings.data.migrate.description')}</p>
            
            {config?.folderId && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>{t('settings.data.migrate.currentFolder')}</strong> {config.folderName || t('podcasts.noImagePlaceholder')}
                </p>
              </div>
            )}
            
            <div className="mb-3">
              <button
                onClick={() => {
                  setFolderBrowserMode('migrate');
                  setShowFolderBrowser(true);
                  setNewFolderId(''); // Clear any manual entry when browsing
                }}
                disabled={!config?.hasToken || migrating}
                className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                <Folder className="w-4 h-4" />
                {t('settings.data.migrate.browseButton')}
              </button>
            </div>
            
            {newFolderId && (
              <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                <p className="text-sm text-green-800">
                  <strong>{t('settings.data.migrate.newFolderSelected')}</strong>
                </p>
                <button
                  onClick={handleMigrateFolder}
                  disabled={!config?.hasToken || migrating}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full mt-2"
                >
                  <FolderSync className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
                  {migrating ? t('settings.data.migrate.migrating') : t('settings.data.migrate.startButton')}
                </button>
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-2">
              {t('settings.data.migrate.note')}
            </p>
          </div>
        </div>
      </div>
      
      {/* Help - Only show when NOT connected */}
      {!config?.hasToken && (
      <div className="card">
        <h3 className="text-xl font-bold mb-4">{t('settings.help.title')}</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>{t('settings.help.simpleSetupTitle')}</strong> {t('settings.help.simpleSetup')}
          </p>
          <p>
            <strong>{t('settings.help.whatWeAccessTitle')}</strong> {t('settings.help.whatWeAccess')}
          </p>
          <p>
            <strong>{t('settings.help.yourDataTitle')}</strong> {t('settings.help.yourData')}
          </p>
        </div>
      </div>
      )}
      
      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setShowClearConfirm(false);
          setShowClearFinalConfirm(true);
        }}
        title={t('settings.data.clear.confirmTitle')}
        message={
          <div>
            <p className="mb-3">{t('settings.data.clear.confirmMessage')}</p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              {t('settings.data.clear.confirmList', { returnObjects: true }).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <p className="font-bold text-red-600">{t('settings.data.clear.finalWarning')}</p>
          </div>
        }
        confirmText={t('settings.data.clear.confirmContinue') || t('common.confirm')}
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={Trash2}
        iconColor="text-red-600"
      />
      
      <ConfirmModal
        isOpen={showClearFinalConfirm}
        onClose={() => setShowClearFinalConfirm(false)}
        onConfirm={handleClearAllEpisodes}
        title={t('settings.data.clear.finalConfirmTitle')}
        message={t('settings.data.clear.finalConfirmMessage')}
        confirmText={t('settings.data.clear.finalConfirmButton')}
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={AlertCircle}
        iconColor="text-red-600"
      />
      
      <ConfirmModal
        isOpen={showMigrateConfirm}
        onClose={() => setShowMigrateConfirm(false)}
        onConfirm={executeMigration}
        title={t('settings.data.migrate.title')}
        message={
          <div>
            <p className="mb-3">{t('settings.data.migrate.description')}</p>
            <p className="text-sm text-gray-600">{t('settings.data.migrate.note')}</p>
          </div>
        }
        confirmText={t('settings.data.migrate.startButton')}
        icon={FolderSync}
      />
      
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={executeReset}
        title={t('settings.drive.resetConfirm.title')}
        message={
          <div>
            <p className="mb-3">{t('settings.drive.resetConfirm.messageIntro')}</p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              {t('settings.drive.resetConfirm.items', { returnObjects: true }).map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            <p className="font-bold text-red-600">{t('settings.drive.resetConfirm.finalWarning')}</p>
          </div>
        }
        confirmText={t('settings.drive.actions.reset')}
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={Trash2}
        iconColor="text-red-600"
      />
      
      <DriveFolderBrowser
        isOpen={showFolderBrowser}
        onClose={() => setShowFolderBrowser(false)}
        onSelectFolder={handleFolderSelect}
        currentFolderId={config?.folderId}
      />
    </div>
  );
}

export default Settings;
