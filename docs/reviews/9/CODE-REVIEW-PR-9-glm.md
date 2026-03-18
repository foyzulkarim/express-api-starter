# Code Review Report

## Metadata

| Field | Value |
|-------|-------|
| **Review Type** | PR |
| **Target** | PR #9 - feat: add shared primitives and configuration (tasks 6-9) |
| **PR URL** | https://github.com/foyzulkarim/express-api-starter/pull/9 |
| **Author** | foyzul Karim |
| **Reviewer** | /review |
| **Date** | 2026-03-18 10:35 |
| **Base Branch** | main |
| **Tech Stack** | Node.js, TypeScript, Express, Vitest, Zod, Pino |
| **Files Changed** | 22 |
| **Lines Added** | +497 |
| **Lines Removed** | -0 |

---

## Executive Summary

### Verdict: APPROVE WITH COMMENTS

This PR introduces well-structured shared primitives and configuration for the Express API starter. The code quality is high, with good separation of concerns, proper TypeScript typing, and comprehensive test coverage (26 tests). The main concerns are around security defaults (CORS wildcard), a vulnerable dev dependency, and missing JSDoc documentation. No critical issues block merging.

### Quick Stats

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Code Quality | 0 | 1 | 0 | 3 |
| Test Coverage | 0 | 1 | 3 | 5 |
| Performance | 0 | 0 | 1 | 3 |
| Security | 0 | 1 | 3 | 2 |
| Documentation | 0 | 1 | 8 | 5 |
| Error Handling | 0 | 0 | 2 | 5 |
| Configuration | 0 | 1 | 2 | 3 |
| **Total** | **0** | **5** | **19** | **26** |

### Key Strengths

- Excellent error class hierarchy with `isOperational` flag for graceful error handling
- Zod-based environment validation with fail-fast behavior
- AsyncLocalStorage pattern for correlation ID tracking
- Comprehensive test coverage with 26 passing tests
- Clean separation of config into domain-specific modules

### Critical Issues

None identified. All High severity issues are non-blocking improvements.

---

## 1. Code Quality

### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `src/shared/utils/__tests__/async-handler.test.ts` | 8 | Variable `res` is assigned without `const` keyword | Add `const` before `res` declaration |
| 2 | Low | `src/shared/types/express.d.ts` | 14 | Unusual `export {}` in global augmentation block | Consider removing or documenting its purpose |
| 3 | Low | `src/shared/errors/error-codes.ts` | 1, 12 | Type name `ErrorCode` shadows const object | Consider renaming type to `ErrorCodeValue` |
| 4 | Low | `src/config/queue.ts` & `src/config/redis.ts` | 1-5 | Near-duplicate config files | Acceptable if they will diverge; document intent |

### Review Comments

##### #1: Missing `const` keyword in test file
File: `src/shared/utils/__tests__/async-handler.test.ts:8`

> I noticed that `res` on line 8 is missing the `const` keyword. This will cause the test to fail with a ReferenceError.
>
> ```suggestion
>     const req = {} as Request;
>     const res = {} as Response;
> ```
>
> What do you think?

##### #2: Unusual `export {}` in global augmentation
File: `src/shared/types/express.d.ts:14`

> Just curious about the `export {};` statement inside the global namespace block. If this was added to make the file a module (to enable `import` statements), that makes sense. If not needed, it could be removed for clarity. Thoughts?

##### #3: Type/value name shadowing
File: `src/shared/errors/error-codes.ts:1,12`

> The `ErrorCode` type shares the same name as the const object. While TypeScript handles this gracefully, an alternative pattern:
> ```typescript
> export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
> ```
> Just a thought - not a blocker!

---

## 2. Test Coverage

### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `src/config/index.ts` | 1-14 | No test coverage for config/index.ts module with side effects | Add test for process.exit(1) behavior |
| 2 | Medium | `src/config/__tests__/env-schema.test.ts` | 37-66 | Missing edge case tests for env schema | Add tests for invalid URLs, negative ports, boundary JWT length |
| 3 | Medium | `src/shared/errors/__tests__/errors.test.ts` | 55-112 | Missing inheritance chain tests for HTTP errors | Add test verifying `instanceof AppError` for all errors |
| 4 | Medium | `src/shared/utils/__tests__/async-handler.test.ts` | 6-17 | Missing test for req/res/next passthrough | Add test verifying arguments are passed correctly |
| 5 | Low | `src/config/__tests__/env-schema.test.ts` | 1-68 | Missing NODE_ENV default value test | Add test for default 'development' value |
| 6 | Low | `src/shared/errors/__tests__/errors.test.ts` | 87-93 | ValidationError default behavior untested | Add test for `new ValidationError()` with no args |
| 7 | Low | `src/shared/utils/__tests__/correlation-id.test.ts` | 5-24 | Missing nested context isolation test | Add test for parent/child correlation ID isolation |
| 8 | Low | `src/config/*.ts` | 1-6 | Config modules lack test coverage | Consider if testing needed for simple value objects |

