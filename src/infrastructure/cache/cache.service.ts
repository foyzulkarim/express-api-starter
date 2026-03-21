import type { Redis } from 'ioredis';

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T>;
}

// Stub implementation — real caching logic added in Phase 7.
export function createCacheService(_redis: Redis): CacheService {
  return {
    async get<T>(_key: string): Promise<T | null> {
      return null;
    },
    async set(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void> {},
    async invalidate(_key: string): Promise<void> {},
    async getOrSet<T>(_key: string, fn: () => Promise<T>, _ttlSeconds?: number): Promise<T> {
      return fn();
    },
  };
}
