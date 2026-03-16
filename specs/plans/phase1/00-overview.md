# Phase 1: Project Scaffold & Infrastructure — Overview

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the complete project skeleton — tooling, configuration, shared primitives, infrastructure clients, middleware pipeline, DI container, and a running HTTP server — so that every subsequent phase builds on a proven foundation.

**Architecture:** Feature-based Express.js + TypeScript API with strict layer separation (`api/` → `domain/` ← `infra/`). Awilix DI wires all dependencies. Zod validates environment at startup. Full middleware pipeline mounted from day one (stubs where real logic arrives in later phases). ESM throughout.

**Tech Stack:** Express 4, TypeScript (strict + ESM + NodeNext), Awilix, Zod, Pino, Prisma, ioredis, BullMQ, OpenTelemetry, Vitest, Testcontainers, Supertest

**Spec reference:** `specs/plans/SPEC-phase1-scaffold-infrastructure.md`

---

## Chunk Index

| File | Chunk | Tasks | Description |
|------|-------|-------|-------------|
| [`01-project-initialization.md`](./01-project-initialization.md) | 1 | 1–5 | package.json, TypeScript, ESLint, Vitest, Docker Compose |
| [`02-shared-primitives-config.md`](./02-shared-primitives-config.md) | 2 | 6–9 | Constants, types, error classes, utils, env config |
| [`03-infrastructure-observability.md`](./03-infrastructure-observability.md) | 3 | 10–13 | Pino logger, OpenTelemetry, Prisma, Redis, BullMQ |
| [`04-di-container-middleware.md`](./04-di-container-middleware.md) | 4 | 14–18 | Awilix DI, core middleware, stubs, validate, error handler |
| [`05-app-assembly-verification.md`](./05-app-assembly-verification.md) | 5 | 19–22 | Health endpoint, app factory, server, integration tests |
| [`06-acceptance-checklist.md`](./06-acceptance-checklist.md) | — | — | Final verification checklist |

**Execution order:** Chunks must be executed sequentially (1 → 2 → 3 → 4 → 5 → 6). Each chunk depends on the previous.

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