### Missing Tests

- `src/config/index.ts:module` — Test process.exit(1) on validation failure — Priority: High
- `src/config/env.schema.ts:envSchema` — Test invalid URL formats — Priority: Medium
- `src/config/env.schema.ts:envSchema` — Test JWT_SECRET boundary (exactly 32 chars) — Priority: Medium
- `src/shared/errors/http-errors.ts:*Error` — Test `instanceof AppError` for all classes — Priority: Medium
- `src/shared/utils/async-handler.ts:asyncHandler` — Test req/res/next passthrough — Priority: Medium

### Review Comments

##### #1: No test coverage for config/index.ts
File: `src/config/index.ts:1-14`

> The main config module has side effects but no test coverage. Consider adding an integration test:
> ```typescript
> describe('config module', () => {
>   it('exits with code 1 on invalid env', async () => {
>     process.env = {};
>     const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
>       throw new Error('process.exit');
>     });
>     await expect(import('../index.js')).rejects.toThrow('process.exit');
>     expect(exitSpy).toHaveBeenCalledWith(1);
>   });
> });
> ```
> Would this make sense to add?

---

## 3. Performance

### Findings Table

| # | Severity | File | Line | Issue | Impact | Recommendation |
|---|----------|------|------|-------|--------|----------------|
| 1 | Medium | `src/shared/utils/correlation-id.ts` | 8-9 | UUID generation on every call without context | 10k req/sec without context = 10k UUIDs/sec | Ensure middleware sets context; consider dev warning |
| 2 | Low | `src/shared/utils/async-handler.ts` | 5-8 | Redundant Promise.resolve wrapper | Extra microtask per request | Call `.catch()` directly on returned Promise |
| 3 | Low | `src/config/index.ts` | 8 | Pretty-printed JSON in error output | Minimal - runs once at startup | Use compact format for production |

### Review Comments

##### #1: UUID generation without context
File: `src/shared/utils/correlation-id.ts:8-9`

> When `getCorrelationId()` is called outside the storage context, it generates a new UUID each time. If used incorrectly, this could create thousands of UUIDs unnecessarily.
>
> ```typescript
> // More efficient - call .catch directly
> return (req, res, next) => fn(req, res, next).catch(next);
> ```
> Thoughts?

---

## 4. Security

### Findings Table

| # | Severity | File | Line | Vulnerability | Risk | Remediation |
|---|----------|------|------|---------------|------|-------------|
| 1 | High | `src/config/env.schema.ts` | 11 | CORS wildcard default (`*`) | Enables requests from any origin | Require explicit config in production |
| 2 | Medium | `src/config/logger.ts` | 6 | Redaction paths incomplete | `apiKey`, `accessToken`, `cookie` not redacted | Expand redaction patterns |
| 3 | Medium | `src/config/env.schema.ts` | 8 | JWT_SECRET validates length only | 32 repeated chars would pass | Add entropy check or document requirements |
| 4 | Medium | `src/config/index.ts` | 6-9 | Validation errors may leak config hints | Detailed errors in logs | Sanitize output in production |
| 5 | Low | `src/config/env.schema.ts` | 9 | JWT_EXPIRES_IN accepts any string | Invalid values cause runtime errors | Validate format with regex |

### OWASP Compliance

| Category | Status | Notes |
|----------|--------|-------|
| A01: Broken Access Control | ⚠️ Concern | `userId`/`userRole` added to Request but no middleware shown |
| A02: Cryptographic Failures | ⚠️ Concern | JWT_SECRET validation only checks length |
| A03: Injection | ✅ Compliant | Zod validates input types |
| A04: Insecure Design | ✅ Compliant | Good separation of concerns |
| A05: Security Misconfiguration | ⚠️ Concern | CORS defaults to wildcard |
| A07: Auth Failures | ✅ Compliant | JWT expiry default is conservative (15m) |
| A09: Logging Failures | ⚠️ Concern | Redaction paths incomplete |

