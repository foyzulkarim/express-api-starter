# Chunk 3: Infrastructure & Observability (Tasks 10–13)

**Depends on:** Chunk 2 (config modules, shared types must exist).
**Delivers:** Pino logger, OpenTelemetry stubs, Prisma client, Redis client, cache service stub, and BullMQ connection.

**Development approach:** Strict TDD — write failing tests first, implement minimal code to pass, then commit. Every factory is designed for testability via dependency injection or injectable destinations.

---

### Task 10: Pino Logger

**Files:**
- Create: `src/infrastructure/observability/__tests__/logger.test.ts`
- Create: `src/infrastructure/observability/logger.ts`

#### Testability design

Two-layer approach for full coverage without fragile spies:

1. **`buildLoggerOptions`** — pure function that builds the pino options object from `LoggerConfig`. Tested directly: assertions on the returned object verify `level`, `redact`, and `transport` fields. No mocking needed.
2. **`createLogger`** — accepts an optional `destination` stream so tests can capture real log output. Tests verify actual pino behaviour: JSON format, correct level, and redaction of sensitive fields.

This avoids the broken `vi.spyOn(pino, 'default')` approach — pino's ESM default export is a function, not a spyable property.

#### Step 1 (RED): Write failing tests

Create `src/infrastructure/observability/__tests__/logger.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';

function makeStream(): { stream: Writable; getOutput: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
  });
  return { stream, getOutput: () => Buffer.concat(chunks).toString('utf8') };
}

describe('buildLoggerOptions', () => {
  it('sets the level from config', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({ level: 'debug', pretty: false, redactPaths: [] });
    expect(options.level).toBe('debug');
  });

  it('configures redact paths with [Redacted] censor', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({
      level: 'info',
      pretty: false,
      redactPaths: ['password', 'token'],
    });
    expect(options.redact).toEqual({ paths: ['password', 'token'], censor: '[Redacted]' });
  });

  it('includes pino-pretty transport when pretty is true', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({ level: 'info', pretty: true, redactPaths: [] });
    expect(options.transport).toEqual({ target: 'pino-pretty' });
  });

  it('omits transport when pretty is false', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({ level: 'info', pretty: false, redactPaths: [] });
    expect(options).not.toHaveProperty('transport');
  });
});

describe('createLogger', () => {
  it('returns a logger with the configured level', async () => {
    const { createLogger } = await import('../logger.js');
    const { stream } = makeStream();
    const logger = createLogger({ level: 'debug', pretty: false, redactPaths: [] }, stream);
    expect(logger.level).toBe('debug');
  });

  it('writes JSON-formatted logs to the provided destination', async () => {
    const { createLogger } = await import('../logger.js');
    const { stream, getOutput } = makeStream();
    const logger = createLogger({ level: 'info', pretty: false, redactPaths: [] }, stream);
    logger.info({ event: 'test' }, 'hello');
    await new Promise((r) => setImmediate(r));
    const line = JSON.parse(getOutput().trim());
    expect(line.msg).toBe('hello');
    expect(line.event).toBe('test');
  });

  it('redacts configured paths from log output', async () => {
    const { createLogger } = await import('../logger.js');
    const { stream, getOutput } = makeStream();
    const logger = createLogger(
      { level: 'info', pretty: false, redactPaths: ['password'] },
      stream,
    );
    logger.info({ password: 'secret123' }, 'user login');
    await new Promise((r) => setImmediate(r));
    const line = JSON.parse(getOutput().trim());
    expect(line.password).toBe('[Redacted]');
  });
});
```

Run: `npm run test:unit -- src/infrastructure/observability/__tests__/logger.test.ts`
Expected: **RED** — module not found

#### Step 2 (GREEN): Implement logger.ts

Create `src/infrastructure/observability/logger.ts`:

```typescript
import pino from 'pino';

export interface LoggerConfig {
  level: string;
  pretty: boolean;
  redactPaths: readonly string[];
}

export function buildLoggerOptions(config: LoggerConfig): pino.LoggerOptions {
  return {
    level: config.level,
    redact: { paths: [...config.redactPaths], censor: '[Redacted]' },
    ...(config.pretty ? { transport: { target: 'pino-pretty' } } : {}),
  };
}

export function createLogger(
  config: LoggerConfig,
  destination?: pino.DestinationStream,
): pino.Logger {
  const options = buildLoggerOptions(config);
  return destination ? pino(options, destination) : pino(options);
}

export type Logger = pino.Logger;
```

Run: `npm run test:unit -- src/infrastructure/observability/__tests__/logger.test.ts`
Expected: **GREEN** — all 7 tests pass

#### Step 3: Verify typecheck

