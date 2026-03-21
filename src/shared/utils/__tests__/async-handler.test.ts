import type { Request, Response } from 'express';
import { describe, it, expect, vi } from 'vitest';

import { asyncHandler } from '../async-handler.js';

describe('asyncHandler', () => {
  it('passes through on successful resolution', async () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    const handler = asyncHandler(async () => {
      // Success - no error thrown
    });

    await handler(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with error on rejection', async () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();
    const error = new Error('Test error');

    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });
});
