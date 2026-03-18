# Code Review Report

## Metadata

| Field | Value |
|-------|-------|
| **Review Type** | PR |
| **Target** | PR #9 |
| **PR URL** | https://github.com/foyzulkarim/express-api-starter/pull/9 |
| **Author** | foyzulkarim |
| **Reviewer** | /review |
| **Date** | 2026-03-18 |
| **Base Branch** | main |
| **Tech Stack** | Node.js, TypeScript, Express, Zod, Vitest, awilix, pino, bullmq, ioredis, prisma, opentelemetry |
| **Files Changed** | 22 |
| **Lines Added** | +497 |
| **Lines Removed** | 0 |

---

## Executive Summary

### Verdict: REQUEST CHANGES

This PR establishes a solid foundation — well-structured error hierarchy, Zod-validated config, typed Express augmentation, and sensible utility functions. The architecture is correct and the TDD discipline is evident. However, one Critical security issue (wildcard CORS default shipping to production), several High issues (PORT validation, `@types/express` v5/v4 mismatch, missing `silent` log level, JWT constraints, type-coverage gaps in tests), and a pattern of shallow `redactPaths` that would leak secrets in production logs need to be addressed before merge.

### Quick Stats

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Code Quality | 0 | 0 | 4 | 5 |
| Test Coverage | 0 | 5 | 8 | 3 |
| Performance | 0 | 0 | 2 | 1 |
| Security | 1 | 3 | 3 | 2 |
| Documentation | 0 | 3 | 5 | 3 |
| Error Handling | 0 | 1 | 4 | 3 |
| Configuration | 0 | 3 | 5 | 4 |
| **Total** | **1** | **15** | **31** | **21** |

> Note: overlapping findings across agents have been deduplicated below; the table above reflects unique findings per category before deduplication.

### Key Strengths
- Clean layered error hierarchy (`AppError` → `AppErrorContract` → `http-errors`) with correct `Object.setPrototypeOf` prototype chain fix
- TDD discipline: tests written first for both `errors.test.ts` and `env-schema.test.ts`
- Zod env schema with coercion, defaults, and type inference is idiomatic and production-ready
- `AsyncLocalStorage`-based correlation ID is the right pattern for Node.js request tracing
- `as const` objects for `HttpStatus` and `ErrorCode` provide both runtime values and compile-time types

### Critical Issues
- **CORS wildcard default** (`src/config/env.schema.ts:11`) — `CORS_ORIGINS` defaults to `'*'`, which will silently ship to production if the env var is omitted. This enables any origin to read API responses.

---

## 1. Code Quality

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | Medium | `src/config/index.ts` | 6 | Emoji `❌` in `console.error` can break log aggregators that parse ASCII/JSON. Also bypasses pino entirely — startup failure is the one critical log that should be structured. | Replace with `process.stderr.write(JSON.stringify({ level: 'fatal', msg: 'Invalid environment variables', errors: redactedErrors }))` or bootstrap a minimal pino instance before parsing env |
| 2 | Medium | `src/shared/errors/app-error.ts` | 14–22 | Constructor parameter object type is declared inline, duplicating the shape already in `AppErrorContract` and the class properties — three definitions of the same five fields | Extract a named `AppErrorOptions` type derived from `AppErrorContract` and use it as the constructor parameter type |
| 3 | Medium | `src/config/redis.ts` & `src/config/queue.ts` | redis:4, queue:4 | Both expose `config.REDIS_URL` under different key names (`url` vs `redisUrl`) — naming inconsistency and unnecessary duplication | Have `queueConfig` compose from `redisConfig.url` rather than reading `config.REDIS_URL` independently, or align the field name |
| 4 | Medium | `src/shared/errors/error-codes.ts` | 12 | `ErrorCode` const and `ErrorCode` type share the same identifier — inconsistent with the `HttpStatus` / `HttpStatusCode` pattern used in the same PR | Adopt the same convention: rename the type to `ErrorCodeValue` or rename the object to `ErrorCodes` |
| 5 | Low | `src/shared/types/express.d.ts` | 14 | `export {}` inside `namespace Express` is redundant — the `declare global` wrapper already handles module augmentation | Remove the line |
| 6 | Low | `src/shared/utils/correlation-id.ts` | 6 | `const storage` is declared privately and immediately re-exported as `correlationIdStorage` — the intermediate alias adds indirection with no benefit | Export directly: `export const correlationIdStorage = new AsyncLocalStorage<string>()` |
| 7 | Low | All shared subdirs | — | No barrel `index.ts` files in `shared/errors/`, `shared/utils/`, `shared/constants/`, `shared/types/`, or `config/` — consumers must know every internal file path | Add lightweight barrel files for each logical group |
| 8 | Low | `src/shared/errors/__tests__/errors.test.ts` | 55–111 | 8 near-identical test cases in `'HTTP Error Classes'` — each constructs one class and asserts the same three fields | Refactor to `it.each` with a parameter table |
| 9 | Low | `src/shared/utils/__tests__/async-handler.test.ts` | 11–13 | Success-path test only checks `next` not called; does not assert `fn` received `req`, `res`, `next` | Add a `vi.fn()` spy on `fn` and assert it was called with the correct arguments |

