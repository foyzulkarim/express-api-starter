# TypeScript Deep Analysis Report

## Metadata

| Field | Value |
|-------|-------|
| **Analysis Type** | PR |
| **Target** | PR #9 |
| **PR URL** | https://github.com/foyzulkarim/express-api-starter/pull/9 |
| **Base Branch** | main |
| **Analyzer** | /ts-check |
| **Date** | 2026-03-18 |
| **Files Analyzed** | 22 TypeScript files |
| **Lines Changed** | +497 / -0 |

## Stack Detected

| Technology | Detected | Agent Activated |
|------------|----------|-----------------|
| TypeScript | ✓ | ✓ (core) |
| React | ✗ | ✗ |
| Next.js | ✗ | ✗ |
| Express | ✓ | ✓ (conditional) |
| Database (Prisma) | ✓ | ✓ (conditional) |

**tsconfig.json baseline:** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitReturns: true`, `noUnusedLocals/Parameters: true` — TypeScript 5.9.3. `tsc --noEmit` exits 0.

---

## Executive Summary

### Verdict: REQUEST CHANGES

The foundational architecture is well-designed — correct Zod validation, clean error hierarchy, idiomatic `AsyncLocalStorage` usage, and sound TypeScript patterns throughout. However, four High issues need resolution: (1) `Object.setPrototypeOf` placement causes a measurable V8 de-optimization on every error construction; (2) `asyncHandler` can invoke `next()` twice when a handler calls `next()` and then rejects; (3) `@types/express@5` is installed against an `express@4` runtime, creating a type/runtime mismatch; and (4) `process.exit(1)` during module evaluation will silently kill the Vitest runner for any test that transitively imports config sub-modules.

### Quick Stats

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| TypeScript Strictness | 0 | 0 | 3 | 4 |
| Runtime Behavior | 0 | 2 | 2 | 3 |
| Async Patterns | 0 | 2 | 2 | 2 |
| Express Patterns | 0 | 1 | 3 | 3 |
| Database Patterns | 0 | 0 | 1 | 2 |
| **Total (deduplicated)** | **0** | **4** | **8** | **9** |

---

## 1. TypeScript Strictness

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | Medium | `src/shared/utils/async-handler.ts` | 4 | `fn` parameter typed as `(...) => Promise<void>` — `res.json(data)` returns `Promise<Response>`, which is not assignable to `Promise<void>`, forcing callers to use statement form | Widen to `Promise<unknown>` |
| 2 | Medium | `src/shared/errors/app-error.contract.ts` & `app-error.ts` | 4, 17 | `code: string` loses the `ErrorCode` union — arbitrary strings silently pass type checks | Change `code` to `ErrorCode` in both `AppErrorContract` and `AppError` constructor |
| 3 | Medium | `src/shared/types/express.d.ts` | 14 | `export {}` placed **inside** `namespace Express { }` — semantically inert at that position; `import type` on lines 1–2 already establishes module scope | Remove line 14 entirely; file is already a module |
| 4 | Low | `src/shared/constants/http-status.ts` | 15 | `HttpStatusCode` type exported but `AppErrorContract.statusCode` uses bare `number` — the two artifacts are decoupled | Type `AppErrorContract.statusCode` as `HttpStatusCode` |
| 5 | Low | `src/shared/errors/error-codes.ts` | 12 | `const ErrorCode` / `type ErrorCode` share identifier — IDE hover shows the object type, not the union string type | Add comment documenting the enum-emulation intent; or rename type to `ErrorCodeValue` for clarity |
| 6 | Low | `src/config/auth.ts`, `database.ts`, `redis.ts`, `queue.ts` | 3–6 | `as const` on objects whose values are `string` (from `Env`) does not narrow to literals — the `as const` only adds `readonly`, which is its sole benefit here | Add a comment clarifying that `as const` here provides `readonly` only, not literal type narrowing |
| 7 | Low | `src/shared/utils/correlation-id.ts` | 8–10 | `getCorrelationId()` returns a new `randomUUID()` on every call outside context — two calls in the same request-setup path yield two different IDs | Add JSDoc warning that the return value is not stable outside a `storage.run()` context |

#### Tracing Notes

**Finding #2 — `AppError.code: string` vs `ErrorCode` union**
- `error-codes.ts` exports both `const ErrorCode` (object) and `type ErrorCode` (union of all values)
- `app-error.contract.ts:4` declares `code: string` — not `ErrorCode`
- `app-error.ts:17` mirrors this in the constructor parameter type
- Result: `new AppError({ code: 'TYPO_ERRRO', statusCode: 400, message: '...' })` compiles silently
- Subclasses in `http-errors.ts` all pass `ErrorCode.BAD_REQUEST` etc. — they happen to be correct, but the type doesn't enforce it

**Finding #3 — `export {}` inside namespace**
```typescript
// Current — export {} at line 14 is inside namespace Express
declare global {
  namespace Express {
    interface Request { ... }
    export {};   // ← has no effect on module scope
  }
}
// Lines 1-2 already make this a module:
import type { AwilixContainer } from 'awilix';
import type { Logger } from 'pino';
```

#### Review Comments

##### #1: `Promise<void>` too narrow in asyncHandler
File: `src/shared/utils/async-handler.ts:4`

> The `fn` return type `Promise<void>` rejects expression-style handlers like `asyncHandler(async (req, res) => res.json({ ok: true }))` — `res.json()` returns `Response`, making the handler return `Promise<Response>`, which is not assignable to `Promise<void>`. Widening to `Promise<unknown>` removes this friction:
> ```typescript
> fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
> ```
> What do you think?

##### #2: `code: string` doesn't enforce the ErrorCode union
File: `src/shared/errors/app-error.contract.ts:4`

> `AppErrorContract.code` is typed as `string`, but `error-codes.ts` exports the `ErrorCode` union specifically to constrain this field. Currently `new AppError({ code: 'TYPO_ERRRO', ... })` compiles without error. Changing to `code: ErrorCode` would catch this at compile time:
> ```typescript
> import type { ErrorCode } from '../errors/error-codes.js';
> export interface AppErrorContract {
>   code: ErrorCode;  // was: string
> }
> ```
> If the intent is to allow domain-specific codes outside the built-in set, document that explicitly as an open extension point. What do you think?

##### #3: `export {}` misplaced inside namespace
File: `src/shared/types/express.d.ts:14`

> The `export {}` on line 14 is inside `namespace Express { }`. At that position it's a no-op — it doesn't contribute to making the file a module (the `import type` statements on lines 1–2 already do that). It reads as dead code and may confuse future readers. Safe to remove:
> ```typescript
> // Remove line 14 entirely — the file is already a module
> ```

---

## 2. Runtime Behavior

#### Findings Table

| # | Severity | File | Line | Issue | Runtime Impact | Recommendation |
|---|----------|------|------|-------|----------------|----------------|
| 1 | High | `src/shared/errors/app-error.ts` | 30 | `Object.setPrototypeOf(this, new.target.prototype)` after all property assignments — V8 must invalidate the hidden class it built for `this`, de-optimizing every IC site that reads properties on AppError instances | At high error rates (rate-limiting, validation), catch handlers and error inspectors become polymorphic/megamorphic. All 8 subclasses inherit this overhead. | Move the call to immediately after `super(message)` — before any `this.x = ...` assignments — so prototype repair happens before V8 builds the property shape |
| 2 | High | `src/shared/errors/app-error.ts` | 27–29 | `if (details !== undefined) { this.details = details; }` — instances without `details` get a 4-property shape; instances with `details` get a 5-property shape. Every `error.details` read site sees two shapes → polymorphic IC | At sustained load, catch handlers processing mixed AppError instances degrade from monomorphic to polymorphic. Two hidden classes instead of one. | Assign `this.details = details;` unconditionally — TypeScript still enforces `FieldError[] \| undefined`; V8 gets a stable uniform shape |
| 3 | Medium | `src/shared/constants/http-status.ts` | 1–13 | `as const` is TypeScript-only — compiled JS is a plain mutable object. Any code writing `HttpStatus.OK = 999` silently corrupts all downstream status checks | Runtime mutation risk — low probability but zero protection | Add `Object.freeze(HttpStatus)` after the declaration |
| 4 | Medium | `src/shared/errors/error-codes.ts` | 1–10 | Same `as const` mutability issue — `ErrorCode` object is mutable at runtime | Same risk as above | Add `Object.freeze(ErrorCode)` |
| 5 | Low | `src/config/logger.ts` | 6 | `redactPaths` array inside `as const` object — shallow mutability. Any consumer doing `loggerConfig.redactPaths.push('newPath')` modifies the global singleton | Future pino logger instances created after mutation will have the unintended paths | `Object.freeze` the array: `redactPaths: Object.freeze(['password', ...])` |

#### Tracing Notes

**Findings #1 & #2 — Hidden class de-optimization in AppError constructor**

V8 execution trace for `new NotFoundError("x")`:
```
super(message)                           → allocates Error, starts HC_Error
this.code = code                         → shape → HC0
this.statusCode = statusCode             → shape → HC1
this.isOperational = isOperational       → shape → HC2
if (details !== undefined) {             ← BRANCH — skipped for most errors
  this.details = details                 → shape → HC3  (different instances!)
}
Object.setPrototypeOf(this, new.target.prototype) ← INVALIDATES HC2 (or HC3)
```

Two hidden class paths exit the constructor. `Object.setPrototypeOf` after property assignment forces V8 to mark all existing ICs on this map as needing relearning. Moving `Object.setPrototypeOf` to immediately after `super()` means it fires before any `this.x` assignments — V8 builds the final shape on the already-corrected prototype, avoiding the invalidation.

#### Review Comments

##### #1 & #2: Object.setPrototypeOf placement + conditional details
File: `src/shared/errors/app-error.ts:24–30`

> Two related runtime concerns in the constructor. First, `Object.setPrototypeOf` on line 30 fires after all `this.x = ...` assignments, which causes V8 to invalidate the hidden class it built for those properties. Moving it to immediately after `super(message)` avoids the de-optimization. Second, the conditional `details` assignment creates two distinct object shapes — instances with `details` and instances without — causing polymorphic IC sites in catch handlers.
>
> ```typescript
> constructor({ code, message, statusCode, isOperational = true, details }: ...) {
>   super(message);
>   Object.setPrototypeOf(this, new.target.prototype); // ← move here, before any assignments
>   this.code = code;
>   this.statusCode = statusCode;
>   this.isOperational = isOperational;
>   this.details = details;                            // ← always assign (undefined is fine)
> }
> ```
> Thoughts?

##### #3 & #4: `as const` doesn't freeze at runtime
File: `src/shared/constants/http-status.ts:1`, `src/shared/errors/error-codes.ts:1`

> `as const` is erased at compile time. The emitted JS for both `HttpStatus` and `ErrorCode` is a plain mutable object. `HttpStatus.OK = 500` is valid JavaScript that compiles and runs without error. `Object.freeze()` is a one-liner that makes the immutability guarantee hold at runtime too:
> ```typescript
> export const HttpStatus = Object.freeze({ OK: 200, ... });
> ```
> Just a thought, not a blocker!

---

## 3. Async Patterns

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `src/shared/utils/async-handler.ts` | 7 | `Promise.resolve(fn(...)).catch(next)` — if a handler calls `next()` explicitly (pass-through), then the returned Promise later rejects, `.catch(next)` fires `next(err)` a second time. Express does not handle double-`next` gracefully (headers-already-sent or double-routing) | Guard with a `called` flag or use `.then(() => fn(...))` form which catches sync throws too |
| 2 | High | `src/config/index.ts` | 10 | `process.exit(1)` during synchronous module evaluation abandons the microtask queue — any test that transitively imports a config sub-module (`auth.ts`, `logger.ts`, etc.) with missing env vars will hard-kill the Vitest worker process, producing a confusing silent test failure | Add a Vitest `setupFiles` entry that pre-populates all required env vars before module evaluation; or throw `Error` and let the entry point handle exit |
| 3 | Medium | `src/shared/utils/async-handler.ts` | 7 | Inner Promise return value is discarded — `handler(req, res, next)` returns `undefined`, not a Promise. Tests `await handler(...)` but are awaiting `undefined`. Works today because `fn` is trivially fast; fails for any handler with real async work | Return the Promise: `return Promise.resolve(fn(...)).catch(next)` |
| 4 | Medium | `src/shared/utils/correlation-id.ts` | 9 | `getCorrelationId()` outside `.run()` context generates a new UUID per call — two calls in the same code path get two different IDs. Logs look valid (UUID format) but are uncoordinated | Return a sentinel (`null` or `'no-context'`) when outside storage; or document clearly that the fallback is not stable |
| 5 | Low | `src/shared/utils/correlation-id.ts` | 4–6 | Raw `AsyncLocalStorage` exported — any importer can call `correlationIdStorage.disable()`, permanently killing context propagation process-wide | Export only `runWithCorrelationId(id, fn)` wrapper and `getCorrelationId()`; keep the storage instance unexported |
| 6 | Low | `src/shared/utils/correlation-id.ts` | — | `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)` handlers (not yet written) run outside any `AsyncLocalStorage` context — `getCorrelationId()` there will always return a fresh UUID | Add a JSDoc note on `getCorrelationId` warning that process-level handlers have no ALS context |

#### Tracing Notes

**Finding #1 — Double `next()` scenario**
```
asyncHandler(async (req, res, next) => {
  next();                    // ← deliberately passes to next middleware
  await db.query();          // ← later rejects unexpectedly
});
// .catch(next) fires → next(err) called a second time
// Express 4: "Cannot set headers after they are sent"
```

**Finding #3 — `await handler(...)` test passes for wrong reason**

The test at `async-handler.test.ts:15` does `await handler(req, res, next)`. `handler` is the inner `(req, res, next) => void` — it returns `undefined`. `await undefined` resolves in one microtask tick. The test passes because Vitest flushes microtasks between `await` and the assertion. This is coincidental correctness — once `fn` involves a real `await`, the test would assert before the inner Promise settles.

**Finding #2 — `process.exit(1)` impact on Vitest**

Import chain: `test file` → `import { authConfig } from '../auth.js'` → `import { config } from './index.js'` → top-level evaluation → `process.exit(1)`.

The current test for `envSchema` avoids this by importing `env.schema.ts` directly. But any future integration test that imports `authConfig`, `databaseConfig`, etc., without a Vitest `setupFiles` that seeds env vars will hit this hard exit. No stack trace, no informative failure — just a Vitest worker silent crash.

#### Review Comments

##### #1: asyncHandler — double next() call
File: `src/shared/utils/async-handler.ts:7`

> The `Promise.resolve(fn(...)).catch(next)` form is correct for pure async handlers. The gap is when a handler calls `next()` internally (e.g., a validator that calls `next(err)` and exits) and then the promise returned by `fn` later rejects due to an unrelated reason — `.catch(next)` fires a second time against an already-progressed request. A minimal guard:
> ```typescript
> return (req, res, next) => {
>   let called = false;
>   const guardedNext: NextFunction = (...args) => {
>     if (!called) { called = true; next(...args as Parameters<NextFunction>); }
>   };
>   return Promise.resolve().then(() => fn(req, res, guardedNext)).catch(guardedNext);
> };
> ```
> The `.then(() => fn(...))` form also catches synchronous throws inside `fn`, which the current form does not. What do you think?

##### #2: `process.exit(1)` will kill Vitest workers
File: `src/config/index.ts:10`

> The module-level `process.exit(1)` is the right fail-fast behavior for production. The concern is tests: any test file that transitively imports `auth.ts`, `database.ts`, `logger.ts`, or any other config sub-module without having env vars set will cause the Vitest worker to hard-exit with no useful error. The current test correctly imports `env.schema.ts` directly to avoid this. Consider adding a Vitest `setupFiles` entry (e.g., `src/test/setup.ts`) that pre-populates all required env vars before any module is loaded, so config sub-modules are safe to import in integration tests. What do you think?

---

## 4. Express Patterns

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `package.json` | — | `@types/express@5.0.6` against `express@4.22.1` runtime — `RequestHandler` return type is `unknown` in v5 types vs `void` in v4; error handler arities and middleware signatures differ | Pin `@types/express` to `^4.17.21`, or upgrade runtime to `express@^5.x` |
| 2 | Medium | `src/shared/types/express.d.ts` | 7–9 | `correlationId`, `scope`, `logger` declared non-optional on `Request` — a route handler running before these middleware sets values will crash at runtime with TypeScript's blessing (`req.scope.resolve(...)` — TypeError: cannot read properties of undefined) | Mark as optional, or introduce a `ScopedRequest` interface for handlers that require middleware to have run |
| 3 | Medium | `src/shared/types/express.d.ts` | 8 | `scope: AwilixContainer` — field name is ambiguous; doesn't distinguish the root container from a per-request child scope | Rename to `diScope` or `requestScope`; add JSDoc noting it is a per-request child container |
| 4 | Low | `src/shared/types/express.d.ts` | 11 | `userRole?: string` — authorization guards like `req.userRole === 'admin'` have no compile-time protection against typos | Replace with a `UserRole` union type |
| 5 | Low | `src/shared/types/common.types.ts` | 5–14 | `ErrorResponse` missing `path` and `method` fields — API clients cannot determine which endpoint produced an error | Add `path?: string; method?: string` to the error envelope |

#### Tracing Notes

**Finding #1 — @types/express v5 vs express@4 runtime**

Key differences confirmed:
- `RequestHandler` return: `unknown` (v5 types) vs `void` (actual v4 runtime)
- Async error handling: v5 natively catches async route errors; v4 requires `asyncHandler` (which this PR provides)
- If future middleware uses `res.sendFile()`, `router.route()`, or other APIs, v5 type descriptions may differ subtly from v4 runtime behavior

The `asyncHandler` utility in this PR is exactly the right pattern for Express 4. Once Express 5 is adopted as the runtime, `asyncHandler` becomes optional for basic async handlers.

**Finding #2 — Non-optional augmented Request fields**

```typescript
// TypeScript says this is fine:
app.get('/users', (req, res) => {
  req.scope.resolve('userService').findAll(); // crashes if DI middleware not registered
});
```

Express doesn't encode middleware ordering in the type system. Two mitigation strategies:
```typescript
// Option A: make optional, force null-check at use site
interface Request { scope?: AwilixContainer; }

