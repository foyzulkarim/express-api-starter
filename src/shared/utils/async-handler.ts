import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express route handler to forward any rejection to `next(err)`.
 * Includes a guard to prevent `next` from being called more than once if the
 * handler calls `next()` before the returned promise rejects.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => {
  return (req, res, next) => {
    let called = false;
    const guardedNext: NextFunction = (err?: unknown) => {
      if (called) return;
      called = true;
      next(err);
    };
    try {
      return Promise.resolve(fn(req, res, guardedNext)).catch(guardedNext);
    } catch (err) {
      return guardedNext(err);
    }
  };
};
