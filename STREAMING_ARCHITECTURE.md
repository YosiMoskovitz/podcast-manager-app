# Streaming Architecture

## Direct Stream to Google Drive (No Local Storage)

This application uses a **zero-local-storage streaming architecture** for podcast episodes.

## How It Works

```
Podcast RSS Feed → Download Stream → Google Drive
                        ↓
                   (no local disk)
```

### Traditional Approach (Not Used)
```
❌ RSS Feed → Download to disk → Upload to Drive → Delete local file
   Problems:
   - Uses disk space (can be GBs)
   - Slower (two operations)
   - Requires cleanup
   - Risk of filling disk
```

### Our Approach (Used)
```
✅ RSS Feed → Stream directly to Drive
   Benefits:
   - Zero disk usage
   - Faster (one operation)
   - No cleanup needed
   - Works on limited storage devices
```

## Implementation Details

### Download Service (`server/services/downloader.js`)

```javascript
// 1. Get audio stream from podcast URL
const response = await axios({
  url: episode.audioUrl,
  responseType: 'stream'  // ← Key: get stream, not buffer
});

// 2. Stream directly to Google Drive (no local file)
await uploadStreamToDrive(response.data, filename, episode);

// 3. No local filepath - only Drive file ID stored in DB
```

### Upload Service (`server/services/cloudStorage.js`)

```javascript
export async function uploadStreamToDrive(stream, filename, episode) {
  const media = {
    mimeType: 'audio/mpeg',
    body: stream  // ← Readable stream passed directly to Drive API
  };
  
  const response = await driveClient.files.create({
    requestBody: fileMetadata,
    media: media  // ← Google Drive API handles the streaming
  });
  
  return {
    fileId: response.data.id,
    webViewLink: response.data.webViewLink
  };
}
```

## Database Storage

Episodes store **only cloud references**, not local paths:

```javascript
{
  _id: "...",
  title: "Episode Title",
  cloudFileId: "1a2B3c4D5e6F7g8H9i0J",  // ← Google Drive file ID
  cloudUrl: "https://drive.google.com/...",
  fileSize: 45678912,  // ← tracked during stream
  localPath: null  // ← never set, no local storage
}
```

## Memory Usage

The streaming approach uses **minimal memory**:

- Node.js streams data in **small chunks** (typically 64KB)
- Memory usage is **O(chunk size)**, not **O(file size)**
- Can stream multi-GB files with only MBs of RAM

```javascript
// Axios provides readable stream
const stream = response.data;  // ReadableStream

// Track bytes without loading into memory
let bytesDownloaded = 0;
stream.on('data', (chunk) => {
  bytesDownloaded += chunk.length;  // ← Count only, don't store
});
```

## Error Handling

If streaming fails:
1. Episode status set to `'failed'`
2. Error message stored in database
3. No local cleanup needed (no files to delete)
4. User can retry download

```javascript
catch (error) {
  await Episode.findByIdAndUpdate(episode._id, {
    status: 'failed',
    errorMessage: error.message
  });
  // No local files to clean up!
}
```

## Benefits Summary

### ✅ Disk Space
- **Zero local storage** required for episodes
- Only app code and MongoDB use disk
- Perfect for servers with limited storage

### ✅ Performance
- **Single operation** (download + upload combined)
- No disk I/O bottleneck
- Faster than download-then-upload

### ✅ Reliability
- **No partial files** left on disk if crash
- No cleanup jobs needed
- Simpler error recovery

### ✅ Scalability
- Can download **unlimited episodes**
- Memory usage stays constant
- No "disk full" errors

## Comparison

| Aspect | Traditional | Streaming (Ours) |
|--------|-------------|------------------|
| Disk Space | Needs GBs | Zero bytes |
| Speed | 2x time | 1x time |
| Memory | O(file size) | O(chunk size) |
| Cleanup | Required | None needed |
| Failure Recovery | Complex | Simple |

## Configuration

No configuration needed! The streaming approach is always used:

```env
# No DOWNLOAD_DIR needed
# No STORAGE_PROVIDER option
# Everything goes to Drive automatically
```

## Limitations

### Requires Google Drive
- This app **requires** Google Drive to be configured
- Without Drive credentials, downloads will fail
- This is by design - the app is built for Drive-first workflow

### No Local Playback
- Episodes are not stored locally
- Listen through Google Drive interface
- Or download from Drive to local device

## Future Enhancements

Possible additions while maintaining streaming:

1. **Multiple Cloud Providers**
   - Stream to Dropbox, OneDrive, etc.
   - Same zero-storage approach

2. **Optional Local Cache**
   - Keep last N episodes locally
   - For offline playback
   - Still stream-first

3. **Transcoding**
   - Stream → Transcode → Upload
   - Convert formats on-the-fly
   - Still no intermediate disk storage

## Technical Notes

### Node.js Streams
- Uses standard Node.js `ReadableStream`
- Compatible with Axios, Google Drive API
- Automatic backpressure handling

### Google Drive API
- Supports direct stream upload
- Handles large files efficiently
- Provides resumable uploads (not yet implemented)

### MongoDB
- Stores only metadata (KB per episode)
- Credentials encrypted at rest
- No binary file storage

## Monitoring

Check streaming in logs:

```bash
tail -f logs/combined.log | grep "Streaming"

# Output:
# Streaming to Google Drive: 2025-01-15-Episode_Title.mp3
# Stream upload successful: 2025-01-15-Episode_Title.mp3 (1a2B3c4D5e)
```

## Summary

This application achieves **true zero-footprint episode storage** by streaming podcast episodes directly from RSS feeds to Google Drive without touching local disk. This design enables unlimited podcast management on resource-constrained systems while maintaining simplicity and performance.

**No downloads folder. No disk space. Just streams.** 🌊→☁️
