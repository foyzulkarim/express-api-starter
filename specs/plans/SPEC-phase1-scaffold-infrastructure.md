# Plan: Phase 1 — Project Scaffold & Infrastructure

> **Date:** 2026-03-15
> **Phase:** Phase 1 of 7
> **Estimated tasks:** 18–22
> **Planning session:** detailed

## Summary

Establish the complete project skeleton for a production-grade Express.js + TypeScript API starter template. This phase delivers tooling, configuration, shared primitives, infrastructure clients, the full middleware pipeline, DI container, and a running HTTP server — so that every subsequent phase (Auth, User, Product, Order, Notification, Polish) can build directly on a proven foundation. No business logic is implemented in this phase.

## Requirements

### Functional Requirements

1. TypeScript project compiles and type-checks cleanly with `strict: true` and additional strict flags
2. ESLint + Prettier enforced across the codebase with import boundary rules active from day one
3. Vitest configured with separate unit and integration test modes, both verified working with at least one real test each
4. Docker Compose brings up PostgreSQL and Redis/Valkey for local development
5. Environment variables validated at startup via Zod; server refuses to start on missing/invalid config
6. Prisma client connected to PostgreSQL; base schema (`datasource` + `generator` only, no models) in place
7. Redis client connected and available via DI
8. BullMQ client initialized (connection only, no queues/workers)
9. Pino logger available across the application via DI, with structured JSON output
10. OpenTelemetry SDK initialized with no-op exporter (correct import order established)
11. Full middleware pipeline mounted: correlation ID, request logger, rate limiter (stub), request context, authenticate (stub), authorize (stub), validate, not-found, error handler
12. Awilix DI container wired; app factory produces a configured Express app
13. HTTP server starts, handles graceful shutdown on SIGTERM/SIGINT
14. `GET /health` returns `200 { status: "ok", timestamp: "..." }`
15. Shared error class hierarchy built (`AppError`, `BadRequestError`, `NotFoundError`, `ValidationError`, `ConflictError`, etc.)

### Non-Functional Requirements

1. ESM throughout (`"type": "module"` in package.json)
2. All packages at latest stable versions
3. Server exits cleanly within 5 seconds on SIGTERM
4. Starting with a missing required env variable logs a clear error and exits non-zero
5. Starting with an unreachable database or Redis crashes with a clear error (fail fast)
6. Integration tests use Testcontainers (ephemeral PostgreSQL + Redis per test run) — no Docker Compose dependency for tests
7. Path alias `@/` → `src/` works in both `tsc` and Vitest

## Detailed Specifications

### 1. TypeScript & Build Tooling

**Purpose:** Establish the TypeScript compilation pipeline and development workflow.

**Toolchain:**

| Concern | Tool |
|---------|------|
| Dev server | `tsx --watch src/server.ts` |
| Type checking | `tsc --noEmit` |
| Production build | `tsup` → ESM output to `dist/` |
| Production run | `node dist/server.js` |

**tsconfig.json:**

- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"exactOptionalPropertyTypes": true`
- `"noImplicitReturns": true`
- `"noFallthroughCasesInSwitch": true`
- `"module": "NodeNext"` / `"moduleResolution": "NodeNext"`
- `"target": "ES2022"` (or latest LTS-compatible)
- Path alias: `"@/*"` → `"./src/*"`

**npm scripts:**

| Script | Command |
|--------|---------|
| `dev` | `tsx --watch src/server.ts` |
| `build` | `tsup` |
| `start` | `node dist/server.js` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint .` |
| `lint:fix` | `eslint . --fix` |
| `format` | `prettier --write .` |
| `test` | `vitest run` |
| `test:unit` | `vitest run --config vitest.config.unit.ts` |
| `test:integration` | `vitest run --config vitest.config.integration.ts` |
| `test:coverage` | `vitest run --coverage` |

### 2. ESLint & Prettier

**Purpose:** Enforce code quality and architectural import boundaries from day one.

**ESLint configuration:**

- Flat config format (`eslint.config.js`)
- TypeScript-aware rules (`@typescript-eslint`)
- Import boundary enforcement:
  - `@prisma/client` blocked in all files except `infrastructure/database/prisma-client.ts` and `features/*/infra/*.ts`
  - `express` blocked in all `domain/` files
  - `shared/` files blocked from importing `infrastructure/`, `features/`, or any external package
