import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockOn = vi.fn();
const mockRedisInstance = { on: mockOn };
const MockRedis = vi.fn(() => mockRedisInstance);
vi.mock('ioredis', () => ({ Redis: MockRedis }));

let createBullMQClient: typeof import('../bullmq-client.js')['createBullMQClient'];

beforeAll(async () => {
  const mod = await import('../bullmq-client.js');
  createBullMQClient = mod.createBullMQClient;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createBullMQClient', () => {
  it('instantiates Redis with the provided URL', () => {
    const url = 'redis://localhost:6379';
    createBullMQClient(url);
    expect(MockRedis).toHaveBeenCalledWith(url, expect.any(Object));
  });

  it('sets maxRetriesPerRequest to null (required by BullMQ)', () => {
    createBullMQClient('redis://localhost:6379');
    expect(MockRedis).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
  });

  it('attaches an error listener to prevent process crash on connection error', () => {
    createBullMQClient('redis://localhost:6379');
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
