import { config } from './index.js';

/**
 * Pino logger configuration derived from validated environment variables.
 * `redactPaths` prevents credentials from appearing in log output.
 */
export const loggerConfig = Object.freeze({
  level: config.LOG_LEVEL,
  pretty: config.NODE_ENV === 'development',
  redactPaths: Object.freeze([
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.token',
    'req.body.secret',
    '*.password',
    '*.token',
    '*.secret',
    '*.authorization',
    '*.cookie',
    'password',
    'token',
    'secret',
    'authorization',
  ]),
});
