import Redis from 'ioredis';

export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl);
}

export type { Redis };
