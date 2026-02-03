/**
 * Phase 32: Portal API Client
 *
 * Base API client for all portal services.
 * Handles authentication, error handling, and response parsing.
 *
 * MODULAR: This is the foundation - other services extend this.
 * Changes here affect all services, so keep it stable.
 */

import { PORTAL_ROUTES } from '../constants';

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build URL with query parameters
 */
function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Get the auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

/**
 * Base fetch wrapper with error handling
 */
async function baseFetch<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, params } = options;

  const url = buildUrl(path, params);

  // Get auth token from localStorage (set by AuthContext)
  const token = getAuthToken();
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    credentials: 'include', // Include cookies for auth
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        error: {
          code: data?.error || 'UNKNOWN_ERROR',
          message: data?.message || 'An unexpected error occurred',
          details: data?.details,
        },
        status: response.status,
      };
    }

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
      status: 0,
    };
  }
}

/**
 * Portal API Client
 *
 * Provides typed methods for all portal API operations.
 * Each method is independent - you can use just the ones you need.
 */
export const portalApi = {
  /**
   * Health check
   */
  health: () => baseFetch<{ status: string; features: Record<string, boolean> }>(
    `${PORTAL_ROUTES.API_BASE}/health`
  ),

  /**
   * Generic GET request
   */
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    baseFetch<T>(path, { method: 'GET', params }),

  /**
   * Generic POST request
   */
  post: <T>(path: string, body?: unknown) =>
    baseFetch<T>(path, { method: 'POST', body }),

  /**
   * Generic PATCH request
   */
  patch: <T>(path: string, body?: unknown) =>
    baseFetch<T>(path, { method: 'PATCH', body }),

  /**
   * Generic DELETE request
   */
  delete: <T>(path: string) =>
    baseFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Create a service-specific API client
 *
 * Usage:
 * ```ts
 * const clientsApi = createServiceClient('/api/portal/organizations/123/clients');
 * const clients = await clientsApi.list({ page: 1, limit: 20 });
 * ```
 */
export function createServiceClient(basePath: string) {
  return {
    list: <T>(params?: Record<string, string | number | boolean | undefined>) =>
      portalApi.get<PaginatedResponse<T>>(basePath, params),

    get: <T>(id: string) =>
      portalApi.get<T>(`${basePath}/${id}`),

    create: <T>(data: unknown) =>
      portalApi.post<T>(basePath, data),

    update: <T>(id: string, data: unknown) =>
      portalApi.patch<T>(`${basePath}/${id}`, data),

    delete: (id: string) =>
      portalApi.delete(`${basePath}/${id}`),
  };
}
