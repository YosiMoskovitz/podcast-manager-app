# Podcast Manager — Frontend Documentation

This document describes the single-page app (React) structure, every top-level page, the UI features each page provides, the service/API calls used, and how to use each feature.

Files reviewed: `src/App.jsx`, `src/pages/*`, `src/components/*`, `src/services/api.js`, `src/hooks/useToast.js`.

Base notes
- The app is a React app (routes defined in `src/App.jsx`) with a left sidebar navigation in `src/components/Layout.jsx`.
- Main pages mounted under client routes:
  - `/` → Dashboard
  - `/podcasts` → Podcasts
  - `/episodes` → Episodes
  - `/statistics` → Statistics
  - `/settings` → Settings
- The frontend talks to the backend using `src/services/api.js`. The default API base is `http://localhost:5000/api` (via Vite env `VITE_API_URL`).
- Toasts are handled with `src/hooks/useToast.js` and `src/components/Toast.jsx`.

---

## Layout & Navigation

- File: `src/components/Layout.jsx`
- Purpose: Fixed sidebar with navigation links and the main content area.
- Behavior:
  - Sidebar links: Dashboard, Podcasts, Episodes, Statistics, Settings.
  - Content is rendered to the right and scrollable.
  - No authentication UI — app assumes local backend is available.

How to use:
- Click the sidebar items to open each page. The app uses react-router `Routes` defined in `src/App.jsx`.

---

## Dashboard (src/pages/Dashboard.jsx)

Purpose
- High-level overview and control panel for syncing and verification.

Key UI elements
- Main stats cards: Total Podcasts, Total Episodes, Downloads Today, Storage Used.
- Quick actions: "Verify Files" and "Check Now" buttons (top-right).
- System status panel: Backend, Database, Google Drive connection with quick links to settings when not configured.
- Sync progress modal (`SyncProgressModal`) shows real-time sync progress when a sync runs.
- Verification modal (`VerificationModal`) displays verification results and allows re-syncing selected episodes.

Main interactions & API calls
- On load: calls `getCurrentStats()` and `getDriveConfig()` and `getSyncStatus()`.
- Check Now: calls `triggerManualCheck()` then polls `getSyncStatus()` until sync completes; `SyncProgressModal` shows progress.
- Verify Files: calls `verifyFiles()`; results displayed in `VerificationModal` which allows selecting missing episodes and calling `resyncEpisodes(episodeIds)`.

How to use
- View the top summary cards for a glance at state.
- Click "Check Now" to start an on-demand sync run; if a run is active the button is disabled.
- Click "Verify Files" to check DB vs Google Drive. If missing episodes are found, open the modal and select episodes to re-sync (click the Re-sync Selected button).

Notes & tips
- Polling interval is aggressive (1s) to provide near-real-time progress in the modal.

---

## Podcasts (src/pages/Podcasts.jsx)

Purpose
- CRUD interface for podcasts: create, enable/disable, refresh feed, delete.

Key UI elements
- Grid of podcast cards (image, name, author, description, stats).
- Actions on each card: Refresh, Enable/Disable toggle, Delete.
- "Add Podcast" modal for creating a new podcast (`name`, `rssUrl`, `keepEpisodeCount`).

Main interactions & API calls
- Load list: `getPodcasts()`.
- Create podcast: `createPodcast({ name, rssUrl, folderName?, keepEpisodeCount })`.
- Delete podcast: `deletePodcast(id)` (also deletes episodes server-side).
- Toggle enabled: `updatePodcast(id, { enabled })`.
- Refresh feed for a podcast: `refreshPodcast(id)` which calls `/podcasts/:id/refresh` and inserts new episodes on the backend.

How to use
- Click "Add Podcast" and provide the RSS feed URL. The frontend validates by letting the backend parse the feed.
- Use "Refresh" to check the feed now for new episodes.
- Use the power button to enable/disable automatic downloads for that podcast.
- Deleting a podcast will also remove all its episodes (frontend asks for confirm via browser confirm prompt).

Notes & tips
- Keep Episode Count controls how many recent episodes the backend keeps for that podcast (0 = unlimited).

---

## Episodes (src/pages/Episodes.jsx)

Purpose
- List of episodes with status and per-episode actions (download, re-sync).

Key UI elements
- Filter buttons: All, Pending, Completed, Failed.
- Episode list: artwork, title, podcast name, pub date, duration, small description preview.
- Status badge per episode and action buttons:
  - Download (for pending episodes) → triggers backend download/upload.
  - Re-sync (when downloaded but not yet uploaded to Drive) → calls re-sync endpoint.

Main interactions & API calls
- Load episodes: `getEpisodes(params)` with optional `status` filter.
- Start download: `downloadEpisode(id)` → POST /episodes/:id/download
- Re-sync single episode: `resyncEpisode(id)` → POST /episodes/:id/resync

How to use
- Use status filters to narrow the list.
- Click "Download" to start a background download for pending episodes. The frontend shows a simple alert and refreshes the list shortly after.
- If an episode failed or shows error text, inspect the error message displayed in the card.

Notes & tips
- Downloads and re-syncs are started as background tasks on the server; the UI polls or refreshes to reflect changes.

---

## Statistics (src/pages/Statistics.jsx)

Purpose
- Dashboard charts and per-podcast statistics for monitoring usage and storage.

Key UI elements
- Bar chart (downloaded vs failed) per podcast using `recharts`.
- Pie chart showing overall status counts (downloaded/failed/pending).
- Table of podcasts with counts and storage usage.
- Recent download history list.

