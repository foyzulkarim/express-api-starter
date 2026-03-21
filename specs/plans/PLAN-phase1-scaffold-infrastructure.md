# Phase 1: Project Scaffold & Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the complete project skeleton — tooling, configuration, shared primitives, infrastructure clients, middleware pipeline, DI container, and a running HTTP server — so that every subsequent phase builds on a proven foundation.

**Architecture:** Feature-based Express.js + TypeScript API with strict layer separation (`api/` → `domain/` ← `infra/`). Awilix DI wires all dependencies. Zod validates environment at startup. Full middleware pipeline mounted from day one (stubs where real logic arrives in later phases). ESM throughout.

**Tech Stack:** Express 4, TypeScript (strict + ESM + NodeNext), Awilix, Zod, Pino, Prisma, ioredis, BullMQ, OpenTelemetry, Vitest, Testcontainers, Supertest

**Spec reference:** `specs/plans/SPEC-phase1-scaffold-infrastructure.md`

---

## File Structure

All files created in this phase:

```
project-root/
├── prisma/
│   ├── schema/
│   │   └── base.prisma
│   └── seed.ts
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── container.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── env.schema.ts
│   │   ├── __tests__/env-schema.test.ts
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── auth.ts
│   │   ├── queue.ts
│   │   └── logger.ts
│   ├── features/health/
│   │   ├── controller.ts
│   │   ├── routes.ts
│   │   ├── __tests__/integration/routes.test.ts
│   │   └── index.ts
│   ├── infrastructure/
│   │   ├── http/
│   │   │   ├── middleware/
│   │   │   │   ├── correlation-id.middleware.ts
│   │   │   │   ├── request-logger.middleware.ts
│   │   │   │   ├── rate-limiter.middleware.ts
│   │   │   │   ├── request-context.middleware.ts
│   │   │   │   ├── authenticate.middleware.ts
│   │   │   │   ├── authorize.middleware.ts
│   │   │   │   ├── validate.middleware.ts
│   │   │   │   ├── not-found.middleware.ts
│   │   │   │   ├── error-handler.middleware.ts
│   │   │   │   └── __tests__/
│   │   │   │       ├── validate.test.ts
│   │   │   │       └── error-handler.test.ts
│   │   │   └── routes/v1.ts
│   │   ├── database/prisma-client.ts
│   │   ├── cache/
│   │   │   ├── redis-client.ts
│   │   │   └── cache.service.ts
│   │   ├── queue/bullmq-client.ts
│   │   └── observability/
│   │       ├── tracing.ts
│   │       ├── metrics.ts
│   │       └── logger.ts
│   └── shared/
│       ├── errors/
│       │   ├── app-error.contract.ts
│       │   ├── app-error.ts
│       │   ├── http-errors.ts
│       │   ├── error-codes.ts
│       │   └── __tests__/errors.test.ts
│       ├── types/
│       │   ├── express.d.ts
│       │   ├── pagination.types.ts
│       │   └── common.types.ts
│       ├── utils/
│       │   ├── async-handler.ts
│       │   └── correlation-id.ts
│       └── constants/
│           ├── http-status.ts
│           └── app.constants.ts
├── tests/
│   ├── setup.ts
│   └── helpers/request.helper.ts
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.unit.ts
├── vitest.config.integration.ts
├── eslint.config.js
├── .prettierrc
├── package.json
├── docker-compose.yml
├── .env.example
└── .gitignore
```

**Test files:**

| File | Type | Tests |
|------|------|-------|
| `src/shared/errors/__tests__/errors.test.ts` | Unit | AppError hierarchy, defaults, instanceof |
| `src/config/__tests__/env-schema.test.ts` | Unit | Env schema validation, defaults, rejections |
| `src/infrastructure/http/middleware/__tests__/validate.test.ts` | Unit | Zod validation, stripping, error shaping |
| `src/infrastructure/http/middleware/__tests__/error-handler.test.ts` | Unit | Error formatting, operational vs programmer |
| `src/features/health/__tests__/integration/routes.test.ts` | Integration | Health endpoint returns 200 with expected shape |

---

## Chunk 1: Project Initialization

