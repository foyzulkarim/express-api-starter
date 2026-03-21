import { describe, it, expect, vi } from 'vitest';

import { createCacheService } from '../cache.service.js';

const mockRedis = {} as never;

describe('createCacheService (stub)', () => {
  it('get always returns null (cache miss stub)', async () => {
    const cache = createCacheService(mockRedis);
    const result = await cache.get('any-key');
    expect(result).toBeNull();
  });

  it('set resolves without error', async () => {
    const cache = createCacheService(mockRedis);
    await expect(cache.set('key', { data: 1 }, 60)).resolves.toBeUndefined();
  });

  it('invalidate resolves without error', async () => {
    const cache = createCacheService(mockRedis);
    await expect(cache.invalidate('key')).resolves.toBeUndefined();
  });

  it('getOrSet calls and returns the result of fn on cache miss', async () => {
    const cache = createCacheService(mockRedis);
    const fn = vi.fn().mockResolvedValue('computed-value');
    const result = await cache.getOrSet('key', fn, 60);
    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBe('computed-value');
  });
});
