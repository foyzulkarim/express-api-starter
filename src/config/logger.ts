import { config } from './index.js';

export const loggerConfig = {
  level: config.LOG_LEVEL,
  pretty: config.NODE_ENV === 'development',
  redactPaths: ['password', 'token', 'secret', 'authorization'],
} as const;
