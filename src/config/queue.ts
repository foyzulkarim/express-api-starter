import { config } from './index.js';

/** Queue (BullMQ) connection configuration derived from validated environment variables. */
export const queueConfig = Object.freeze({
  url: config.REDIS_URL,
});
