import { config } from './index.js';

/** JWT authentication configuration derived from validated environment variables. */
export const authConfig = Object.freeze({
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
});