Main interactions & API calls
- Fetch data on load: `getPodcastStats()` and `getDownloadHistory({ limit })`.

How to use
- Open `/statistics` to view charts and a recent list of downloads. Use this page to identify storage usage and failing podcasts.

Notes & tips
- Chart labels truncate long podcast names; use the table below charts for full names and storage numbers.

---

## Settings (src/pages/Settings.jsx)

Purpose
- Central place to configure system settings, Google Drive integration, import/export data, and destructive management actions.

Key UI elements & sections
- System Settings card (max episodes per check, check interval hours, max concurrent downloads, default keep count).
- Google Drive Integration:
  - Step 1: Upload OAuth2 credentials JSON (client_id/client_secret) via file upload.
  - Step 2: Authorize with Google (OAuth flow) OR upload a token.json file.
  - Step 3: Create or enter a Drive folder ID for podcasts (auto-create "Podcasts" recommended).
  - Actions: Test connection, Enable/Disable Drive uploads, Reset configuration.
  - Drive folder browser modal (`DriveFolderBrowser`) for exploring Drive and picking a folder.
- Data Management:
  - Export/Import podcasts and settings (JSON).
  - Clear all episodes (two-step confirm) — destructive: deletes DB episodes and Drive files.
  - Migrate main podcast folder to a new Drive folder.

Main interactions & API calls
- System settings: `getSystemSettings()` and `updateSystemSettings(settings)`.
- Export: `exportPodcasts()` returns a blob downloaded as `podcasts.json`.
- Import: `importPodcasts(formData)` with multipart file upload.
- Drive config flow:
  - `uploadCredentials(formData)` → POST /drive/credentials
  - `uploadToken(formData)` → POST /drive/token
  - `getAuthUrl()` → GET /drive/auth-url (opens OAuth flow)
  - Backend exchanges code at `/api/drive/exchange-code` (frontend sends code in `handleOAuthCallback` via direct fetch to backend).
  - `createPodcastsFolder()` → POST /drive/create-folder (auto-creates or finds Podcasts folder)
  - `setFolderId({ folderId })` → POST /drive/folder
  - `toggleDrive()` → POST /drive/toggle
  - `testConnection()` → POST /drive/test
  - `resetDriveConfig()` → DELETE /drive/config
  - `clearAllEpisodes()` → DELETE /episodes/clear-all/confirm
  - `migratePodcastFolder(newFolderId)` → POST /drive/migrate-folder

How to use — Google Drive quick setup
1. Upload OAuth2 credentials JSON from Google Cloud Console (or use existing token file).
2. Click "Authorize with Google" to perform the OAuth flow. After successful authorization you are redirected back to `/settings` and the app auto-creates a Podcasts folder if configured.
3. Use "Setup Podcasts Folder" to auto-create a Podcasts folder or paste a folder ID manually and click Save.
4. Test connection and then Enable Drive Uploads to start uploading episodes.

How to use — Data management
- Export: click Export Data to download a JSON backup.
- Import: click Import Data and choose a JSON file exported by the app.
- Clear All Episodes: click the button, follow the two confirmation modals. This will delete episodes and Drive files.
- Migrate: pick or paste a new folder ID and click Migrate; this may take a while for many podcasts.

Safety notes
- Several actions are destructive (Reset Configuration, Clear All Episodes, Migrate). The UI uses confirmation modals and explicit text. Use with care.

---

## Reusable Components

- `Toast` (`src/components/Toast.jsx`): Small notification used via `useToast()` hook.
- `SyncProgressModal` (`src/components/SyncProgressModal.jsx`): Shows live sync progress, counts, and per-podcast status.
- `VerificationModal` (`src/components/VerificationModal.jsx`): Display results of verification and select episodes to re-sync.
- `DriveFolderBrowser` (`src/components/DriveFolderBrowser.jsx`): Browse Drive folders (calls backend endpoints `/api/drive/folders?parent=...`) and create subfolders.
- `ConfirmModal` (`src/components/ConfirmModal.jsx`): Generic confirmation modal (used in Settings for destructive actions).

---

## API client mapping (quick)

- The frontend uses `src/services/api.js` for all HTTP calls. Important mappings:
  - Podcasts: `getPodcasts`, `createPodcast`, `deletePodcast`, `updatePodcast`, `refreshPodcast`
  - Episodes: `getEpisodes`, `downloadEpisode`, `resyncEpisode`, `clearAllEpisodes`
  - Stats: `getCurrentStats`, `getPodcastStats`, `getDownloadHistory`
  - Sync: `triggerManualCheck`, `getSyncStatus`, `verifyFiles`, `resyncEpisodes`
  - Drive: `getDriveConfig`, `uploadCredentials`, `uploadToken`, `getAuthUrl`, `setFolderId`, `toggleDrive`, `testConnection`, `resetDriveConfig`, `createPodcastsFolder`, `migratePodcastFolder`
  - Settings: `getSystemSettings`, `updateSystemSettings`, `exportPodcasts`, `importPodcasts`

---

## Developer notes & next steps

- The UI is driven by optimistic updates and short polling for sync state. Consider adding web-socket or SSE support for more efficient realtime updates.
- For generating docs or API clients, an OpenAPI spec (server-side) would enable automatic client generation for the frontend.
- I can:
  - Add example request/response snippets for each page action.
  - Generate a minimal user guide with screenshots (if you provide or allow me to capture UI images).
  - Produce a Postman/Insomnia collection from `src/services/api.js`.

---

Generated by scanning `src/` files in the workspace. If you'd like, I can now add example requests for each action or produce a condensed quickstart for end-users.
