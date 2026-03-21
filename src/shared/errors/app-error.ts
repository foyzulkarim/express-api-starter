import type { FieldError } from '../types/common.types.js';

import type { AppErrorContract } from './app-error.contract.js';
import type { ErrorCode } from './error-codes.js';

export class AppError extends Error implements AppErrorContract {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: FieldError[] | undefined;

  constructor({
    code,
    message,
    statusCode,
    isOperational = true,
    details,
    cause,
  }: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    isOperational?: boolean;
    details?: FieldError[];
    cause?: unknown;
  }) {
    super(message, { cause });
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
  }
}
