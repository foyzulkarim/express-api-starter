import { config } from './index.js';

/** Redis connection configuration derived from validated environment variables. */
export const redisConfig = Object.freeze({
  url: config.REDIS_URL,
});
