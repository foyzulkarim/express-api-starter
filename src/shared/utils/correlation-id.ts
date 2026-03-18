import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<string>();

/** Returns the correlation ID for the current async context, or `undefined` if none is set. */
export function getCorrelationId(): string | undefined {
  return storage.getStore();
}

/** Runs `fn` inside an async context where `getCorrelationId()` returns `correlationId`. */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run(correlationId, fn);
}
