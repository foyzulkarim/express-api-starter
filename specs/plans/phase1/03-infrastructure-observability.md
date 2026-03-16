# Chunk 3: Infrastructure & Observability (Tasks 10–13)

**Depends on:** Chunk 2 (config modules, shared types must exist).
**Delivers:** Pino logger, OpenTelemetry stubs, Prisma client, Redis client, cache service stub, and BullMQ connection.

---

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
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NoopSpanExporter } from '@opentelemetry/sdk-trace-base';

const sdk = new NodeSDK({
  traceExporter: new NoopSpanExporter(),
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
