export interface ApiResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    correlationId: string;
    timestamp: string;
    details?: FieldError[];
  };
}

export interface FieldError {
  field: string;
  message: string;
}
