import { config } from './index.js';

export const redisConfig = {
  url: config.REDIS_URL,
} as const;
