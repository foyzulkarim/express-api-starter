/**
 * Vitest global setup — seeds the minimum required env vars so that any test
 * that transitively imports src/config/index.ts does not trigger process.exit(1).
 *
 * Values are test-only placeholders; they are not used against real services.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyzABCDEF'; // 32 chars, 8+ unique
