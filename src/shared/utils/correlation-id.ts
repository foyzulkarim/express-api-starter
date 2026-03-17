import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage<string>();

export const correlationIdStorage = storage;

export function getCorrelationId(): string {
  return storage.getStore() ?? randomUUID();
}
