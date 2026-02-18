# API Endpoints

## Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - Logout

## Podcasts
- `GET /api/podcasts/search?q=...&limit=10` - Search Apple Podcasts
- `GET /api/podcasts` - Get all podcasts
- `GET /api/podcasts/:id` - Get podcast with latest episodes
- `POST /api/podcasts` - Add new podcast
- `PUT /api/podcasts/:id` - Update podcast
- `DELETE /api/podcasts/:id` - Delete podcast
- `POST /api/podcasts/:id/refresh` - Refresh a podcast feed
- `POST /api/podcasts/:id/rebuild-metadata` - Rebuild metadata from RSS
- `POST /api/podcasts/:id/reset-counter` - Reset numbering for a podcast
- `POST /api/podcasts/:id/start-over` - Start over (delete episodes and Drive files)
- `GET /api/podcasts/:id/rss-items` - RSS items merged with system status
- `POST /api/podcasts/:id/download-rss` - Manual download from RSS item

## Episodes
- `GET /api/episodes` - Get episodes (with filters)
- `GET /api/episodes/:id` - Get episode details
- `POST /api/episodes/:id/download` - Download episode
- `POST /api/episodes/:id/resync` - Re-upload episode to Drive
- `POST /api/episodes/:id/protect` - Protect/unprotect episode from cleanup
- `POST /api/episodes/:id/remove` - Remove episode from Drive (keep record)
- `DELETE /api/episodes/:id` - Delete episode record
- `DELETE /api/episodes/clear-all/confirm` - Clear all episodes

## Drive Integration
- `GET /api/drive/config` - Get Drive configuration
- `POST /api/drive/credentials` - Upload OAuth credentials
- `POST /api/drive/token` - Upload OAuth token
- `GET /api/drive/auth-url` - Get OAuth authorization URL
- `POST /api/drive/exchange-code` - Exchange OAuth code for tokens
- `POST /api/drive/folder` - Set Drive folder
- `POST /api/drive/toggle` - Enable/disable Drive
- `POST /api/drive/test` - Test Drive connection
- `POST /api/drive/create-folder` - Create main Podcasts folder
- `POST /api/drive/create-custom-folder` - Create a custom folder
- `POST /api/drive/migrate-folder` - Migrate to a new folder
- `GET /api/drive/folders` - Browse Drive folders
- `GET /api/drive/diagnostic/files` - Diagnostic listing
- `DELETE /api/drive/config` - Reset Drive configuration

## Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

## Statistics
- `GET /api/stats/current` - Current stats
- `GET /api/stats/history?days=7` - Historical stats
- `GET /api/stats/downloads` - Download history
- `GET /api/stats/podcasts` - Podcast stats summary

## Sync
- `GET /api/sync/status` - Get sync status
- `POST /api/sync/verify` - Verify DB vs Drive files
- `POST /api/sync/resync` - Re-sync episodes by ID (`episodeIds` array)
- `POST /api/check-now` - Manually trigger a podcast check

## Health
- `GET /api/health` - Health check

## Import/Export
- `GET /api/data/export` - Export data
- `POST /api/data/import` - Import data
