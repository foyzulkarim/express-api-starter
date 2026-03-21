import { Redis } from 'ioredis';

// BullMQ requires its own dedicated Redis connection separate from the cache client.
export function createBullMQClient(redisUrl: string): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
  client.on('error', (err: Error) => {
    console.error('[BullMQ Redis] Connection error:', err.message);
  });
  return client;
}

export type BullMQClient = Redis;
