import { describe, it, expect } from 'vitest';
import { envSchema } from '../env.schema.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'abcdefghijklmnopqrstuvwxyzABCDEF', // 32 chars, 8+ unique
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
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('DATABASE_URL');
    }
  });

  it('rejects missing REDIS_URL', () => {
    const { REDIS_URL, ...env } = validEnv;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('REDIS_URL');
    }
  });

  it('rejects missing JWT_SECRET', () => {
    const { JWT_SECRET, ...env } = validEnv;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('JWT_SECRET');
    }
  });

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'abcdefghijklmnopqrstuvwxyzABCDE' }); // 31 chars
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('JWT_SECRET');
    }
  });

  it('accepts JWT_SECRET of exactly 32 characters with sufficient diversity', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'abcdefghijklmnopqrstuvwxyzABCDEF' }); // 32 chars
    expect(result.success).toBe(true);
  });

  it('rejects JWT_SECRET with low entropy (repeated characters)', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'a'.repeat(32) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('JWT_SECRET');
    }
  });

  it('rejects invalid DATABASE_URL scheme', () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('DATABASE_URL');
    }
  });

  it('rejects DATABASE_URL with wrong scheme (valid URL but not postgresql)', () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: 'http://localhost:5432/db' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('DATABASE_URL');
    }
  });

  it('rejects invalid REDIS_URL scheme', () => {
    const result = envSchema.safeParse({ ...validEnv, REDIS_URL: 'http://localhost:6379' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('REDIS_URL');
    }
  });

  it('rejects negative PORT', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '-1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('PORT');
    }
  });

  it('rejects non-numeric PORT', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: 'abc' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('PORT');
    }
  });

  it('rejects PORT greater than 65535', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '70000' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('PORT');
    }
  });

  it('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('NODE_ENV');
    }
  });

  it('rejects invalid LOG_LEVEL', () => {
    const result = envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'verbose' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('LOG_LEVEL');
    }
  });

  it('rejects non-positive PORT', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '0' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('PORT');
    }
  });
});
