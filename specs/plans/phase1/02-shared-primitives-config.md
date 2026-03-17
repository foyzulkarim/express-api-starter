# Chunk 2: Shared Primitives & Configuration (Tasks 6–9)

**Depends on:** Chunk 1 (package.json, TypeScript, Vitest config must exist).
**Delivers:** Shared constants, types, error class hierarchy, utility functions, and validated environment configuration.

---

### Task 6: Shared Constants & Types

**Files:**
- Create: `src/shared/constants/http-status.ts`
- Create: `src/shared/constants/app.constants.ts`
- Create: `src/shared/types/common.types.ts`
- Create: `src/shared/types/pagination.types.ts`
- Create: `src/shared/types/express.d.ts`

- [ ] **Step 1: Create http-status.ts**

```typescript
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];
```

- [ ] **Step 2: Create app.constants.ts**

```typescript
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const SHUTDOWN_TIMEOUT_MS = 5000;
```

- [ ] **Step 3: Create common.types.ts**

```typescript
export interface ApiResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    correlationId: string;
    timestamp: string;
    details?: FieldError[];
  };
}

export interface FieldError {
  field: string;
  message: string;
}
```

- [ ] **Step 4: Create pagination.types.ts**

```typescript
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
```

- [ ] **Step 5: Create express.d.ts**

```typescript
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
  }
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 7: Commit**

```bash
git add src/shared/constants/ src/shared/types/
git commit -m "feat: add shared constants and types"
```

---

### Task 7: Shared Error Classes + Unit Tests

**Files:**
- Create: `src/shared/errors/error-codes.ts`
- Create: `src/shared/errors/app-error.contract.ts`
- Create: `src/shared/errors/app-error.ts`
- Create: `src/shared/errors/http-errors.ts`
- Test: `src/shared/errors/__tests__/errors.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/errors/__tests__/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AppError } from '../app-error.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalError,
} from '../http-errors.js';