- Plugin: `eslint-plugin-boundaries` (or `no-restricted-imports` patterns) for inter-layer import rules

**Prettier configuration:**

- `.prettierrc` with project defaults (single quotes, trailing commas, semicolons — standard)

### 3. Environment Configuration

**Purpose:** Validate all environment variables at startup and provide a typed config object.

**Files:**

- `src/config/env.schema.ts` — Zod schema for all env vars
- `src/config/index.ts` — parses `process.env` at import time, exports typed config object
- `src/config/database.ts` — derives database connection config
- `src/config/redis.ts` — derives Redis connection config
- `src/config/auth.ts` — derives auth config (JWT secret, expiry)
- `src/config/queue.ts` — derives BullMQ config
- `src/config/logger.ts` — derives logger config (level, redaction)
- `.env.example` — documents all variables with safe example values

**Environment variables (Phase 1):**

| Variable | Required | Default | Validation |
|----------|----------|---------|------------|
| `NODE_ENV` | Yes | `development` | Enum: `development`, `production`, `test` |
| `PORT` | Yes | `3000` | Positive integer |
| `DATABASE_URL` | Yes | — | Valid URL format |
| `REDIS_URL` | Yes | — | Valid URL format |
| `JWT_SECRET` | Yes | — | Min 32 characters |
| `JWT_EXPIRES_IN` | No | `15m` | String |
| `LOG_LEVEL` | No | `info` | Enum: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `CORS_ORIGINS` | No | `*` | Comma-separated string |

**Behavior:**

- On missing/invalid variable: log exactly which variable failed and why, exit with code 1
- Config object registered as singleton in DI container
- No code outside `src/config/` reads `process.env` directly

**Error Scenarios:**

| Condition | Expected Behavior |
|-----------|-------------------|
| Missing `DATABASE_URL` | Clear error message naming the variable, process exits code 1 |
| `JWT_SECRET` is 10 chars | Zod rejects with min-length error, process exits code 1 |
| `LOG_LEVEL` is `verbose` | Zod rejects with enum error, process exits code 1 |
| All vars valid | Config object created, startup continues |

### 4. Infrastructure Clients

**Purpose:** Initialize database, cache, and queue connections as singletons in the DI container.

#### Prisma Client (`infrastructure/database/prisma-client.ts`)

- Instantiates `PrismaClient` with connection string from config
- Exported for DI registration
- Connection tested at startup — if unreachable, crash with clear error
- Disconnected during graceful shutdown

#### Redis Client (`infrastructure/cache/redis-client.ts`)

- Uses `ioredis` (or the `redis` package — both support ESM)
- Connection string from config
- Connection tested at startup — if unreachable, crash with clear error
- Disconnected during graceful shutdown

#### BullMQ Client (`infrastructure/queue/bullmq-client.ts`)

- Initialized with Redis connection
- No queues or workers created in Phase 1 — just the connection setup
- Ready for Phase 5/6 to add producers and consumers

#### Cache Service (`infrastructure/cache/cache.service.ts`)

- Wraps Redis client with `get`, `set`, `invalidate`, `getOrSet` interface
- Registered as singleton in DI
- Stub implementation in Phase 1 (methods exist, real caching logic in Phase 7)

### 5. Observability

**Purpose:** Establish structured logging, correlation ID propagation, and the OTel tracing foundation.

#### Logger (`infrastructure/observability/logger.ts`)

- Pino instance with structured JSON output
- Log level from config
- Redaction paths configured for sensitive fields (`password`, `token`, `secret`, `authorization`)
- Registered as singleton in DI

#### Correlation ID (`shared/utils/correlation-id.ts` or similar)

- Uses `AsyncLocalStorage` to store correlation ID per request
- `getCorrelationId()` utility function readable from anywhere in the async call chain
- Set by correlation-id middleware (from `X-Correlation-ID` header or new UUID)

#### Tracing (`infrastructure/observability/tracing.ts`)

- OpenTelemetry SDK initialized with no-op exporter
- **Must be the first import** in the application entry point (`src/server.ts`)
- Auto-instrumentation packages installed but exporting to nowhere
- Swappable to a real exporter (Jaeger, Tempo, Datadog) via env config in the future

#### Metrics (`infrastructure/observability/metrics.ts`)

- File exists with OTel Metrics API scaffolding
- No-op in Phase 1
- Ready for custom metrics in later phases

### 6. Middleware Pipeline

