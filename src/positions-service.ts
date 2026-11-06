import { PhDPosition } from './types';
import { scanFeeds } from './scanner';
import { savePositions, getAllStoredPositions } from './db';
import { getCachedPositionsFromRedis, setCachedPositionsInRedis } from './redis';

export async function getPositions(force = false, apiKey?: string): Promise<PhDPosition[]> {
  if (!force) {
    const cached = await getCachedPositionsFromRedis();
    if (cached && cached.length > 0) {
      return cached;
    }

    const stored = getAllStoredPositions();
    if (stored && stored.length > 0) {
      setCachedPositionsInRedis(stored, 3600).catch(() => {});
      return stored;
    }
  }

  const fresh = await scanFeeds(apiKey);
  if (fresh.length > 0) {
    savePositions(fresh);
    setCachedPositionsInRedis(fresh, 3600).catch(() => {});
  }
  return fresh;
}