// Option B: ScopedRequest for handlers that require DI (preferred for ergonomics)
interface ScopedRequest extends Request {
  scope: AwilixContainer;
  logger: Logger;
  correlationId: string;
}
```

#### Review Comments

##### #1: @types/express v5 against express@4 runtime
File: `package.json`

> `@types/express@5.0.6` describes the Express v5 API, but the installed runtime is `express@4.22.1`. TypeScript currently passes, but the type descriptions are semantically wrong for the running code — particularly `RequestHandler` returns `unknown` in v5 types vs `void` in v4. Code written to be type-correct against v5 may behave unexpectedly at runtime. Two options: (a) pin `@types/express` to `^4.17.21`, or (b) upgrade the runtime to `express@^5.x` (which would also make `asyncHandler` unnecessary for basic async routes). Thoughts on which direction?

##### #2: Non-optional augmented Request properties
File: `src/shared/types/express.d.ts:7-9`

> `correlationId`, `scope`, and `logger` are non-optional on `Request`, but they're only populated after their respective middleware runs. A handler registered before those middleware (easy to do accidentally as the codebase grows) will crash at runtime with `Cannot read properties of undefined`, with no TypeScript warning. A `ScopedRequest` interface that extends `Request` with these fields guaranteed could give handlers a way to declare they depend on middleware having run:
> ```typescript
> // In a new file: src/shared/types/scoped-request.ts
> export interface ScopedRequest extends Express.Request {
>   correlationId: string;
>   scope: AwilixContainer;
>   logger: Logger;
> }
> // Route handlers that need DI/logging accept ScopedRequest:
> asyncHandler(async (req: ScopedRequest, res) => { ... })
> ```
> What do you think?

---

## 5. Database Patterns

#### Findings Table

| # | Severity | File | Line | Issue | Query Impact | Recommendation |
|---|----------|------|------|-------|--------------|----------------|
| 1 | Medium | `src/config/env.schema.ts` | 6 | `DATABASE_URL` validated as a generic URL — `mysql://`, `mongodb://`, `http://` all pass. Prisma requires `postgresql://` or `postgres://`. Misconfiguration fails only at Prisma connect time, not at startup. | Failure is delayed and harder to diagnose | Add `.refine(v => /^postgres(ql)?:\/\//.test(v), { message: 'Must be a PostgreSQL connection string' })` |
| 2 | Low | `src/config/database.ts` | 3–5 | `databaseConfig.url` field name is `url` — matches Prisma's `datasources.db.url` but the datasource name `db` is an implicit contract not documented anywhere | No impact now, but could confuse when Prisma schema is written | Add comment: `// used as datasources.db.url in PrismaClient({ datasources: { db: { url: databaseConfig.url } } })` |
| 3 | Low | `src/shared/types/pagination.types.ts` | 6–11 | `PaginatedResponse<T>` models only offset pagination — no `nextCursor` field for Prisma's cursor-based pagination. Cursor pagination avoids `OFFSET` performance degradation on large tables. | Future deep-page queries (page > 100) will be slow without cursor support | Add optional `nextCursor?: string` now; or document that this type is offset-only and a `CursorPaginatedResponse<T>` will be added |

