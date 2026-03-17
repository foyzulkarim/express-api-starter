# Chunk 4: DI Container & Middleware (Tasks 14–18)

**Depends on:** Chunk 3 (infrastructure clients, logger, config must exist).
**Delivers:** Awilix DI container, full middleware pipeline (core + stubs + validate + error handler), with unit tests for validate and error handler.

---

### Task 14: Awilix DI Container

**Files:**
- Create: `src/container.ts`

- [ ] **Step 1: Create container.ts**

> Uses PROXY injection mode (default). Dependencies are lazy — resolved only when accessed. This means the app can boot and register everything without actually connecting to DB/Redis until something resolves those registrations.

```typescript
import { createContainer, asValue, asFunction } from 'awilix';
import { config } from './config/index.js';
import { loggerConfig } from './config/logger.js';
import { databaseConfig } from './config/database.js';
import { redisConfig } from './config/redis.js';
import { createLogger, type Logger } from './infrastructure/observability/logger.js';
import { createPrismaClient, type PrismaClient } from './infrastructure/database/prisma-client.js';
import { createRedisClient, type Redis } from './infrastructure/cache/redis-client.js';
import { createCacheService, type CacheService } from './infrastructure/cache/cache.service.js';
import { createBullMQClient, type BullMQClient } from './infrastructure/queue/bullmq-client.js';
import type { Env } from './config/env.schema.js';

export interface Cradle {
  config: Env;
  logger: Logger;
  prismaClient: PrismaClient;
  redisClient: Redis;
  cacheService: CacheService;
  bullmqClient: BullMQClient;
}

const container = createContainer<Cradle>({
  strict: true,
});

container.register({
  config: asValue(config),
  logger: asFunction(() =>
    createLogger({
      level: loggerConfig.level,
      pretty: loggerConfig.pretty,
      redactPaths: loggerConfig.redactPaths,
    }),
  ).singleton(),
  prismaClient: asFunction(() => createPrismaClient(databaseConfig.url)).singleton(),
  redisClient: asFunction(() => createRedisClient(redisConfig.url)).singleton(),
  cacheService: asFunction(({ redisClient }: Cradle) => createCacheService(redisClient)).singleton(),
  bullmqClient: asFunction(() => createBullMQClient(redisConfig.url)).singleton(),
});

export { container };
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 3: Commit**

```bash
git add src/container.ts
git commit -m "feat: add Awilix DI container with all Phase 1 registrations"
```

---

### Task 15: Core Middleware (Correlation ID, Request Logger, Request Context)

**Files:**
- Create: `src/infrastructure/http/middleware/correlation-id.middleware.ts`
- Create: `src/infrastructure/http/middleware/request-logger.middleware.ts`
- Create: `src/infrastructure/http/middleware/request-context.middleware.ts`

- [ ] **Step 1: Create correlation-id.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { correlationIdStorage } from '../../../shared/utils/correlation-id.js';
import { CORRELATION_ID_HEADER } from '../../../shared/constants/app.constants.js';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? randomUUID();
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  correlationIdStorage.run(correlationId, () => next());
}
```

- [ ] **Step 2: Create request-logger.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../../observability/logger.js';

export function createRequestLoggerMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const child = logger.child({ correlationId: req.correlationId });

    child.info({ method: req.method, url: req.url }, 'request started');

    // Attach child logger to request for use by controllers and services
    req.logger = child;

    res.on('finish', () => {
      const duration = Date.now() - start;
      child.info(
        { method: req.method, url: req.url, statusCode: res.statusCode, duration },
        'request completed',
      );
    });

    next();
  };
}
```

- [ ] **Step 3: Create request-context.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { asValue, type AwilixContainer } from 'awilix';

export function createRequestContextMiddleware(container: AwilixContainer) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const scope = container.createScope();
    scope.register({
      correlationId: asValue(req.correlationId),
    });
    req.scope = scope;
    next();
  };
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/middleware/correlation-id.middleware.ts \
       src/infrastructure/http/middleware/request-logger.middleware.ts \
       src/infrastructure/http/middleware/request-context.middleware.ts
git commit -m "feat: add correlation-id, request-logger, and request-context middleware"
```

---

### Task 16: Stub Middleware (Rate Limiter, Authenticate, Authorize)

**Files:**
- Create: `src/infrastructure/http/middleware/rate-limiter.middleware.ts`
- Create: `src/infrastructure/http/middleware/authenticate.middleware.ts`
- Create: `src/infrastructure/http/middleware/authorize.middleware.ts`

- [ ] **Step 1: Create rate-limiter.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';

// TODO: Implement real Redis-backed rate limiting in Phase 7
export function rateLimiterMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
```

- [ ] **Step 2: Create authenticate.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';

// TODO: Implement real JWT verification in Phase 2
export function authenticateMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
```

- [ ] **Step 3: Create authorize.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';

// TODO: Implement real RBAC check in Phase 2
export function authorizeMiddleware(..._roles: string[]) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/http/middleware/rate-limiter.middleware.ts \
       src/infrastructure/http/middleware/authenticate.middleware.ts \
       src/infrastructure/http/middleware/authorize.middleware.ts
git commit -m "feat: add stub middleware for rate-limiter, authenticate, authorize"
```

---

### Task 17: Validate Middleware + Unit Test

**Files:**
- Create: `src/infrastructure/http/middleware/validate.middleware.ts`
- Test: `src/infrastructure/http/middleware/__tests__/validate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/http/middleware/__tests__/validate.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateMiddleware } from '../validate.middleware.js';
import { ValidationError } from '@/shared/errors/http-errors.js';
import type { Request, Response, NextFunction } from 'express';

