import { describe, it, expect } from 'vitest';
import { envSchema } from '../env.schema.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
};

describe('envSchema', () => {
  it('accepts valid environment variables', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe('info');
      expect(result.data.CORS_ORIGINS).toBe('*');
      expect(result.data.JWT_EXPIRES_IN).toBe('15m');
      expect(result.data.PORT).toBe(3000);
    }
  });

  it('coerces PORT to number', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '8080' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8080);
    }
  });

  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL, ...env } = validEnv;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects missing REDIS_URL', () => {
    const { REDIS_URL, ...env } = validEnv;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'too-short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid LOG_LEVEL', () => {
    const result = envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'verbose' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive PORT', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '0' });
    expect(result.success).toBe(false);
  });
});