Run: `npx tsc --noEmit`
Expected: Clean exit

#### Step 4: Commit

```bash
git add src/infrastructure/observability/
git commit -m "feat: add Pino logger factory with tests"
```

---

### Task 11: OpenTelemetry Tracing & Metrics Stubs

**Files:**
- Create: `src/infrastructure/observability/__tests__/tracing.test.ts`
- Create: `src/infrastructure/observability/tracing.ts`
- Create: `src/infrastructure/observability/metrics.ts`

#### Testability design

`tracing.ts` exports an `initTracing()` factory in addition to the module-level `sdk` singleton. Tests call `initTracing()` directly with OTel packages mocked via `vi.mock`, avoiding real SDK startup in the test suite. The module-level `export const sdk = initTracing()` preserves the side-effect-on-import behaviour required by OTel auto-instrumentation in production.

The module is imported once in `beforeAll` (which triggers the module-level `initTracing()` with mocks — harmless). `beforeEach` clears all mock call counts so each test only sees its own `initTracing()` call.

> **Critical (production):** `tracing.ts` MUST be the first import in `src/server.ts`. OTel auto-instrumentation only works when loaded before other modules.

#### Step 1 (RED): Write failing tests

Create `src/infrastructure/observability/__tests__/tracing.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockStart = vi.fn();
const mockSdk = { start: mockStart };
const MockNodeSDK = vi.fn(() => mockSdk);

vi.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: MockNodeSDK }));
vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => 'mock-instrumentation'),
}));
vi.mock('@opentelemetry/sdk-trace-base', () => ({
  NoopSpanExporter: vi.fn(() => 'mock-exporter'),
}));

let initTracing: typeof import('../tracing.js')['initTracing'];

beforeAll(async () => {
  // Module loads; module-level initTracing() runs with mocks (harmless).
  const mod = await import('../tracing.js');
  initTracing = mod.initTracing;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initTracing', () => {
  it('creates a NodeSDK instance with NoopSpanExporter', () => {
    initTracing();
    expect(MockNodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({ traceExporter: 'mock-exporter' }),
    );
  });

  it('creates a NodeSDK instance with auto-instrumentations', () => {
    initTracing();
    expect(MockNodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({ instrumentations: ['mock-instrumentation'] }),
    );
  });

  it('calls sdk.start() during initialization', () => {
    initTracing();
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it('returns the NodeSDK instance', () => {
    const result = initTracing();
    expect(result).toBe(mockSdk);
  });
});
```

Run: `npm run test:unit -- src/infrastructure/observability/__tests__/tracing.test.ts`
Expected: **RED** — module not found

#### Step 2 (GREEN): Implement tracing.ts and metrics.ts

Create `src/infrastructure/observability/tracing.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NoopSpanExporter } from '@opentelemetry/sdk-trace-base';

export function initTracing(): NodeSDK {
  const sdk = new NodeSDK({
    traceExporter: new NoopSpanExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return sdk;
}

// Side effect: must be the first import in server.ts for auto-instrumentation to work.
// Call sdk.shutdown() during graceful shutdown (see server.ts).
export const sdk = initTracing();
```

Create `src/infrastructure/observability/metrics.ts`:

```typescript
// OpenTelemetry Metrics API scaffolding — no-op in Phase 1.
// Ready for custom metrics (request counters, latency histograms) in later phases.
export {};
```

Run: `npm run test:unit -- src/infrastructure/observability/__tests__/tracing.test.ts`
Expected: **GREEN** — all 4 tests pass

#### Step 3: Verify typecheck

Run: `npx tsc --noEmit`
Expected: Clean exit

#### Step 4: Commit

```bash
git add src/infrastructure/observability/
git commit -m "feat: add OpenTelemetry tracing and metrics stubs with tests"
```

---

### Task 12: Prisma Setup

**Files:**
- Create: `prisma/schema/base.prisma`
- Create: `prisma/seed.ts`
- Create: `src/infrastructure/database/__tests__/prisma-client.test.ts`
- Create: `src/infrastructure/database/prisma-client.ts`

#### Testability design

`createPrismaClient` is a thin factory wrapping the `PrismaClient` constructor. Tests mock `@prisma/client` via `vi.mock` to avoid requiring a live database or generated client during unit tests. The factory is the single allowed import site for `@prisma/client` in this layer.

#### Step 1: Create prisma/schema/base.prisma and generate client

Create `prisma/schema/base.prisma`:

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

Run: `cp .env.example .env && npx prisma generate`
Expected: Prisma client generated successfully

> This must run before the test and implementation steps — `@prisma/client` must exist for TypeScript to resolve it.

#### Step 2: Create prisma/seed.ts scaffold

