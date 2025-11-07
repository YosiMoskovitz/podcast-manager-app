## Podcast Manager — Server API Documentation

This document summarizes the server responsibilities, every API endpoint, what it does, and the key functions/models/services used by each route handler.

Base API prefix: `/api`

Notes:
- Routes are mounted in `server/index.js`.
- Models live in `server/models/` and services in `server/services/`.
- Logging is done via `server/utils/logger.js`.

---

## Health & Utilities

- `GET /api/health`
  - Purpose: Simple health check. Returns server status, timestamp and uptime.
  - Functions / modules: inline handler in `server/index.js` (no services).

- `POST /api/check-now`
  - Purpose: Trigger a manual RSS check / scheduler run.
  - Functions / modules: `triggerManualCheck()` from `server/services/scheduler.js`.

---

## /api/drive (server/routes/drive.js)
Handles Google Drive configuration, OAuth flow, folder management and connection tests.

- `GET /api/drive/config`
  - Purpose: Return current Drive configuration status (client ID, token, folder, enabled, last sync).
  - Uses: `DriveCredentials.getConfig()` (model), returns config fields; `logger`.

- `POST /api/drive/credentials` (multipart file field: `file`)
  - Purpose: Upload OAuth2 client credentials JSON (client_id / client_secret). Stores in `DriveCredentials`.
  - Uses: multer upload, `DriveCredentials.getConfig()`, `config.save()`, `logger`.

- `POST /api/drive/token` (multipart file field: `file`)
  - Purpose: Upload OAuth2 token JSON (access token / refresh token). Stores token info and initializes Drive client.
  - Uses: `DriveCredentials.getConfig()`, set token fields and `config.save()`, `initializeDrive()` from `server/services/cloudStorage.js`, `logger`.

- `GET /api/drive/auth-url`
  - Purpose: Generate OAuth2 authorization URL for the frontend to redirect the user to Google consent screen.
  - Uses: `DriveCredentials.getConfig()`, `google.auth.OAuth2` (googleapis), `oauth2Client.generateAuthUrl()`, `config.save()`, `logger`.

- `POST /api/drive/exchange-code`
  - Purpose: Exchange authorization code (sent from frontend) for tokens; store tokens and initialize Drive.
  - Uses: `DriveCredentials.getConfig()`, `google.auth.OAuth2.getToken()`, `config.save()`, `initializeDrive()`, `logger`.

- `POST /api/drive/folder`
  - Purpose: Set the configured Drive folder ID (used as main podcasts folder).
  - Uses: `DriveCredentials.getConfig()`, set `config.folderId`, `config.save()`, `logger`.

- `POST /api/drive/toggle`
  - Purpose: Toggle Drive integration enabled/disabled.
  - Uses: `DriveCredentials.getConfig()`, flip `config.enabled`, `config.save()`, `logger`.

- `POST /api/drive/test`
  - Purpose: Test Drive connection by calling Google Drive `about.get` and updating status + lastSync.
  - Uses: `DriveCredentials.getConfig()`, `google.auth.OAuth2`, `drive.about.get()`, `config.save()`, `logger`.

- `POST /api/drive/create-folder`
  - Purpose: Create (or find) a top-level `Podcasts` folder in Drive and save its folderId to the config.
  - Uses: `DriveCredentials.getConfig()`, Google Drive `files.list()` and `files.create()`, `config.save()`, `logger`.

- `DELETE /api/drive/config`
  - Purpose: Reset/clear the Drive configuration (credentials, tokens, folder, enabled flag, status and error messages).
  - Uses: `DriveCredentials.getConfig()`, set many fields to `null` or defaults, `config.save()`, `logger`.

Key modules referenced by this router:
- `server/models/DriveCredentials.js`
- `server/services/cloudStorage.js` (exports: `initializeDrive`, `getDriveClient`, `listFilesInFolder`)
- `googleapis` OAuth client usage (google.auth.OAuth2)

---

## /api/episodes (server/routes/episodes.js)
Episode CRUD, downloads, re-sync and a destructive "clear all" endpoint.

- `GET /api/episodes?podcast=&status=&limit=`
  - Purpose: List episodes with optional filters (podcast id, status) and limit (default 50). Populates podcast name and image.
  - Uses: `Episode.find()`, `.populate()`, `.sort()`, `.limit()`, `logger`.

