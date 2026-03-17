# Chunk 5: App Assembly, Server & Verification (Tasks 19–22)

**Depends on:** Chunk 4 (DI container, all middleware must exist).
**Delivers:** Health endpoint, Express app factory, server bootstrap with graceful shutdown, integration test infrastructure, and verification tests.

---

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
