/**
 * Service for adding ID3 metadata tags to audio files
 * Makes files appear with proper album (podcast), artist, and song (episode) names
 * when synced to Android devices or music players
 */

import { PassThrough } from 'stream';
import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * Download podcast image from URL and convert to buffer
 * Supports JPEG and PNG formats for album art
 * 
 * @param {string} imageUrl - URL of the podcast image
 * @returns {Promise<Buffer|null>} Image buffer or null if download fails
 */
export async function downloadPodcastImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 10000, // 10 second timeout for image download
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Validate that we got an image (check content-type)
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('image')) {
      logger.warn(`Download podcast image: Invalid content-type received: ${contentType}`);
      return null;
    }

    const buffer = Buffer.from(response.data);
    logger.debug(`Downloaded podcast image: ${buffer.length} bytes from ${imageUrl.substring(0, 50)}...`);
    return buffer;

  } catch (error) {
    logger.warn(`Failed to download podcast image from ${imageUrl}: ${error.message}`);
    // Return null rather than throwing - missing image shouldn't break the download
    return null;
  }
}

/**
 * Add ID3 metadata tags to MP3 audio stream
 * Transforms the stream by injecting ID3v2 tags
 * 
 * @param {Stream} audioStream - Input audio stream
 * @param {Object} metadata - Metadata to embed
 * @param {string} metadata.title - Episode title (song name)
 * @param {string} metadata.artist - Podcast author/artist
 * @param {string} metadata.album - Podcast name (album)
 * @param {number} metadata.trackNumber - Episode sequence number
 * @param {Buffer} metadata.albumArt - Optional album artwork image buffer (JPG/PNG)
 * @returns {Promise<Stream>} Stream with ID3 tags prepended
 */
export async function addID3Metadata(audioStream, metadata) {
  try {
    if (!audioStream || !metadata) {
      logger.warn('addID3Metadata: Missing stream or metadata, returning original stream');
      return audioStream;
    }

    const {
      title = 'Unknown Episode',
      artist = 'Unknown Podcast',
      album = 'Unknown Podcast',
      trackNumber = 0,
      albumArt = null,
      year = new Date().getFullYear().toString(),
      genre = 'Podcast'
    } = metadata;

    // Create ID3v2.4 tags
    const tags = {
      v2: {
        TIT2: title,              // Song/Episode title
        TPE1: artist,             // Artist/Podcast author
        TALB: album,              // Album/Podcast name
        TRCK: String(trackNumber), // Track number/Episode number
        TYER: year,               // Year
        TCON: genre,              // Genre
        COMM: {
          language: 'eng',
          shortDescription: '',
          text: `Episode from ${album}`
        }
      }
    };

    // Add album art if provided
    if (albumArt && Buffer.isBuffer(albumArt)) {
      tags.v2.APIC = {
        mime: 'image/jpeg',
        type: 3, // 3 = Cover (front)
        description: 'Cover',
        imageBuffer: albumArt
      };
    }

    logger.debug(`Adding ID3 metadata: "${title}" by "${artist}" from album "${album}"`);

    // Create a pass-through stream and write the tagged audio to it
    const outputStream = new PassThrough();

    // Use id3 library to write tags
    // Note: id3js works with file paths, so we need to buffer the stream first
    // For streaming to Drive, we'll prepend the ID3 tag header manually
    const id3TagBuffer = createID3v2TagBuffer(tags.v2);
    
    // Write ID3 tag to output stream first
    outputStream.write(id3TagBuffer);

    // Then pipe the audio data
    audioStream.pipe(outputStream);

    // Handle errors in the input stream
    audioStream.on('error', (error) => {
      logger.error('Error in audio stream while adding metadata:', error);
      outputStream.destroy(error);
    });

    return outputStream;

  } catch (error) {
    logger.error('Error adding ID3 metadata:', error);
    // Return original stream on error
    return audioStream;
  }
}