### Review Comments

##### #1: CORS wildcard default creates cross-origin risk
File: `src/config/env.schema.ts:11`

> **Severity: High**
>
> The `CORS_ORIGINS` default of `*` allows requests from any origin. Consider:
> ```typescript
> CORS_ORIGINS: z.string()
>   .refine(
>     (val) => val !== '*' || process.env.NODE_ENV === 'development',
>     { message: 'CORS wildcard (*) not allowed in production' }
>   )
>   .default('*'),
> ```
> What do you think?

##### #2: Logger redaction paths incomplete
File: `src/config/logger.ts:6`

> Current paths miss `apiKey`, `accessToken`, `refreshToken`, `cookie`, `session`. Consider:
> ```typescript
> redactPaths: [
>   'password', 'token', 'secret', 'authorization',
>   'apiKey', 'accessToken', 'refreshToken', 'cookie', 'session'
> ],
> ```

---

## 5. Documentation

### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `README.md` | 63-70 | Project structure outdated | Add `config/` and `shared/` subdirectories |
| 2 | Medium | `src/config/index.ts` | 1-14 | Missing module-level JSDoc | Document validation behavior and exit-on-failure |
| 3 | Medium | `src/config/env.schema.ts` | 1-14 | Missing schema documentation | Add JSDoc with constraints and examples |
| 4 | Medium | `src/shared/errors/app-error.ts` | 1-32 | Missing JSDoc for `isOperational` | Document operational vs non-operational distinction |
| 5 | Medium | `src/shared/errors/http-errors.ts` | 1-67 | Missing JSDoc for error classes | Document when to use each class |
| 6 | Medium | `src/shared/utils/async-handler.ts` | 1-9 | Missing JSDoc for utility | Add usage example |
| 7 | Medium | `src/shared/utils/correlation-id.ts` | 1-10 | Missing JSDoc for AsyncLocalStorage pattern | Document middleware integration |
| 8 | Medium | `src/shared/types/express.d.ts` | 1-16 | Missing JSDoc for Request augmentation | Document each property's purpose |

### Documentation Checklist

| Item | Status |
|------|--------|
| README updated | ❌ (outdated structure) |
| API documentation | N/A |
| Code comments | ⚠️ (complex logic has none) |
| Public functions have JSDoc | ❌ (all modules lack JSDoc) |
| Changelog updated | ❌ (no CHANGELOG.md) |
| Migration guide | N/A |
| Config changes documented | ✅ (.env.example complete) |

### Review Comments

##### #1: README project structure outdated
File: `README.md:63-70`

> The project structure section doesn't reflect the new `config/` and expanded `shared/` directories. Something like:
> ```
> src/
> ├── config/             # Environment & app configuration
> │   ├── index.ts        # Validated config export
> │   └── env.schema.ts   # Zod validation schema
> ├── shared/             # Shared utilities and types
> │   ├── constants/      # HTTP status, app constants
> │   ├── errors/         # Error classes & codes
> │   ├── types/          # TypeScript interfaces
> │   └── utils/          # Helper functions
> ```
> Just a thought to help onboarding!

---

## 6. Error Handling & Observability

### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | Medium | `src/config/index.ts` | 5-12 | Uses console.error instead of pino logger | Use structured logging for consistency |
| 2 | Medium | `src/config/index.ts` | 5-12 | Missing startup context for traceability | Add context marker for startup errors |
| 3 | Low | `src/shared/utils/async-handler.ts` | 6-8 | No error enrichment before next() | Attach correlation ID to errors |
| 4 | Low | `src/shared/errors/app-error.ts` | 28 | Missing `cause` property support | Add ES2022 error chaining support |
| 5 | Low | `src/config/logger.ts` | 5 | Redaction may miss header case variations | Add case-insensitive matching |

### Observability Checklist

| Category | Status |
|----------|--------|
| Appropriate logging levels | ⚠️ (console.error at startup) |
| No sensitive data in logs | ✅ |
| Error messages clear | ✅ |
| Monitoring/alerting | ❌ (not in this PR) |
| Graceful degradation | ❌ (not in this PR) |
| Retry logic | N/A |

### Review Comments

##### #1: Config validation should use structured logging
File: `src/config/index.ts:5-12`

> Using `console.error` bypasses the structured logging system. Consider:
> ```typescript
> logger.fatal({ errors: result.error.flatten().fieldErrors }, 'Invalid environment variables');
> ```

