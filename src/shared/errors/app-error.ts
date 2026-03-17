import type { AppErrorContract } from './app-error.contract.js';
import type { FieldError } from '../types/common.types.js';

export class AppError extends Error implements AppErrorContract {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: FieldError[];

  constructor({
    code,
    message,
    statusCode,
    isOperational = true,
    details,
  }: {
    code: string;
    message: string;
    statusCode: number;
    isOperational?: boolean;
    details?: FieldError[];
  }) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (details !== undefined) {
      this.details = details;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
