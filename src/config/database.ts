import { config } from './index.js';

/** Database configuration derived from validated environment variables. */
export const databaseConfig = Object.freeze({
  url: config.DATABASE_URL,
});
