import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage<string>();

export function getCorrelationId(): string | undefined {
  return storage.getStore();
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run(correlationId, fn);
}

export { randomUUID };