### Task 1: Create package.json

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "express-api-starter",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:unit": "vitest run --config vitest.config.unit.ts",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:coverage": "vitest run --coverage",
    "postinstall": "prisma generate"
  },
  "prisma": {
    "schema": "prisma/schema"
  },
  "dependencies": {
    "@opentelemetry/auto-instrumentations-node": "^0.56.0",
    "@opentelemetry/sdk-node": "^0.57.0",
    "@opentelemetry/sdk-trace-base": "^1.30.0",
    "@prisma/client": "^6.4.0",
    "awilix": "^12.0.0",
    "bullmq": "^5.34.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "helmet": "^8.0.0",
    "ioredis": "^5.4.0",
    "pino": "^9.6.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.21.0",
    "@types/node": "^22.0.0",
    "@testcontainers/postgresql": "^10.21.0",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.21.0",
    "pino-pretty": "^13.0.0",
    "prettier": "^3.5.0",
    "prisma": "^6.4.0",
    "supertest": "^7.0.0",
    "testcontainers": "^10.21.0",
    "tsup": "^8.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.24.0",
    "vite-tsconfig-paths": "^5.1.0",
    "vitest": "^3.0.0"
  }
}
```

> **Note:** Version ranges are approximate. Use `npm install` to resolve to latest compatible versions. The `postinstall` script runs `prisma generate` after install — this requires the Prisma schema to exist first (Task 12 creates it). For the initial install, the postinstall may warn about a missing schema — this is expected and harmless.

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: Clean install with no errors (postinstall prisma warning is OK until schema exists)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: initialize package.json with all Phase 1 dependencies"
```

---

### Task 2: TypeScript & Build Config

**Files:**
- Create: `tsconfig.json`
- Create: `tsup.config.ts`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  outDir: 'dist',
  target: 'node22',
  splitting: false,
  sourcemap: true,
});
```

- [ ] **Step 3: Create minimal placeholder to verify typecheck**

Create `src/server.ts`:

```typescript
console.log('server placeholder');
```

- [ ] **Step 4: Verify typecheck works**

Run: `npx tsc --noEmit`
Expected: Clean exit, no errors

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json tsup.config.ts src/server.ts
git commit -m "chore: add TypeScript and tsup build config"
```

---

### Task 3: ESLint & Prettier Config

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`

- [ ] **Step 1: Create .prettierrc**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 2: Create eslint.config.js**

> **Note:** The spec lists `eslint-plugin-boundaries` as an option. This plan uses the built-in `no-restricted-imports` instead — simpler, no extra dependency, same enforcement.

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Domain files: no Express, no Prisma, no infra packages
  {
    files: ['src/features/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express/*'],
              message: 'Domain layer must not import Express.',
            },
            {
              group: ['@prisma/client', '@prisma/client/*'],
              message: 'Domain layer must not import Prisma directly.',
            },
            {
              group: ['ioredis', 'bullmq', 'pino'],
              message: 'Domain layer must not import infrastructure packages.',
            },
          ],
        },
      ],
    },
  },
  // API files: no Prisma (controllers go through domain, never infra)
  {
    files: ['src/features/*/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '@prisma/client/*'],
              message: 'API layer must not import Prisma directly.',
            },
          ],
        },
      ],
    },
  },
  // Shared files: pure TypeScript only — no Express, no Prisma, no infra packages
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express/*'],
              message: 'Shared layer must not import Express.',
            },
            {
              group: ['@prisma/client', '@prisma/client/*'],
              message: 'Shared layer must not import Prisma.',
            },
            {
              group: ['ioredis', 'bullmq', 'pino'],
              message: 'Shared layer must not import infrastructure packages.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
);
```

- [ ] **Step 3: Verify lint runs**

