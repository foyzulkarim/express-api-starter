import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockOn = vi.fn();
const mockRedisInstance = { on: mockOn };
const MockRedis = vi.fn(() => mockRedisInstance);
vi.mock('ioredis', () => ({ Redis: MockRedis }));

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
    const client = createRedisClient('redis://localhost:6379');
    expect(client).toBe(mockRedisInstance);
  });

  it('attaches an error listener to prevent process crash on connection error', () => {
    createRedisClient('redis://localhost:6379');
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
