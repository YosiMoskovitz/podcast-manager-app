import Parser from 'rss-parser';
import { logger } from '../utils/logger.js';

const parser = new Parser({
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['itunes:explicit', 'explicit'],
      ['itunes:image', 'itunesImage'],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail']
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
        episodes: feed.items.map(item => {
          // Try multiple sources for episode image
          let episodeImageUrl = null;
          
          // 1. Try itunes:image attribute with href
          if (item.itunesImage?.$ && item.itunesImage.$.href) {
            episodeImageUrl = item.itunesImage.$.href;
          }
          // 2. Try itunes:image as direct value
          else if (typeof item.itunesImage === 'string') {
            episodeImageUrl = item.itunesImage;
          }
          // 3. Try media:content or media:thumbnail
          else if (item.mediaContent && item.mediaContent.length > 0) {
            const imageMedia = item.mediaContent.find(m => m.$ && m.$.medium === 'image');
            if (imageMedia?.$.url) {
              episodeImageUrl = imageMedia.$.url;
            }
          }
          else if (item.mediaThumbnail?.$.url) {
            episodeImageUrl = item.mediaThumbnail.$.url;
          }
          // 4. Try enclosure with image type
          else if (item.enclosure?.type?.startsWith('image/')) {
            episodeImageUrl = item.enclosure.url;
          }
          // 5. Fallback to itunes object
          else if (item.itunes?.image) {
            episodeImageUrl = item.itunes.image;
          }
          
          return {
            title: item.title,
            description: item.contentSnippet || item.description,
            guid: item.guid || item.link,
            pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            audioUrl: item.enclosure?.url,
            duration: item.duration || item.itunes?.duration,
            fileSize: item.enclosure?.length ? parseInt(item.enclosure.length) : null,
            link: item.link,
            imageUrl: episodeImageUrl
          };
        })
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