#### Review Comments

##### #1: Emoji + console.error bypasses structured logging
File: `src/config/index.ts:6`

> The startup validation failure message uses `console.error` with an emoji, which creates two problems: (1) log aggregators parsing JSON from stderr will receive an unparseable string, potentially causing the startup failure to go unalerted; (2) the format is inconsistent with all other pino-based log output. The very moment you most need a clean, parseable error message is during startup failures. Would it make sense to emit a structured JSON line to stderr here, even without a full pino instance?

##### #2: Constructor parameter type duplicates AppErrorContract
File: `src/shared/errors/app-error.ts:14`

> The inline object type on the constructor (lines 14–22) describes the same five fields already declared in `AppErrorContract` and again as class properties — three places to update if the shape changes. Extracting a named `AppErrorOptions` type derived from `AppErrorContract` would make the single source of truth explicit. What do you think?

##### #3: Inconsistent REDIS_URL re-export key names
File: `src/config/redis.ts:4`, `src/config/queue.ts:4`

> `redisConfig.url` and `queueConfig.redisUrl` both point to the same `config.REDIS_URL` but under different names. A developer looking up how to get the Redis URL will find two config objects with differently-named fields for the same thing. Having `queueConfig` reference `redisConfig.url` directly would eliminate the duplication and make the relationship explicit. Thoughts?

##### #4: ErrorCode type/const naming inconsistent with HttpStatus pattern
File: `src/shared/errors/error-codes.ts:12`

> In the same PR, `http-status.ts` exports `HttpStatus` (the object) and `HttpStatusCode` (the type) as separate identifiers. But `error-codes.ts` uses `ErrorCode` for both. While TypeScript allows this, it's inconsistent within the PR itself. Aligning on one convention — either always merge or always separate — would make the codebase easier to reason about. Just a thought, not a blocker!

---

## 2. Test Coverage

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `src/config/__tests__/env-schema.test.ts` | 37–67 | Rejection tests only assert `result.success === false` — any schema failure (even for an unrelated reason) would make the test pass | Assert on `result.error.flatten().fieldErrors` to confirm the specific field caused the rejection |
| 2 | High | `src/config/__tests__/env-schema.test.ts` | — | `JWT_SECRET` boundary not tested: 31 chars (should fail) and exactly 32 chars (should pass) — only an obviously short string is tested | Add boundary tests at 31 and 32 characters |
| 3 | High | `src/config/__tests__/env-schema.test.ts` | — | Invalid URL strings (non-URL format) for `DATABASE_URL` and `REDIS_URL` not tested — only omission is tested | Add tests supplying `'not-a-url'` for both fields |
| 4 | High | `src/config/__tests__/env-schema.test.ts` | — | `PORT: '-1'` (negative) and `PORT: 'abc'` (non-numeric) are not tested; only `PORT: '0'` is covered | Add tests for negative and non-numeric PORT values |
| 5 | High | `src/config/__tests__/env-schema.test.ts` | — | Missing `JWT_SECRET` entirely is not tested as a separate case from too-short | Add a test omitting `JWT_SECRET` from the input |
| 6 | Medium | `src/config/__tests__/env-schema.test.ts` | 18–27 | `NODE_ENV` default value (`'development'`) never tested — `validEnv` always provides `NODE_ENV: 'test'` | Supply input without `NODE_ENV` and assert it defaults to `'development'` |
| 7 | Medium | `src/config/__tests__/env-schema.test.ts` | — | Valid enum values for `NODE_ENV` (`'development'`, `'production'`) never positively tested | Add parameterized test covering all three valid values |
| 8 | Medium | `src/config/__tests__/env-schema.test.ts` | — | Valid `LOG_LEVEL` enum values (`fatal`, `error`, `warn`, `debug`, `trace`) never positively tested | Add `it.each` covering all valid log levels |
| 9 | Medium | `src/shared/errors/__tests__/errors.test.ts` | 56–111 | Custom message tested only for `NotFoundError`; remaining 6 error classes never tested with custom messages | Add parameterized custom-message tests for all classes |
| 10 | Medium | `src/shared/errors/__tests__/errors.test.ts` | — | `new ValidationError()` default constructor (no args → `details: []`) never tested | Add test asserting default produces `details: []` |
| 11 | Medium | `src/shared/errors/__tests__/errors.test.ts` | — | No `instanceof AppError` / `instanceof Error` check for any HTTP error subclass | Add instanceof chain assertions for subclasses |
| 12 | Medium | `src/shared/utils/__tests__/async-handler.test.ts` | — | Synchronous throw inside `fn` not tested — `Promise.resolve(fn(...)).catch(next)` does NOT catch synchronous throws; this is a latent bug | Add a sync-throw test and document (or fix) the behavior |
| 13 | Medium | `src/shared/utils/__tests__/correlation-id.test.ts` | — | Nested `AsyncLocalStorage.run()` context not tested | Add a nested-context test asserting inner ID takes precedence |
| 14 | Low | `src/shared/utils/__tests__/correlation-id.test.ts` | 18–23 | "Returns different UUIDs" test is probabilistically non-deterministic; also would not catch a regression returning `''` | Assert UUID regex format on each call instead of inequality |
| 15 | Low | `src/config/__tests__/env-schema.test.ts` | 4–10 | `validEnv` is module-scoped and could be mutated by future tests | Wrap in `Object.freeze()` |
| 16 | Low | (no test file) | — | `src/config/logger.ts` `pretty` flag produces two values but is never tested | Add a test asserting `pretty === false` in `NODE_ENV: 'test'` |

