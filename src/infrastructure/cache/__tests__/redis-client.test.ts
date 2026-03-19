import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const MockRedis = vi.fn();
vi.mock('ioredis', () => ({ default: MockRedis }));

let createRedisClient: typeof import('../redis-client.js')['createRedisClient'];

beforeAll(async () => {
  const mod = await import('../redis-client.js');
  createRedisClient = mod.createRedisClient;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRedisClient', () => {
  it('instantiates Redis with the provided URL', () => {
    const url = 'redis://localhost:6379';
    createRedisClient(url);
    expect(MockRedis).toHaveBeenCalledWith(url);
  });

  it('returns the Redis instance', () => {
    const mockInstance = { status: 'ready' };
    MockRedis.mockReturnValueOnce(mockInstance);
    const client = createRedisClient('redis://localhost:6379');
    expect(client).toBe(mockInstance);
  });
});