- `GET /api/episodes/:id`
  - Purpose: Get single episode by id (populates podcast).
  - Uses: `Episode.findById().populate()`, `logger`.

- `POST /api/episodes/:id/download`
  - Purpose: Start background download/upload process for an episode (if not already downloaded).
  - Uses: `Episode.findById()`, `Podcast.findById()`, `downloadEpisode(episode, podcast)` from `server/services/downloader.js` (fire-and-forget), `logger`.

- `POST /api/episodes/:id/resync`
  - Purpose: Reset minimal episode fields and force a fresh download/upload (re-sync) for a single episode.
  - Uses: `Episode.findById()`, `Podcast.findById()`, modify fields (`status`, `downloaded`, `cloudFileId`, `cloudUrl`), `episode.save()`, `downloadEpisode(...)`, `logger`.

- `DELETE /api/episodes/:id`
  - Purpose: Delete an episode document from the database.
  - Uses: `Episode.findByIdAndDelete()`, `logger`.

- `DELETE /api/episodes/clear-all/confirm`
  - Purpose: Destructive operation used to clear all episodes and associated Drive files. Behavior:
    - Optionally deletes files from Google Drive (if Drive configured).
    - Deletes all episode documents from DB: `Episode.deleteMany({})`.
    - Resets `driveFolderId` on all podcasts: `Podcast.updateMany()`.
  - Uses: dynamic import of `getDriveClient` from `server/services/cloudStorage.js`, `DriveCredentials.getConfig()`, Google Drive `files.list()` and `files.delete()`, `Episode.deleteMany()`, `Podcast.updateMany()`, `logger`.

Key modules referenced by this router:
- `server/models/Episode.js`, `server/models/Podcast.js`, `server/models/DriveCredentials.js`
- `server/services/downloader.js` (export: `downloadEpisode`)
- `server/services/cloudStorage.js` (for Drive deletion flow)

---

## /api/sync (server/routes/sync.js)
Sync status and verification utilities.

- `GET /api/sync/status`
  - Purpose: Return current sync status object.
  - Uses: `syncStatus.getStatus()` from `server/services/syncStatus.js`, `logger`.

- `POST /api/sync/verify`
  - Purpose: Verify consistency between DB and Drive files.
  - Uses: `verifyDriveConsistency()` from `server/services/verifier.js`, `logger`.

- `POST /api/sync/resync` (body: `{ episodeIds: [...] }`)
  - Purpose: Re-sync (force re-upload/download) a list of episodes by id.
  - Uses: `resyncEpisodesByIds(episodeIds)` from `server/services/verifier.js`, `logger`.

Key modules referenced by this router:
- `server/services/syncStatus.js`, `server/services/verifier.js`

---

## /api/stats (server/routes/stats.js)
Statistics endpoints for dashboard and history.

- `GET /api/stats/current`
  - Purpose: Return summary statistics (podcasts count, episodes count, downloaded/failed/pending counts, total storage used, downloads in last 24h).
  - Uses: `Podcast.countDocuments()`, `Episode.countDocuments()`, `Episode.aggregate()` for storage, `DownloadHistory.countDocuments()`, `logger`.

- `GET /api/stats/history?days=`
  - Purpose: Return historical Stats documents for the last N days (default 7).
  - Uses: `Stats.find()`.

- `GET /api/stats/downloads?limit=&podcast=`
  - Purpose: Return recent download history entries (populated with episode title and podcast name).
  - Uses: `DownloadHistory.find().populate('episode').populate('podcast')`.

- `GET /api/stats/podcasts`
  - Purpose: Return per-podcast aggregated stats (total episodes, downloaded, failed, storage used).
  - Uses: `Podcast.find()`, per-podcast `Episode.countDocuments()` and `Episode.aggregate()` calls.

Key modules referenced by this router:
- `server/models/Podcast.js`, `server/models/Episode.js`, `server/models/DownloadHistory.js`, `server/models/Stats.js`

---

## /api/settings (server/routes/settings.js)
System settings read/update.

- `GET /api/settings`
  - Purpose: Return persisted system settings.
  - Uses: `SystemSettings.getSettings()` from `server/models/SystemSettings.js`.

