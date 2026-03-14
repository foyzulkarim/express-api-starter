# Express.js API Server — Architecture Reference

> Comprehensive reference for building an enterprise-grade Express.js API server in 2026.
> This document is theory only — no code. It defines the folder structure, architectural patterns, conventions, rules, and decisions that govern the codebase.

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [Folder Structure Reference](#2-folder-structure-reference)
3. [Architectural Layers](#3-architectural-layers)
4. [Feature Module Anatomy](#4-feature-module-anatomy)
5. [API Versioning Strategy](#5-api-versioning-strategy)
6. [Dependency Injection](#6-dependency-injection)
7. [Request Lifecycle](#7-request-lifecycle)
8. [Middleware Pipeline](#8-middleware-pipeline)
9. [Error Handling](#9-error-handling)
10. [Configuration Management](#10-configuration-management)
11. [Database & Prisma Strategy](#11-database--prisma-strategy)
12. [Repository Pattern](#12-repository-pattern)
13. [Validation Strategy](#13-validation-strategy)
14. [Authentication & Authorization](#14-authentication--authorization)
15. [Observability](#15-observability)
16. [Caching Strategy](#16-caching-strategy)
17. [Async Processing & Queues](#17-async-processing--queues)
18. [Health Checks](#18-health-checks)
19. [Graceful Shutdown](#19-graceful-shutdown)
20. [Cross-Feature Communication](#20-cross-feature-communication)
21. [Import Rules & Dependency Boundaries](#21-import-rules--dependency-boundaries)
22. [Testing Strategy](#22-testing-strategy)
23. [TypeScript Strategy](#23-typescript-strategy)
24. [Naming Conventions](#24-naming-conventions)
25. [Barrel Files & Encapsulation](#25-barrel-files--encapsulation)

---

## 1. Guiding Principles

The architecture is governed by five non-negotiable principles that inform every structural decision in the codebase.

**Principle 1 — Domain logic must never know about transport.** Business rules in the domain layer must not import Express, read from `req`, write to `res`, or reference HTTP status codes. The domain layer is pure TypeScript with no framework dependency. This ensures that the same business logic can be reused if the transport changes (REST today, GraphQL tomorrow, gRPC later) without rewriting a single line of domain code.

**Principle 2 — Infrastructure is an implementation detail.** The domain layer depends on abstractions (interfaces), not on concrete implementations like Prisma, Redis, or BullMQ. The infrastructure layer provides the implementations. This boundary is enforced physically in the folder structure: the repository interface lives in `domain/`, the Prisma implementation lives in `infra/`. The only files in the entire `src/` directory that may import `@prisma/client` are the Prisma client instantiation file and the `*.prisma-repository.ts` files inside each feature's `infra/` layer.

**Principle 3 — Features are the primary organisational axis.** The codebase is organised by business domain (user, order, product), not by technical layer (controllers, services, repositories). Each feature is a self-contained module that owns its full vertical slice: routes, controllers, validation, services, types, repository interfaces, repository implementations, and tests. Adding a new domain means adding a single new folder under `features/`. Removing a domain means deleting that folder. No shotgun surgery across five separate directories.

**Principle 4 — Layers flow in one direction.** Dependencies flow inward: `api/` → `domain/` → `infra/` (where `infra/` implements interfaces defined by `domain/`). No layer may import from a layer above it. Controllers never import repository implementations. Services never import Express. Repositories never import controllers. This is enforced by the import rules documented in Section 21.

**Principle 5 — Fail fast, validate early.** Environment variables are validated at startup with a schema — if anything is missing or malformed, the server refuses to start. Request payloads are validated at the middleware boundary before reaching the controller. Database schemas are validated through Prisma's type system. Configuration errors should never manifest as runtime bugs in production.

---

## 2. Folder Structure Reference

> **See [`folder-structure.md`](./folder-structure.md)** for the complete folder structure with file-by-file explanations.

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `prisma/` | Database schema (split by domain), migrations, seed scripts |
| `src/config/` | Environment validation, typed configuration objects |
| `src/features/` | Business domain modules (one folder per domain) |
| `src/infrastructure/` | Cross-cutting technical concerns (HTTP, DB, cache, queues, observability) |
| `src/shared/` | Pure TypeScript utilities (no external dependencies) |
| `tests/` | Global test infrastructure (helpers, fixtures, factories) |
| `docs/adr/` | Architecture Decision Records |

---

## 3. Architectural Layers

The codebase has four distinct layers, each with a clear responsibility boundary. The layers are not arbitrary groupings — they exist to enforce a specific direction of dependency flow that keeps the domain logic portable, testable, and independent of any framework or library.

### Layer 1 — Transport (`features/*/api/`)

The transport layer is the HTTP boundary. It is the only layer that knows about Express, HTTP methods, status codes, request objects, and response objects. Its job is translation: it receives an HTTP request, parses it into domain-meaningful inputs, delegates to the service layer, and translates the service output back into an HTTP response.

The transport layer contains versioned controllers and route definitions. When the API evolves and introduces breaking changes, only this layer changes. The same service method might be called by both a v1 controller (which returns a flat response) and a v2 controller (which returns a nested response). The transport layer also houses the validation schemas for that feature, since validation is about the shape of HTTP input — though these schemas are shared across versions because they are model-driven rather than version-driven.

The transport layer is deliberately thin. A controller method should be no more than a few lines: parse, call service, respond. If a controller is growing complex, it means domain logic is leaking into the transport layer.

### Layer 2 — Domain (`features/*/domain/`)

The domain layer is the heart of each feature. It contains the business rules, domain types, repository interfaces, mappers, and feature-specific error classes. This layer has zero external dependencies — it does not import Express, Prisma, Redis, or any infrastructure library. It imports only from `shared/` and from its own files.

The service file in the domain layer orchestrates business operations. It receives and returns domain types (not Prisma models, not Express request objects). It calls repository methods through the interface, interacts with the cache service, and may communicate with other features through their exported barrel-file APIs.

The repository interface file defines the contract for data access. It specifies what queries the feature needs (findById, findByEmail, create, etc.) using domain types. It says nothing about how those queries are implemented — no SQL, no Prisma methods, no connection strings. This is the most critical boundary in the entire architecture: the service depends on this interface, not on Prisma.

The types file defines the domain model: the canonical shape of the data as the business understands it. This is not the Prisma model (which may have different field names, include database-specific fields, or have a different relationship structure). The mapper file handles the translation between the Prisma model and the domain type.

### Layer 3 — Infrastructure (`features/*/infra/`)

The infrastructure layer provides concrete implementations of the interfaces defined by the domain layer. The primary resident is the Prisma repository implementation, which imports `@prisma/client`, receives a PrismaClient instance via dependency injection, and implements every method defined in the repository interface.

The infrastructure layer may also contain adapters for external services that are feature-specific. For example, the notification feature's `infra/` layer might contain an email sender adapter that wraps a SendGrid or AWS SES client. The auth feature's `infra/` layer might contain a JWT provider and an OAuth provider.

The infrastructure layer imports from the domain layer (to implement its interfaces) and from `infrastructure/` (to get database and service clients). It never imports from the transport layer.

### Layer 4 — Shared Infrastructure (`infrastructure/` and `shared/`)

Cross-cutting concerns that don't belong to any single feature live at this level. There is an important distinction between the two directories.

`infrastructure/` contains concerns that depend on external libraries or frameworks: Express middleware, the Prisma client instantiation, Redis client, BullMQ setup, OpenTelemetry configuration, and the Pino logger. These are technical plumbing files that bootstrap and configure services.

`shared/` contains pure TypeScript utilities that have no external dependencies. Error base classes, common types like pagination, utility functions for dates and strings, and application constants. The rule of thumb is straightforward: if it imports any library that isn't part of the TypeScript standard library, it belongs in `infrastructure/`, not `shared/`.

---

## 4. Feature Module Anatomy

Every feature module follows the same internal structure. This consistency is non-negotiable — it means any developer who understands one feature can navigate any other feature without a learning curve. The structure is the architecture's primary enforcement mechanism.

A feature module has five subdirectories: `api/`, `domain/`, `infra/`, `__tests__/`, and a barrel file `index.ts` at the root.

### api/ — The HTTP Surface

The `api/` directory contains a version folder for each active API version that this feature participates in, plus a shared validation file. A feature starts with `api/v1/` only. The `api/v2/` folder is created only when this specific feature introduces breaking changes in a new API version. Features that have not changed do not get new version folders — they are re-exported at the global router level.

Each version folder contains exactly two files: a controller and a routes file. The controller handles HTTP-specific logic: parsing path parameters, extracting query strings, reading the request body (already validated by middleware), calling the service, and shaping the response. The routes file defines the Express route table for that version: which HTTP method, which path, which middleware stack, and which controller method handles it.

The validation file sits directly under `api/` rather than inside a version folder because validation schemas are model-driven. They describe the shape of the domain input, not the shape of a particular API version. Both v1 and v2 controllers typically validate using the same schemas.

### domain/ — The Business Core

The `domain/` directory contains everything related to business logic. The service file is the orchestrator — it enforces business rules, coordinates multiple repository calls within transactions, and raises domain-specific errors when invariants are violated.

The repository interface file defines the data access contract. This is the most architecturally significant file in the entire feature. It uses only domain types in its method signatures. The service imports this interface. The DI container resolves the interface to a concrete implementation at runtime.

The types file defines the domain model. The mapper file translates between domain types and the shapes used by the infrastructure layer (Prisma models). The errors file defines feature-specific error classes that extend the base `AppError`.

### infra/ — The Implementation

The `infra/` directory contains the concrete implementations. The primary file is the Prisma repository, which implements the repository interface using `@prisma/client`. This is one of only two places in the entire codebase where Prisma imports are permitted (the other being `infrastructure/database/prisma-client.ts`).

Additional adapter files may live here for feature-specific external service integrations — email sending, payment processing, file storage, etc.

### __tests__/ — Co-located Tests

Tests are co-located with the feature they test, not separated into a parallel test directory. This means when a developer opens a feature folder, they see everything: the code and its tests. The testing approach is detailed in Section 22.

### index.ts — The Barrel File

The barrel file is the feature's public API. It exports the versioned route handlers and any domain types that other features or the global router need. Internal files — services, repositories, controllers — are not exported. External consumers (the global version router, other features) import only from the barrel file, never from internal paths. This is the encapsulation mechanism. The barrel file strategy is detailed in Section 25.

---

## 5. API Versioning Strategy

The project uses **global version-first URL path versioning**. The API version prefix comes first in the URL path, providing consumers with a single, complete API surface per version.

```
URL pattern:     /v1/orders    /v1/users    /v2/orders    /v2/users
                 └── global version prefix ──┘
```

### Why Global Over Module-First

The alternative approach — module-first versioning (`/orders/v1`, `/users/v2`) — optimises for the producer (developer convenience) at the expense of the consumer. With module-first, external clients must track which version each resource is on. A single integration might need to call `/orders/v2` but `/users/v1` but `/products/v3`. Documentation becomes fragmented. Deprecation communication becomes per-resource rather than per-API.

Global versioning optimises for the consumer. A client targets `/v1` and gets the entire API surface. When the API evolves, the client targets `/v2` and gets the entire updated surface. One version number, one migration guide, one deprecation timeline.

### How Global Versioning Avoids Lockstep

The common objection is that bumping one resource forces the entire API to v2. This is a misconception. When the API moves to v2, only features with breaking changes create new `api/v2/` folders. Features that did not change are re-exported — the v2 global router simply imports their v1 routes. There is zero code duplication for unchanged features. The re-export is a single import line in the version router file.

### Version Assembly

Version assembly is a global infrastructure concern, not a feature concern. The global version routers live in `infrastructure/http/routes/` and import from feature barrel files. Each version router mounts every feature's routes under the appropriate path prefix, creating a complete API surface for that version.

When v2 is introduced, the v2 router imports v2 routes for changed features and v1 routes for unchanged features. The result is that `/v2` is a complete, self-contained API surface — clients never need to mix version prefixes.

### What Gets Versioned, What Doesn't

Only the transport layer is versioned. Controllers and route definitions live inside version folders (`api/v1/`, `api/v2/`). Everything else — validation schemas, domain types, services, repository interfaces, repository implementations — is version-agnostic. This means introducing a new API version is a small, contained change: create a new controller that calls the same service methods but parses or shapes the HTTP layer differently.

### When to Bump the Global Version

A version bump is required only for breaking changes: removing or renaming a response field, changing a field type, removing an endpoint, or changing the required/optional status of a request field. Non-breaking changes (new optional fields, new endpoints, new query parameters) do not require a version bump — they are additive and backward-compatible.

### Versioning Principles

All routes require a version prefix — no unversioned endpoints exist except for health checks. The API version number is included in every response body so clients can confirm which version they are consuming. Previous versions remain active until formally deprecated, and deprecation is communicated to all consumers before removal.

---

## 6. Dependency Injection

The project uses **Awilix** as its dependency injection container. Awilix was chosen over alternatives because it requires no decorators (keeping the code free of framework-specific syntax), supports both singleton and request-scoped registrations natively, and integrates cleanly with Express through a per-request scoped container.

### Why DI at All

Without a DI container, wiring dependencies means either passing them manually through constructor chains (which becomes verbose as the dependency graph grows) or importing singletons directly (which creates tight coupling and makes testing harder). A DI container centralises the wiring in a single file (`container.ts`) and provides automatic resolution: when a service is requested, the container knows to inject the repository, which knows it needs the database client, which knows it needs the config.

### Registration Scopes

The container has two scopes. Singletons are created once at startup and shared across all requests. The database client, Redis client, cache service, logger, and configuration object are all singletons — they represent long-lived connections or stateless utilities.

Request-scoped dependencies are created fresh for each incoming HTTP request. Repositories, services, and controllers are all request-scoped. This means each request gets its own instance of the service, which gets its own instance of the repository. The scoped container is created by the `request-context` middleware, which attaches an Awilix child scope to the request. The child scope inherits all singletons from the parent container and adds the request-scoped registrations.

### Why Request Scoping for Repositories and Services

Request scoping exists because some dependencies carry per-request state. The logger, for example, might carry the correlation ID for the current request. A repository might carry a transaction context. Request scoping ensures that these per-request concerns don't leak between concurrent requests.

### Registration File

All registrations live in `container.ts` at the `src/` root. This file is the single source of truth for the dependency graph. When a developer adds a new feature, they register its repository, service, and controller here. The registration maps the interface name to the concrete implementation, which is the key to the inversion of control that makes the architecture testable.

---

## 7. Request Lifecycle

Understanding the full lifecycle of a request from arrival to response is essential for debugging, performance tuning, and understanding where each concern is handled.

```
Client sends HTTP request
│
└─→ Express receives request
    │
    ├─→ correlation-id middleware
    │     Extracts X-Correlation-ID from header (or generates a new UUID).
    │     Stores it in AsyncLocalStorage so it is available everywhere in this
    │     request's call chain without explicit passing.
    │
    ├─→ request-logger middleware
    │     Creates a Pino child logger with the correlation ID baked in.
    │     Logs request start: method, path, correlationId, user-agent.
    │     Attaches an on-finish hook to log response: statusCode, duration.
    │
    ├─→ rate-limiter middleware
    │     Checks Redis sliding window counter for this client (by IP or API key).
    │     If limit exceeded → responds 429 immediately, request stops here.
    │
    ├─→ request-context middleware
    │     Creates an Awilix scoped container (child of the root container).
    │     Attaches it to the request object (req.scope).
    │     All subsequent middleware and handlers resolve dependencies from this scope.
    │
    ├─→ Global version router matches /v1/* or /v2/*
    │   │
    │   └─→ Feature router matches specific path (e.g., /v1/orders/:id)
    │       │
    │       ├─→ authenticate middleware (if route is protected)
    │       │     Extracts JWT from Authorization header.
    │       │     Verifies signature, expiry, issuer, audience.
    │       │     Decodes claims, attaches user context to request.
    │       │     If invalid → responds 401, request stops here.
    │       │
    │       ├─→ authorize middleware (if route requires specific permissions)
    │       │     Reads user's role/permissions from the request context.
    │       │     Checks against the required permission for this route.
    │       │     If insufficient → responds 403, request stops here.
    │       │
    │       ├─→ validate middleware (if route has a schema)
    │       │     Runs the Zod schema against req.body, req.query, or req.params.
    │       │     If validation fails → responds 422 with structured errors.
    │       │     If valid → parsed/typed data replaces raw req.body.
    │       │
    │       └─→ Controller method
    │             Resolved from the scoped DI container.
    │             Extracts typed inputs from the validated request.
    │             Calls the service method with domain-typed arguments.
    │             │
    │             └─→ Service method
    │                   Executes business logic.
    │                   May call repository methods (through interface).
    │                   May call cache service.
    │                   May call other feature services.
    │                   May throw domain errors if business rules are violated.
    │                   │
    │                   └─→ Repository method
    │                         Executes Prisma query.
    │                         Returns domain type (mapped from Prisma model).
    │                         │
    │                         └─→ PostgreSQL
    │
    │   ←── Response flows back up ──
    │
    │             Repository returns domain entity to service.
    │             Service returns result to controller.
    │             Controller maps to response DTO via mapper.
    │             Controller calls res.status(200).json(responseDto).
    │
    ├─→ not-found middleware
    │     If no route matched → responds 404.
    │
    └─→ error-handler middleware
          If any layer threw an error, Express skips to here.
          Maps AppError subclass to HTTP status code + structured response.
          Logs error with correlationId, stack trace (if non-operational).
          Responds with structured error JSON.
```

---

## 8. Middleware Pipeline

Middleware executes in a strict order. The order matters because each middleware depends on the context established by the ones before it.

The first middleware in the pipeline is the **correlation ID middleware**. It must be first because every subsequent middleware, log line, error report, and trace span will include this ID. If a request arrives with an `X-Correlation-ID` header (common in microservice environments where an upstream service originates the ID), it is reused. Otherwise a new UUID is generated. The ID is stored in AsyncLocalStorage so that any code anywhere in the request's call chain — including code that doesn't have access to the `req` object, like a deep repository method — can retrieve it without explicit passing.

The **request logger middleware** comes second because it needs the correlation ID. It creates a Pino child logger that has the correlation ID as a default field, so every log line from this request includes it automatically. It also hooks into the response finish event to log the response status code and duration.

The **rate limiter middleware** comes next because there is no point in authenticating, authorising, validating, or executing business logic for a request that has exceeded its rate limit. Rejecting early saves compute and protects downstream systems.

The **request context middleware** creates the Awilix scoped container. It must come before any middleware or handler that resolves dependencies from the container. The scoped container is attached to `req.scope`.

The four middleware above are global — they run on every request. The following middleware are route-level and are applied selectively per route.

The **authenticate middleware** verifies the JWT and attaches the decoded user to the request context. It is applied to protected routes only. Public routes (login, register, health checks) skip it.

The **authorize middleware** checks the authenticated user's permissions against the route's requirements. It is applied to routes that require specific roles or permissions.

The **validate middleware** runs the Zod schema against the request body, query parameters, or path parameters (or any combination). It is applied to routes that accept input. On success, it replaces the raw `req.body` with the parsed and typed output from Zod, stripping unknown fields.

The **not-found middleware** is mounted after all routes. If no route matched the request, this middleware responds with a 404.

The **error handler middleware** is the final middleware in the pipeline. It is an Express error-handling middleware (four-parameter signature). Any error thrown anywhere in the request lifecycle — whether in a controller, service, repository, or earlier middleware — is caught here and converted to a structured HTTP error response.

---

## 9. Error Handling

The error handling strategy is designed around a single principle: every error that reaches the client must be structured, identifiable, and traceable. No raw stack traces, no generic "Internal Server Error" strings, no error codes that require the client to guess what went wrong.

### Error Taxonomy

All application errors extend a base `AppError` class that carries four properties: a machine-readable error code (an enum value like `USER_NOT_FOUND` or `INSUFFICIENT_STOCK`), an HTTP status code, a human-readable message, and a boolean `isOperational` flag that distinguishes expected business errors from unexpected programmer errors.

The `shared/errors/http-errors.ts` file provides standard HTTP error classes: `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (422), `RateLimitError` (429), and `InternalError` (500).

Feature-specific errors live in each feature's `domain/` layer. A `UserAlreadyExistsError` extends `ConflictError` with a specific error code. An `InsufficientStockError` extends `ValidationError` with a specific code. These are domain-meaningful errors that the service layer throws when business rules are violated.

### Operational vs Programmer Errors

Operational errors are expected and recoverable: a user not found, a validation failure, an expired token, a duplicate email. These are part of the application's normal flow. They have `isOperational: true` and are logged at `warn` level.

Programmer errors are unexpected: a null reference, a broken database query, an unhandled promise rejection. These indicate bugs. They have `isOperational: false` and are logged at `error` level with full stack traces.

The error handler middleware uses the `isOperational` flag to decide what information to include in the response. Operational errors return the error code, message, and status code to the client. Programmer errors return a generic "Internal Server Error" message to the client — the details are logged server-side but never exposed.

### Error Response Shape

Every error response follows the same structure. The `error` object contains a machine-readable `code`, a human-readable `message`, the HTTP `statusCode`, the `correlationId` for tracing, and an ISO-8601 `timestamp`. Validation errors additionally include a `details` array with per-field error information.

### Where Errors Are Thrown

Controllers do not throw errors — they delegate to services and let errors propagate. Services throw domain errors when business rules are violated. Repositories throw when database operations fail (Prisma errors are caught and wrapped in domain errors by the repository). Middleware throws for transport concerns (authentication failures, rate limit violations, validation failures).

All errors propagate up to the centralized error handler middleware. No try-catch blocks in individual controllers unless there is a specific reason to transform an error at that layer (which is rare).

---

## 10. Configuration Management

Configuration follows the fail-fast principle: every environment variable the application needs is defined in a Zod schema, and the schema is parsed at startup. If any variable is missing, malformed, or outside acceptable bounds, the application refuses to start and logs exactly which variable failed and why.

### Config Structure

The `config/` directory contains a Zod schema file (`env.schema.ts`) that defines the shape and validation rules for every environment variable: types, defaults, minimum lengths, valid enum values, URL format checks. The `index.ts` file parses `process.env` against this schema at import time and exports a fully typed, validated configuration object.

Individual config files (`database.ts`, `redis.ts`, `auth.ts`, `queue.ts`, `logger.ts`) consume the validated config object and derive connection-specific configuration from it. They exist for organisational clarity — rather than one massive config object, each concern has its own focused config derivation.

### Config Principles

Environment variables are the only external input to the configuration system. There are no config files to load, no remote config services to call during startup, no YAML or JSON to parse. The `.env.example` file documents every variable with its expected format and a safe example value. The `.env` file is gitignored.

Secrets (database passwords, JWT secrets, API keys) are never hardcoded, never committed, and never have insecure defaults. The Zod schema enforces minimum lengths for secrets to prevent developers from using trivially insecure values in development that might accidentally reach production.

The configuration object is registered as a singleton in the DI container. Any service or middleware that needs configuration receives it through injection, not by reading `process.env` directly.

---

## 11. Database & Prisma Strategy

### Prisma at the Project Root

The `prisma/` directory lives at the project root, not inside `src/`. This is intentional: the Prisma schema and migrations are operational artifacts consumed by the CI/CD pipeline (migrations run as a pipeline stage before deployment) and by developers (for schema authoring and local migration generation). They are not application code that gets imported by `src/`.

### Split Schema Files

Schema files are split by domain (one `.prisma` file per feature) using Prisma's `prismaSchemaFolder` preview feature. This reduces merge conflicts during active development — two developers working on different domains modify different schema files. The `base.prisma` file contains the `datasource` and `generator` blocks and is the single source of truth for database connection configuration. Domain schema files contain only models and enums.

### Forward-Only Migrations

Migrations are forward-only. There are no rollback scripts. Every schema change must be backward-compatible with the currently running application version. This means additive changes (new columns with defaults, new tables) are always safe. Destructive changes (dropping columns, renaming tables) require a multi-step migration strategy: first deploy code that stops using the old column, then deploy the migration that removes it.

### Prisma Import Restrictions

The only files in the entire `src/` directory that may import `@prisma/client` are the Prisma client instantiation file (`infrastructure/database/prisma-client.ts`) and the Prisma repository implementation files (`features/*/infra/*.prisma-repository.ts`). No exceptions. This is enforced by an ESLint rule (restricted-imports) that blocks `@prisma/client` imports in any file outside these two locations. The service layer never sees a Prisma model — only domain types returned by the repository through the mapper.

### Seeding

The seed script (`prisma/seed.ts`) populates development and test databases with realistic data. It is idempotent (safe to run multiple times) and uses upserts rather than inserts. The seed script is never run in production.

---

## 12. Repository Pattern

The repository pattern is the most important architectural boundary in the codebase. It separates what the domain needs (the interface) from how it is implemented (Prisma queries).

### Repository Interface (Domain Layer)

The repository interface lives in `features/*/domain/` and defines the data access contract using only domain types. Method signatures use domain types for inputs and outputs, never Prisma-generated types. The interface describes the operations the service needs: `findById`, `findByEmail`, `findAll` (with filtering and pagination), `create`, `update`, `delete`. It is the service's sole dependency for data access.

### Repository Implementation (Infrastructure Layer)

The Prisma repository implementation lives in `features/*/infra/` and implements the interface. It receives a PrismaClient instance via DI constructor injection. Each method translates the domain-typed input into a Prisma query, executes it, and maps the Prisma result back to a domain type using the feature's mapper.

### Why This Separation Matters

The separation delivers three benefits. First, the service is testable without a database — unit tests mock the interface, not Prisma, resulting in fast and deterministic tests. Second, the ORM is swappable — if Prisma is replaced by Drizzle, Kysely, or raw SQL, only the `infra/` files change. The service, controller, and types are untouched. Third, the boundary is visible in the folder structure — a code review can verify at a glance that no domain file imports `@prisma/client`.

### Mapper Pattern

The mapper file in the domain layer handles translation between the Prisma model shape and the domain type shape. Prisma models may have snake_case columns, database-specific fields (created_at as a Date), or relationship fields that don't map directly to the domain model. The mapper normalises these differences. The repository implementation calls the mapper before returning results to the service.

---

## 13. Validation Strategy

Validation happens at the HTTP boundary, before the request reaches the controller. The project uses Zod for runtime validation because it provides a single source of truth for both the validation rules and the TypeScript types (Zod's `z.infer<>` produces the type from the schema, eliminating drift between validation and typing).

### Validation File Location

Each feature has a `api/*.validation.ts` file that sits directly under the `api/` directory, not inside a version folder. Validation schemas are model-driven — they describe the shape of the domain input — and are shared across API versions. If a v2 controller changes the response shape but accepts the same input, it uses the same validation schema as v1.

### Validation Middleware

The generic `validate` middleware in `infrastructure/http/middleware/` accepts a schema object with optional `body`, `query`, and `params` schemas. It runs the appropriate schema against the corresponding part of the request. On success, the raw `req.body`/`req.query`/`req.params` is replaced with the parsed, typed output. On failure, the middleware throws a `ValidationError` with structured per-field details.

Replacing the raw request data with parsed data is critical: it means the controller receives typed, validated input rather than raw `any` — and unknown fields are stripped, preventing unexpected data from reaching the service layer.

### What Gets Validated Where

Request input (body, query, params) is validated at the middleware layer. Domain invariants (a user cannot place an order if their account is suspended) are validated in the service layer. Database constraints (unique email) are caught in the repository layer and wrapped in domain errors. Configuration is validated at startup.

---

## 14. Authentication & Authorization

### Authentication

Authentication is handled by the `authenticate` middleware. It extracts the JWT from the `Authorization` header (Bearer scheme), verifies the signature against the configured secret, checks expiry and issuer claims, and decodes the payload. The decoded user claims (user ID, email, roles) are attached to the request context so downstream handlers can access them.

If the token is missing, malformed, expired, or has an invalid signature, the middleware responds with a 401 immediately. The request never reaches the controller.

Authentication is applied selectively: public routes (login, register, password reset, health checks) skip it. Protected routes declare authentication in their route definitions.

### Authorization

Authorization is handled by the `authorize` middleware. It reads the user's roles and permissions from the request context (populated by the authenticate middleware) and checks them against the route's declared requirements.

The authorization model is RBAC (Role-Based Access Control). Each role (admin, editor, viewer) has a set of permissions (users:read, users:write, orders:read, orders:delete). Routes declare which permission is required. The authorize middleware checks whether the authenticated user has a role that includes the required permission.

Authorization is a separate middleware from authentication because the two concerns are orthogonal. A request must be authenticated before it can be authorised, but authentication does not imply any particular level of access.

### Token Lifecycle

JWTs are stateless and short-lived (15 minutes by default). Refresh tokens (longer-lived, stored server-side in the database) are used to issue new access tokens without re-authentication. Token revocation is handled by maintaining a blacklist (Redis set of revoked JTIs) checked during authentication.

The auth feature's `infra/` layer contains the JWT provider (sign and verify operations) and the OAuth provider (for social login integrations). These are implementation details behind the auth service interface.

---

## 15. Observability

Observability is not an afterthought — it is a first-class concern baked into the middleware pipeline and infrastructure layer from day one.

### Structured Logging (Pino)

The project uses Pino for logging because it produces structured JSON output, is the fastest Node.js logger by benchmarks, and supports child loggers that inherit context fields. The root Pino instance is created in `infrastructure/observability/logger.ts` and registered as a singleton in the DI container.

The request logger middleware creates a child logger per request that includes the correlation ID as a default field. Every log line produced during that request's lifecycle automatically includes the correlation ID, enabling end-to-end request tracing in log aggregation tools (CloudWatch, ELK, Loki) without any manual effort by the developer.

Log levels follow the standard Pino hierarchy: `fatal` (system is unusable), `error` (programmer errors, unexpected failures), `warn` (operational errors, deprecation warnings), `info` (significant events like startup, shutdown, configuration), `debug` (development-time detail), `trace` (very verbose, rarely used in production). The log level is configurable per environment via config.

Redaction paths are configured to prevent sensitive data (passwords, tokens, credit card numbers) from appearing in logs. Pino's redaction is applied at the serialiser level, not as an afterthought.

### Correlation IDs (AsyncLocalStorage)

The correlation ID is the glue that connects all observability signals for a single request. It is generated (or extracted from the inbound `X-Correlation-ID` header) by the first middleware and stored in Node.js's `AsyncLocalStorage`. AsyncLocalStorage propagates the value through the entire async call chain — from middleware to controller to service to repository to database client — without passing it explicitly through function arguments. Any code anywhere can retrieve the current correlation ID by calling a utility function that reads from the async store.

The correlation ID appears in every log line, every trace span, every error response, and is returned to the client as the `X-Correlation-ID` response header. If a downstream system receives this ID and propagates it, the entire distributed call chain is traceable.

### Distributed Tracing (OpenTelemetry)

The project uses OpenTelemetry for distributed tracing. The OTel SDK is initialized in `infrastructure/observability/tracing.ts`, which must be the first import in the application entry point (before Express, before Prisma, before anything else). This is because OTel patches Node.js modules (HTTP, pg, ioredis) at load time to automatically instrument them.

Auto-instrumentation provides traces for HTTP requests (inbound and outbound), database queries (Prisma/pg), Redis operations, and BullMQ jobs without any manual code. Custom spans can be added for business-critical paths (order placement, payment processing) where additional granularity is needed.

Traces are exported to a collector (Jaeger, Grafana Tempo, Datadog) configured via the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable. Each span carries the correlation ID as an attribute for cross-referencing with logs.

### Metrics

Custom application metrics are defined in `infrastructure/observability/metrics.ts` using the OpenTelemetry Metrics API. Standard metrics include: HTTP request duration (histogram, by route and status code), active connections (gauge), request count (counter, by route and method), error count (counter, by error code), and business metrics (orders placed, users registered). These complement the infrastructure-level metrics provided by the container orchestrator (CPU, memory, restarts).

---

## 16. Caching Strategy

The caching layer sits in `infrastructure/cache/` and provides a Redis-backed cache service that any feature's service layer can use through dependency injection.

### Cache Service Interface

The cache service exposes four core operations: `get` (read a value by key), `set` (write a value with a TTL), `invalidate` (delete a key or a key pattern), and `getOrSet` (read the value if it exists, otherwise execute a callback, cache the result, and return it). The `getOrSet` pattern is the most commonly used — it eliminates the cache-miss boilerplate that otherwise clutters every service method.

### Cache Key Strategy

Cache keys follow a namespaced convention: `feature:entity:id` (e.g., `user:profile:123`, `product:detail:456`). This convention makes invalidation straightforward — when a user profile is updated, invalidate `user:profile:123`. When an admin action requires clearing all product caches, invalidate `product:*`.

### What Gets Cached

Caching decisions are made in the service layer, not in the repository or controller. The service layer understands the business context: how frequently data changes, how expensive it is to compute, and how stale it can be. Read-heavy data that changes infrequently (user profiles, product catalog, configuration) is cached. Write-heavy or real-time data (order status, live inventory counts) is not.

### Cache Invalidation

Cache invalidation follows the write-through pattern: when the service writes to the database (create, update, delete), it invalidates the corresponding cache entries in the same operation. There is no separate cache invalidation job. This ensures that stale data is never served after a write, at the cost of slightly slower writes (one additional Redis call).

---

## 17. Async Processing & Queues

Not every operation needs to complete within the HTTP request-response cycle. The project uses BullMQ (backed by Redis) for asynchronous job processing.

### When to Use Queues

Operations that are slow (sending emails, generating reports, processing images), operations that can fail and need retry (calling flaky third-party APIs, webhook delivery), and operations where the user doesn't need an immediate result (analytics ingestion, audit log shipping) should be enqueued rather than executed synchronously.

### Producer/Consumer Pattern

The `infrastructure/queue/` directory contains a BullMQ client that creates named queues, a `producers/` directory with functions that enqueue jobs, and a `consumers/` directory with worker functions that process jobs.

Producers are called from the service layer. When the notification service needs to send an email after an order is placed, it calls the email producer to enqueue the job rather than calling the email sender directly. This decouples the order flow from the email delivery and ensures that email failures don't fail the order.

Consumers run as separate processes (or in a separate pod/container) and process jobs from the queue. Each consumer handles a specific job type, implements retry logic with exponential backoff, and moves permanently failed jobs to a dead-letter queue for manual investigation.

### Queue Configuration

Default job options (retry count, backoff strategy, job timeout, removal on completion) are configured centrally in `config/queue.ts`. Individual producers can override defaults for specific job types that need different behavior.

---

## 18. Health Checks

The health feature exposes two endpoints that serve different purposes.

### Liveness — `/health/live`

The liveness endpoint answers the question "is this process alive and able to respond to HTTP requests?" It returns 200 if the Express server is running and can process requests. It does not check external dependencies. This endpoint is used by the container orchestrator (Kubernetes liveness probe, ECS health check) to detect zombie processes that are running but unable to serve traffic. If the liveness check fails, the orchestrator kills and restarts the container.

The liveness endpoint must be fast (sub-millisecond) and must never fail due to an external dependency outage. If the database goes down, the liveness check still returns 200 — the process itself is fine, it just can't reach the database.

### Readiness — `/health/ready`

The readiness endpoint answers the question "is this process ready to serve real traffic?" It checks all critical external dependencies: can it connect to PostgreSQL (a simple query like `SELECT 1`), can it connect to Redis (a `PING`), and are any other required services reachable. If any dependency is unreachable, it returns 503.

This endpoint is used by the load balancer (Kubernetes readiness probe) to decide whether to route traffic to this instance. During startup, the readiness check fails until all connections are established — this prevents the load balancer from sending traffic to a container that hasn't finished initialising. During a dependency outage, the readiness check fails and traffic is routed to healthy instances.

### No Auth on Health Endpoints

Health check endpoints are public (no authentication required). They are excluded from the API versioning scheme — they are mounted at `/health/live` and `/health/ready`, not under `/v1/` or `/v2/`.

---

## 19. Graceful Shutdown

When the process receives a termination signal (SIGTERM from the container orchestrator during deployment, SIGINT from Ctrl+C during development), it must shut down gracefully: finish processing in-flight requests, close database connections, flush log buffers, and disconnect from Redis before exiting.

### Shutdown Sequence

The shutdown handler is registered in `server.ts`. When a signal is received, the sequence is as follows. First, the HTTP server stops accepting new connections (calling `server.close()`). Existing in-flight requests are allowed to complete up to a configurable timeout (default 30 seconds). Second, BullMQ consumers stop picking up new jobs and wait for current jobs to complete. Third, the Prisma client disconnects from the database, closing the connection pool. Fourth, the Redis client disconnects. Fifth, the OpenTelemetry SDK flushes pending traces and metrics. Finally, the process exits with code 0.

If the graceful shutdown exceeds the timeout, the process exits with code 1 (force kill). This prevents a stuck request from keeping the container alive indefinitely during a deployment.

### Why This Matters

Without graceful shutdown, a deployment kills the container mid-request. In-flight database transactions are left uncommitted, WebSocket connections are dropped without close frames, and pending trace data is lost. Graceful shutdown ensures zero dropped requests during deployments and zero data corruption from interrupted transactions.

---

## 20. Cross-Feature Communication

When a feature needs data or behavior from another feature, it must follow strict communication rules that preserve the encapsulation and independence of each feature module.

### Allowed Communication

Feature A's service may call Feature B's service. The import must go through Feature B's barrel file (`index.ts`), never through Feature B's internal files. This means Feature A depends on Feature B's public API, not on its implementation details.

Feature A may also import domain types exported from Feature B's barrel file. This is necessary for shared contracts — an order service needs to know the shape of a User type to validate that the ordering user exists.

### Prohibited Communication

Feature A must never import Feature B's repository (interface or implementation). If Feature A needs data owned by Feature B, it must call Feature B's service, which calls Feature B's repository. This ensures that data access for a domain is always mediated by that domain's service layer, which can enforce its own business rules.

Feature A must never import from Feature B's internal paths — only from Feature B's barrel file. This rule is enforced by the barrel file pattern (Section 25) and can be backed by an ESLint rule.

### When Communication Becomes Excessive

If two features are constantly calling each other's services, it is a signal that the domain boundary is drawn incorrectly. Either the two features should be merged into one, or a shared domain concept should be extracted. Excessive cross-feature communication is an architectural smell, not a pattern to optimise.

---

## 21. Import Rules & Dependency Boundaries

The import rules are the enforcement mechanism for the layer architecture. They are codified as ESLint rules (using `eslint-plugin-import` or `eslint-plugin-boundaries`) so that violations are caught at lint time, not during code review.

### Layer Import Matrix

```
WHO CAN IMPORT WHAT:

features/*/api/v*/      → features/*/domain/        ✅  (controller calls service)
                         → features/*/api/*.validation.ts  ✅  (controller uses validation)
                         → shared/*                  ✅  (common types, errors, utils)
                         → features/*/infra/         ❌  NEVER (transport must not know infra)
                         → other features' internals ❌  NEVER (only via barrel file)
                         → @prisma/client            ❌  NEVER

features/*/domain/       → shared/*                  ✅  (common types, errors, utils)
                         → features/*/api/           ❌  NEVER (domain must not know transport)
                         → features/*/infra/         ❌  NEVER (domain depends on interface, not impl)
                         → @prisma/client            ❌  NEVER
                         → express                   ❌  NEVER
                         → other features (barrel)   ✅  (via index.ts for cross-feature services/types)

features/*/infra/        → features/*/domain/        ✅  (implements interfaces defined by domain)
                         → infrastructure/database/  ✅  (needs PrismaClient instance)
                         → infrastructure/cache/     ✅  (if feature-specific caching in repo)
                         → shared/*                  ✅  (common types)
                         → features/*/api/           ❌  NEVER
                         → @prisma/client            ✅  (ONLY place in src/ besides prisma-client.ts)

infrastructure/*         → shared/*                  ✅
                         → config/*                  ✅
                         → features/*/               ❌  NEVER (infra doesn't know about features)
                         → @prisma/client            ✅  (prisma-client.ts only)

shared/*                 → (nothing)                 Only standard TypeScript, no external imports.
                         → infrastructure/*          ❌  NEVER
                         → features/*                ❌  NEVER
                         → @prisma/client            ❌  NEVER
                         → express                   ❌  NEVER
```

### Enforcing the Rules

The ESLint configuration includes rules that enforce these boundaries. The `no-restricted-imports` rule blocks `@prisma/client` in any file not matching the allowed paths. The `eslint-plugin-boundaries` rules (or equivalent) enforce inter-layer and inter-feature import restrictions. These rules run in CI, so violations block the PR.

---

## 22. Testing Strategy

The testing strategy is designed around the architectural layers. Each layer has a specific testing approach that matches its responsibility.

### Unit Tests — Service Layer

Service unit tests are the most valuable tests in the codebase. They test business logic in isolation by mocking the repository interface. Since the service depends on an interface (not on Prisma), mocking is trivial: create an object that satisfies the interface and stub the methods to return predetermined data.

Service unit tests are fast (no database, no I/O), deterministic (no flaky network calls), and focused (one test per business rule). They verify that the service enforces invariants, orchestrates correctly, handles edge cases, and throws the right domain errors.

### Unit Tests — Controller Layer

Controller unit tests verify that the HTTP layer correctly translates between HTTP and domain. They mock the service and verify that the controller parses the request correctly, calls the service with the right arguments, and shapes the response correctly (status code, response body structure, headers). They also verify that the controller passes through service errors without catching them (since the error handler middleware handles them).

### Integration Tests — Route Layer

Integration tests exercise the full vertical slice: HTTP request → middleware → controller → service → repository → database → response. They use Supertest to send real HTTP requests to the Express app and Testcontainers to spin up a real PostgreSQL instance for the test run. Integration tests verify that the middleware pipeline, DI wiring, Prisma queries, and error handling all work together correctly.

Integration tests are slower than unit tests and are run less frequently (in CI, not in watch mode). They focus on happy-path flows and critical error scenarios rather than exhaustive edge case coverage.

### Test File Location

Unit and integration tests are co-located in each feature's `__tests__/` directory. File naming conventions distinguish them: `*.test.ts` for unit tests, `*.integration.test.ts` for integration tests. Vitest can be configured to run them separately (unit tests in watch mode during development, integration tests in CI).

### Global Test Infrastructure

The `tests/` directory at the project root contains shared test infrastructure: global setup (bootstrap the DI container and database connection for integration tests), global teardown (close connections, stop containers), helpers (Prisma mock factory, Supertest app builder with automatic auth token injection, JWT generation for test users), fixtures (static test data), and factories (dynamic test data builders that create valid domain objects with sensible defaults and allow per-field overrides).

### Coverage

Coverage thresholds are configured in `vitest.config.ts`. The domain layer (services, mappers, error classes) should have the highest coverage (90%+) because it contains the business logic. The infrastructure layer should have moderate coverage (70%+) through integration tests. The transport layer has the lowest direct coverage because most of its logic is trivially thin — parsing, delegating, responding.

---

## 23. TypeScript Strategy

The project uses TypeScript in strict mode with all strict family flags enabled: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. These flags catch entire categories of bugs at compile time.

### Path Aliases

Path aliases are configured in `tsconfig.json` to eliminate deep relative imports. The standard alias is `@/` pointing to `src/`. This means imports read as `@/features/user` rather than `../../../features/user`, which is both more readable and resilient to file moves.

### Type Strategy

Domain types (defined in each feature's `domain/*.types.ts`) are the canonical type system for the application. Prisma generates its own types, but these are treated as infrastructure types that live behind the repository boundary. The mapper translates between Prisma types and domain types. Controllers define response DTOs that shape the API output. Request types are inferred from Zod schemas using `z.infer<>`, ensuring zero drift between validation and typing.

Type assertions (`as`) and non-null assertions (`!`) are treated as code smells. They indicate a gap in the type narrowing logic and should be replaced with proper runtime checks or type guards.

### Build

The project uses `tsc` for type checking and a bundler (esbuild or tsx) for compilation. Type checking and compilation are separate steps because esbuild is significantly faster than tsc for compilation but doesn't perform type checking. CI runs `tsc --noEmit` for type safety and the bundler for artifact generation.

---

## 24. Naming Conventions

Consistent naming reduces cognitive load. Every file and directory in the project follows predictable patterns.

### File Naming

All files use kebab-case except feature files, which use the `feature.purpose.ts` dot-notation convention: `user.service.ts`, `order.controller.ts`, `product.prisma-repository.ts`, `auth.validation.ts`. This convention makes it instantly clear what feature a file belongs to and what its role is.

Middleware files use the `purpose.middleware.ts` pattern: `authenticate.middleware.ts`, `rate-limiter.middleware.ts`, `error-handler.middleware.ts`.

Test files mirror the source file name with a `.test.ts` or `.integration.test.ts` suffix: `user.service.test.ts`, `order.routes.integration.test.ts`.

### Directory Naming

Directories use lowercase singular nouns for layers (`api`, `domain`, `infra`) and lowercase singular nouns for feature modules (`user`, `order`, `product`). Infrastructure directories use lowercase (`database`, `cache`, `queue`, `http-client`, `observability`).

### Type and Interface Naming

Interfaces use the plain noun convention without an `I` prefix: `UserRepository` not `IUserRepository`. Types use descriptive names that indicate purpose: `CreateUserInput`, `UpdateOrderDto`, `PaginatedResponse<T>`, `UserWithOrders`. Error classes use the `*Error` suffix: `UserNotFoundError`, `InsufficientStockError`.

### Export Naming

Services, repositories, controllers, and other classes use PascalCase. Utility functions use camelCase. Constants use UPPER_SNAKE_CASE. Enum values use UPPER_SNAKE_CASE.

---

## 25. Barrel Files & Encapsulation

Each feature module has an `index.ts` at its root that serves as the barrel file — the sole public API for that feature. It exports only what external consumers need: versioned route handlers and domain types. Internal files (services, repositories, controllers, mappers) are not exported.

### What Gets Exported

The barrel file exports two categories of things. First, route handlers for each active API version: the global version routers in `infrastructure/http/routes/` import these to assemble the complete API surface. Second, domain types that other features might need: if the order feature needs to reference a `User` type, it imports it from `@/features/user`, which re-exports the type from its domain layer.

### What Does Not Get Exported

Services, controllers, repositories, mappers, and error classes are internal. They are not exported from the barrel file. This means no external code can depend on the internal structure of a feature. If the user feature refactors its service into two services, no other feature is affected because no other feature ever imported the service directly.

### Enforcement

The convention is enforced by the import rules in Section 21: external consumers (other features, global routers) must import from the feature's barrel file, not from internal paths. The ESLint `no-restricted-imports` rule can be configured to flag imports that bypass the barrel file.

### When Services Need to Be Shared

If Feature A's service needs to call Feature B's service (per the cross-feature communication rules in Section 20), the barrel file exports the service class and its interface type. This is a deliberate, explicit widening of the public API — the team makes a conscious decision that this service method is part of the feature's public contract. The default is to keep services internal until a concrete need arises.

---
