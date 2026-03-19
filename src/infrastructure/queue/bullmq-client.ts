import Redis from 'ioredis';

// BullMQ requires its own dedicated Redis connection separate from the cache client.
export function createBullMQClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
}

export type BullMQClient = Redis;