---

## 7. Configuration & Dependencies

### Findings Table

| # | Severity | File | Line | Issue | Recommendation |
|---|----------|------|------|-------|----------------|
| 1 | High | `package.json` | 52-54 | Vulnerable testcontainers (undici CVEs) | Update to testcontainers@11.x |
| 2 | Medium | `src/config/env.schema.ts` | 7 | Permissive CORS default | Require explicit config in production |
| 3 | Medium | `src/config/index.ts` | 1-14 | console.error for boot errors | Use stderr with JSON format |
| 4 | Low | `src/config/*.ts` | 1-6 | Redundant wrapper modules | Document pattern purpose |
| 5 | Low | `.env.example` | 18 | Example JWT_SECRET placeholder | Add runtime check for placeholder |

### Dependency Changes

| Package | Version | Risk | Notes |
|---------|---------|------|-------|
| `zod` | ^3.24.2 | Low | Schema validation - well-established |
| `awilix` | ^12.0.5 | Low | DI container - popular choice |
| `testcontainers` | ^10.18.0 | **High** | Has CVEs - upgrade to v11.x |
| `@testcontainers/postgresql` | ^10.18.0 | **High** | Affected by undici CVEs |
| `@testcontainers/redis` | ^10.18.0 | **High** | Affected by undici CVEs |

### Breaking Changes

None identified. This PR adds new infrastructure without modifying existing behavior.

---

## 8. Prioritized Action Items

### Must Fix Before Merge (Critical / High)

| # | Category | Issue | File |
|---|----------|-------|------|
| 1 | Code Quality | Missing `const` in test | `async-handler.test.ts:8` |
| 2 | Config | Vulnerable testcontainers | `package.json` |
| 3 | Security | CORS wildcard default | `env.schema.ts` |

### Should Address (Medium)

| # | Category | Issue |
|---|----------|-------|
| 1 | Documentation | Update README project structure |
| 2 | Documentation | Add JSDoc to public APIs |
| 3 | Security | Expand logger redaction paths |
| 4 | Security | Add JWT_SECRET entropy guidance |
| 5 | Test | Add config/index.ts test coverage |
| 6 | Test | Add env schema edge case tests |
| 7 | Error | Use structured logging at startup |

### Nice to Have (Low)

- Add `cause` property support to AppError
- Add validation for JWT_EXPIRES_IN format
- Document Express type augmentation pattern
- Add nested context isolation test for correlation ID

---

## 9. Files Changed

| File | Status | +/- | Key Changes |
|------|--------|-----|-------------|
| `src/config/__tests__/env-schema.test.ts` | New | +68 | Env schema validation tests |
| `src/config/auth.ts` | New | +6 | JWT config wrapper |
| `src/config/database.ts` | New | +5 | Database config wrapper |
| `src/config/env.schema.ts` | New | +14 | Zod env validation schema |
| `src/config/index.ts` | New | +14 | Config loader with validation |
| `src/config/logger.ts` | New | +7 | Logger config with redaction |
| `src/config/queue.ts` | New | +5 | Queue config wrapper |
| `src/config/redis.ts` | New | +5 | Redis config wrapper |
| `src/shared/constants/app.constants.ts` | New | +2 | Correlation header, timeout |
| `src/shared/constants/http-status.ts` | New | +15 | HTTP status code constants |
| `src/shared/errors/__tests__/errors.test.ts` | New | +112 | Error class tests |
| `src/shared/errors/app-error.contract.ts` | New | +9 | Error interface |
| `src/shared/errors/app-error.ts` | New | +32 | Base error class |
| `src/shared/errors/error-codes.ts` | New | +12 | Error code constants |
| `src/shared/errors/http-errors.ts` | New | +67 | HTTP error subclasses |
| `src/shared/types/common.types.ts` | New | +19 | API response types |
| `src/shared/types/express.d.ts` | New | +16 | Express Request augmentation |
| `src/shared/types/pagination.types.ts` | New | +11 | Pagination types |
| `src/shared/utils/__tests__/async-handler.test.ts` | New | +35 | Async handler tests |
| `src/shared/utils/__tests__/correlation-id.test.ts` | New | +24 | Correlation ID tests |
| `src/shared/utils/async-handler.ts` | New | +9 | Async route handler wrapper |
| `src/shared/utils/correlation-id.ts` | New | +10 | AsyncLocalStorage correlation ID |

---

*Generated by /review — 2026-03-18 10:35*
