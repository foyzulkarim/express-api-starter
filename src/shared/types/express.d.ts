import type { AwilixContainer } from 'awilix';
import type { Logger } from 'pino';

export type UserRole = 'admin' | 'user' | 'guest';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      requestScope?: AwilixContainer;
      logger?: Logger;
      userId?: string;
      userRole?: UserRole;
    }
  }
}
