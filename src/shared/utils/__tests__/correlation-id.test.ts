import { describe, it, expect } from 'vitest';
import { correlationIdStorage, getCorrelationId } from '../correlation-id.js';

describe('correlation-id', () => {
  it('returns a valid UUID when no ID is stored', () => {
    const id = getCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns the stored correlation ID when available', () => {
    const storedId = 'test-correlation-id-123';
    correlationIdStorage.run(storedId, () => {
      const id = getCorrelationId();
      expect(id).toBe(storedId);
    });
  });

  it('returns different UUIDs when called outside storage context', () => {
    const id1 = getCorrelationId();
    const id2 = getCorrelationId();
    // Each call generates a new UUID when not in storage context
    expect(id1).not.toBe(id2);
  });
});
