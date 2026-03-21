import { PrismaClient } from '@prisma/client';

// Only this file (and features/*/infra/*.ts) may import from @prisma/client directly.
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
  });
}

export type { PrismaClient };
