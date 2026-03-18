import { config } from './index.js';

export const queueConfig = Object.freeze({
  url: config.REDIS_URL,
});
