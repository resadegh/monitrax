/**
 * API Response Wrapper
 * Standardized response format for all API endpoints
 */

import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { AppError, errors, formatErrorResponse, isAppError, wrapError } from './errors';
import { log } from './logger';

// ============================================
// RESPONSE TYPES
// ============================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  };
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: Required<Pick<ResponseMeta, 'page' | 'limit' | 'total' | 'totalPages'>>;
}

// ============================================
// SUCCESS RESPONSES
// ============================================

/**
 * Create a success response with data
 */
export function success<T>(data: T, meta?: ResponseMeta): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

/**
 * Create a paginated success response
 */
export function paginated<T>(
  items: T[],
  page: number,
  limit: number,
  total: number
): NextResponse<ApiSuccessResponse<PaginatedData<T>>> {
  const totalPages = Math.ceil(total / limit);
  return success({
    items,
    meta: { page, limit, total, totalPages },
  });
}

/**
 * Create a success response for create operations (201)
 */
export function created<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { success: true, data },
    { status: 201 }
  );
}

/**
 * Create a success response for delete operations (no content)
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ============================================
// ERROR RESPONSES
// ============================================

/**
 * Create an error response from an AppError
 */
export function error(appError: AppError): NextResponse<ApiErrorResponse> {
  return formatErrorResponse(appError) as NextResponse<ApiErrorResponse>;
}

/**
 * Create a validation error response from Zod errors
 */
export function validationError(zodError: ZodError): NextResponse<ApiErrorResponse> {
  const details = zodError.errors.reduce((acc, err) => {
    const path = err.path.join('.');
    acc[path] = err.message;
    return acc;
  }, {} as Record<string, string>);

  return error(errors.validation('Validation failed', details));
}

/**
 * Create a not found error response
 */
export function notFound(resource: string, id?: string): NextResponse<ApiErrorResponse> {
  return error(errors.notFound(resource, id));
}

/**
 * Create an unauthorized error response
 */
export function unauthorized(message?: string): NextResponse<ApiErrorResponse> {
  return error(errors.unauthorized(message));
}

/**
 * Create a forbidden error response
 */
export function forbidden(message?: string): NextResponse<ApiErrorResponse> {
  return error(errors.forbidden(message));
}

/**
 * Create an internal server error response
 */
export function serverError(err?: unknown): NextResponse<ApiErrorResponse> {
  if (err) {
    log.error('Internal server error', err instanceof Error ? err : null, {
      errorType: typeof err,
    });
  }
  return error(errors.internal());
}

// ============================================
// REQUEST HANDLING UTILITIES
// ============================================

/**
 * Parse and validate request body against a Zod schema
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse<ApiErrorResponse> }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return { error: validationError(result.error) };
    }

    return { data: result.data };
  } catch {
    return { error: error(errors.badRequest('Invalid JSON body')) };
  }
}

/**
 * Parse and validate URL search params against a Zod schema
 */
export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse<ApiErrorResponse> } {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    return { error: validationError(result.error) };
  }

  return { data: result.data };
}

/**
 * Wrap an async handler with error handling
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((err: unknown) => {
    if (isAppError(err)) {
      return error(err);
    }
    return serverError(err);
  });
}

/**
 * Type guard to check if parse result is an error
 */
export function isParseError<T>(
  result: { data: T } | { error: NextResponse<ApiErrorResponse> }
): result is { error: NextResponse<ApiErrorResponse> } {
  return 'error' in result;
}
