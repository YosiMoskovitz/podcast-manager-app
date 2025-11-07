# Testing Guide for New Features

## Feature 1: Clear All Episodes Data

### Backend Endpoint
- **Method**: DELETE
- **URL**: `http://localhost:5000/api/episodes/clear-all/confirm`
- **Description**: Deletes all episodes from MongoDB and all files from Google Drive podcast folders

### What it does:
1. Deletes all files from Google Drive podcast subfolders
2. Deletes all episodes from the MongoDB database
3. Resets the `driveFolderId` field for all podcasts (so folders can be recreated)
4. Returns a summary of deleted episodes, files, and reset podcasts

### Test with curl (PowerShell):
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/episodes/clear-all/confirm" -Method DELETE | Select-Object -Expand Content
```

### Test from UI:
1. Go to Settings page
2. Scroll to "Data Management" section
3. Click "Clear All Episodes Data" button
4. Confirm both dialog prompts
5. Check the toast notification for results

---

## Feature 2: Migrate Main Podcast Folder

### Backend Endpoint
- **Method**: POST
- **URL**: `http://localhost:5000/api/drive/migrate-folder`
- **Body**: `{ "newFolderId": "YOUR_NEW_FOLDER_ID" }`
- **Description**: Moves all podcast subfolders from the current main folder to a new location

### What it does:
1. Validates the new folder ID exists in Google Drive
2. Lists all podcast subfolders in the current main folder
3. Moves each podcast folder to the new main folder location
4. Updates the Drive configuration with the new folder ID
5. Returns a summary of migrated folders

### Test with curl (PowerShell):
```powershell
$body = @{ newFolderId = "YOUR_NEW_FOLDER_ID_HERE" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:5000/api/drive/migrate-folder" -Method POST -Body $body -ContentType "application/json" | Select-Object -Expand Content
```

### Test from UI:
1. Go to Settings page
2. Scroll to "Data Management" section
3. Find "Migrate Main Podcast Folder" section
4. Enter a new Google Drive folder ID
5. Click "Migrate Folder" button
6. Confirm the dialog
7. Wait for migration to complete (may take time)
8. Check the toast notification for results

---

## Manual Testing Checklist

### Before Testing
- [ ] Backend server is running (`npm run dev` in server directory)
- [ ] Frontend is running (`npm run dev` in root directory)
- [ ] Google Drive is configured and authorized
- [ ] You have some test podcasts and episodes in the system

### Test Clear Episodes
- [ ] Backend: Can call DELETE `/api/episodes/clear-all/confirm`
- [ ] Backend: Episodes are deleted from MongoDB
- [ ] Backend: Files are deleted from Google Drive
- [ ] Backend: Podcast `driveFolderId` fields are reset
- [ ] Frontend: Button appears in Settings
- [ ] Frontend: Confirmation dialogs appear
- [ ] Frontend: Success/error toast notifications work
- [ ] Sync: Running sync after clear creates episodes from scratch

### Test Folder Migration
- [ ] Backend: Can call POST `/api/drive/migrate-folder` with valid folder ID
- [ ] Backend: Validates folder ID exists
- [ ] Backend: Moves podcast folders to new location
- [ ] Backend: Updates configuration with new folder ID
- [ ] Frontend: Input field and button appear in Settings
- [ ] Frontend: Shows current folder ID
- [ ] Frontend: Confirmation dialog appears
- [ ] Frontend: Migration progress indication (button disabled, spinner)
- [ ] Frontend: Success/error toast notifications work
- [ ] Verify: Folders are in new location in Google Drive
- [ ] Verify: Episode records still reference correct folder IDs

---

## Expected Responses

### Clear Episodes Success:
```json
{
  "message": "All episodes cleared successfully",
  "episodesDeleted": 25,
  "filesDeleted": 23,
  "podcastsReset": 5,
  "errors": undefined
}
```

### Migrate Folder Success:
```json
{
  "message": "Folder migration completed",
  "oldFolderId": "1abc...",
  "newFolderId": "1xyz...",
  "migrated": 5,
  "errors": undefined
}
```

---

## Notes

### Clear Episodes
- **IMPORTANT**: This is a destructive operation that cannot be undone
- Double confirmation dialogs are intentional
- Files in Google Drive are permanently deleted, not trashed
- After clearing, next sync will download and upload episodes as if first run

### Folder Migration
- Migration time depends on the number of podcast folders
- Only moves the podcast folders, not the main folder itself
- Does not re-upload episode files, just moves the existing folders
- If a folder fails to move, the error is logged but migration continues for other folders
- The configuration is updated even if some folders fail to migrate