**Purpose:** Process every HTTP request through a strict, ordered pipeline.

**Execution order (global middleware applied to all requests):**

```
1. correlation-id    → extract/generate X-Correlation-ID, store in AsyncLocalStorage
2. request-logger    → Pino child logger with correlationId, log request start + response finish
3. rate-limiter      → [STUB] calls next(), real Redis rate limiting in Phase 7
4. request-context   → create Awilix scoped container, attach to req.scope
```

**Route-level middleware (applied selectively per route):**

```
5. authenticate      → [STUB] calls next(), real JWT verification in Phase 2
6. authorize         → [STUB] calls next(), real RBAC check in Phase 2
7. validate          → [REAL] runs Zod schema against req.body/query/params
```

**Terminal middleware (after all routes):**

```
8. not-found         → [REAL] 404 response for unmatched routes
9. error-handler     → [REAL] catches all errors, formats structured error response
```

#### Validate Middleware Interface

Accepts a schema object:

```
{ body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
```

On success: replaces raw `req.body`/`req.query`/`req.params` with parsed, typed output (unknown fields stripped).
On failure: throws `ValidationError` with structured per-field details.

#### Error Handler Behavior

- Receives `AppError` subclasses → maps to structured response with `code`, `message`, `statusCode`, `correlationId`, `timestamp`
- Operational errors (`isOperational: true`): log at `warn`, return error details to client
- Programmer errors (`isOperational: false`): log at `error` with full stack trace, return generic "Internal Server Error" to client
- Validation errors: include `details` array with per-field errors

#### Stub Middleware Contract

Stub middleware files (`authenticate`, `authorize`, `rate-limiter`) must:
- Export the same function signature as their real implementation will
- Call `next()` unconditionally
- Include a `// TODO: implement in Phase 2/7` comment
- Be swappable to real implementations without changing any route definition

### 7. Request Context

**Purpose:** Carry per-request state through the middleware and handler chain.

**Contents:**

| Field | Set By | Available To |
|-------|--------|-------------|
| `correlationId` | correlation-id middleware | Everything via AsyncLocalStorage |
| `logger` | request-logger middleware | Controllers, services (child logger with correlationId bound) |
| `userId` | authenticate middleware (Phase 2) | Controllers, services |
| `scope` (Awilix container) | request-context middleware | Route handlers, controllers |

### 8. Shared Error Classes

**Purpose:** Provide a base error hierarchy that all features and middleware can use.

**Files in `shared/errors/`:**

| File | Contents |
|------|----------|
| `app-error.contract.ts` | Interface/abstract type for AppError |
| `app-error.ts` | Base `AppError` class with `code`, `statusCode`, `message`, `isOperational` |
| `http-errors.ts` | `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (422), `RateLimitError` (429), `InternalError` (500) |
| `error-codes.ts` | Enum/const of machine-readable error codes |

**Error response shape:**

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "statusCode": 404,
    "correlationId": "abc-123-def",
    "timestamp": "2026-03-15T10:00:00.000Z"
  }
}
```

Validation error response includes additional `details`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "statusCode": 422,
    "correlationId": "abc-123-def",
    "timestamp": "2026-03-15T10:00:00.000Z",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### 9. DI Container (Awilix)

**Purpose:** Wire all dependencies in a single file, enabling testability and loose coupling.

**File:** `src/container.ts`

**Phase 1 registrations:**

| Registration | Scope | Resolves To |
|-------------|-------|-------------|
| `config` | Singleton | Validated config object |
| `logger` | Singleton | Pino instance |
| `prismaClient` | Singleton | PrismaClient instance |
| `redisClient` | Singleton | Redis/ioredis instance |
| `cacheService` | Singleton | Cache service (stub) |
| `bullmqClient` | Singleton | BullMQ connection |

Request-scoped registrations will be added in Phase 2+ as features are built.

**Container initialization:**

- Container created in `container.ts`
- Imported by `app.ts` (app factory)
- `request-context` middleware creates child scope per request

### 10. App Factory & Server

**Purpose:** Separate Express app creation from HTTP server lifecycle.

#### App Factory (`src/app.ts`)

- Creates and configures Express app
- Mounts global middleware in correct order
- Mounts version routers (`/api/v1/*`)
- Mounts health route (`/health`)
- Mounts not-found and error-handler middleware last
- Returns configured app (no `app.listen()` — that's the server's job)

#### Server (`src/server.ts`)

