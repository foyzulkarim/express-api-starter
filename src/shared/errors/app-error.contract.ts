import type { FieldError } from '../types/common.types.js';

export interface AppErrorContract {
  code: string;
  message: string;
  statusCode: number;
  isOperational: boolean;
  details?: FieldError[] | undefined;
}
