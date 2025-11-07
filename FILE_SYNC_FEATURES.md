# File Verification & Re-sync Features

## Overview
Added comprehensive file verification and re-sync capabilities to ensure database episodes match files in Google Drive.

## New Features

### 1. File Verification
- **Location**: Dashboard page - "Verify Files" button
- **Functionality**: 
  - Compares episodes in database with files in Google Drive
  - Identifies episodes marked as downloaded but missing from Drive
  - Identifies extra files in Drive not tracked in database
  - Shows detailed results in a modal with per-podcast breakdown

### 2. Bulk Re-sync
- **Location**: Verification modal
- **Functionality**:
  - Select multiple missing episodes
  - Re-sync selected episodes to Google Drive
  - "Select All Missing" button for convenience
  - Progress feedback during re-sync

### 3. Per-Episode Re-sync
- **Location**: Episodes page
- **Functionality**:
  - "Re-sync" button appears for episodes that are downloaded but missing cloudFileId
  - Allows individual episode re-upload to Drive
  - Useful for fixing specific sync issues

### 4. Improved Manual Sync Modal
- **Location**: Dashboard - "Check Now" button
- **Fix**: Modal now shows immediately when manual sync is triggered
- **Improvement**: Better polling logic to ensure modal appears even if sync completes quickly

## Backend Changes

### New Endpoints
1. **POST /api/sync/verify** - Verify database vs Drive consistency
2. **POST /api/sync/resync** - Bulk re-sync episodes by IDs
3. **POST /api/episodes/:id/resync** - Re-sync individual episode

### New Services
- **verifier.js**: Contains verification and re-sync logic
  - `verifyDriveConsistency()`: Checks all podcasts for missing/extra files
  - `resyncEpisodesByIds()`: Re-uploads specified episodes

### Updated Services
- **cloudStorage.js**:
  - Added `getDriveClient()`: Exposes Drive client for verification
  - Added `listFilesInFolder()`: Lists all files in a Drive folder

## Frontend Changes

### New Components
- **VerificationModal.jsx**: Interactive modal showing verification results
  - Displays missing and extra files per podcast
  - Checkbox selection for episodes to re-sync
  - Real-time re-sync progress

### Updated Components
- **Dashboard.jsx**:
  - Added "Verify Files" button
  - Integrated VerificationModal
  - Improved sync status polling
  - Optimistic modal display on manual sync

- **Episodes.jsx**:
  - Added "Re-sync" button for problematic episodes
  - Uses new resync API endpoint

### New API Methods
- `verifyFiles()`: Trigger verification check
- `resyncEpisodes(episodeIds)`: Bulk re-sync
- `resyncEpisode(id)`: Single episode re-sync

## User Workflow

### Scenario 1: Manual Verification
1. User clicks "Verify Files" on Dashboard
2. System checks all podcasts against Drive
3. Modal shows results with any discrepancies
4. User selects episodes to re-sync
5. System re-uploads selected episodes

### Scenario 2: Episode-Level Fix
1. User notices episode missing cloudFileId on Episodes page
2. User clicks "Re-sync" button next to episode
3. System re-uploads that specific episode

### Scenario 3: Manual Sync with Modal
1. User clicks "Check Now" on Dashboard
2. Modal appears immediately showing progress
3. Real-time updates as podcasts are synced
4. Modal remains visible after completion for review

## Technical Notes

- File verification uses Google Drive API to list files in podcast folders
- Re-sync resets episode status to pending and clears cloud fields
- Background download service handles actual re-upload
- Verification skips podcasts without Drive folder IDs
- Modal uses polling to update sync progress every second

## Error Handling

- Drive not configured: Verification returns "skipped" status
- Missing podcast folder: Episode shows as missing, can be re-synced
- Re-sync failures: Logged and episode status updated to "failed"
- API errors: Displayed via toast notifications