#### Missing Tests

- `envSchema` — Reject `DATABASE_URL: 'not-a-url'` — Priority: **High**
- `envSchema` — Reject `REDIS_URL: 'not-a-url'` — Priority: **High**
- `envSchema` — Reject `JWT_SECRET` of exactly 31 chars — Priority: **High**
- `envSchema` — Accept `JWT_SECRET` of exactly 32 chars — Priority: **High**
- `envSchema` — Reject missing `JWT_SECRET` — Priority: **High**
- `envSchema` — Reject `PORT: '-1'` and `PORT: 'abc'` — Priority: **High**
- `envSchema` — Default `NODE_ENV` to `'development'` when omitted — Priority: **Medium**
- `envSchema` — Accept all valid `LOG_LEVEL` values — Priority: **Medium**
- `asyncHandler` — Sync throw inside `fn` — Priority: **Medium** (potential latent bug)
- `AppError` / subclasses — `instanceof` chain — Priority: **Medium**
- `ValidationError` — Default constructor produces `details: []` — Priority: **Medium**

#### Review Comments

##### #1: Weak rejection assertions
File: `src/config/__tests__/env-schema.test.ts:37`

> The rejection tests only confirm `result.success === false`. If the schema rejected for a completely different reason (e.g., a different required field was accidentally removed in a refactor), these tests would still pass. Asserting on the specific failing field makes the tests much more trustworthy:
> ```typescript
> expect(result.error.flatten().fieldErrors).toHaveProperty('DATABASE_URL');
> ```
> What do you think?

##### #2: JWT_SECRET boundary not tested
File: `src/config/__tests__/env-schema.test.ts`

> The schema uses `.min(32)`, so 31 chars must fail and 32 must pass — these exact boundaries are never exercised. Only the obviously-short `'too-short'` is tested. Worth adding:
> ```typescript
> it('rejects JWT_SECRET of exactly 31 characters', () => {
>   const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'a'.repeat(31) });
>   expect(result.success).toBe(false);
> });
> it('accepts JWT_SECRET of exactly 32 characters', () => {
>   const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'a'.repeat(32) });
>   expect(result.success).toBe(true);
> });
> ```

##### #12: Synchronous throw in asyncHandler is a latent bug
File: `src/shared/utils/async-handler.ts:6`

