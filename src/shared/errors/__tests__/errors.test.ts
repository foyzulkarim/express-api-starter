import { describe, it, expect } from 'vitest';

import { AppError } from '../app-error.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalError,
} from '../http-errors.js';

describe('AppError', () => {
  it('creates an operational error by default', () => {
    const error = new AppError({
      code: 'TEST_ERROR',
      message: 'Test message',
      statusCode: 400,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('supports non-operational errors', () => {
    const error = new AppError({
      code: 'FATAL',
      message: 'Something broke',
      statusCode: 500,
      isOperational: false,
    });

    expect(error.isOperational).toBe(false);
  });

  it('supports validation details', () => {
    const details = [{ field: 'email', message: 'Required' }];
    const error = new AppError({
      code: 'VALIDATION',
      message: 'Invalid',
      statusCode: 422,
      details,
    });

    expect(error.details).toEqual(details);
  });
});

describe('HTTP Error Classes', () => {
  it('BadRequestError defaults', () => {
    const err = new BadRequestError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.isOperational).toBe(true);
  });

  it('UnauthorizedError defaults', () => {
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError defaults', () => {
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('NotFoundError defaults', () => {
    const err = new NotFoundError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('ConflictError defaults', () => {
    const err = new ConflictError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('ValidationError includes details', () => {
    const details = [{ field: 'name', message: 'Too short' }];
    const err = new ValidationError('Bad input', details);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });

  it('RateLimitError defaults', () => {
    const err = new RateLimitError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('InternalError is not operational', () => {
    const err = new InternalError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(false);
  });

  it('accepts custom messages', () => {
    const err = new NotFoundError('User not found');
    expect(err.message).toBe('User not found');
  });
});
