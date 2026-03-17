import { config } from './index.js';

export const databaseConfig = {
  url: config.DATABASE_URL,
} as const;
