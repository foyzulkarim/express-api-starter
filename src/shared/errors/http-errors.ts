import { HttpStatus } from '../constants/http-status.js';
import type { FieldError } from '../types/common.types.js';

import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super({ code: ErrorCode.BAD_REQUEST, message, statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super({ code: ErrorCode.UNAUTHORIZED, message, statusCode: HttpStatus.UNAUTHORIZED });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super({ code: ErrorCode.FORBIDDEN, message, statusCode: HttpStatus.FORBIDDEN });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({ code: ErrorCode.RESOURCE_NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super({ code: ErrorCode.CONFLICT, message, statusCode: HttpStatus.CONFLICT });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: FieldError[] = []) {
    super({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super({
      code: ErrorCode.INTERNAL_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      isOperational: false,
    });
  }
}