#### Review Comments

##### #1: DATABASE_URL scheme not validated
File: `src/config/env.schema.ts:6`

> `z.string().url()` confirms the value is a valid URL structurally, but accepts any scheme. Since this project targets PostgreSQL exclusively, a `mysql://` or `http://` value passes startup validation and only fails when Prisma tries to open a connection — making the error harder to diagnose. A one-liner `.refine()` check closes this gap at startup:
> ```typescript
> DATABASE_URL: z.string().url().refine(
>   v => /^postgres(ql)?:\/\//.test(v),
>   { message: 'DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://)' }
> ),
> ```

##### #3: No cursor pagination support
File: `src/shared/types/pagination.types.ts:6`

> `PaginatedResponse<T>` is built for offset pagination (`page`/`pageSize`/`total`). Prisma's recommended pattern for large datasets is cursor-based pagination, which avoids the `OFFSET N` performance cliff. Adding an optional `nextCursor?: string` field now costs nothing and keeps both strategies available without a future breaking change:
> ```typescript
> export interface PaginatedResponse<T> {
>   data: T[];
>   page: number;
>   pageSize: number;
>   total: number;
>   nextCursor?: string; // optional: supports cursor-based pagination via Prisma
> }
> ```
> Just a thought, not a blocker!

---

## Prioritized Action Items

