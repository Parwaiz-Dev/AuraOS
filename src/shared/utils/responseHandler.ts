/**
 * Standard API response wrapper
 * All API responses follow this structure
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    message?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, any>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  code: string = 'ERROR',
  details: any = null
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