/**
 * Create a minimal ID3v2.4 tag buffer
 * Format spec: https://id3.org/id3v2.4.0-structure
 * 
 * @param {Object} frames - ID3 frame data
 * @returns {Buffer} ID3v2 tag buffer
 */
function createID3v2TagBuffer(frames) {
  try {
    // Build frame data
    let frameData = Buffer.alloc(0);

    // Helper to create text information frame (TXxx)
    const createTextFrame = (frameId, text) => {
      if (!text) return Buffer.alloc(0);
      const encoding = 0x03; // UTF-8
      const textBuffer = Buffer.from(text, 'utf-8');
      const size = textBuffer.length + 1; // +1 for encoding byte
      const header = Buffer.alloc(10);
      header.write(frameId, 0, 4, 'ascii');
      header.writeUInt32BE(size, 4);
      header.writeUInt16BE(0, 8); // flags
      
      return Buffer.concat([header, Buffer.from([encoding]), textBuffer]);
    };

    // Helper to create APIC frame (attached picture/album art)
    const createAPICFrame = (apicData) => {
      if (!apicData || !apicData.imageBuffer) return Buffer.alloc(0);
      
      const encoding = 0x03; // UTF-8
      const mimeBuffer = Buffer.from(apicData.mime || 'image/jpeg', 'utf-8');
      const descriptionBuffer = Buffer.from(apicData.description || 'Cover', 'utf-8');
      const pictureType = apicData.type || 3; // 3 = Cover (front)
      
      // Build APIC frame: encoding + mime type (null-terminated) + picture type + description (null-terminated) + picture data
      const content = Buffer.concat([
        Buffer.from([encoding]),
        mimeBuffer,
        Buffer.from([0]), // null terminator for MIME
        Buffer.from([pictureType]),
        descriptionBuffer,
        Buffer.from([0]), // null terminator for description
        apicData.imageBuffer
      ]);
      
      const header = Buffer.alloc(10);
      header.write('APIC', 0, 4, 'ascii');
      header.writeUInt32BE(content.length, 4);
      header.writeUInt16BE(0, 8); // flags
      
      return Buffer.concat([header, content]);
    };

    // Add text frames
    if (frames.TIT2) frameData = Buffer.concat([frameData, createTextFrame('TIT2', frames.TIT2)]);
    if (frames.TPE1) frameData = Buffer.concat([frameData, createTextFrame('TPE1', frames.TPE1)]);
    if (frames.TALB) frameData = Buffer.concat([frameData, createTextFrame('TALB', frames.TALB)]);
    if (frames.TRCK) frameData = Buffer.concat([frameData, createTextFrame('TRCK', frames.TRCK)]);
    if (frames.TYER) frameData = Buffer.concat([frameData, createTextFrame('TYER', frames.TYER)]);
    if (frames.TCON) frameData = Buffer.concat([frameData, createTextFrame('TCON', frames.TCON)]);
    
    // Add album art if provided
    if (frames.APIC) frameData = Buffer.concat([frameData, createAPICFrame(frames.APIC)]);

    // Create ID3v2.4 header
    // Spec: 'ID3' + version (0x04 0x00) + flags + size
    const header = Buffer.alloc(10);
    header.write('ID3', 0, 3, 'ascii');
    header[3] = 0x04; // Version 2.4
    header[4] = 0x00; // Revision
    header[5] = 0x00; // Flags (no flags set)

    // Write size (synchsafe integer - max 7 bits per byte)
    const size = frameData.length;
    header[6] = (size >> 21) & 0x7F;
    header[7] = (size >> 14) & 0x7F;
    header[8] = (size >> 7) & 0x7F;
    header[9] = size & 0x7F;

    return Buffer.concat([header, frameData]);

  } catch (error) {
    logger.error('Error creating ID3v2 tag buffer:', error);
    return Buffer.alloc(0);
  }
}

export default {
  addID3Metadata,
  createID3v2TagBuffer
};
