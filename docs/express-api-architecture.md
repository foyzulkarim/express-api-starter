# Express.js API Server — Quick Reference

> One-page reference for the express-api-starter project.
> For comprehensive explanations, see [`express-api-architecture-reference.md`](./express-api-architecture-reference.md).
> For folder structure, see [`folder-structure.md`](./folder-structure.md).

---

## Guiding Principles (Summary)

| # | Principle |
|---|-----------|
| 1 | Domain logic never knows about transport (no Express in `domain/`) |
| 2 | Infrastructure is an implementation detail (interfaces in `domain/`, implementations in `infra/`) |
| 3 | Features are the primary organisational axis (not technical layers) |
| 4 | Layers flow in one direction: `api/` → `domain/` ← `infra/` |
| 5 | Fail fast, validate early (env at startup, requests at middleware) |

---

## Layer Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST                                 │
└─────────────────────────────┬───────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  api/          Controller → parse req, call service, shape res      │
│  (v1/, v2/)    Routes → path + method + middleware                  │
│  validation.ts → Zod schemas (shared across versions)               │
└─────────────────────────────┬───────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  domain/       Service → business rules, orchestration              │
│                Types → domain model, DTOs                           │
│                Repository → interface only (no implementation)      │
│                Errors → feature-specific error classes              │
│                Mapper → Prisma ↔ domain transformation              │
└─────────────────────────────┬───────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  infra/        *.prisma-repository.ts → implements interface        │
│                *.provider.ts → external service adapters            │
│                *.sender.ts → outbound integrations                   │
└─────────────────────────────┬───────────────────────────────────────┘
                              ▼
                        PostgreSQL
```

---

## File Naming Quick Reference

### Inside Feature Directories

| Pattern | Example | Purpose |
|---------|---------|---------|
| `*.service.ts` | `user.service.ts` | Business logic |
| `*.controller.ts` | `order.controller.ts` | HTTP request handling |
| `*.routes.ts` | `product.routes.ts` | Express route definitions |
| `*.repository.ts` | `user.repository.ts` | Repository interface |
| `*.prisma-repository.ts` | `user.prisma-repository.ts` | Prisma implementation |
| `*.types.ts` | `order.types.ts` | Domain types, DTOs |
| `*.errors.ts` | `user.errors.ts` | Feature-specific errors |
| `*.mapper.ts` | `product.mapper.ts` | Entity ↔ DTO transformation |
| `*.validation.ts` | `auth.validation.ts` | Zod request schemas |
| `*.test.ts` | `user.service.test.ts` | Unit tests |
| `*.integration.test.ts` | `order.routes.integration.test.ts` | Integration tests |

### Outside Features (Shared/Infrastructure)

| Pattern | Example | Purpose |
|---------|---------|---------|
| `*.middleware.ts` | `authenticate.middleware.ts` | Express middleware |
| `*.client.ts` | `redis-client.ts`, `prisma-client.ts` | Infrastructure clients |
| `*.provider.ts` | `jwt.provider.ts`, `oauth.provider.ts` | External service adapters |
| `*.sender.ts` | `email.sender.ts` | Outbound integrations |
| `*.service.ts` | `cache.service.ts` | Shared services |
| `*.fixture.ts` | `users.fixture.ts` | Static test data |
| `*.factory.ts` | `user.factory.ts` | Test object builders |

---

## Import Rules (Cheat Sheet)

```
✅ ALLOWED:
   api/        → domain/, shared/, validation
   domain/     → shared/, other features (via barrel)
   infra/      → domain/, infrastructure/database, shared/, @prisma/client

❌ NEVER:
   domain/     → api/, infra/, @prisma/client, express
   api/        → infra/, @prisma/client
   shared/     → anything external (pure TypeScript only)
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode |
| `PORT` | Yes | `3000` | HTTP server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis/Valkey connection string |
| `JWT_SECRET` | Yes | — | Secret key (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `15m` | Token expiration |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `CORS_ORIGINS` | No | `*` | Allowed origins (comma-separated) |

### Example `.env`

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Primary database |
| Redis/Valkey | 6379 | Caching + rate limiting + queue backend |

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm run start            # Start production server

# Database
npx prisma migrate dev   # Run migrations + generate client
npx prisma studio        # Open database GUI
npx prisma db seed       # Run seed script

# Testing
npm run test             # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:coverage    # Run with coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format with Prettier
npm run typecheck        # Run TypeScript type check
```

---

## When to Create a New Feature

| ✅ Create New Feature | ❌ Extend Existing |
|----------------------|-------------------|
| Distinct domain noun (`User`, `Order`) | Same noun (`UserProfile`, `UserSettings`) |
| Independent lifecycle | Shared lifecycle |
| Separate API routes (`/users`, `/orders`) | Same prefix (`/users/profile`) |
| Unique business rules | Shared business context |
| Different persistence (own table) | Same primary table |

---

## Error Response Shape

```json
{
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "A user with this email already exists",
    "statusCode": 409,
    "correlationId": "abc-123-def",
    "timestamp": "2026-03-01T10:00:00Z"
  }
}
```

---

## Further Reading

| Document | Purpose |
|----------|---------|
| [`express-api-architecture-reference.md`](./express-api-architecture-reference.md) | Comprehensive architectural theory |
| [`folder-structure.md`](./folder-structure.md) | Complete folder structure reference |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records |