describe('AppError', () => {
  it('creates an operational error by default', () => {
    const error = new AppError({
      code: 'TEST_ERROR',
      message: 'Test message',
      statusCode: 400,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('supports non-operational errors', () => {
    const error = new AppError({
      code: 'FATAL',
      message: 'Something broke',
      statusCode: 500,
      isOperational: false,
    });

    expect(error.isOperational).toBe(false);
  });

  it('supports validation details', () => {
    const details = [{ field: 'email', message: 'Required' }];
    const error = new AppError({
      code: 'VALIDATION',
      message: 'Invalid',
      statusCode: 422,
      details,
    });

    expect(error.details).toEqual(details);
  });
});

describe('HTTP Error Classes', () => {
  it('BadRequestError defaults', () => {
    const err = new BadRequestError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.isOperational).toBe(true);
  });

  it('UnauthorizedError defaults', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError defaults', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('NotFoundError defaults', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('ConflictError defaults', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('ValidationError includes details', () => {
    const details = [{ field: 'name', message: 'Too short' }];
    const err = new ValidationError('Bad input', details);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });

  it('RateLimitError defaults', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('InternalError is not operational', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(false);
  });

  it('accepts custom messages', () => {
    const err = new NotFoundError('User not found');
    expect(err.message).toBe('User not found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — modules not found

- [ ] **Step 3: Create error-codes.ts**

```typescript
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

- [ ] **Step 4: Create app-error.contract.ts**

```typescript
import type { FieldError } from '../types/common.types.js';

export interface AppErrorContract {
  code: string;
  message: string;
  statusCode: number;
  isOperational: boolean;
  details?: FieldError[];
}
```

- [ ] **Step 5: Create app-error.ts**

```typescript
import type { AppErrorContract } from './app-error.contract.js';
import type { FieldError } from '../types/common.types.js';

export class AppError extends Error implements AppErrorContract {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: FieldError[];

  constructor({
    code,
    message,
    statusCode,
    isOperational = true,
    details,
  }: {
    code: string;
    message: string;
    statusCode: number;
    isOperational?: boolean;
    details?: FieldError[];
  }) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

- [ ] **Step 6: Create http-errors.ts**

```typescript
import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';
import { HttpStatus } from '../constants/http-status.js';
import type { FieldError } from '../types/common.types.js';

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super({ code: ErrorCode.BAD_REQUEST, message, statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super({ code: ErrorCode.UNAUTHORIZED, message, statusCode: HttpStatus.UNAUTHORIZED });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super({ code: ErrorCode.FORBIDDEN, message, statusCode: HttpStatus.FORBIDDEN });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({ code: ErrorCode.RESOURCE_NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super({ code: ErrorCode.CONFLICT, message, statusCode: HttpStatus.CONFLICT });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: FieldError[] = []) {
    super({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super({ code: ErrorCode.RATE_LIMIT_EXCEEDED, message, statusCode: HttpStatus.TOO_MANY_REQUESTS });
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super({
      code: ErrorCode.INTERNAL_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      isOperational: false,
    });
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: All error tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/shared/errors/
git commit -m "feat: add shared error class hierarchy with unit tests"
```

---

### Task 8: Shared Utils

**Files:**
- Create: `src/shared/utils/async-handler.ts`
- Create: `src/shared/utils/correlation-id.ts`

- [ ] **Step 1: Create async-handler.ts**

```typescript
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

- [ ] **Step 2: Create correlation-id.ts**

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage<string>();

export const correlationIdStorage = storage;

export function getCorrelationId(): string {
  return storage.getStore() ?? randomUUID();
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 4: Commit**

```bash
git add src/shared/utils/
git commit -m "feat: add async-handler and correlation-id utils"
```

---

### Task 9: Environment Schema & Config Modules + Unit Tests

**Files:**
- Create: `src/config/env.schema.ts`
- Create: `src/config/index.ts`
- Create: `src/config/database.ts`
- Create: `src/config/redis.ts`
- Create: `src/config/auth.ts`
- Create: `src/config/queue.ts`
- Create: `src/config/logger.ts`
- Test: `src/config/__tests__/env-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/config/__tests__/env-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { envSchema } from '../env.schema.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
};

describe('envSchema', () => {
  it('accepts valid environment variables', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe('info');
      expect(result.data.CORS_ORIGINS).toBe('*');
      expect(result.data.JWT_EXPIRES_IN).toBe('15m');
      expect(result.data.PORT).toBe(3000);
    }
  });

  it('coerces PORT to number', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '8080' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8080);
    }
  });

  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL, ...env } = validEnv;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects missing REDIS_URL', () => {
    const { REDIS_URL, ...env } = validEnv;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'too-short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid LOG_LEVEL', () => {
    const result = envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'verbose' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive PORT', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '0' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `env.schema.js` not found

- [ ] **Step 3: Create env.schema.ts**

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z.string().default('*'),
});

export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: All env schema tests PASS

- [ ] **Step 5: Create config/index.ts**

> **Important:** This module validates env at import time. Any module that imports from `@/config` will trigger validation. In unit tests, either mock this module or test `envSchema` directly (as we do above).

```typescript
import { envSchema, type Env } from './env.schema.js';

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(result.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const config: Env = result.data;
export type { Env };
```

- [ ] **Step 6: Create config sub-modules**

Create `src/config/database.ts`:

```typescript
import { config } from './index.js';

export const databaseConfig = {
  url: config.DATABASE_URL,
} as const;
```

Create `src/config/redis.ts`:

```typescript
import { config } from './index.js';

export const redisConfig = {
  url: config.REDIS_URL,
} as const;
```

Create `src/config/auth.ts`:

```typescript
import { config } from './index.js';

export const authConfig = {
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
} as const;
```

Create `src/config/queue.ts`:

```typescript
import { config } from './index.js';

export const queueConfig = {
  redisUrl: config.REDIS_URL,
} as const;
```

Create `src/config/logger.ts`:

```typescript
import { config } from './index.js';

export const loggerConfig = {
  level: config.LOG_LEVEL,
  pretty: config.NODE_ENV === 'development',
  redactPaths: ['password', 'token', 'secret', 'authorization'],
} as const;
```

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 8: Commit**

```bash
git add src/config/
git commit -m "feat: add env schema validation and config modules"
```
