# Phase 1: Acceptance Checklist

After all 22 tasks are complete, verify every Phase 1 acceptance criterion:

**Build & Quality:**
- [ ] `npm run typecheck` exits clean
- [ ] `npm run lint` exits clean
- [ ] `npm run test:unit` passes all unit tests
- [ ] `npm run test:integration` passes all integration tests (Docker must be running)

**Runtime:**
- [ ] `GET /health` returns `200 { status: "ok", timestamp: "..." }`
- [ ] Unknown routes return `404` with structured error body including `code`, `correlationId`, `timestamp`
- [ ] `x-correlation-id` header is echoed when provided, generated when absent
- [ ] Server starts cleanly against Docker Compose stack (`docker compose up -d && npm run dev`)

**Fail-fast Behavior:**
- [ ] Starting with missing required env var (e.g., unset `DATABASE_URL`) logs clear error naming the variable and exits non-zero
- [ ] Starting with `JWT_SECRET` shorter than 32 chars logs a Zod validation error and exits non-zero
- [ ] Starting with unreachable database (wrong `DATABASE_URL`) crashes with a clear connection error
- [ ] Starting with unreachable Redis (wrong `REDIS_URL`) crashes with a clear connection error

**Graceful Shutdown:**
- [ ] Server exits cleanly within 5 seconds when sent SIGTERM (`kill -TERM <pid>`)
- [ ] A second SIGTERM during shutdown forces immediate exit