> `Promise.resolve(fn(req, res, next)).catch(next)` — if `fn` throws synchronously before returning a Promise, the throw happens before `Promise.resolve` sees it, so `catch(next)` never fires. The synchronous error propagates as an uncaught exception. This could crash the process. Either a `try/catch` wrapper or a test documenting the behavior (so it's an explicit contract) would be valuable. This is worth investigating as a potential bug rather than just a test gap.

---

## 3. Performance

#### Findings Table

| # | Severity | File | Line | Issue | Impact | Recommendation |
|---|----------|------|------|-------|--------|----------------|
| 1 | Medium | `src/shared/utils/correlation-id.ts` | 9 | `randomUUID()` (CSPRNG syscall) invoked on every call without a seeded storage context. The generated ID is never stored, so two calls in the same untracked scope return different IDs, silently breaking log correlation | At 1000 RPS with missing middleware: measurable CSPRNG drain + broken tracing. Low noise at normal scale. | Return `undefined` or a sentinel when outside storage context, forcing callers to handle missing context explicitly rather than silently generating a useless ID |
| 2 | Medium | `src/shared/errors/app-error.ts` | 30 | `Object.setPrototypeOf(this, new.target.prototype)` after construction breaks V8's hidden-class (shape) optimization — V8 de-opts any catch handler or inspector that processes AppError instances | Unmeasurable at low error rates; measurable at high validation-error throughput (100x scale) | Confirm `tsconfig.json` targets `ES2015` or higher. If so, native `class` handles the prototype chain correctly and this line can be removed. It is only required for ES5 targets. |
| 3 | Low | `src/config/logger.ts` | 6 | `redactPaths` array literal is evaluated fresh each time the module is re-evaluated (e.g., in tests using `vi.resetModules()`) | Negligible in production (module cached). Minor garbage in test suites with heavy module resets. | Hoist to a standalone `const` above the config object if module-reset test performance becomes a concern |

#### Review Comments

##### #2: Object.setPrototypeOf may be unnecessary given the TypeScript target
File: `src/shared/errors/app-error.ts:30`

> The `Object.setPrototypeOf(this, new.target.prototype)` is the standard workaround for TypeScript's ES5 transpilation of `extends Error` — without it, `instanceof` checks fail. However, V8 de-optimises objects whose prototype is mutated post-construction (breaking hidden-class assumptions), which makes all catch handlers that process AppError instances slower. If `tsconfig.json` already targets `ES2015+` (typical for Node.js 18+), native `class` handles the prototype chain correctly and this line can be safely removed. Could you check the `tsconfig` target? Thoughts?

---

## 4. Security

#### Findings Table

| # | Severity | File | Line | Vulnerability | Risk | Remediation |
|---|----------|------|------|---------------|------|-------------|
| 1 | Critical | `src/config/env.schema.ts` | 11 | Wildcard CORS default `'*'` | Any origin can read API responses; in combination with `Authorization` headers or cookies, enables cross-origin data exfiltration. Ships silently to production if env var is omitted. | Remove default entirely (require explicit configuration) or default to `'http://localhost:3000'` for dev only; add a `.superRefine()` rejecting `'*'` when `NODE_ENV === 'production'` |
| 2 | High | `src/config/index.ts` | 6–9 | Startup validation error dumps `fieldErrors` JSON to stderr | Reveals which sensitive env vars (`JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`) are missing/malformed to anyone with log read access | Log only field names and messages, never values; use a generic message in non-development environments |
| 3 | High | `src/config/env.schema.ts` | 8 | `JWT_SECRET` minimum of 32 chars enforces length but not entropy | `'a'.repeat(32)` passes validation but provides no security. OWASP recommends 256 bits of cryptographic randomness for HS256. | Increase minimum to 64 chars and add a `.refine()` rejecting known placeholder values in production; document `openssl rand -hex 32` in `.env.example` |
| 4 | High | `src/config/env.schema.ts` | 9 | `JWT_EXPIRES_IN` accepts any string — no format or upper-bound validation | `'0'`, `'9999d'`, or unrecognized strings could create non-expiring tokens depending on the JWT library | Add `.regex(/^\d+[smhd]$/)` and cap at a reasonable maximum (e.g., `24h`) |
| 5 | Medium | `src/config/logger.ts` | 6 | Pino `redactPaths` uses bare top-level key names | `req.headers.authorization`, `req.body.password`, `*.accessToken` all escape redaction — credentials in request bodies and headers will appear in logs | Use pino path syntax: `['req.headers.authorization', 'req.body.password', '*.password', '*.token', '*.secret']` |
| 6 | Medium | `src/shared/types/express.d.ts` | 11 | `userRole` typed as `string` | Typos or injected values in `userRole` from a compromised middleware bypass compile-time role enforcement, enabling silent privilege escalation | Define a `UserRole` union type (`'admin' \| 'user' \| 'guest'`) and use it here |
| 7 | Medium | `src/config/env.schema.ts` | 6–7 | `DATABASE_URL`/`REDIS_URL` accept any URL scheme | `file://`, `http://`, or injected URLs pass schema validation and fail only at connection time | Add `.refine()` checking for `postgresql://`/`postgres://` and `redis://`/`rediss://` prefixes respectively |
| 8 | Low | `src/shared/constants/app.constants.ts` | 1 | `x-correlation-id` header accepted from client without sanitization | Client-supplied IDs can contain log-injection payloads (newlines, ANSI codes) | Validate against UUID regex in middleware; generate a fresh UUID if header is absent or invalid |

#### OWASP Compliance

| OWASP Top 10 (2021) | Status | Notes |
|---|---|---|
| A01 — Broken Access Control | ⚠️ Concern | `userRole` is untyped `string` (Finding #6) |
| A02 — Cryptographic Failures | ⚠️ Concern | JWT secret insufficient entropy (Finding #3); unconstrained token lifetime (Finding #4) |
| A03 — Injection | ⚠️ Concern | Correlation ID header not sanitized before logging (Finding #8) |
| A04 — Insecure Design | ⚠️ Concern | Silent UUID fallback masks missing context; wildcard CORS default |
| A05 — Security Misconfiguration | ❌ Violation | Wildcard CORS default (Finding #1); unconstrained `JWT_EXPIRES_IN` (Finding #4) |
| A06 — Vulnerable Components | N/A | Not assessed in this PR |
| A07 — Identification and Authentication Failures | ⚠️ Concern | JWT constraints too weak (Findings #3, #4) |
| A08 — Software and Data Integrity | N/A | Not assessed in this PR |
| A09 — Security Logging and Monitoring | ⚠️ Concern | Shallow `redactPaths` (Finding #5); startup error exposes config surface (Finding #2) |
| A10 — SSRF | ⚠️ Concern | URL scheme not restricted for `DATABASE_URL`/`REDIS_URL` (Finding #7) |

#### Review Comments

##### #1: Critical — Wildcard CORS ships to production silently
File: `src/config/env.schema.ts:11`

> **Severity: Critical**
>
> The `CORS_ORIGINS: z.string().default('*')` is a dangerous default. In production, if `CORS_ORIGINS` is omitted from the deployment config (easy to miss), the API silently allows all origins. Combined with `Authorization` headers, this enables cross-origin data exfiltration from authenticated sessions. Would it make sense to either remove the default entirely (forcing explicit configuration per environment), or add a `.superRefine()` that rejects `'*'` when `NODE_ENV === 'production'`? Happy to chat more about this.

##### #4: High — JWT_EXPIRES_IN accepts unconstrained strings
File: `src/config/env.schema.ts:9`

> I noticed `JWT_EXPIRES_IN` has no format validation. If someone sets it to `'0'`, `'9999 days'`, or a string the JWT library doesn't recognize as a duration, the behavior depends on the library — some silently issue non-expiring tokens. A regex like `/^\d+[smhd]$/` and an upper-bound cap would make the contract explicit and safe. What do you think?

---

## 5. Documentation

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `src/shared/utils/correlation-id.ts` | 4–9 | `correlationIdStorage` exported with no JSDoc — consumers don't know middleware must call `.run()` to seed it; `getCorrelationId` has no usage example | Add JSDoc on both exports explaining the middleware→getter pattern with an `@example` |
| 2 | High | `src/shared/errors/app-error.ts` | 30 | `Object.setPrototypeOf(this, new.target.prototype)` has no comment explaining it is a TypeScript ES5 prototype-chain fix — easy to remove as "dead code" in a cleanup | Add inline comment: `// Restores prototype chain broken by TypeScript ES5 transpilation; keeps instanceof working` |
| 3 | High | `src/shared/errors/app-error.contract.ts` | 7 | `isOperational: boolean` is the key semantic for error middleware (restart vs. log-and-continue) but its purpose is undocumented | Add JSDoc `@remarks` explaining operational vs. non-operational distinction and how error middleware should act on it |
| 4 | Medium | `src/config/index.ts` | 3–11 | Module-level `process.exit(1)` side effect not documented — any test importing a config sub-module without env vars set will get a hard process exit with no stack trace | Add module-level JSDoc noting the eager-validation behavior and test setup requirements |
| 5 | Medium | `src/config/logger.ts` | 6 | `redactPaths` security purpose not documented | Add comment: `// Pino redacts these paths from all log output to prevent credential leakage` |
| 6 | Medium | `src/shared/types/express.d.ts` | 7–11 | Augmented `Request` properties have no documentation — `scope` (Awilix container) is unknown to most Express developers; required vs optional distinction is invisible | Add JSDoc per property noting which middleware populates it and its contract |
| 7 | Medium | `src/config/env.schema.ts` | 8 | `JWT_SECRET: z.string().min(32)` — the `32` is not arbitrary (HMAC-SHA256 key entropy) but reads as a magic number | Add inline comment: `// Minimum 32 chars for HMAC-SHA256 key entropy` |
| 8 | Medium | `src/shared/constants/app.constants.ts` | 1–2 | Both constants lack documentation — `SHUTDOWN_TIMEOUT_MS = 5000` in particular is non-obvious | Add JSDoc: `SHUTDOWN_TIMEOUT_MS` is the grace period for in-flight requests during SIGTERM; `CORRELATION_ID_HEADER` is the HTTP header name for request ID propagation |
| 9 | Low | `src/shared/types/common.types.ts` | 1–19 | `ApiResponse<T>` and `ErrorResponse` lack `@example` blocks showing wire-format JSON | Add JSON examples in JSDoc |
| 10 | Low | `src/shared/errors/error-codes.ts` | 12 | Dual value/type `ErrorCode` pattern not explained | Add JSDoc noting the const is the value, the type is the union |
| 11 | Low | `README.md` | 63–70 | Project Structure section doesn't reflect new `src/config/` or expanded `src/shared/` subdirectories | Update the directory tree |

#### Documentation Checklist

| Item | Status |
|------|--------|
| README updated | ⚠️ Project structure section outdated |
| API documentation updated | N/A — no API endpoints in this PR |
| Complex logic commented | ❌ `Object.setPrototypeOf`, `AsyncLocalStorage` seeding contract, `process.exit` side effect undocumented |
| Public functions/exports have JSDoc | ❌ `asyncHandler`, `getCorrelationId`, `correlationIdStorage`, config objects all lack JSDoc |
| Changelog updated | ❌ No changelog exists or was added |
| Migration guide | N/A — no breaking changes |
| Configuration changes documented | ⚠️ `env.schema.ts` field constraints lack inline comments; `.env.example` well-maintained |

---

## 6. Error Handling & Observability

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `src/config/index.ts` | 6–9 | `console.error` + unstructured text at startup; `fieldErrors` payload could surface sensitive field values to stderr in edge cases | Emit structured JSON to stderr; log only field names and messages, never values |
| 2 | Medium | `src/shared/errors/app-error.ts` | 23 | `AppError` does not preserve the original `cause` — wrapping a Prisma or JWT error discards the original stack entirely | Add optional `cause?: unknown` constructor parameter and pass to `super(message, { cause })` (Node 16.9+ / ES2022) |
| 3 | Medium | `src/shared/errors/http-errors.ts` | 58–67 | `InternalError.isOperational === false` is inert — no error handler exists yet to act on it | Document (and enforce in the forthcoming middleware) that `isOperational: false` must trigger process shutdown / fatal alert |
| 4 | Medium | `src/shared/utils/async-handler.ts` | 3–9 | Input type restricts to async-only (`Promise<void>`); a synchronous throw inside `fn` propagates uncaught — not through `next` | Add a `try/catch` wrapper or broaden the signature to `Promise<void> \| void` |
| 5 | Medium | `src/config/index.ts` | 10 | `process.exit(1)` is synchronous — no opportunity to flush async log buffers or telemetry spans | Use `process.exitCode = 1` + `setImmediate(() => process.exit(1))` to allow one I/O cycle for buffer flushing |
| 6 | Low | `src/shared/errors/http-errors.ts` | 37–46 | `ValidationError` defaults `details` to `[]` — an empty array is serialized into the response, adding noise | Default to `undefined` and preserve the optional `details?` semantics from `AppErrorContract` |

#### Observability Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Appropriate logging levels used | ⚠️ | `console.error` at startup; rest is primitives only |
| No sensitive data in logs | ⚠️ | `redactPaths` too shallow; startup fieldErrors could expose secret names |
| Error messages are clear and actionable | ✅ | HTTP error defaults are sensible; `ErrorResponse` includes `code`, `correlationId`, `timestamp` |
| Monitoring/alerting hooks in place | ❌ | `isOperational` flag exists but no handler; no OTel spans/metrics |
| Graceful degradation implemented | ❌ | Hard `process.exit(1)` with no buffer flush |
| Retry logic where appropriate | N/A | No I/O operations wired yet |

#### Review Comments

##### #2: AppError swallows the original cause
File: `src/shared/errors/app-error.ts:23`

> When Prisma throws a `PrismaClientKnownRequestError` and you wrap it in `ConflictError`, the original stack and error details are completely lost. Node 16.9+ and ES2022 support `new Error(message, { cause: originalError })`. Adding an optional `cause?: unknown` to `AppError`'s constructor and threading it through to `super()` would give pino, Sentry, and any error monitoring tool the full chain to work with. What do you think?

##### #4: asyncHandler doesn't catch synchronous throws
File: `src/shared/utils/async-handler.ts:6`

> `Promise.resolve(fn(req, res, next)).catch(next)` only catches promise rejections. If `fn` throws synchronously before returning, the throw unwinds the stack before `Promise.resolve` sees it, and the error propagates as an uncaught exception rather than calling `next`. A `try/catch` wrapper would make this safe for both sync and async handlers:
> ```typescript
> return (req, res, next) => {
>   try {
>     Promise.resolve(fn(req, res, next)).catch(next);
>   } catch (err) {
>     next(err);
>   }
> };
> ```
> Thoughts?

---

## 7. Configuration & Dependencies

#### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `src/config/env.schema.ts` | 5 | `PORT` has no upper bound — values > 65535 (invalid TCP ports) are accepted | Change to `z.coerce.number().int().min(1).max(65535).default(3000)` |
| 2 | High | `src/config/env.schema.ts` | 10 | `LOG_LEVEL` enum omits `'silent'` — setting `LOG_LEVEL=silent` in tests causes `process.exit(1)` | Add `'silent'` to the enum |
| 3 | High | `package.json` | — | `@types/express@5.0.6` (v5 types) installed against `express@4.22.1` (v4 runtime) — types describe a different API than the one running | Pin `@types/express` to `^4.17.21`, or upgrade `express` runtime to `^5.x` |
| 4 | Medium | `src/config/env.schema.ts` | 6 | `DATABASE_URL` validated as generic URL — `mysql://`, `http://` etc. pass schema | Add `.refine(v => /^postgres(ql)?:\/\//.test(v))` |
| 5 | Medium | `src/config/env.schema.ts` | 7 | `REDIS_URL` validated as generic URL | Add `.refine(v => /^rediss?:\/\//.test(v))` |
| 6 | Medium | `src/config/index.ts` | 3–11 | `process.exit(1)` as module-level side effect — tests transitively importing config sub-modules without env vars set will hard-exit the Vitest process | Add a Vitest `setupFiles` entry that sets all required env vars; or throw an `Error` and catch at the entry point |
| 7 | Medium | `package.json` | 47 | `pino-pretty` in `dependencies` (production) — only activated when `NODE_ENV === 'development'`, so it ships as dead weight in production containers (~1.1 MB) | Move to `devDependencies` |
| 8 | Low | `src/config/` | — | No `cors.ts` sub-module despite `cors` being installed and `CORS_ORIGINS` defined — raw comma-separated string must be split ad-hoc by consumers | Add `src/config/cors.ts` exporting `corsConfig = { origins: config.CORS_ORIGINS.split(',').map(s => s.trim()) }` |
| 9 | Low | `src/config/env.schema.ts` | 11 | `CORS_ORIGINS` defaults to `'*'` with no production guard (also flagged in Security) | See Security #1 |
| 10 | Low | `src/config/env.schema.ts` | — | OpenTelemetry env vars (`OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`) bypass the validated schema | Add optional OTel vars to `envSchema` or create `src/config/otel.ts` documenting them |

#### Dependency Changes

No new dependencies introduced in this PR.

| Package | Version | Risk | Notes |
|---------|---------|------|-------|
| `express` | `^4.22.1` | Medium | v5 is current; v4 is maintenance mode. `@types/express@5` already installed suggests planned migration. |
| `@types/express` | `^5.0.6` | **High** | v5 types against v4 runtime — see Finding #3 |
| `pino-pretty` | `^13.0.0` | Low | Misplaced in `dependencies` — see Finding #7 |
| `zod` | `^3.24.2` | Low | Active, widely used |
| `pino` | `^9.14.0` | Low | Active |

#### Breaking Changes

None identified. This PR introduces only new source files with no deletions.

#### Review Comments

##### #2: LOG_LEVEL=silent causes process.exit in tests
File: `src/config/env.schema.ts:10`

> Pino supports `'silent'` to suppress all log output — exactly what you want in CI or noisy test runs. Without it in the enum, setting `LOG_LEVEL=silent` in a test environment will trigger the validation failure and call `process.exit(1)`. A one-character addition to the array would prevent that surprise. What do you think?

##### #3: @types/express v5 against express v4 runtime
File: `package.json`

> I noticed `@types/express@5.0.6` is installed while the runtime is `express@4.22.1`. These describe different APIs — v5 async route handlers return `unknown` rather than `void`, and v5 natively handles async errors without needing `asyncHandler`. TypeScript currently passes (the types are broadly compatible for basic cases), but type-correct code written against v5 semantics could silently misbehave on the v4 runtime. The two options are: (a) pin `@types/express` to `^4.17.21`, or (b) upgrade `express` to `^5.x` — which would also make `asyncHandler` redundant for basic async routes. Thoughts on which direction to take?

---

## 8. Prioritized Action Items

### Must Fix Before Merge (Critical / High)

1. **[Security] CORS wildcard default** — `src/config/env.schema.ts:11` — Remove `'*'` default or add production guard
2. **[Config/Test] LOG_LEVEL missing `'silent'`** — `src/config/env.schema.ts:10` — Add to enum
3. **[Config] PORT has no upper bound** — `src/config/env.schema.ts:5` — Add `.max(65535)`
4. **[Config] `@types/express` v5 against v4 runtime** — `package.json` — Align versions
5. **[Security] JWT_EXPIRES_IN unconstrained** — `src/config/env.schema.ts:9` — Add format regex
6. **[Security] JWT_SECRET entropy check** — `src/config/env.schema.ts:8` — Increase min to 64 chars; document generation command
7. **[Security/Error] Startup fieldErrors exposure** — `src/config/index.ts:6` — Redact values, use structured logging
8. **[Error] asyncHandler doesn't catch sync throws** — `src/shared/utils/async-handler.ts:6` — Add `try/catch`
9. **[Test] Rejection tests lack field assertions** — `env-schema.test.ts` — Assert on `fieldErrors`
10. **[Test] JWT_SECRET boundary not tested** — `env-schema.test.ts` — Add 31-char / 32-char boundary tests
11. **[Test] Invalid URL strings not tested** — `env-schema.test.ts` — Add non-URL values for DB/Redis
12. **[Docs] `Object.setPrototypeOf` lacks comment** — `app-error.ts:30` — Add inline explanation

### Should Address (Medium)

13. **[Security] redactPaths too shallow** — `src/config/logger.ts:6` — Use dot-notation paths
14. **[Security] `userRole` untyped** — `src/shared/types/express.d.ts:11` — Define `UserRole` union
15. **[Security] DB/Redis URL scheme not validated** — `env.schema.ts:6-7` — Add `.refine()` for scheme prefix
16. **[Error] AppError doesn't preserve cause** — `app-error.ts:23` — Add `cause` parameter
17. **[Config] pino-pretty in dependencies** — `package.json` — Move to `devDependencies`
18. **[Config] process.exit(1) side effect in tests** — `config/index.ts` — Add Vitest setup file
19. **[Test] Many missing env-schema test cases** — See Test Coverage section
20. **[Docs] isOperational semantic undocumented** — `app-error.contract.ts:7` — Add JSDoc
21. **[Docs] correlationIdStorage lacks usage JSDoc** — `correlation-id.ts:4` — Add JSDoc + example

### Nice to Have (Low)

22. **[CodeQ] ErrorCode type/const naming inconsistency** — Align with HttpStatus pattern
23. **[CodeQ] Add barrel index.ts files** — `shared/*/` and `config/`
24. **[Config] Add `src/config/cors.ts`** — Parse CORS_ORIGINS into array for `cors()` middleware
25. **[Config] Document OTel env vars** — Add optional `OTEL_SERVICE_NAME` etc. to schema
26. **[Docs] Update README project structure** — Reflect new `src/config/` and `src/shared/` trees
27. **[Test] Use `Object.freeze(validEnv)`** — Prevent accidental mutation of shared test fixture

---

## 9. Files Changed

| File | Status | Key Changes |
|------|--------|-------------|
| `src/config/__tests__/env-schema.test.ts` | Added | 9 test cases for Zod env schema |
| `src/config/auth.ts` | Added | JWT config sub-module |
| `src/config/database.ts` | Added | Database config sub-module |
| `src/config/env.schema.ts` | Added | Zod schema with 8 env vars |
| `src/config/index.ts` | Added | Eager env validation at import time |
| `src/config/logger.ts` | Added | Logger config sub-module with redactPaths |
| `src/config/queue.ts` | Added | Queue config sub-module |
| `src/config/redis.ts` | Added | Redis config sub-module |
| `src/shared/constants/app.constants.ts` | Added | CORRELATION_ID_HEADER, SHUTDOWN_TIMEOUT_MS |
| `src/shared/constants/http-status.ts` | Added | HttpStatus const + HttpStatusCode type |
| `src/shared/errors/__tests__/errors.test.ts` | Added | 11 test cases for error hierarchy |
| `src/shared/errors/app-error.contract.ts` | Added | AppErrorContract interface |
| `src/shared/errors/app-error.ts` | Added | AppError base class |
| `src/shared/errors/error-codes.ts` | Added | ErrorCode const + type |
| `src/shared/errors/http-errors.ts` | Added | 8 HTTP error subclasses |
| `src/shared/types/common.types.ts` | Added | ApiResponse, ErrorResponse, FieldError |
| `src/shared/types/express.d.ts` | Added | Express.Request augmentation |
| `src/shared/types/pagination.types.ts` | Added | PaginationQuery, PaginatedResponse |
| `src/shared/utils/__tests__/async-handler.test.ts` | Added | 2 test cases for asyncHandler |
| `src/shared/utils/__tests__/correlation-id.test.ts` | Added | 3 test cases for correlation ID |
| `src/shared/utils/async-handler.ts` | Added | Express async wrapper utility |
| `src/shared/utils/correlation-id.ts` | Added | AsyncLocalStorage-based correlation ID |

---
*Generated by /review — 2026-03-18*
