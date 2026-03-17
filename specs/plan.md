# Express API Starter — Implementation Plan

**Date:** 2026-03-14
**Approach:** Test-Driven Development, built using agentic tools (Claude Code)

---

## Overview

This project is a production-grade Express.js + TypeScript API starter template, published as a GitHub template repository. It implements a full example application — `auth`, `user`, `product`, `order`, and `notification` features — so that developers can see every architectural pattern working end-to-end before forking it for their own projects.

The architecture is feature-based (not layer-based), with strict dependency direction: `api/` → `domain/` ← `infra/`. Domain logic never touches Express or Prisma directly. Dependency injection is handled by Awilix. All request validation uses Zod. All persistence goes through Prisma + PostgreSQL. Redis handles caching and rate limiting. BullMQ (on Redis) handles async job queues.

Phases are ordered by dependency. The foundation must exist before any feature can be built. Auth must exist before User, because roles and JWT middleware are shared. Product and User are prerequisites for Order. Notification depends on Order events. Caching and polish are deferred to the final phase to be done efficiently in one pass across all features.

The critical path is linear: Foundation → Auth → User → Product → Order → Notification → Polish. Product and User are independent of each other and could be worked in parallel once Auth is complete, but for a sequential agentic build the ordering above is preferred.

---

## Phase 1: Project Scaffold & Infrastructure

### Goal

Establish the complete project skeleton — tooling, configuration, shared primitives, infrastructure clients, middleware pipeline, DI container, and a running HTTP server — so that every subsequent phase can build directly on a proven foundation.

### Delivers

- TypeScript project compiles and type-checks cleanly
- ESLint + Prettier enforced across the codebase
- Vitest configured for unit and integration test runs with separate modes
- Docker Compose brings up PostgreSQL and Redis/Valkey locally
- Environment variables validated at startup via Zod; server refuses to start on missing/invalid config
- Prisma client connected to PostgreSQL; base schema in place
- Redis client connected; BullMQ client initialised
- Pino logger available across the application via DI
- Full middleware pipeline mounted: correlation ID, request logger, rate limiter, request context, validate, not-found, error handler
- Awilix DI container wired; app factory produces a configured Express app
- HTTP server starts, handles graceful shutdown on SIGTERM/SIGINT
- `GET /health` returns service status including database and Redis liveness

### Acceptance Criteria

- `npm run dev` starts the server without errors against a running Docker Compose stack
- `GET /health` returns `200` with database and cache status fields
- `npm run typecheck` exits clean
- `npm run lint` exits clean
- `npm run test:unit` and `npm run test:integration` both run (even with zero tests yet) without configuration errors
- Server exits cleanly within 5 seconds when sent SIGTERM
- Starting the server with a missing required env variable logs a clear error and exits non-zero

### Test Strategy

- Unit: Env schema validation rejects invalid/missing variables; error handler formats error responses correctly
- Integration: Health endpoint returns expected shape; server boots and responds to requests

### Transition to Phase 2

Auth feature can now be scaffolded directly into `src/features/auth/` with the DI container, middleware, and database client all ready to use.

---

## Phase 2: Auth Feature

### Goal

Implement JWT-based authentication — register, login, and refresh token — including the shared auth middleware that all subsequent features will use for protecting routes.

### Delivers

- `POST /api/v1/auth/register` creates a new user account and returns tokens
- `POST /api/v1/auth/login` authenticates credentials and returns access + refresh tokens
- `POST /api/v1/auth/refresh` exchanges a valid refresh token for a new access token
- `POST /api/v1/auth/logout` invalidates the refresh token
- JWT provider issues and verifies tokens
- `authenticate` middleware validates the JWT on protected routes and attaches user context to the request
- `authorize(role)` middleware enforces role-based access (admin | customer)
- Passwords hashed; plain-text passwords never stored or logged
- Auth-specific error types (`InvalidCredentialsError`, `TokenExpiredError`, etc.) returned through the global error handler

### Acceptance Criteria