Run: `npx eslint .`
Expected: Clean exit (only the placeholder server.ts to check)

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js .prettierrc
git commit -m "chore: add ESLint flat config and Prettier"
```

---

### Task 4: Vitest Unit Test Config

**Files:**
- Create: `vitest.config.unit.ts`

- [ ] **Step 1: Create vitest.config.unit.ts**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 2: Create a smoke test to verify the runner works**

Create `src/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke test', () => {
  it('vitest runs correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: 1 test passes

- [ ] **Step 4: Delete the smoke test**

Delete `src/__tests__/smoke.test.ts` (it served its purpose).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.unit.ts
git commit -m "chore: add Vitest unit test config"
```

---

### Task 5: Docker Compose, .env.example, .gitignore

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:17
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U user']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 2: Create .env.example**

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-min-32-chars-long!!
JWT_EXPIRES_IN=15m
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
.turbo/
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: add Docker Compose, env example, and gitignore"
```

---

## Chunk 2: Shared Primitives & Configuration

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

---

## Chunk 3: Infrastructure & Observability

### Task 10: Pino Logger

**Files:**
- Create: `src/infrastructure/observability/logger.ts`

- [ ] **Step 1: Create logger.ts**

```typescript
import pino from 'pino';

export interface LoggerConfig {
  level: string;
  pretty: boolean;
  redactPaths: readonly string[];
}

export function createLogger(config: LoggerConfig): pino.Logger {
  return pino({
    level: config.level,
    redact: [...config.redactPaths],
    ...(config.pretty ? { transport: { target: 'pino-pretty' } } : {}),
  });
}

export type Logger = pino.Logger;
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/observability/logger.ts
git commit -m "feat: add Pino logger factory"
```

---

### Task 11: OpenTelemetry Tracing & Metrics Stubs

**Files:**
- Create: `src/infrastructure/observability/tracing.ts`
- Create: `src/infrastructure/observability/metrics.ts`

- [ ] **Step 1: Create tracing.ts**

> **Critical:** This file MUST be the first import in `src/server.ts`. OTel auto-instrumentation only works when loaded before other modules.

```typescript
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base';

const sdk = new NodeSDK({
  spanProcessors: [new NoopSpanProcessor()],
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Call sdk.shutdown() during graceful shutdown (see server.ts)
export { sdk };
```

- [ ] **Step 2: Create metrics.ts**

```typescript
// OpenTelemetry Metrics API scaffolding — no-op in Phase 1.
// Ready for custom metrics (request counters, latency histograms) in later phases.
export {};
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/observability/tracing.ts src/infrastructure/observability/metrics.ts
git commit -m "feat: add OpenTelemetry tracing and metrics stubs"
```

---

### Task 12: Prisma Setup

**Files:**
- Create: `prisma/schema/base.prisma`
- Create: `src/infrastructure/database/prisma-client.ts`

- [ ] **Step 1: Create base.prisma**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Generate Prisma client**

> Prisma needs `DATABASE_URL` set to resolve the datasource. Copy `.env.example` to `.env` first, or inline the var:

Run: `cp .env.example .env && npx prisma generate`
Expected: Prisma client generated successfully

- [ ] **Step 3: Create prisma/seed.ts (empty scaffold)**

```typescript
// Seed script — ready for Phase 2+ when models are added.
// Run with: npx prisma db seed
async function main() {
  // Add seed data here
}

main();
```

- [ ] **Step 4: Create prisma-client.ts**

> This is one of only two locations allowed to import `@prisma/client` (the other is `features/*/infra/*.ts`). Re-exports the `PrismaClient` type so other files import from here, not from `@prisma/client` directly.

```typescript
import { PrismaClient } from '@prisma/client';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
  });
}

export type { PrismaClient };
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/infrastructure/database/
git commit -m "feat: add Prisma base schema, seed scaffold, and client factory"
```

---

### Task 13: Redis Client, Cache Service Stub & BullMQ Connection

**Files:**
- Create: `src/infrastructure/cache/redis-client.ts`
- Create: `src/infrastructure/cache/cache.service.ts`
- Create: `src/infrastructure/queue/bullmq-client.ts`

- [ ] **Step 1: Create redis-client.ts**

```typescript
import Redis from 'ioredis';

export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl);
}

export type { Redis };
```

- [ ] **Step 2: Create cache.service.ts**

```typescript
import type Redis from 'ioredis';

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T>;
}

// Stub implementation — real caching logic added in Phase 7
export function createCacheService(_redis: Redis): CacheService {
  return {
    async get<T>(_key: string): Promise<T | null> {
      return null;
    },
    async set(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void> {},
    async invalidate(_key: string): Promise<void> {},
    async getOrSet<T>(_key: string, fn: () => Promise<T>, _ttlSeconds?: number): Promise<T> {
      return fn();
    },
  };
}
```

- [ ] **Step 3: Create bullmq-client.ts**

> BullMQ needs its own dedicated Redis connection (separate from the cache client). This returns a closeable ioredis instance that BullMQ queues/workers will use in Phase 5/6. In Phase 1 we just establish the connection.

```typescript
import Redis from 'ioredis';

export function createBullMQClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
}

export type BullMQClient = Redis;
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/cache/ src/infrastructure/queue/
git commit -m "feat: add Redis client, cache service stub, and BullMQ connection"
```

---

## Chunk 4: DI Container & Middleware

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

---

## Chunk 5: App Assembly, Server & Verification

### Task 19: Health Endpoint

**Files:**
- Create: `src/features/health/controller.ts`
- Create: `src/features/health/routes.ts`
- Create: `src/features/health/index.ts`

- [ ] **Step 1: Create controller.ts**

```typescript
import type { Request, Response } from 'express';

export function healthController(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Create routes.ts**

```typescript
import { Router } from 'express';
import { healthController } from './controller.js';

export function createHealthRoutes(): Router {
  const router = Router();
  router.get('/health', healthController);
  return router;
}
```

- [ ] **Step 3: Create index.ts (barrel)**

```typescript
export { createHealthRoutes } from './routes.js';
```

- [ ] **Step 4: Commit**

```bash
git add src/features/health/
git commit -m "feat: add health endpoint"
```

---

### Task 20: Version Router & App Factory

**Files:**
- Create: `src/infrastructure/http/routes/v1.ts`
- Create: `src/app.ts`

- [ ] **Step 1: Create v1.ts**

```typescript
import { Router } from 'express';

export function createV1Router(): Router {
  const router = Router();
  // Feature routes mounted here in Phase 2+
  return router;
}
```

- [ ] **Step 2: Create app.ts**

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { container } from './container.js';
import { config } from './config/index.js';
import { correlationIdMiddleware } from './infrastructure/http/middleware/correlation-id.middleware.js';
import { createRequestLoggerMiddleware } from './infrastructure/http/middleware/request-logger.middleware.js';
import { rateLimiterMiddleware } from './infrastructure/http/middleware/rate-limiter.middleware.js';
import { createRequestContextMiddleware } from './infrastructure/http/middleware/request-context.middleware.js';
import { notFoundMiddleware } from './infrastructure/http/middleware/not-found.middleware.js';
import { createErrorHandlerMiddleware } from './infrastructure/http/middleware/error-handler.middleware.js';
import { createHealthRoutes } from './features/health/index.js';
import { createV1Router } from './infrastructure/http/routes/v1.js';
import type { Logger } from './infrastructure/observability/logger.js';

export function createApp() {
  const app = express();
  const logger = container.resolve<Logger>('logger');

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS === '*' ? '*' : config.CORS_ORIGINS.split(','),
    }),
  );

  // Global middleware pipeline (order matters)
  app.use(correlationIdMiddleware);
  app.use(createRequestLoggerMiddleware(logger));
  app.use(rateLimiterMiddleware);
  app.use(createRequestContextMiddleware(container));

  // Routes
  app.use(createHealthRoutes());
  app.use('/api/v1', createV1Router());

  // Terminal middleware (must be last)
  app.use(notFoundMiddleware);
  app.use(createErrorHandlerMiddleware(logger));

  return app;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/http/routes/v1.ts src/app.ts
git commit -m "feat: add version router and Express app factory"
```

---

### Task 21: Server Bootstrap & Graceful Shutdown

**Files:**
- Modify: `src/server.ts` (replace placeholder)

- [ ] **Step 1: Replace src/server.ts with full implementation**

```typescript
import { sdk } from './infrastructure/observability/tracing.js'; // MUST be first import

import { createApp } from './app.js';
import { config } from './config/index.js';
import { container } from './container.js';
import { SHUTDOWN_TIMEOUT_MS } from './shared/constants/app.constants.js';
import type { Logger } from './infrastructure/observability/logger.js';
import type { PrismaClient } from './infrastructure/database/prisma-client.js';
import type { Redis } from './infrastructure/cache/redis-client.js';
import type { BullMQClient } from './infrastructure/queue/bullmq-client.js';

const logger = container.resolve<Logger>('logger');

async function startServer() {
  const prismaClient = container.resolve<PrismaClient>('prismaClient');
  const redisClient = container.resolve<Redis>('redisClient');
  const bullmqClient = container.resolve<BullMQClient>('bullmqClient');

  // Fail fast: test database connectivity
  try {
    await prismaClient.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.fatal({ err }, 'Failed to connect to database');
    process.exit(1);
  }

  // Fail fast: test Redis connectivity
  try {
    await redisClient.ping();
    logger.info('Redis connected');
  } catch (err) {
    logger.fatal({ err }, 'Failed to connect to Redis');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Server started');
  });

  // Graceful shutdown
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      logger.warn('Forced shutdown — second signal received');
      process.exit(1);
    }
    shuttingDown = true;
    logger.info({ signal }, 'Shutdown signal received');

    const forceTimeout = setTimeout(() => {
      logger.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // 1. Stop accepting new connections, drain in-flight requests
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      // 2. Disconnect infrastructure (order: app clients, then DB, then Redis/queue)
      await prismaClient.$disconnect();
      await bullmqClient.quit();
      await redisClient.quit();
      // 3. Flush OTel pending data
      await sdk.shutdown();

      clearTimeout(forceTimeout);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Clean exit

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add server bootstrap with graceful shutdown"
```

---

### Task 22: Vitest Integration Config, Testcontainers & Verification Tests

**Files:**
- Create: `vitest.config.integration.ts`
- Create: `tests/setup.ts`
- Create: `tests/helpers/request.helper.ts`
- Test: `src/features/health/__tests__/integration/routes.test.ts`

- [ ] **Step 1: Create vitest.config.integration.ts**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
```

- [ ] **Step 2: Create tests/setup.ts (Testcontainers global setup)**

> This starts ephemeral PostgreSQL and Redis containers before any integration test runs. Environment variables are set so that the config module validates successfully when tests import the app.

```typescript
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { execSync } from 'node:child_process';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;

export default async function setup() {
  pgContainer = await new PostgreSqlContainer('postgres:17')
    .withDatabase('testdb')
    .withUsername('testuser')
    .withPassword('testpass')
    .start();

  redisContainer = await new GenericContainer('redis:7').withExposedPorts(6379).start();

  // Set env vars for config validation (must happen before any app import)
  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = pgContainer.getConnectionUri();
  process.env['REDIS_URL'] = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env['JWT_SECRET'] = 'integration-test-secret-key-at-least-32-characters';
  process.env['LOG_LEVEL'] = 'error';

  // Run Prisma migrations against ephemeral database
  // Phase 1 has no models/migrations yet, but this ensures the pipeline works
  // when Phase 2 adds models. Uses deploy (not dev) for CI-safe idempotent apply.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  });

  // Return teardown function
  return async function teardown() {
    await pgContainer?.stop();
    await redisContainer?.stop();
  };
}
```

- [ ] **Step 3: Create tests/helpers/request.helper.ts**

```typescript
import supertest from 'supertest';
import { createApp } from '@/app.js';

export function createTestClient() {
  const app = createApp();
  return supertest(app);
}
```

- [ ] **Step 4: Write integration test**

Create `src/features/health/__tests__/integration/routes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createTestClient } from '../../../../../tests/helpers/request.helper.js';