- **First line:** imports OTel tracing (must be before all other imports)
- Imports app factory, creates app
- Validates config (triggers fail-fast on bad env)
- Tests database and Redis connectivity (fail fast if unreachable)
- Starts HTTP server on configured port
- Registers graceful shutdown handler

#### Version Router (`infrastructure/http/routes/v1.ts`)

- Mounts health routes at `/health` (outside versioned prefix)
- Mounts `/api/v1/` prefix — empty in Phase 1, ready for feature routes in Phase 2+

### 11. Health Endpoint

**Purpose:** Verify the server is running.

**Route:** `GET /health`

**Response:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-03-15T10:00:00.000Z"
}
```

**Notes:**

- No authentication required
- Not under `/api/v1/` — mounted at root level
- No dependency checks (simplified for Phase 1)

### 12. Graceful Shutdown

**Purpose:** Clean up resources when the process is terminated.

**Shutdown sequence on SIGTERM/SIGINT:**

1. Log "shutdown signal received"
2. Stop accepting new HTTP connections (`server.close()`)
3. Wait for in-flight requests to drain (up to 5 second timeout)
4. Disconnect Prisma (`prisma.$disconnect()`)
5. Close Redis connection
6. Close BullMQ connection
7. Flush OTel SDK pending data
8. Exit with code 0

**Edge cases:**

| Scenario | Behavior |
|----------|----------|
| Second SIGTERM/SIGINT during shutdown | Force-exit immediately (`process.exit(1)`) |
| In-flight requests still active after 5s | Force-exit (`process.exit(1)`) |
| All connections closed before 5s | Exit immediately with code 0 |

### 13. Docker Compose

**Purpose:** Local development services (PostgreSQL + Redis).

**Services:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL | `postgres:17` (latest) | 5432 | Primary database |
| Redis/Valkey | `redis:7` (latest) | 6379 | Cache, rate limiting, queue backend |

**Notes:**

- Volume mounts for data persistence across restarts
- Health checks configured for both services
- `.env.example` includes connection strings for these services
- Docker Compose is for **local dev only** — tests use Testcontainers

### 14. Testing Infrastructure

**Purpose:** Establish test pipeline with separate unit and integration modes.

#### Vitest Configuration

**`vitest.config.unit.ts`:**

- Includes: `**/*.test.ts`
- Excludes: `**/*.integration.test.ts`
- Path aliases mirrored from `tsconfig.json`
- No global setup/teardown (no DB needed)

**`vitest.config.integration.ts`:**

- Includes: `**/*.integration.test.ts`
- Path aliases mirrored from `tsconfig.json`
- Global setup: `tests/setup.ts` (start Testcontainers, run migrations)
- Global teardown: `tests/teardown.ts` (stop containers)

#### Testcontainers Setup (`tests/setup.ts`)

- Start PostgreSQL container (same version as Docker Compose)
- Start Redis container (same version as Docker Compose)
- Set `DATABASE_URL` and `REDIS_URL` env vars to container endpoints
- Run Prisma migrations against ephemeral database
- Export container references for teardown

#### Testcontainers Teardown (`tests/teardown.ts`)

- Stop and remove PostgreSQL container
- Stop and remove Redis container

#### Test Helpers (`tests/helpers/`)

- `request.helper.ts` — Supertest wrapper that creates an app instance for integration tests

#### Verification Tests (Phase 1)

**Unit test** — `src/config/__tests__/env-schema.test.ts`:
- Verify env schema rejects missing `DATABASE_URL`
- Verify env schema rejects `JWT_SECRET` shorter than 32 chars
- Verify env schema accepts valid config

**Integration test** — `src/features/health/__tests__/integration/routes.test.ts`:
- `GET /health` returns `200` with `{ status: "ok", timestamp: "..." }`
- Verify timestamp is a valid ISO-8601 string

### 15. Prisma Setup

**Purpose:** Database schema management and client generation.

**Files:**

- `prisma/schema/base.prisma` — `datasource` (PostgreSQL) + `generator` (client) config only
- `prisma/migrations/` — empty initially (no models = no migrations yet)
- `prisma/seed.ts` — empty scaffold, ready for Phase 2+

**`prismaSchemaFolder` preview feature** enabled for split schema files (one `.prisma` file per feature in later phases).

### 16. Folder Structure (Phase 1 deliverables)

```
project-root/
├── prisma/
│   └── schema/
│       └── base.prisma
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── container.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── env.schema.ts
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── auth.ts
│   │   ├── queue.ts
│   │   └── logger.ts
│   ├── features/
│   │   └── health/
│   │       ├── controller.ts
│   │       ├── routes.ts
│   │       ├── __tests__/
│   │       │   └── integration/
│   │       │       └── routes.test.ts
│   │       └── index.ts
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
│   │   │   │   └── error-handler.middleware.ts
│   │   │   └── routes/
│   │   │       └── v1.ts
│   │   ├── database/
│   │   │   └── prisma-client.ts
│   │   ├── cache/
│   │   │   ├── redis-client.ts
│   │   │   └── cache.service.ts
│   │   ├── queue/
│   │   │   └── bullmq-client.ts
│   │   └── observability/
│   │       ├── tracing.ts
│   │       ├── metrics.ts
│   │       └── logger.ts
│   └── shared/
│       ├── errors/
│       │   ├── app-error.contract.ts
│       │   ├── app-error.ts
│       │   ├── http-errors.ts
│       │   └── error-codes.ts
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
│   ├── teardown.ts
│   └── helpers/
│       └── request.helper.ts
├── docs/
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.unit.ts
├── vitest.config.integration.ts
├── eslint.config.js
├── .prettierrc
├── package.json
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── .gitignore
```

## Edge Cases & Failure Modes

| Scenario | Decision | Rationale |
|----------|----------|-----------|
| Missing required env variable | Crash at startup with Zod error naming the variable | Fail fast — running without config leads to worse failures later |
| Valid env vars but database unreachable | Crash at startup with connection error | No point accepting requests if DB is down |
| Valid env vars but Redis unreachable | Crash at startup with connection error | Redis is required for cache, rate limiting, and queue |
| SIGTERM received during request processing | Drain in-flight requests up to 5s, then force exit | Standard production pattern — avoid dropped requests during deploys |
| Second SIGTERM during shutdown | Force-exit immediately (`process.exit(1)`) | Orchestrator is impatient — respect the kill signal |
| Request to undefined route | Return structured 404 via not-found middleware | Consistent error shape for all error types |
| Unhandled exception in controller/service | Caught by error-handler middleware, logged with stack trace, generic 500 returned | Never expose internal details to clients |
| Zod validation failure on request body | Return 422 with per-field error details | Client needs to know which fields failed and why |
| ESM + path alias mismatch in Vitest | Mirror aliases in vitest config via `resolve.alias` | Known gotcha — must be handled explicitly |
| Prisma client import in wrong layer | Blocked by ESLint `no-restricted-imports` rule | Architectural boundary enforcement at lint time |

## Decisions Log

| # | Decision | Alternatives Considered | Chosen Because |
|---|----------|------------------------|----------------|
| 1 | ESM (`"type": "module"`) | CommonJS | Modern standard, native in Node.js, future-proof |
| 2 | Single path alias `@/` → `src/` | Multiple aliases (`@shared/`, `@features/`) | Matches architecture reference, simpler config, one convention to learn |
| 3 | TypeScript strict + extra flags | Strict only | `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` catch real bugs |
| 4 | `tsx` for dev | `ts-node`, `nodemon` | Wraps esbuild, fastest TS execution, native ESM |
| 5 | `tsup` for production build | `tsc`, raw `esbuild` | esbuild speed with sensible defaults, less config than raw esbuild |
| 6 | `tsc --noEmit` for type checking | Bundler-integrated type checking | Authoritative type checking, separate from fast compilation |
| 7 | Full middleware pipeline in Phase 1 (stubs where needed) | Only implement middleware as needed per phase | Prevents middleware from being forgotten; stubs are trivial |
| 8 | Simplified health endpoint (`200 + timestamp`) | Full dependency health checks | Pragmatic for Phase 1; can be enhanced later if needed |
| 9 | Fail fast on startup (bad env or unreachable services) | Lazy connect, retry loop | Simplest, most predictable; Docker Compose handles service readiness |
| 10 | Force-exit on second SIGTERM | Ignore duplicate signals | Respects orchestrator kill semantics |
| 11 | Drain in-flight requests up to 5s on shutdown | Kill immediately | Standard production pattern; 5s timeout is the safety net |
| 12 | Separate Vitest configs for unit/integration | Single config with filters | Clean separation; unit tests never accidentally hit DB |
| 13 | Testcontainers for integration tests | Docker Compose for tests | Self-contained tests; CI needs no external `docker compose up` |
| 14 | OTel stub in Phase 1 (no-op exporter) | Defer OTel entirely | Must be first import — retrofitting later means restructuring entry point |
| 15 | Shared error classes in Phase 1 | Build per-feature as needed | Error handler middleware needs the full hierarchy from day one |
| 16 | Prisma base schema only (no models) | Minimal User model to prove migrations | No fake models; migrations proven when real models arrive in Phase 2 |
| 17 | ESLint import boundaries in Phase 1 | Defer to Phase 7 | Violations caught as written; no Phase 7 cleanup debt |
| 18 | AsyncLocalStorage for correlation IDs | Pass correlationId through function arguments | Available anywhere in the async chain without threading through params |
| 19 | Verification tests in Phase 1 | Trust that test config works | Proves entire pipeline (Vitest + TS + aliases + Testcontainers + Supertest) |

## Scope Boundaries

### In Scope

- Project initialization (`package.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`)
- Full folder structure skeleton for Phase 1 files
- All infrastructure clients (Prisma, Redis, BullMQ) initialized and connected
- Complete middleware pipeline (real + stubs)
- DI container with Phase 1 registrations
- App factory + HTTP server + graceful shutdown
- Health endpoint
- Shared error class hierarchy
- Environment validation
- Observability foundation (Pino logger, OTel stub, AsyncLocalStorage correlation IDs)
- Docker Compose for local dev
- Vitest configs + Testcontainers integration test setup
- At least 1 unit test + 1 integration test to verify runners work
- `.env.example`, `.gitignore`
- ESLint import boundary rules

### Out of Scope

- Authentication / authorization logic (Phase 2)
- Any business domain features: user, product, order, notification (Phases 2–6)
- Real rate limiting with Redis (Phase 7)
- Real caching logic (Phase 7)
- BullMQ queues, producers, or consumers (Phase 5–6)
- ADR documents (Phase 7)
- README.md content (Phase 7)
- Production Dockerfile optimization (Phase 7)
- Test factories, fixtures (Phase 2+ as features are added)
- Prisma models and migrations (Phase 2+)
- Seed scripts (Phase 2+)

## Dependencies

### Depends On (must exist before this work starts)

- Node.js (latest LTS) installed
- Docker installed (for Docker Compose and Testcontainers)
- Architecture reference docs (already exist in `docs/`)

### Depended On By (other work waiting for this)

- **Phase 2 (Auth):** needs DI container, middleware pipeline, error classes, Prisma client, config
- **All subsequent phases:** build directly on the foundation established here

## Architecture Notes

### Dependency Flow

```
src/server.ts
  └─→ infrastructure/observability/tracing.ts  (MUST be first import)
  └─→ src/app.ts
       └─→ src/container.ts (Awilix DI container)
       └─→ infrastructure/http/middleware/* (mounted in order)
       └─→ infrastructure/http/routes/v1.ts
            └─→ features/health/ (only feature in Phase 1)
```

### Key Packages (Phase 1)

| Package | Purpose |
|---------|---------|
| `express` | HTTP framework |
| `awilix` | Dependency injection |
| `awilix-express` | Express integration for Awilix |
| `zod` | Schema validation (env + request) |
| `pino` | Structured logging |
| `pino-pretty` | Dev-mode log formatting |
| `@prisma/client` + `prisma` | Database ORM |
| `ioredis` | Redis client |
| `bullmq` | Job queue (connection only in Phase 1) |
| `@opentelemetry/sdk-node` | OTel SDK |
| `@opentelemetry/auto-instrumentations-node` | Auto-instrumentation |
| `helmet` | Security headers |
| `cors` | CORS middleware |
| `tsx` | Dev runtime |
| `tsup` | Production build |
| `typescript` | Type checking |
| `eslint` | Linting |
| `prettier` | Formatting |
| `vitest` | Test runner |
| `supertest` | HTTP testing |
| `testcontainers` | Ephemeral test containers |
| `@testcontainers/postgresql` | PostgreSQL test container |
| `eslint-plugin-boundaries` | Import boundary enforcement |

## Open Questions

- None — all decisions resolved in planning session.

---
_This plan artifact is the input for /taskgen._
_Review this document, then run: "/taskgen specs/plans/PLAN-phase1-scaffold-infrastructure.md"_
