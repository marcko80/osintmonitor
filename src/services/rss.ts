import type { Feed, NewsItem } from '@/types';
import { ALERT_KEYWORDS } from '@/config';
import { chunkArray, fetchWithProxy } from '@/utils';

export async function fetchFeed(feed: Feed): Promise<NewsItem[]> {
  try {
    const response = await fetchWithProxy(feed.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn(`Parse error for ${feed.name}`);
      return [];
    }

    const items = doc.querySelectorAll('item');

    return Array.from(items)
      .slice(0, 5)
      .map((item) => {
        const title = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDateStr = item.querySelector('pubDate')?.textContent || '';
        const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();
        const isAlert = ALERT_KEYWORDS.some((kw) =>
          title.toLowerCase().includes(kw)
        );

        return {
          source: feed.name,
          title,
          link,
          pubDate,
          isAlert,
        };
      });
  } catch (e) {
    console.error(`Failed to fetch ${feed.name}:`, e);
    return [];
  }
}

export async function fetchCategoryFeeds(
  feeds: Feed[],
  options: {
    batchSize?: number;
    onBatch?: (items: NewsItem[]) => void;
  } = {}
): Promise<NewsItem[]> {
  const batchSize = options.batchSize ?? 5;
  const batches = chunkArray(feeds, batchSize);
  const items: NewsItem[] = [];

  for (const batch of batches) {
    const results = await Promise.all(batch.map(fetchFeed));
    items.push(...results.flat());

    items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
    options.onBatch?.(items.slice(0, 20));
  }

  return items.slice(0, 20);
}
