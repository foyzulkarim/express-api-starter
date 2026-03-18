import type { Request, Response, NextFunction, RequestHandler } from 'express';

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
      Promise.resolve(fn(req, res, guardedNext)).catch(guardedNext);
    } catch (err) {
      guardedNext(err);
    }
  };
};