describe('GET /health', () => {
  it('returns 200 with status ok and ISO timestamp', async () => {
    const client = createTestClient();
    const response = await client.get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });

  it('returns x-correlation-id header', async () => {
    const client = createTestClient();
    const response = await client.get('/health');

    expect(response.headers).toHaveProperty('x-correlation-id');
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('echoes provided x-correlation-id', async () => {
    const client = createTestClient();
    const response = await client
      .get('/health')
      .set('x-correlation-id', 'my-custom-id');

    expect(response.headers['x-correlation-id']).toBe('my-custom-id');
  });
});

describe('Unmatched routes', () => {
  it('returns 404 for unknown routes', async () => {
    const client = createTestClient();
    const response = await client.get('/api/v1/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.error).toHaveProperty('code', 'RESOURCE_NOT_FOUND');
    expect(response.body.error).toHaveProperty('correlationId');
    expect(response.body.error).toHaveProperty('timestamp');
  });
});
```

- [ ] **Step 5: Run integration tests**

Run: `npm run test:integration`
Expected: All integration tests PASS (requires Docker running for Testcontainers)

- [ ] **Step 6: Run all checks to verify Phase 1 is complete**

Run each command and verify clean output:

```bash
npx tsc --noEmit          # typecheck passes
npx eslint .              # lint passes
npm run test:unit         # unit tests pass
npm run test:integration  # integration tests pass
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.integration.ts tests/ \
       src/features/health/__tests__/
git commit -m "feat: add integration test infrastructure and health endpoint verification tests"
```

---

## Acceptance Checklist

After all 22 tasks are complete, verify every Phase 1 acceptance criterion:

**Build & Quality:**
- [ ] `npm run typecheck` exits clean
- [ ] `npm run lint` exits clean
- [ ] `npm run test:unit` passes all unit tests
- [ ] `npm run test:integration` passes all integration tests (Docker must be running)

**Runtime:**
- [ ] `GET /health` returns `200 { status: "ok", timestamp: "..." }`
- [ ] Unknown routes return `404` with structured error body including `code`, `correlationId`, `timestamp`
- [ ] `x-correlation-id` header is echoed when provided, generated when absent
- [ ] Server starts cleanly against Docker Compose stack (`docker compose up -d && npm run dev`)

**Fail-fast Behavior:**
- [ ] Starting with missing required env var (e.g., unset `DATABASE_URL`) logs clear error naming the variable and exits non-zero
- [ ] Starting with `JWT_SECRET` shorter than 32 chars logs a Zod validation error and exits non-zero
- [ ] Starting with unreachable database (wrong `DATABASE_URL`) crashes with a clear connection error
- [ ] Starting with unreachable Redis (wrong `REDIS_URL`) crashes with a clear connection error

**Graceful Shutdown:**
- [ ] Server exits cleanly within 5 seconds when sent SIGTERM (`kill -TERM <pid>`)
- [ ] A second SIGTERM during shutdown forces immediate exit