- Registering with a duplicate email returns a `409` error with a structured error body
- Logging in with wrong credentials returns `401`
- A valid access token grants access to a protected test route; an expired or missing token returns `401`
- Refresh token rotation works: old refresh token is invalidated after use
- `authorize('admin')` rejects a customer-role token with `403`

### Test Strategy

- Unit: Auth service — password hashing, token generation, credential validation logic
- Unit: JWT provider — sign, verify, expiry handling
- Integration: All four auth routes tested end-to-end against a real database

### Transition to Phase 3

User feature can now use the `authenticate` and `authorize` middleware to protect admin routes. The `userId` on the request context is available for all subsequent features.

---

## Phase 3: User Feature

### Goal

Implement user profile management with role-based access — customers manage their own profile, admins can manage all users.

### Delivers

- `GET /api/v1/users/me` returns the authenticated user's profile
- `PATCH /api/v1/users/me` updates the authenticated user's own profile
- `GET /api/v1/users` (admin only) lists all users with pagination
- `GET /api/v1/users/:id` (admin only) fetches any user by ID
- `PATCH /api/v1/users/:id` (admin only) updates any user
- `DELETE /api/v1/users/:id` (admin only) soft-deletes a user
- User domain model separated from auth identity (mapper handles Prisma ↔ domain transform)
- Domain errors (`UserNotFoundError`) flow through global error handler

### Acceptance Criteria

- A customer token can fetch and update their own profile but receives `403` on admin routes
- An admin token can list, fetch, update, and delete any user
- Deleting a user does not hard-delete the database row; the user is marked inactive
- Paginated list response includes `page`, `pageSize`, `total`, and `data` fields
- Requesting a non-existent user ID returns `404` with a structured error

### Test Strategy

- Unit: User service — ownership checks, admin permission logic, soft-delete behaviour
- Unit: User mapper — Prisma model to domain type transformation
- Integration: All user routes tested with both customer and admin tokens

### Transition to Phase 4

With User complete, both Product and Notification can be built independently. Product is built next because Order depends on it.

---

## Phase 4: Product Feature

### Goal

Implement a simple product catalog where admins manage products and all authenticated users can browse them.

### Delivers

- `GET /api/v1/products` lists all active products with pagination (public or authenticated)
- `GET /api/v1/products/:id` fetches a single product
- `POST /api/v1/products` (admin only) creates a product
- `PATCH /api/v1/products/:id` (admin only) updates a product
- `DELETE /api/v1/products/:id` (admin only) soft-deletes a product
- Product domain model with mapper, repository contract, and Prisma implementation
- Domain errors (`ProductNotFoundError`) returned through global error handler

### Acceptance Criteria

- Unauthenticated or customer requests to create/update/delete products return `403`
- Listing products returns paginated results; inactive (deleted) products are excluded
- Fetching a deleted product by ID returns `404`
- Creating a product with missing required fields returns `422` with field-level validation errors

### Test Strategy

- Unit: Product service — CRUD logic, soft-delete filter, admin guard
- Integration: All product routes tested with admin and customer tokens; validation errors verified

### Transition to Phase 5

Order feature can now reference Product IDs in order line items. Both User and Product are available.

---

## Phase 5: Order Feature

### Goal

Implement shopping cart-style order creation and lifecycle management, demonstrating cross-feature relationships (User + Product) and status transitions.

### Delivers

- `POST /api/v1/orders` creates a new order with one or more line items (product ID + quantity)
- `GET /api/v1/orders` lists the authenticated user's orders; admin sees all orders
- `GET /api/v1/orders/:id` fetches a single order with line items
- `PATCH /api/v1/orders/:id/status` (admin only) transitions order status (`pending` → `confirmed` → `shipped` → `delivered` | `cancelled`)
- Order total calculated from product prices at time of order
- `OrderNotFoundError`, `ProductNotFoundError` (referenced product), and invalid status transition errors handled
- Order status change event emitted to the notification queue on confirmation

### Acceptance Criteria

