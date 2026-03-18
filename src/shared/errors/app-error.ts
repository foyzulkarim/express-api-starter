import type { AppErrorContract } from './app-error.contract.js';
import type { FieldError } from '../types/common.types.js';

export class AppError extends Error implements AppErrorContract {
  public readonly code: string;
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
    code: string;
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
    this.details = details ?? undefined;
  }
}
