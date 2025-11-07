# Drive Folder Validation Fix

## Problem
The system was encountering `404 File not found` errors when trying to upload episodes to Google Drive. This happened because:

1. **Stale Folder IDs**: Podcast records in the database stored `driveFolderId` that pointed to folders that were deleted or no longer exist in Google Drive
2. **No Validation**: The upload process didn't verify if the folder ID was still valid before attempting to use it
3. **Confusing Error Messages**: The error mentioned looking for a "file" when it was actually a parent folder that was missing

## Root Cause Analysis

When an episode is uploaded:
1. System checks if `podcast.driveFolderId` exists in database
2. If yes, it directly uses that ID as the parent folder
3. Google Drive API returns 404 because that folder ID no longer exists
4. Upload fails with cryptic error message

This commonly happens when:
- User manually deletes podcast folders in Google Drive
- Drive folder is moved or trashed
- Database is migrated but Drive folder IDs aren't updated
- Testing/debugging creates orphaned references

## Solution Implemented

### 1. Folder Validation Before Upload
Added `verifyFolderExists()` function that:
- Checks if the folder ID actually exists in Google Drive
- Uses Google Drive API `files.get()` to validate
- Returns `false` on 404 errors (folder doesn't exist)
- Re-throws other errors for proper error handling

### 2. Automatic Folder Recreation
Enhanced `uploadStreamToDrive()` to:
- Verify folder exists before using cached ID
- If folder is missing, log a warning and clear the cached ID
- Call `getOrCreatePodcastFolder()` to create a new folder
- Update podcast record with new folder ID
- Continue upload seamlessly

### 3. Improved Verification
Updated `verifyDriveConsistency()` to:
- Handle podcasts without folder IDs (show all downloaded episodes as missing)
- Catch 404 errors when listing folder contents
- Display helpful error messages in verification results
- Distinguish between "no folder ID" vs "folder deleted"

### 4. Better Error Messages
- Verification modal now shows warnings and errors per podcast
- Users see "Podcast folder no longer exists in Drive (folder will be recreated on next upload)"
- Clear distinction between missing folder vs missing files

## Code Changes

### cloudStorage.js
```javascript
async function verifyFolderExists(folderId) {
  // Check if folder ID is still valid in Drive
  try {
    await driveClient.files.get({ fileId: folderId });
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    throw error;
  }
}

export async function uploadStreamToDrive(stream, filename, podcast) {
  // ... existing code ...
  
  let podcastFolderId = podcast.driveFolderId;
  
  // Verify folder exists before using it
  if (podcastFolderId) {
    const folderExists = await verifyFolderExists(podcastFolderId);
    if (!folderExists) {
      logger.warn(`Podcast folder ${podcastFolderId} no longer exists. Creating new folder.`);
      podcastFolderId = null; // Force recreation
    }
  }
  
  // Get or create folder if needed
  if (!podcastFolderId) {
    podcastFolderId = await getOrCreatePodcastFolder(podcast.name, mainFolderId);
    podcast.driveFolderId = podcastFolderId;
    await podcast.save();
  }
  
  // ... continue with upload ...
}
```

### verifier.js
```javascript
export async function verifyDriveConsistency() {
  // ... existing code ...
  
  try {
    files = await listFilesInFolder(folderId);
  } catch (error) {
    if (error.code === 404) {
      // Folder deleted - all downloaded episodes are missing
      results.push({
        podcastId: podcast._id,
        name: podcast.name,
        missingInDrive: downloadedEpisodes,
        extraOnDrive: [],
        summary: { missingCount: downloadedEpisodes.length, extraCount: 0 },
        error: 'Podcast folder no longer exists in Drive'
      });
      continue;
    }
    throw error;
  }
  
  // ... existing code ...
}
```

## User Experience

### Before Fix
1. User triggers manual sync or re-sync
2. Upload fails with cryptic error: "File not found: 1w14inLq47qOKKH..."
3. Episode status set to "failed"
4. User has no clear path to fix the issue

### After Fix
1. User triggers manual sync or re-sync
2. System detects folder is missing (logged as warning)
3. System automatically creates new folder in Drive
4. Upload succeeds with new folder ID
5. Database updated with new folder reference
6. Seamless experience - no user intervention needed

### Verification Flow
1. User clicks "Verify Files"
2. System checks each podcast folder
3. If folder missing, shows clear error message
4. User can select episodes and re-sync
5. Re-sync automatically recreates folders as needed

## Technical Notes

- **No Local Files**: System streams directly from RSS feed URL to Google Drive (no local storage used)
- **Folder Caching**: Folder IDs cached in database for performance, but now validated before use
- **Idempotent**: Multiple re-syncs won't create duplicate folders (uses `getOrCreatePodcastFolder`)
- **Atomic Updates**: Podcast record updated with new folder ID before upload completes

## Testing Recommendations

1. **Delete Folder Test**: Manually delete a podcast folder in Drive, then trigger re-sync
2. **No Folder ID Test**: Remove `driveFolderId` from a podcast record, then upload episode
3. **Verify After Delete**: Delete folder, run verification, check error messages
4. **Bulk Re-sync**: Select multiple episodes from podcast with deleted folder, verify all work

## Future Improvements

- Add periodic folder validation job to proactively detect missing folders
- Cache folder existence checks (with TTL) to reduce API calls
- Add UI option to "reset folder" for a podcast
- Implement folder recovery from trash before creating new folder