```typescript
// Seed script — ready for Phase 2+ when models are added.
// Run with: npx prisma db seed
async function main() {
  // Add seed data here
}

main();
```

#### Step 3 (RED): Write failing tests

Create `src/infrastructure/database/__tests__/prisma-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const MockPrismaClient = vi.fn();
vi.mock('@prisma/client', () => ({ PrismaClient: MockPrismaClient }));

let createPrismaClient: typeof import('../prisma-client.js')['createPrismaClient'];

beforeAll(async () => {
  const mod = await import('../prisma-client.js');
  createPrismaClient = mod.createPrismaClient;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPrismaClient', () => {
  it('instantiates PrismaClient with the provided database URL', () => {
    const url = 'postgresql://user:pass@localhost:5432/testdb';
    createPrismaClient(url);
    expect(MockPrismaClient).toHaveBeenCalledWith({ datasourceUrl: url });
  });

  it('returns the PrismaClient instance', () => {
    const mockInstance = { $connect: vi.fn() };
    MockPrismaClient.mockReturnValueOnce(mockInstance);
    const client = createPrismaClient('postgresql://localhost:5432/db');
    expect(client).toBe(mockInstance);
  });
});
```

Run: `npm run test:unit -- src/infrastructure/database/__tests__/prisma-client.test.ts`
Expected: **RED** — module not found

#### Step 4 (GREEN): Implement prisma-client.ts

Create `src/infrastructure/database/prisma-client.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

// Only this file (and features/*/infra/*.ts) may import from @prisma/client directly.
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
  });
}

export type { PrismaClient };
```

Run: `npm run test:unit -- src/infrastructure/database/__tests__/prisma-client.test.ts`
Expected: **GREEN** — all 2 tests pass

#### Step 5: Verify typecheck

Run: `npx tsc --noEmit`
Expected: Clean exit

#### Step 6: Commit

```bash
git add prisma/ src/infrastructure/database/
git commit -m "feat: add Prisma base schema, seed scaffold, and client factory with tests"
```

---

### Task 13: Redis Client, Cache Service Stub & BullMQ Connection

**Files:**
- Create: `src/infrastructure/cache/__tests__/redis-client.test.ts`
- Create: `src/infrastructure/cache/__tests__/cache.service.test.ts`
- Create: `src/infrastructure/queue/__tests__/bullmq-client.test.ts`
- Create: `src/infrastructure/cache/redis-client.ts`
- Create: `src/infrastructure/cache/cache.service.ts`
- Create: `src/infrastructure/queue/bullmq-client.ts`

#### Testability design

- `createRedisClient` and `createBullMQClient` are tested by mocking `ioredis` via `vi.mock` — we verify the constructor is called with the correct URL and options. Each test file uses `beforeAll` for the module import and `beforeEach` with `vi.clearAllMocks()` for clean mock state.
- `createCacheService` stub behaviour is pure logic with no external I/O — tested with real code, no mocks needed.

---

#### Sub-task 13a: Redis Client

##### Step 1 (RED): Write failing tests

Create `src/infrastructure/cache/__tests__/redis-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const MockRedis = vi.fn();
vi.mock('ioredis', () => ({ default: MockRedis }));

let createRedisClient: typeof import('../redis-client.js')['createRedisClient'];

beforeAll(async () => {
  const mod = await import('../redis-client.js');
  createRedisClient = mod.createRedisClient;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRedisClient', () => {
  it('instantiates Redis with the provided URL', () => {
    const url = 'redis://localhost:6379';
    createRedisClient(url);
    expect(MockRedis).toHaveBeenCalledWith(url);
  });

  it('returns the Redis instance', () => {
    const mockInstance = { status: 'ready' };
    MockRedis.mockReturnValueOnce(mockInstance);
    const client = createRedisClient('redis://localhost:6379');
    expect(client).toBe(mockInstance);
  });
});
```

Run: `npm run test:unit -- src/infrastructure/cache/__tests__/redis-client.test.ts`
Expected: **RED** — module not found

##### Step 2 (GREEN): Implement redis-client.ts

Create `src/infrastructure/cache/redis-client.ts`:

```typescript
import Redis from 'ioredis';

export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl);
}

export type { Redis };
```

Run: `npm run test:unit -- src/infrastructure/cache/__tests__/redis-client.test.ts`
Expected: **GREEN** — all 2 tests pass

---

#### Sub-task 13b: Cache Service Stub

##### Step 1 (RED): Write failing tests