- Creating an order with a non-existent product ID returns `404`
- Creating an order with quantity ≤ 0 returns `422`
- A customer can only view their own orders; admin can view all
- Invalid status transitions (e.g. `delivered` → `pending`) return `422`
- When an order is confirmed, an event is enqueued in BullMQ (verifiable in integration test)

### Test Strategy

- Unit: Order service — total calculation, status transition guards, ownership checks
- Unit: Order mapper — nested line items transformation
- Integration: Order creation, listing, and status transition routes; queue enqueue verified via BullMQ test client

### Transition to Phase 6

Notification feature can now consume the order confirmation event from the BullMQ queue and send email notifications.

---

## Phase 6: Notification Feature

### Goal

Implement async email notification delivery via BullMQ, triggered by order events, demonstrating the queue producer/consumer pattern.

### Delivers

- BullMQ email consumer processes order confirmation events from the queue
- Email sender sends a confirmation email (stubbed in test/dev; real provider hookable via env config)
- `GET /api/v1/notifications` lists the authenticated user's notification history
- Notification records persisted to database (recipient, type, status, timestamp)
- Failed email jobs retried with exponential backoff; dead-letter handling logged
- Notification domain errors handled cleanly

### Acceptance Criteria

- When an order confirmation event is enqueued, the consumer processes it and a notification record is created in the database
- Email sender is called with the correct recipient and order details
- In test mode, the email sender is stubbed and no real email is sent
- A failed job is retried up to the configured max attempts before being marked failed
- `GET /api/v1/notifications` returns the authenticated user's notifications in reverse chronological order

### Test Strategy

- Unit: Notification service — record creation, status update logic
- Unit: Email consumer — job processing, retry behaviour, error handling
- Integration: Full flow — order confirmation event → consumer → notification record verified in database

### Transition to Phase 7

All features are complete. The final phase adds cross-cutting concerns and polish across the entire codebase.

---

## Phase 7: Caching, Rate Limiting & Polish

### Goal

Add Redis caching for the product catalog, tighten rate limiting on auth endpoints, complete the ADR set, and ensure the project is ready to be used as a public GitHub template.

### Delivers

- Product list and single-product responses cached in Redis; cache invalidated on admin writes
- Cache service integrated via DI — features call the cache service, not Redis directly
- Auth endpoints (`/register`, `/login`, `/refresh`) have stricter rate limits than general API routes
- All ADR documents written (`use-feature-based-architecture`, `global-api-versioning`, `prisma-as-orm`, `awilix-for-dependency-injection`, `fishery-for-test-factories`)
- `.env.example` complete with all required and optional variables documented
- `README.md` covers: prerequisites, local setup, running tests, project structure, how to add a new feature
- Test coverage reviewed; critical paths have unit + integration coverage
- `Dockerfile` and `docker-compose.yml` verified working for production-mode startup

### Acceptance Criteria

- Product list response is served from cache on second request (verifiable via cache hit log or response header)
- Cache is invalidated after an admin creates, updates, or deletes a product
- Sending more than the configured rate limit of login requests returns `429`
- `docker compose up` + `npm run start` produces a working API without local Node.js dev tooling
- `npm run test:coverage` produces a coverage report; all feature services and controllers have coverage
- `README.md` contains a working "Getting Started" section that a new developer can follow without prior context

### Test Strategy

- Unit: Cache service — get, set, invalidate behaviour with mocked Redis client
- Integration: Product routes — cache hit/miss verified; cache invalidation verified after write
- Integration: Auth rate limiting — limit exceeded returns `429`

---

## Phase Dependency Graph

```
Phase 1: Foundation
    │
    ▼
Phase 2: Auth
    │
    ▼
Phase 3: User
    │
    ▼
Phase 4: Product
    │
    ▼
Phase 5: Order
    │
    ▼
Phase 6: Notification
    │
    ▼
Phase 7: Caching, Rate Limiting & Polish
```

> Note: Phase 3 (User) and Phase 4 (Product) are independent of each other once Phase 2 (Auth) is complete and could be built in parallel. Phase 5 (Order) requires both Phase 3 and Phase 4 to be complete.
