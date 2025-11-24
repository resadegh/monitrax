/**
 * Monitrax Error Utility
 * Standardized error handling across the application
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

/**
 * Create a standardized application error
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Type guard to check if an object is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error
  );
}

/**
 * Get HTTP status code from error code
 */
export function getStatusFromErrorCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    VALIDATION_ERROR: 400,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  };
  return statusMap[code] || 500;
}

/**
 * Format an AppError as an HTTP Response
 */
export function formatErrorResponse(error: AppError, status?: number): Response {
  const httpStatus = status || getStatusFromErrorCode(error.code);
  return Response.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
      },
    },
    { status: httpStatus }
  );
}

/**
 * Error factory functions for common error types
 */
export const errors = {
  validation: (message: string, details?: Record<string, unknown>) =>
    createError('VALIDATION_ERROR', message, details),

  notFound: (resource: string, id?: string) =>
    createError('NOT_FOUND', id ? `${resource} with id '${id}' not found` : `${resource} not found`),

  unauthorized: (message = 'Authentication required') =>
    createError('UNAUTHORIZED', message),

  forbidden: (message = 'Permission denied') =>
    createError('FORBIDDEN', message),

  conflict: (message: string, details?: Record<string, unknown>) =>
    createError('CONFLICT', message, details),

  internal: (message = 'An unexpected error occurred') =>
    createError('INTERNAL_ERROR', message),

  rateLimited: (message = 'Too many requests. Please try again later.') =>
    createError('RATE_LIMITED', message),

  badRequest: (message: string, details?: Record<string, unknown>) =>
    createError('BAD_REQUEST', message, details),
};

/**
 * Wrap an unknown error into a standardized AppError
 */
export function wrapError(error: unknown, fallbackMessage = 'An unexpected error occurred'): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createError('INTERNAL_ERROR', error.message || fallbackMessage);
  }

  if (typeof error === 'string') {
    return createError('INTERNAL_ERROR', error);
  }

  return createError('INTERNAL_ERROR', fallbackMessage);
}
