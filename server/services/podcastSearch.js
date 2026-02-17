import { logger } from '../utils/logger.js';

/**
 * Search for podcasts using Apple Podcasts API
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results (default: 10)
 * @returns {Promise<Array>} Array of podcast results
 */
export async function searchApplePodcasts(query, limit = 10) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://itunes.apple.com/search?term=${encodedQuery}&media=podcast&limit=${limit}`;
    
    logger.info(`Searching Apple Podcasts for: ${query}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Apple API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform results to a cleaner format
    const results = data.results.map(item => ({
      id: item.collectionId,
      name: item.collectionName,
      author: item.artistName,
      feedUrl: item.feedUrl,
      description: item.collectionCensoredName, // Apple doesn't provide full description in search
      imageUrl: item.artworkUrl600 || item.artworkUrl100,
      thumbnailUrl: item.artworkUrl100,
      genre: item.primaryGenreName,
      episodeCount: item.trackCount,
      explicit: item.collectionExplicitness !== 'notExplicit',
      appleUrl: item.collectionViewUrl,
      releaseDate: item.releaseDate
    }));
    
    logger.info(`Found ${results.length} podcasts`);
    
    return results;
  } catch (error) {
    logger.error('Error searching Apple Podcasts:', error);
    throw error;
  }
}
