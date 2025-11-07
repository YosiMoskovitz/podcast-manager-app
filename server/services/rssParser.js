import Parser from 'rss-parser';
import { logger } from '../utils/logger.js';

const parser = new Parser({
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['itunes:explicit', 'explicit'],
      ['itunes:image', 'image']
    ]
  }
});

export async function parseFeed(feedUrl) {
  try {
    logger.info(`Parsing RSS feed: ${feedUrl}`);
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
        link: item.link
      }))
    };
  } catch (error) {
    logger.error(`Error parsing RSS feed ${feedUrl}:`, error);
    throw error;
  }
}

export async function getLatestEpisodes(feedUrl, limit = 5) {
  try {
    const feedData = await parseFeed(feedUrl);
    return feedData.episodes.slice(0, limit);
  } catch (error) {
    logger.error(`Error getting latest episodes from ${feedUrl}:`, error);
    throw error;
  }
}