### Must Fix Before Merge (Critical / High)

1. **[Runtime] Move `Object.setPrototypeOf` before property assignments** — `src/shared/errors/app-error.ts:24` — Prevents V8 hidden-class de-optimization on every error construction; assign `this.details = details` unconditionally for uniform shape
2. **[Async/Express] `asyncHandler` double `next()` call** — `src/shared/utils/async-handler.ts:7` — Add guard flag or restructure to prevent double invocation when handler calls `next()` then rejects
3. **[Express] `@types/express@5` against `express@4` runtime** — `package.json` — Align by pinning types to v4 or upgrading runtime to v5
4. **[Async] `process.exit(1)` will kill Vitest workers** — `src/config/index.ts:10` — Add a Vitest `setupFiles` entry that seeds all required env vars before module load

### Should Address (Medium)

5. **[TS] `asyncHandler` fn return type** — `async-handler.ts:4` — Widen `Promise<void>` to `Promise<unknown>` to allow expression-style handlers
6. **[TS] `AppError.code: string` doesn't enforce ErrorCode union** — `app-error.contract.ts:4` — Change to `code: ErrorCode`
7. **[TS] `export {}` inside namespace** — `express.d.ts:14` — Remove (redundant; file already a module)
8. **[Express] Non-optional augmented Request properties** — `express.d.ts:7-9` — Introduce `ScopedRequest` or make fields optional
9. **[Runtime] `Promise.resolve(fn(...))` doesn't return the Promise** — `async-handler.ts:7` — Add `return` to allow proper awaiting
10. **[Runtime] `getCorrelationId()` fallback is identity-unsafe** — `correlation-id.ts:9` — Return sentinel or document instability
11. **[DB] `DATABASE_URL` accepts any URL scheme** — `env.schema.ts:6` — Add `.refine()` for `postgresql://` prefix
12. **[Runtime] `as const` objects are mutable at runtime** — `http-status.ts`, `error-codes.ts` — Add `Object.freeze()`

