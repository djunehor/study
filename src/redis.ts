import Redis from 'ioredis';
import { PhDPosition } from './types';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
    });

    client.on('connect', () => {
      isRedisAvailable = true;
    });

    client.on('error', () => {
      isRedisAvailable = false;
    });

    // Attempt non-blocking connection
    client.connect().catch(() => {
      isRedisAvailable = false;
    });

    redisClient = client;
    return client;
  } catch (err: unknown) {
    console.warn('[Redis Cache] Could not initialize Redis client:', err);
    return null;
  }
}

const CACHE_KEY_POSITIONS = 'phd:positions:cached';
const CACHE_KEY_EVAL_PREFIX = 'phd:eval:';

export async function getCachedPositionsFromRedis(): Promise<PhDPosition[] | null> {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return null;
  try {
    const data = await client.get(CACHE_KEY_POSITIONS);
    if (!data) return null;
    return JSON.parse(data) as PhDPosition[];
  } catch {
    return null;
  }
}

export async function setCachedPositionsInRedis(positions: PhDPosition[], ttlSeconds = 3600): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return;
  try {
    await client.set(CACHE_KEY_POSITIONS, JSON.stringify(positions), 'EX', ttlSeconds);
  } catch {
    // Silently ignore cache write errors
  }
}

export async function getCachedEvaluationFromRedis(id: string): Promise<Partial<PhDPosition> | null> {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return null;
  try {
    const data = await client.get(`${CACHE_KEY_EVAL_PREFIX}${id}`);
    if (!data) return null;
    return JSON.parse(data) as Partial<PhDPosition>;
  } catch {
    return null;
  }
}

export async function setCachedEvaluationInRedis(id: string, evalData: Partial<PhDPosition>, ttlSeconds = 86400 * 7): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return;
  try {
    await client.set(`${CACHE_KEY_EVAL_PREFIX}${id}`, JSON.stringify(evalData), 'EX', ttlSeconds);
  } catch {
    // Silently ignore cache write errors
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
      isRedisAvailable = false;
    }
  }
}

