import type { FieldError } from '../types/common.types.js';

import type { ErrorCode } from './error-codes.js';

export interface AppErrorContract {
  code: ErrorCode;
  message: string;
  statusCode: number;
  /**
   * Distinguishes expected errors from unexpected failures.
   *
   * `true`  — operational error (e.g. 404, validation failure): log it and
   *           continue serving requests. The process is in a known, safe state.
   *
   * `false` — programmer error or unknown failure: the process may be in a
   *           corrupt state and should be restarted (e.g. via PM2/Kubernetes).
   *           Error middleware should propagate these rather than swallow them.
   */
  isOperational: boolean;
  details?: FieldError[] | undefined;
}