### Nice to Have (Low)

13. **[TS] `HttpStatusCode` not used as type constraint** — tie `AppErrorContract.statusCode` to `HttpStatusCode`
14. **[TS] `ErrorCode` const/type shadowing** — add comment documenting enum-emulation intent
15. **[Express] `userRole?: string`** — define `UserRole` union type
16. **[Express] `ErrorResponse` missing `path`/`method`** — add to error envelope
17. **[DB] `databaseConfig.url` datasource contract** — add comment linking to Prisma datasource name
18. **[DB] No cursor pagination support** — add optional `nextCursor?: string` to `PaginatedResponse`
19. **[Async] Export raw `AsyncLocalStorage`** — export only `runWithCorrelationId` wrapper
20. **[Runtime] `redactPaths` array shallowly mutable** — `Object.freeze` the array in `loggerConfig`

---

## Files Analyzed

| File | Lines | Significant Exports |
|------|-------|---------------------|
| `src/config/env.schema.ts` | 14 | `envSchema`, `Env` |
| `src/config/index.ts` | 14 | `config` (side-effectful module) |
| `src/config/auth.ts` | 6 | `authConfig` |
| `src/config/database.ts` | 5 | `databaseConfig` |
| `src/config/redis.ts` | 5 | `redisConfig` |
| `src/config/queue.ts` | 5 | `queueConfig` |
| `src/config/logger.ts` | 7 | `loggerConfig` |
| `src/shared/constants/http-status.ts` | 15 | `HttpStatus`, `HttpStatusCode` |
| `src/shared/constants/app.constants.ts` | 2 | `CORRELATION_ID_HEADER`, `SHUTDOWN_TIMEOUT_MS` |
| `src/shared/errors/error-codes.ts` | 12 | `ErrorCode` |
| `src/shared/errors/app-error.contract.ts` | 9 | `AppErrorContract` |
| `src/shared/errors/app-error.ts` | 32 | `AppError` |
| `src/shared/errors/http-errors.ts` | 67 | 8 error subclasses |
| `src/shared/types/common.types.ts` | 19 | `ApiResponse`, `ErrorResponse`, `FieldError` |
| `src/shared/types/pagination.types.ts` | 11 | `PaginationQuery`, `PaginatedResponse` |
| `src/shared/types/express.d.ts` | 16 | Express.Request augmentation |
| `src/shared/utils/async-handler.ts` | 9 | `asyncHandler` |
| `src/shared/utils/correlation-id.ts` | 10 | `correlationIdStorage`, `getCorrelationId` |

---
*Generated by /ts-check — 2026-03-18*
