import { describe, it, expect, vi, afterEach } from 'vitest';

describe('config/index — startup validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('writes structured JSON error and exits when required env vars are missing', async () => {
    const saved = {
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      JWT_SECRET: process.env.JWT_SECRET,
    };
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.JWT_SECRET;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.resetModules();
    await import('../index.js');

    // process.exit is called inside setImmediate — wait for it
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Restore env vars before any assertions that might fail
    process.env.DATABASE_URL = saved.DATABASE_URL;
    process.env.REDIS_URL = saved.REDIS_URL;
    process.env.JWT_SECRET = saved.JWT_SECRET;

    expect(stderrSpy).toHaveBeenCalledOnce();
    const raw = stderrSpy.mock.calls[0]?.[0];
    const payload = JSON.parse(raw as string);
    expect(payload.fatal).toBe(true);
    expect(payload.message).toBe('Invalid environment variables');
    expect(payload.fields).toContain('DATABASE_URL');
    expect(payload.fields).toContain('REDIS_URL');
    expect(payload.fields).toContain('JWT_SECRET');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exports valid config when all required env vars are present', async () => {
    vi.resetModules();
    const { config } = await import('../index.js');
    expect(config.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/testdb');
    expect(config.NODE_ENV).toBe('test');
  });
});
