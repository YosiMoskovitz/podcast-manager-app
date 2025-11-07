# Implementation Summary: Clear Episodes & Folder Migration Features

## Overview
Two new features have been implemented for the Podcast Manager App:
1. **Clear All Episodes Data** - Allows users to reset all episode data and files
2. **Migrate Main Podcast Folder** - Allows users to change the main podcast folder location in Google Drive

---

## Feature 1: Clear All Episodes Data

### Purpose
Provides a way to completely reset the episode data, deleting all episodes from the database and all corresponding files from Google Drive. This allows the sync process to start fresh as if it's the first run.

### Backend Changes

#### File: `server/routes/episodes.js`
- **New Endpoint**: `DELETE /api/episodes/clear-all/confirm`
- **Functionality**:
  - Deletes all files from Google Drive podcast subfolders
  - Deletes all episodes from MongoDB
  - Resets `driveFolderId` field for all podcasts (allows folders to be recreated on next sync)
  - Returns summary of deleted items and any errors

#### Response Format:
```json
{
  "message": "All episodes cleared successfully",
  "episodesDeleted": 25,
  "filesDeleted": 23,
  "podcastsReset": 5,
  "errors": []
}
```

### Frontend Changes

#### File: `src/services/api.js`
- **New Function**: `clearAllEpisodes()` - Calls the backend endpoint

#### File: `src/pages/Settings.jsx`
- **New UI Section**: "Data Management" section added
- **New State Variables**:
  - `clearing` - tracks clearing operation status
- **New Handler**: `handleClearAllEpisodes()`
  - Shows double confirmation dialogs (safety measure)
  - Calls the API
  - Shows success/error notifications
- **UI Elements**:
  - Red warning section with clear explanation
  - "Clear All Episodes Data" button with loading state
  - Trash icon with spinning animation during operation

---

## Feature 2: Migrate Main Podcast Folder

### Purpose
Allows users to change the main podcast folder location in Google Drive. All podcast subfolders are moved to the new location, and the configuration is updated accordingly.

### Backend Changes

#### File: `server/routes/drive.js`
- **New Endpoint**: `POST /api/drive/migrate-folder`
- **Request Body**: `{ "newFolderId": "string" }`
- **Functionality**:
  - Validates the new folder ID exists in Google Drive
  - If no old folder exists, just sets the new one
  - Checks that new folder is different from current
  - Lists all podcast subfolders in current location
  - Moves each podcast folder to new location using Google Drive API
  - Updates Drive configuration with new folder ID
  - Returns summary of migrated folders

#### Response Format:
```json
{
  "message": "Folder migration completed",
  "oldFolderId": "1abc...",
  "newFolderId": "1xyz...",
  "migrated": 5,
  "errors": []
}
```

### Frontend Changes

#### File: `src/services/api.js`
- **New Function**: `migratePodcastFolder(newFolderId)` - Calls the backend endpoint

#### File: `src/pages/Settings.jsx`
- **New Icons**: Imported `FolderSync` from lucide-react
- **New State Variables**:
  - `migrating` - tracks migration operation status
  - `newFolderId` - stores user input for new folder ID
- **New Handler**: `handleMigrateFolder()`
  - Validates input
  - Shows confirmation dialog with time warning
  - Calls the API
  - Shows success/error notifications
  - Clears input and refreshes config on success
- **UI Elements**:
  - Displays current folder ID
  - Input field for new folder ID
  - "Migrate Folder" button with loading state
  - Helper text showing how to get folder ID from Google Drive URL
  - FolderSync icon with spinning animation during operation

---

## Files Modified

### Backend
1. `server/routes/episodes.js` - Added clear all episodes endpoint
2. `server/routes/drive.js` - Added migrate folder endpoint

### Frontend
1. `src/services/api.js` - Added API functions for both features
2. `src/pages/Settings.jsx` - Added UI for both features

### Documentation
1. `test-new-features.md` - Testing guide
2. `IMPLEMENTATION_SUMMARY.md` - This file

---

## Security & Safety Features

### Clear Episodes
- **Double Confirmation**: Users must confirm twice before deletion
- **Clear Warnings**: UI clearly states the action is irreversible
- **Endpoint Path**: Uses `/clear-all/confirm` to prevent accidental calls
- **Error Handling**: Continues operation even if some files fail to delete
- **Logging**: All actions are logged for audit trail

### Folder Migration
- **Validation**: Verifies new folder exists before migration
- **Same Folder Check**: Prevents migration to the same folder
- **Authorization Check**: Requires Google Drive to be configured and authorized
- **Error Handling**: Continues migration even if some folders fail
- **Logging**: All actions are logged for audit trail

---

## Usage Flow

### Clear All Episodes Data
1. User navigates to Settings page
2. Scrolls to "Data Management" section
3. Clicks "Clear All Episodes Data" button
4. Confirms first dialog
5. Confirms second "FINAL CONFIRMATION" dialog
6. System deletes all data and shows results
7. Next sync run will start fresh

### Migrate Folder
1. User navigates to Settings page
2. Scrolls to "Data Management" section
3. Sees current folder ID displayed
4. Enters new Google Drive folder ID
5. Clicks "Migrate Folder" button
6. Confirms the migration dialog
7. System moves all podcast folders (may take time)
8. Shows success with count of migrated folders

---

## Testing

See `test-new-features.md` for detailed testing instructions.

### Quick Tests

#### Clear Episodes (PowerShell):
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/episodes/clear-all/confirm" -Method DELETE
```

#### Migrate Folder (PowerShell):
```powershell
$body = @{ newFolderId = "YOUR_FOLDER_ID" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:5000/api/drive/migrate-folder" -Method POST -Body $body -ContentType "application/json"
```

---

## Notes & Considerations

### Clear Episodes
- **Permanent**: Cannot be undone
- **Complete Reset**: Podcast definitions remain, but all episode records are deleted
- **Drive Cleanup**: Deletes files from Drive, doesn't just unlink them
- **Fresh Start**: After clearing, the next sync will be like the first run

### Folder Migration
- **Time**: May take several minutes with many podcasts
- **Non-Blocking**: Frontend shows loading state during migration
- **Partial Success**: If some folders fail, the rest still migrate
- **Episode Records**: Episode database records are not modified (they reference podcast folders via the Podcast model's `driveFolderId`)
- **No Re-upload**: Files are moved in Google Drive, not re-uploaded

### Future Enhancements
1. Add progress reporting during clear/migration operations
2. Add ability to preview what will be deleted/migrated
3. Add option to export data before clearing
4. Add background job for migration to avoid timeout on large datasets
5. Add webhook/event system to notify when operations complete