Create `src/infrastructure/cache/__tests__/cache.service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createCacheService } from '../cache.service.js';

const mockRedis = {} as never;

describe('createCacheService (stub)', () => {
  it('get always returns null (cache miss stub)', async () => {
    const cache = createCacheService(mockRedis);
    const result = await cache.get('any-key');
    expect(result).toBeNull();
  });

  it('set resolves without error', async () => {
    const cache = createCacheService(mockRedis);
    await expect(cache.set('key', { data: 1 }, 60)).resolves.toBeUndefined();
  });

  it('invalidate resolves without error', async () => {
    const cache = createCacheService(mockRedis);
    await expect(cache.invalidate('key')).resolves.toBeUndefined();
  });

  it('getOrSet calls and returns the result of fn on cache miss', async () => {
    const cache = createCacheService(mockRedis);
    const fn = vi.fn().mockResolvedValue('computed-value');
    const result = await cache.getOrSet('key', fn, 60);
    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBe('computed-value');
  });
});
```

Run: `npm run test:unit -- src/infrastructure/cache/__tests__/cache.service.test.ts`
Expected: **RED** — module not found

##### Step 2 (GREEN): Implement cache.service.ts

Create `src/infrastructure/cache/cache.service.ts`:

```typescript
import type Redis from 'ioredis';

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T>;
}

// Stub implementation — real caching logic added in Phase 7.
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

Run: `npm run test:unit -- src/infrastructure/cache/__tests__/cache.service.test.ts`
Expected: **GREEN** — all 4 tests pass

---

#### Sub-task 13c: BullMQ Client

##### Step 1 (RED): Write failing tests

Create `src/infrastructure/queue/__tests__/bullmq-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const MockRedis = vi.fn();
vi.mock('ioredis', () => ({ default: MockRedis }));

let createBullMQClient: typeof import('../bullmq-client.js')['createBullMQClient'];

beforeAll(async () => {
  const mod = await import('../bullmq-client.js');
  createBullMQClient = mod.createBullMQClient;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createBullMQClient', () => {
  it('instantiates Redis with the provided URL', () => {
    const url = 'redis://localhost:6379';
    createBullMQClient(url);
    expect(MockRedis).toHaveBeenCalledWith(url, expect.any(Object));
  });

  it('sets maxRetriesPerRequest to null (required by BullMQ)', () => {
    createBullMQClient('redis://localhost:6379');
    expect(MockRedis).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
  });
});
```

Run: `npm run test:unit -- src/infrastructure/queue/__tests__/bullmq-client.test.ts`
Expected: **RED** — module not found

##### Step 2 (GREEN): Implement bullmq-client.ts

Create `src/infrastructure/queue/bullmq-client.ts`:

```typescript
import Redis from 'ioredis';

// BullMQ requires its own dedicated Redis connection separate from the cache client.
export function createBullMQClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
}

export type BullMQClient = Redis;
```

Run: `npm run test:unit -- src/infrastructure/queue/__tests__/bullmq-client.test.ts`
Expected: **GREEN** — all 2 tests pass

---

#### Step 3: Verify typecheck

Run: `npx tsc --noEmit`
Expected: Clean exit

#### Step 4: Commit

```bash
git add src/infrastructure/cache/ src/infrastructure/queue/
git commit -m "feat: add Redis client, cache service stub, and BullMQ connection with tests"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` exits clean
- [ ] `npx prisma generate` succeeds
- [ ] `.env` exists (copied from `.env.example`)
- [ ] `npm run test:unit` — all logger tests pass (7 tests)
- [ ] `npm run test:unit` — all tracing tests pass (4 tests)
- [ ] `npm run test:unit` — all prisma-client tests pass (2 tests)
- [ ] `npm run test:unit` — all redis-client tests pass (2 tests)
- [ ] `npm run test:unit` — all cache service tests pass (4 tests)
- [ ] `npm run test:unit` — all bullmq-client tests pass (2 tests)

**Total: 21 tests across 6 test files**

## Files Produced

### Source files (9)
`src/infrastructure/observability/logger.ts` · `src/infrastructure/observability/tracing.ts` · `src/infrastructure/observability/metrics.ts` · `src/infrastructure/database/prisma-client.ts` · `src/infrastructure/cache/redis-client.ts` · `src/infrastructure/cache/cache.service.ts` · `src/infrastructure/queue/bullmq-client.ts` · `prisma/schema/base.prisma` · `prisma/seed.ts`

### Test files (6)
`src/infrastructure/observability/__tests__/logger.test.ts` · `src/infrastructure/observability/__tests__/tracing.test.ts` · `src/infrastructure/database/__tests__/prisma-client.test.ts` · `src/infrastructure/cache/__tests__/redis-client.test.ts` · `src/infrastructure/cache/__tests__/cache.service.test.ts` · `src/infrastructure/queue/__tests__/bullmq-client.test.ts`
