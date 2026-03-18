import { describe, it, expect } from 'vitest';
import { getCorrelationId, runWithCorrelationId } from '../correlation-id.js';

describe('correlation-id', () => {
  it('returns undefined when no ID is stored', () => {
    const id = getCorrelationId();
    expect(id).toBeUndefined();
  });

  it('returns the stored correlation ID when available', () => {
    const storedId = 'test-correlation-id-123';
    const result = runWithCorrelationId(storedId, () => {
      const id = getCorrelationId();
      expect(id).toBe(storedId);
      return id;
    });
    expect(result).toBe(storedId);
  });

  it('returns undefined outside storage context on successive calls', () => {
    const id1 = getCorrelationId();
    const id2 = getCorrelationId();
    expect(id1).toBeUndefined();
    expect(id2).toBeUndefined();
  });
});
