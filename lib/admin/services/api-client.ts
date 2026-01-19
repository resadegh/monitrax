/**
 * Phase 33: Admin Portal API Client
 *
 * Base HTTP client for admin portal API calls.
 * Provides a consistent interface for all admin API requests.
 */

import { ADMIN_API_ROUTES } from '../constants';
import type { AdminApiResponse, AdminApiError } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

// =============================================================================
// API CLIENT
// =============================================================================

/**
 * Build URL with query parameters
 */
function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Make an API request
 */
async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<AdminApiResponse<T>> {
  const { method = 'GET', body, params, headers = {} } = options;

  const url = buildUrl(path, params);

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // Include cookies for session
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
        },
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    console.error('[Admin API] Request failed:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

// =============================================================================
// API CLIENT METHODS
// =============================================================================

export const adminApi = {
  /**
   * GET request
   */
  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<AdminApiResponse<T>> {
    return request<T>(path, { method: 'GET', params });
  },

  /**
   * POST request
   */
  post<T>(path: string, body?: unknown): Promise<AdminApiResponse<T>> {
    return request<T>(path, { method: 'POST', body });
  },

  /**
   * PATCH request
   */
  patch<T>(path: string, body?: unknown): Promise<AdminApiResponse<T>> {
    return request<T>(path, { method: 'PATCH', body });
  },

  /**
   * PUT request
   */
  put<T>(path: string, body?: unknown): Promise<AdminApiResponse<T>> {
    return request<T>(path, { method: 'PUT', body });
  },

  /**
   * DELETE request
   */
  delete<T>(path: string): Promise<AdminApiResponse<T>> {
    return request<T>(path, { method: 'DELETE' });
  },
};

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export { ADMIN_API_ROUTES };
