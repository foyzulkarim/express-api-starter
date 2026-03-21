import { Redis } from 'ioredis';

export function createRedisClient(redisUrl: string): Redis {
  const client = new Redis(redisUrl);
  client.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });
  return client;
}

export type { Redis };
