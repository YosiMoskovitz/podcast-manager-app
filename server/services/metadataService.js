/**
 * Service for adding ID3 metadata tags to audio files
 * Makes files appear with proper album (podcast), artist, and song (episode) names
 * when synced to Android devices or music players
 */

import { PassThrough } from 'stream';
import { logger } from '../utils/logger.js';

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

    // Add text frames
    if (frames.TIT2) frameData = Buffer.concat([frameData, createTextFrame('TIT2', frames.TIT2)]);
    if (frames.TPE1) frameData = Buffer.concat([frameData, createTextFrame('TPE1', frames.TPE1)]);
    if (frames.TALB) frameData = Buffer.concat([frameData, createTextFrame('TALB', frames.TALB)]);
    if (frames.TRCK) frameData = Buffer.concat([frameData, createTextFrame('TRCK', frames.TRCK)]);
    if (frames.TYER) frameData = Buffer.concat([frameData, createTextFrame('TYER', frames.TYER)]);
    if (frames.TCON) frameData = Buffer.concat([frameData, createTextFrame('TCON', frames.TCON)]);

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
