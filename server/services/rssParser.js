import Parser from 'rss-parser';
import { logger } from '../utils/logger.js';

const parser = new Parser({
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['itunes:explicit', 'explicit'],
      ['itunes:image', 'image']
    ]
  },
  timeout: 30000, // 30 second timeout for RSS feed fetching
  maxRedirects: 5
});

export async function parseFeed(feedUrl, retries = 2) {
  // Validate feedUrl
  if (!feedUrl) {
    throw new Error('RSS feed URL is required');
  }
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      logger.info(`Parsing RSS feed: ${feedUrl}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
      const feed = await parser.parseURL(feedUrl);
    
      return {
        title: feed.title,
        description: feed.description,
        imageUrl: feed.image?.url || feed.itunes?.image,
        author: feed.itunes?.author || feed.author,
        link: feed.link,
        episodes: feed.items.map(item => ({
          title: item.title,
          description: item.contentSnippet || item.description,
          guid: item.guid || item.link,
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          audioUrl: item.enclosure?.url,
          duration: item.duration || item.itunes?.duration,
          fileSize: item.enclosure?.length ? parseInt(item.enclosure.length) : null,
          link: item.link,
          imageUrl: item.image?.href || item.image || item.itunes?.image
        }))
      };
    } catch (error) {
      lastError = error;
      const isRetryable = error.code === 'ECONNRESET' || 
                          error.code === 'ETIMEDOUT' || 
                          error.code === 'ENOTFOUND' ||
                          error.code === 'EAI_AGAIN';
      
      if (isRetryable && attempt <= retries) {
        const delay = attempt * 1000; // 1s, 2s
        logger.warn(`RSS feed parsing attempt ${attempt} failed with ${error.code}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`Error parsing RSS feed ${feedUrl}:`, error);
        throw error;
      }
    }
  }
  
  // If we got here, all retries failed
  throw lastError;
}

export async function getLatestEpisodes(feedUrl, limit = 5) {
  // Validate feedUrl
  if (!feedUrl) {
    throw new Error('RSS feed URL is required');
  }
  
  try {
    const feedData = await parseFeed(feedUrl);
    return feedData.episodes.slice(0, limit);
  } catch (error) {
    logger.error(`Error getting latest episodes from ${feedUrl}:`, error);
    throw error;
  }
}
