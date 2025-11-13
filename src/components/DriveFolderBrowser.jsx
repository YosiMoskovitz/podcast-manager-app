import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/useToast';
import { X, Folder, ChevronRight, ChevronDown, Home, Loader, FolderPlus } from 'lucide-react';
import { getApiBaseUrl } from '../utils/apiUrl';

function DriveFolderBrowser({ isOpen, onClose, onSelectFolder, currentFolderId }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadRootFolders();
    }
  }, [isOpen]);

  const loadRootFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/drive/folders?parent=root`);
      const data = await response.json();
      
      if (response.ok) {
        setFolders([
          {
            id: 'root',
            name: t('settings.drive.browser.myDrive'),
            isRoot: true,
            children: data.folders || []
          }
        ]);
      } else {
        setError(t('settings.drive.browser.loadFoldersFailed'));
      }
    } catch (err) {
      setError(t('settings.drive.browser.connectFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadSubfolders = async (folderId) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/drive/folders?parent=${folderId}`);
      const data = await response.json();
      
      if (response.ok) {
        return data.folders || [];
      } else {
        console.error(t('settings.drive.browser.loadSubfoldersFailed'), data.error);
        return [];
      }
    } catch (err) {
      console.error(t('settings.drive.browser.loadSubfoldersError'), err);
      return [];
    }
  };

  const toggleFolder = async (folder) => {
    const newExpanded = new Set(expandedFolders);
    
    if (expandedFolders.has(folder.id)) {
      newExpanded.delete(folder.id);
    } else {
      newExpanded.add(folder.id);
      
      // Load children if not loaded yet
      if (!folder.children) {
        const children = await loadSubfolders(folder.id);
        updateFolderChildren(folder.id, children);
      }
    }
    
    setExpandedFolders(newExpanded);
  };

  const updateFolderChildren = (folderId, children) => {
    const updateFolder = (folders) => {
      return folders.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, children };
        }
        if (folder.children) {
          return { ...folder, children: updateFolder(folder.children) };
        }
        return folder;
      });
    };
    
    setFolders(updateFolder(folders));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/drive/create-custom-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newFolderName.trim(),
          parentId: newFolderParent || 'root'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Reload the parent folder's children
        if (newFolderParent) {
          const children = await loadSubfolders(newFolderParent);
          updateFolderChildren(newFolderParent, children);
        } else {
          loadRootFolders();
        }
        
        setNewFolderName('');
        setNewFolderParent(null);
      } else {
        toast.error(t('settings.drive.browser.createFolderFailed', { error: data.error || t('common.unknownError') }));
      }
    } catch (err) {
      toast.error(t('settings.drive.browser.createFolderFailed', { error: err.message }));
    } finally {
      setCreatingFolder(false);
    }
  };

  const renderFolder = (folder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folder.children && folder.children.length > 0;
    const isSelected = selectedFolder?.id === folder.id;
    const isCurrent = folder.id === currentFolderId;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-100 cursor-pointer rounded ${
            isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          } ${isCurrent ? 'bg-green-50' : ''}`}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          <button
            onClick={() => toggleFolder(folder)}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {hasChildren || folder.isRoot ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          
          <button
            onClick={() => setSelectedFolder(folder)}
            className="flex-1 flex items-center gap-2 text-left"
          >
            {folder.isRoot ? (
              <Home className="w-4 h-4 text-blue-500" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-sm truncate">{folder.name}</span>
            {isCurrent && (
              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                {t('settings.drive.browser.current')}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setNewFolderParent(folder.id)}
            className="p-1 hover:bg-gray-200 rounded"
            title={t('settings.drive.browser.createSubfolderTitle')}
          >
            <FolderPlus className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>
        
        {isExpanded && folder.children && (
          <div>
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">{t('settings.drive.browser.title')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('settings.drive.browser.subtitle')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Create Folder Section */}
        {newFolderParent && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">{t('settings.drive.browser.createNewFolder')}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('settings.drive.browser.folderNamePlaceholder')}
                className="input flex-1"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="btn btn-primary disabled:opacity-50"
              >
                {creatingFolder ? <Loader className="w-4 h-4 animate-spin" /> : t('settings.drive.browser.create')}
              </button>
              <button
                onClick={() => {
                  setNewFolderParent(null);
                  setNewFolderName('');
                }}
                className="btn btn-secondary"
              >
                {t('settings.drive.browser.cancel')}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Folder Tree */}
        <div className="flex-1 overflow-y-auto border rounded-lg mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="p-2">
              {folders.map(folder => renderFolder(folder))}
            </div>
          )}
        </div>

        {/* Selected Folder Info */}
        {selectedFolder && (
          <div className="mb-4 p-3 bg-gray-50 border rounded">
            <div className="text-sm text-gray-600">{t('settings.drive.browser.selected')}</div>
            <div className="font-medium">{selectedFolder.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              {t('settings.drive.browser.id')} {selectedFolder.id}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            {t('settings.drive.browser.cancel')}
          </button>
          <button
            onClick={() => {
              if (selectedFolder) {
                onSelectFolder(selectedFolder);
                onClose();
              }
            }}
            disabled={!selectedFolder}
            className="btn btn-primary disabled:opacity-50"
          >
            {t('settings.drive.browser.selectFolder')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DriveFolderBrowser;