function createMocks(body = {}, query = {}, params = {}) {
  return {
    req: { body, query, params } as unknown as Request,
    res: {} as Response,
    next: vi.fn() as NextFunction,
  };
}

describe('validateMiddleware', () => {
  it('passes valid body and replaces with parsed value', () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateMiddleware({ body: schema });
    const { req, res, next } = createMocks({ name: 'Alice', extra: 'dropped' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice' });
  });

  it('strips unknown fields from body', () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateMiddleware({ body: schema });
    const { req, res, next } = createMocks({ name: 'Alice', unknown: true });

    middleware(req, res, next);

    expect(req.body).toEqual({ name: 'Alice' });
    expect(req.body).not.toHaveProperty('unknown');
  });

  it('calls next with ValidationError for invalid body', () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validateMiddleware({ body: schema });
    const { req, res, next } = createMocks({ email: 'not-an-email' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as ValidationError;
    expect(err.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('validates query params when schema provided', () => {
    const schema = z.object({ page: z.coerce.number().positive() });
    const middleware = validateMiddleware({ query: schema });
    const { req, res, next } = createMocks({}, { page: '3' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 3 });
  });

  it('collects errors from multiple schemas', () => {
    const bodySchema = z.object({ name: z.string() });
    const querySchema = z.object({ page: z.coerce.number().positive() });
    const middleware = validateMiddleware({ body: bodySchema, query: querySchema });
    const { req, res, next } = createMocks({ name: 123 }, { page: '-1' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('does nothing when no schemas are provided', () => {
    const middleware = validateMiddleware({});
    const { req, res, next } = createMocks({ anything: true });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `validate.middleware.js` not found

- [ ] **Step 3: Create validate.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../../../shared/errors/http-errors.js';
import type { FieldError } from '../../../shared/types/common.types.js';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validateMiddleware(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: FieldError[] = [];

    for (const [key, schema] of Object.entries(schemas) as [
      keyof ValidationSchemas,
      ZodSchema | undefined,
    ][]) {
      if (!schema) continue;
      const target = req[key as 'body' | 'query' | 'params'];
      const result = schema.safeParse(target);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        Object.assign(req, { [key]: result.data });
      }
    }

    if (errors.length > 0) {
      next(new ValidationError('Request validation failed', errors));
      return;
    }

    next();
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: All validate middleware tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/middleware/validate.middleware.ts \
       src/infrastructure/http/middleware/__tests__/validate.test.ts
git commit -m "feat: add validate middleware with Zod schema support"
```

---

### Task 18: Not-Found & Error Handler Middleware + Unit Tests

**Files:**
- Create: `src/infrastructure/http/middleware/not-found.middleware.ts`
- Create: `src/infrastructure/http/middleware/error-handler.middleware.ts`
- Test: `src/infrastructure/http/middleware/__tests__/error-handler.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/infrastructure/http/middleware/__tests__/error-handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createErrorHandlerMiddleware } from '../error-handler.middleware.js';
import {
  NotFoundError,
  ValidationError,
  InternalError,
} from '@/shared/errors/http-errors.js';
import type { Request, Response, NextFunction } from 'express';

describe('errorHandlerMiddleware', () => {
  const mockLogger = { warn: vi.fn(), error: vi.fn() } as any;
  const errorHandler = createErrorHandlerMiddleware(mockLogger);

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  const mockNext: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { correlationId: 'test-corr-id' };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it('formats operational AppError as structured response', () => {
    const error = new NotFoundError('User not found');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'RESOURCE_NOT_FOUND',
        message: 'User not found',
        statusCode: 404,
        correlationId: 'test-corr-id',
      }),
    });
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('includes details array for ValidationError', () => {
    const details = [{ field: 'email', message: 'Invalid email format' }];
    const error = new ValidationError('Validation failed', details);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    const body = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.error.details).toEqual(details);
  });

  it('hides message for non-operational errors', () => {
    const error = new InternalError('database exploded');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    const body = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.error.message).toBe('Internal server error');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('handles unknown errors as 500 Internal Server Error', () => {
    const error = new Error('unexpected');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    const body = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Internal server error');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('includes correlationId and timestamp in every error response', () => {
    const error = new NotFoundError();

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    const body = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.error.correlationId).toBe('test-corr-id');
    expect(body.error.timestamp).toBeDefined();
    expect(() => new Date(body.error.timestamp)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `error-handler.middleware.js` not found

- [ ] **Step 3: Create not-found.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../../../shared/errors/http-errors.js';

export function notFoundMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError('The requested resource was not found'));
}
```

- [ ] **Step 4: Create error-handler.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../shared/errors/app-error.js';
import { HttpStatus } from '../../../shared/constants/http-status.js';
import { ErrorCode } from '../../../shared/errors/error-codes.js';
import type { Logger } from '../../observability/logger.js';

export function createErrorHandlerMiddleware(logger: Logger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const correlationId = req.correlationId ?? 'unknown';
    const timestamp = new Date().toISOString();

    if (err instanceof AppError) {
      if (err.isOperational) {
        logger.warn({ err, correlationId }, err.message);
      } else {
        logger.error({ err, correlationId }, err.message);
      }

      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.isOperational ? err.message : 'Internal server error',
          statusCode: err.statusCode,
          correlationId,
          timestamp,
          ...(err.details ? { details: err.details } : {}),
        },
      });
      return;
    }

    // Unknown / programmer error
    logger.error({ err, correlationId }, 'Unhandled error');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        correlationId,
        timestamp,
      },
    });
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: All error-handler tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/http/middleware/not-found.middleware.ts \
       src/infrastructure/http/middleware/error-handler.middleware.ts \
       src/infrastructure/http/middleware/__tests__/error-handler.test.ts
git commit -m "feat: add not-found and error-handler middleware with unit tests"
```