- `PUT /api/settings`
  - Purpose: Update allowed system settings fields (maxEpisodesPerCheck, maxConcurrentDownloads, checkIntervalHours, defaultKeepEpisodeCount).
  - Uses: `SystemSettings.getSettings()`, update fields, `settings.save()`.

Key modules referenced by this router:
- `server/models/SystemSettings.js`

---

## /api/podcasts (server/routes/podcasts.js)
Podcast CRUD and feed refresh.

- `GET /api/podcasts`
  - Purpose: List all podcasts (sorted by name).
  - Uses: `Podcast.find()`.

- `GET /api/podcasts/:id`
  - Purpose: Return a single podcast and recent episodes (limit 50).
  - Uses: `Podcast.findById()`, `Episode.find({ podcast: id })`.

- `POST /api/podcasts` (body: `{ name, rssUrl, folderName, keepEpisodeCount }`)
  - Purpose: Create a new podcast. Validates RSS feed and stores feed metadata.
  - Uses: `parseFeed(rssUrl)` from `server/services/rssParser.js`, `Podcast.create()`, `logger`.

- `PUT /api/podcasts/:id`
  - Purpose: Update podcast fields via `findByIdAndUpdate`.
  - Uses: `Podcast.findByIdAndUpdate()`.

- `DELETE /api/podcasts/:id`
  - Purpose: Delete a podcast and all its episodes.
  - Uses: `Podcast.findByIdAndDelete()`, `Episode.deleteMany({ podcast: id })`, `logger`.

- `POST /api/podcasts/:id/refresh`
  - Purpose: Fetch latest feed items and insert new episodes (up to latest N, dedupe by guid).
  - Uses: `getLatestEpisodes(podcast.rssUrl, 10)` from `server/services/rssParser.js`, `Episode.findOne()` to check existence, `Episode.create()` and `Podcast.findByIdAndUpdate()`.

Key modules referenced by this router:
- `server/services/rssParser.js` (exports: `parseFeed`, `getLatestEpisodes`)
- `server/models/Podcast.js`, `server/models/Episode.js`

---

## /api/data (server/routes/import-export.js)
Import and export podcasts and system settings as JSON.

- `GET /api/data/export`
  - Purpose: Produce a JSON file containing all podcasts and system settings suitable for import or backup.
  - Uses: `Podcast.find().select(...)`, `SystemSettings.getSettings()`, `logger`.

- `POST /api/data/import` (multipart file field: `file`)
  - Purpose: Import podcasts and settings from a JSON file. Validates RSS feeds during import.
  - Uses: multer upload, `parseFeed()` (RSS validation), `Podcast.findOne()` to dedupe, `Podcast.create()`, `SystemSettings.getSettings()` and `settings.save()`.

---

## Models & Services (quick reference)

- Models in `server/models/` (examples used by routes):
  - `Podcast.js`, `Episode.js`, `DriveCredentials.js`, `SystemSettings.js`, `DownloadHistory.js`, `Stats.js`

- Services in `server/services/` referenced throughout routes:
  - `cloudStorage.js` — Drive client initialization and helpers (`initializeDrive`, `getDriveClient`, `listFilesInFolder`).
  - `downloader.js` — `downloadEpisode(episode, podcast)` to download/upload episodes.
  - `rssParser.js` — `parseFeed(rssUrl)` and `getLatestEpisodes(rssUrl, limit)`.
  - `scheduler.js` — `startScheduler()` and `triggerManualCheck()`.
  - `syncStatus.js` — `getStatus()` to expose sync progress state.
  - `verifier.js` — `verifyDriveConsistency()` and `resyncEpisodesByIds()` for DB/Drive verification and targeted resyncs.

---

## Error handling & logging

- Routes use structured try/catch blocks and respond with 500 + message on unexpected errors.
- Logging is provided by `server/utils/logger.js` and is used in nearly every route.

---

## Next steps (optional enhancements)

- Add example request/response JSON for each endpoint.
- Generate an OpenAPI (Swagger) spec from this summary.
- Include the exact service function definitions (read service files and list internal helpers).

Generated: automatically from the repository routes on the local workspace.
