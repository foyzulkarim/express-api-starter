import { config } from './index.js';

export const queueConfig = {
  redisUrl: config.REDIS_URL,
} as const;
