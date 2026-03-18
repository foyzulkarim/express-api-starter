import { HttpStatus } from '../constants/http-status.js';
import type { FieldError } from '../types/common.types.js';

import { AppError } from './app-error.js';
import { ErrorCodes } from './error-codes.js';

/** 400 Bad Request — malformed syntax or invalid request parameters. */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super({ code: ErrorCodes.BAD_REQUEST, message, statusCode: HttpStatus.BAD_REQUEST });
  }
}

/** 401 Unauthorized — authentication is required or has failed. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super({ code: ErrorCodes.UNAUTHORIZED, message, statusCode: HttpStatus.UNAUTHORIZED });
  }
}

/** 403 Forbidden — the caller is authenticated but lacks permission. */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super({ code: ErrorCodes.FORBIDDEN, message, statusCode: HttpStatus.FORBIDDEN });
  }
}

/** 404 Not Found — the requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({ code: ErrorCodes.RESOURCE_NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }
}

/** 409 Conflict — the request conflicts with the current state of a resource. */
export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super({ code: ErrorCodes.CONFLICT, message, statusCode: HttpStatus.CONFLICT });
  }
}

/** 422 Unprocessable Entity — request is well-formed but contains semantic validation errors. */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: FieldError[] = []) {
    super({
      code: ErrorCodes.VALIDATION_ERROR,
      message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    });
  }
}

/** 429 Too Many Requests — the caller has exceeded the allowed request rate. */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super({
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message,
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  }
}

/**
 * 500 Internal Server Error — unexpected failure; `isOperational` is `false`.
 * Error middleware should treat this as a programmer error and restart the process.
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      isOperational: false,
    });
  }
}
