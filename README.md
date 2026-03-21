# Express API Starter

**version: 1.1.0** 

Production-grade Express.js + TypeScript API starter template with Prisma, Redis, and OpenTelemetry.

## Requirements

- Node.js >= 22.0.0
- Docker & Docker Compose

## Quick Start

```bash
# Install dependencies
npm install

# Start infrastructure (Postgres + Redis)
docker compose up -d

# Run in development
npm run dev

# Build for production
npm run build
npm start
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run in development with hot reload |
| `npm run build` | Build for production using tsup |
| `npm run start` | Start production server |
| `npm run typecheck` | Run TypeScript type check |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/express_api
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-min-32-chars-long!!
JWT_EXPIRES_IN=15m
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Project Structure

```
src/
├── server.ts              # Application entry point
├── config/                # Validated env (`env.schema.ts`) and app config (e.g. logger wiring)
├── features/              # Feature modules (domain / API / shared)
├── infrastructure/        # Cross-cutting I/O: DB, cache, queue, observability (factories)
└── shared/                # Shared utilities and types
```

## Infrastructure layer

`src/infrastructure/` holds **factories** for external systems so features stay testable and wiring stays in one place:

| Area | Role |
|------|------|
| `database/prisma-client.ts` | Builds `PrismaClient` from `DATABASE_URL`. Prefer importing the client only from here (or feature infra) per file comment. |
| `cache/redis-client.ts` | ioredis client for cache; logs connection errors to stderr. |
| `cache/cache.service.ts` | Cache port + stub implementation (real Redis-backed logic planned in later phases). |
| `queue/bullmq-client.ts` | Dedicated Redis connection for BullMQ (`maxRetriesPerRequest: null`). |
| `observability/logger.ts` | Pino options and `createLogger`; redaction paths are assembled in `src/config/logger.ts` from env-backed settings. |
| `observability/tracing.ts` | OpenTelemetry Node SDK with auto-instrumentations; import early in `server.ts` for correct hook order. |
| `observability/metrics.ts` | Placeholder for future metrics. |

Integration tests and local development expect **PostgreSQL** and **Redis** (see Docker Compose and `REDIS_URL` / `DATABASE_URL`).

## Tech Stack

- **Runtime:** Node.js 22+
- **Framework:** Express.js
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL + Prisma ORM
- **Cache/Queue:** Redis + BullMQ
- **DI:** Awilix
- **Validation:** Zod
- **Logging:** Pino
- **Testing:** Vitest
- **Linting:** ESLint (flat config)
- **Formatting:** Prettier
- **Build:** tsup
- **Observability:** OpenTelemetry
