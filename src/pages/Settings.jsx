import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Trash2, FolderPlus, Settings as SettingsIcon, Download, FileUp, FolderSync, Folder } from 'lucide-react';
import { getDriveConfig, uploadCredentials, uploadToken, getAuthUrl, setFolderId, toggleDrive, testConnection, resetDriveConfig, createPodcastsFolder, getSystemSettings, updateSystemSettings, exportPodcasts, importPodcasts, clearAllEpisodes, migratePodcastFolder } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import DriveFolderBrowser from '../components/DriveFolderBrowser';

function Settings() {
  const [searchParams] = useSearchParams();
  const { toasts, removeToast, toast } = useToast();
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
  
  useEffect(() => {
    // Check for OAuth callback with code
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    
    if (code) {
      handleOAuthCallback(code);
    } else if (success) {
      toast.success('Google Drive authorized successfully!');
      window.history.replaceState({}, '', '/settings');
      fetchConfig();
    } else if (error) {
      toast.error('Authorization failed: ' + error);
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
      const response = await fetch('http://localhost:5000/api/drive/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Google Drive authorized successfully!');
        window.history.replaceState({}, '', '/settings');
        await fetchConfig();
        // Auto-create Podcasts folder (silently)
        setTimeout(async () => {
          try {
            const folderResponse = await createPodcastsFolder();
            setFolderIdInput(folderResponse.data.folderId);
            // Don't show toast here - already showed success above
            fetchConfig();
          } catch (error) {
            // Only show error if folder creation fails
            toast.error('Failed to create folder: ' + (error.response?.data?.error || error.message));
          }
        }, 500);
      } else {
        toast.error('Authorization failed: ' + (data.error || 'Unknown error'));
        window.history.replaceState({}, '', '/settings');
      }
    } catch (error) {
      toast.error('Failed to complete authorization: ' + error.message);
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
      toast.success('System settings saved successfully');
      fetchSystemSettings();
    } catch (error) {
      toast.error('Failed to save settings: ' + (error.response?.data?.error || error.message));
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
      toast.success('Podcasts exported successfully');
    } catch (error) {
      toast.error('Failed to export: ' + (error.response?.data?.error || error.message));
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
        toast.warning(`Import completed with errors: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`);
      } else {
        toast.success(`Import successful: ${result.imported} podcasts imported, ${result.skipped} skipped`);
      }
      
      fetchSystemSettings();
    } catch (error) {
      toast.error('Failed to import: ' + (error.response?.data?.error || error.message));
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
      toast.error('Failed to upload credentials: ' + (error.response?.data?.error || error.message));
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
      toast.error('Failed to upload token: ' + (error.response?.data?.error || error.message));
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
      toast.error('Failed to get authorization URL: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleCreateFolder = async () => {
    if (config?.folderId && !useCustomFolder) {
      toast.info('Podcasts folder already configured');
      return;
    }
    
    setCreatingFolder(true);
    try {
      const response = await createPodcastsFolder();
      setFolderIdInput(response.data.folderId);
      
      if (response.data.isNew) {
        toast.success('Podcasts folder created successfully!');
      } else {
        toast.success('Found and connected to existing Podcasts folder!');
      }
      
      fetchConfig();
    } catch (error) {
      toast.error('Failed to access folder: ' + (error.response?.data?.error || error.message));
    } finally {
      setCreatingFolder(false);
    }
  };
  
  const handleSetFolder = async () => {
    if (!folderId.trim()) {
      toast.warning('Please enter a folder ID');
      return;
    }
    
    try {
      await setFolderId({ folderId: folderId.trim() });
      toast.success('Folder ID saved successfully');
      fetchConfig();
    } catch (error) {
      toast.error('Failed to set folder ID: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleToggle = async () => {
    try {
      const response = await toggleDrive();
      toast.success(response.data.message);
      fetchConfig();
    } catch (error) {
      toast.error('Failed to toggle Drive: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await testConnection();
      toast.success(`${response.data.message} Connected as: ${response.data.user}`);
      fetchConfig();
    } catch (error) {
      toast.error('Connection test failed: ' + (error.response?.data?.error || error.message));
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
      toast.success('Google Drive configuration reset successfully');
      setFolderIdInput('');
      setUseCustomFolder(false);
      fetchConfig();
    } catch (error) {
      toast.error('Failed to reset configuration: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleClearAllEpisodes = async () => {
    setClearing(true);
    try {
      const response = await clearAllEpisodes();
      const result = response.data;
      
      toast.success(
        `Episodes cleared: ${result.episodesDeleted} episodes, ${result.filesDeleted} files deleted, ${result.podcastsReset} podcasts reset`
      );
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`Some errors occurred during cleanup: ${result.errors.length} errors`);
      }
    } catch (error) {
      toast.error('Failed to clear episodes: ' + (error.response?.data?.error || error.message));
    } finally {
      setClearing(false);
      setShowClearFinalConfirm(false);
    }
  };
  
  const handleMigrateFolder = async () => {
    if (!newFolderId.trim()) {
      toast.warning('Please enter a new folder ID');
      return;
    }
    
    if (newFolderId.trim() === config?.folderId) {
      toast.warning('New folder is the same as the current folder');
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
          ? `Migration successful: ${result.migrated} podcast folders moved`
          : result.message
      );
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`Some errors occurred: ${result.errors.length} errors`);
      }
      
      setNewFolderId('');
      fetchConfig();
    } catch (error) {
      toast.error('Failed to migrate folder: ' + (error.response?.data?.error || error.message));
    } finally {
      setMigrating(false);
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }
  
  const getStatusBadge = () => {
    const badges = {
      not_configured: { text: 'Not Configured', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
      credentials_uploaded: { text: 'Credentials Uploaded', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      needs_authorization: { text: 'Needs Authorization', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
      active: { text: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      error: { text: 'Error', color: 'bg-red-100 text-red-700', icon: AlertCircle }
    };
    
    const badge = badges[config?.status] || badges.not_configured;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium ${badge.color}`}>
        <Icon className="w-5 h-5" />
        {badge.text}
      </span>
    );
  };
  
  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      {/* System Settings */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">System Settings</h2>
            <p className="text-gray-600">Configure global app behavior</p>
          </div>
        </div>
        
        {systemSettings && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Episodes Per Check
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
                  How many recent episodes to check and download when a podcast is scanned
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Check Interval (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={systemSettings.checkIntervalHours}
                  onChange={(e) => setSystemSettings({ ...systemSettings, checkIntervalHours: parseInt(e.target.value) })}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How often to automatically check for new episodes
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Concurrent Downloads
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
                  Number of episodes to download simultaneously
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Default Keep Episode Count
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
                  Default number of episodes to keep for new podcasts (0 = unlimited)
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
                  {exporting ? 'Exporting...' : 'Export Data'}
                </button>
                <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
                  <FileUp className="w-4 h-4" />
                  {importing ? 'Importing...' : 'Import Data'}
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
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Google Drive Integration</h2>
            <p className="text-gray-600">Upload podcast episodes to your personal Google Drive</p>
          </div>
          {getStatusBadge()}
        </div>
        
        {config?.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{config.errorMessage}</p>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Step 1: Upload Credentials */}
          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">Upload OAuth2 Credentials</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download your OAuth 2.0 Client ID JSON file from{' '}
                  <a 
                    href="https://console.cloud.google.com/apis/credentials" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                
                <div className="flex items-center gap-3">
                  <label className="btn btn-secondary cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload credentials.json'}
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={handleCredentialsUpload}
                      disabled={uploading}
                    />
                  </label>
                  {config?.hasCredentials && (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Uploaded
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Step 2: Authorize or Upload Token */}
          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">Authorize Access</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose one of the following options:
                </p>
                
                {/* Option A: OAuth Flow */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="font-medium mb-2">Option A: Authorize via Browser</p>
                  <p className="text-sm text-gray-600 mb-3">
                    Click the button below to authorize this app to access your Google Drive
                  </p>
                  <button 
                    onClick={handleAuthorize}
                    disabled={!config?.hasCredentials}
                    className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Authorize with Google
                  </button>
                </div>
                
                {/* Option B: Upload Token */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="font-medium mb-2">Option B: Upload Token JSON</p>
                  <p className="text-sm text-gray-600 mb-3">
                    If you already have a token.json file from a previous authorization, upload it here
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="btn btn-secondary cursor-pointer flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Uploading...' : 'Upload token.json'}
                      <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        onChange={handleTokenUpload}
                        disabled={uploading || !config?.hasCredentials}
                      />
                    </label>
                    {config?.hasToken && (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Authorized
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Step 3: Set Folder ID */}
          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">Set Drive Folder</h3>
                
                {!config?.folderId && !useCustomFolder ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800 mb-3">
                      <strong>Recommended:</strong> Auto-create a "Podcasts" folder in your Google Drive root
                    </p>
                    <button
                      onClick={handleCreateFolder}
                      disabled={!config?.hasToken || creatingFolder}
                      className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FolderPlus className={`w-4 h-4 ${creatingFolder ? 'animate-spin' : ''}`} />
                      {creatingFolder ? 'Setting up...' : 'Setup Podcasts Folder'}
                    </button>
                    <button
                      onClick={() => setUseCustomFolder(true)}
                      className="text-sm text-blue-600 hover:underline mt-2 block"
                    >
                      Or use custom folder ID
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      {useCustomFolder ? (
                        <>
                          Enter the folder ID from your Google Drive URL:<br/>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs">drive.google.com/drive/folders/<strong>FOLDER_ID_HERE</strong></code>
                        </>
                      ) : (
                        'Your Podcasts folder is configured'
                      )}
                    </p>
                    
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={folderId}
                        onChange={(e) => setFolderIdInput(e.target.value)}
                        placeholder="Enter Google Drive Folder ID"
                        className="input flex-1"
                        disabled={!config?.hasToken || (!useCustomFolder && config?.folderId)}
                      />
                      <button 
                        onClick={handleSetFolder}
                        disabled={!config?.hasToken}
                        className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button 
              onClick={handleTest}
              disabled={!config?.hasToken || testing}
              className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            
            <button 
              onClick={handleToggle}
              disabled={!config?.hasToken}
              className={`btn ${config?.enabled ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {config?.enabled ? 'Disable' : 'Enable'} Drive Upload
            </button>
            
            <button 
              onClick={handleReset}
              className="btn btn-danger flex items-center gap-2 ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Reset Configuration
            </button>
          </div>
        </div>
      </div>
      
      {/* Data Management Section */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-6 h-6 text-red-600" />
          <div>
            <h2 className="text-2xl font-bold">Data Management</h2>
            <p className="text-gray-600">Manage episode data and storage</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Clear All Episodes */}
          <div className="border border-red-200 rounded-lg p-6 bg-red-50">
            <h3 className="text-lg font-bold mb-2 text-red-900">Clear All Episodes Data</h3>
            <p className="text-sm text-red-700 mb-4">
              This will delete all episodes from the database and all corresponding files from Google Drive. 
              The sync process will start fresh on the next run. <strong>This action cannot be undone!</strong>
            </p>
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing}
              className="btn bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className={`w-4 h-4 ${clearing ? 'animate-spin' : ''}`} />
              {clearing ? 'Clearing...' : 'Clear All Episodes Data'}
            </button>
          </div>
          
          {/* Migrate Folder */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-bold mb-2">Migrate Main Podcast Folder</h3>
            <p className="text-sm text-gray-600 mb-4">
              Change the main podcast folder location in Google Drive. All podcast subfolders 
              will be moved to the new location. This may take time depending on the number of podcasts.
            </p>
            
            {config?.folderId && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Current folder ID:</strong> {config.folderId}
                </p>
              </div>
            )}
            
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setShowFolderBrowser(true)}
                disabled={!config?.hasToken || migrating}
                className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Folder className="w-4 h-4" />
                Browse Folders
              </button>
              <span className="text-sm text-gray-500 self-center">or enter folder ID manually:</span>
            </div>
            
            <div className="flex gap-3">
              <input
                type="text"
                value={newFolderId}
                onChange={(e) => setNewFolderId(e.target.value)}
                placeholder="Enter new Google Drive folder ID"
                className="input flex-1"
                disabled={!config?.hasToken || migrating}
              />
              <button
                onClick={handleMigrateFolder}
                disabled={!config?.hasToken || !newFolderId.trim() || migrating}
                className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderSync className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
                {migrating ? 'Migrating...' : 'Migrate Folder'}
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Tip: Use the Browse button to explore your Google Drive, or copy the folder ID from the URL: 
              <code className="bg-gray-100 px-2 py-1 rounded ml-1">drive.google.com/drive/folders/<strong>FOLDER_ID</strong></code>
            </p>
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Setup Instructions</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">1. Create OAuth2 Credentials:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
              <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Google Drive API</li>
              <li>Go to Credentials → Create Credentials → OAuth 2.0 Client ID</li>
              <li>Choose "Desktop app" or "Web application"</li>
              <li>Add authorized redirect URI: <code className="bg-gray-100 px-2 py-1 rounded">http://localhost:5000/api/drive/callback</code></li>
              <li>Download the JSON file and upload it above</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">2. Authorize the App:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
              <li>Click "Authorize with Google" button (Option A)</li>
              <li>OR upload a token.json file if you have one (Option B)</li>
              <li>Follow the OAuth flow to grant access to your Google Drive</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">3. Set Folder ID:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
              <li>Create a folder in your Google Drive for podcasts</li>
              <li>Copy the folder ID from the URL</li>
              <li>Paste it in the folder ID field above</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setShowClearConfirm(false);
          setShowClearFinalConfirm(true);
        }}
        title="Clear All Episodes Data?"
        message={
          <div>
            <p className="mb-3">This will:</p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Delete all episodes from the database</li>
              <li>Delete all podcast files from Google Drive</li>
              <li>Allow the sync to start fresh</li>
            </ul>
            <p className="font-bold text-red-600">This action CANNOT be undone!</p>
          </div>
        }
        confirmText="Continue"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={Trash2}
        iconColor="text-red-600"
      />
      
      <ConfirmModal
        isOpen={showClearFinalConfirm}
        onClose={() => setShowClearFinalConfirm(false)}
        onConfirm={handleClearAllEpisodes}
        title="FINAL CONFIRMATION"
        message="All episode data and files will be permanently deleted. Are you absolutely sure?"
        confirmText="Yes, Delete Everything"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={AlertCircle}
        iconColor="text-red-600"
      />
      
      <ConfirmModal
        isOpen={showMigrateConfirm}
        onClose={() => setShowMigrateConfirm(false)}
        onConfirm={executeMigration}
        title="Migrate Podcast Folder?"
        message={
          <div>
            <p className="mb-3">
              This will move all podcast subfolders from the current location to the new folder.
            </p>
            <p className="text-sm text-gray-600">
              ⏱️ This may take some time depending on the number of podcasts.
            </p>
          </div>
        }
        confirmText="Start Migration"
        icon={FolderSync}
      />
      
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={executeReset}
        title="Reset Google Drive Configuration?"
        message={
          <div>
            <p className="mb-3">
              This will remove all Google Drive settings including:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>OAuth credentials</li>
              <li>Access tokens</li>
              <li>Folder configuration</li>
            </ul>
            <p className="font-bold text-red-600">This action cannot be undone!</p>
          </div>
        }
        confirmText="Reset Configuration"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        icon={Trash2}
        iconColor="text-red-600"
      />
      
      <DriveFolderBrowser
        isOpen={showFolderBrowser}
        onClose={() => setShowFolderBrowser(false)}
        onSelectFolder={(folder) => {
          setNewFolderId(folder.id);
        }}
        currentFolderId={config?.folderId}
      />
    </div>
  );
}

export default Settings;
