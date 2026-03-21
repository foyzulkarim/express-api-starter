import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const MockPrismaClient = vi.fn();
vi.mock('@prisma/client', () => ({ PrismaClient: MockPrismaClient }));

let createPrismaClient: typeof import('../prisma-client.js')['createPrismaClient'];

beforeAll(async () => {
  const mod = await import('../prisma-client.js');
  createPrismaClient = mod.createPrismaClient;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPrismaClient', () => {
  it('instantiates PrismaClient with the provided database URL', () => {
    const url = 'postgresql://user:pass@localhost:5432/testdb';
    createPrismaClient(url);
    expect(MockPrismaClient).toHaveBeenCalledWith({ datasourceUrl: url });
  });

  it('returns the PrismaClient instance', () => {
    const mockInstance = { $connect: vi.fn() };
    MockPrismaClient.mockReturnValueOnce(mockInstance);
    const client = createPrismaClient('postgresql://localhost:5432/db');
    expect(client).toBe(mockInstance);
  });
});
