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
    path?: string;
    method?: string;
    details?: FieldError[];
  };
}

export interface FieldError {
  field: string;
  message: string;
}
