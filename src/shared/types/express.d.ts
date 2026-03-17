import type { AwilixContainer } from 'awilix';
import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      scope: AwilixContainer;
      logger: Logger;
      userId?: string;
      userRole?: string;
    }

    export {};
  }
}
