/**
 * Safe admin fetch helper
 *
 * Handles the common failure modes of admin API calls:
 * - Empty response bodies (happens when Vercel serverless crashes)
 * - Non-JSON responses (HTML error pages)
 * - Network errors
 *
 * Always returns a well-shaped result instead of throwing.
 */

export interface SafeFetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export async function safeAdminFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const response = await fetch(url, init);
    const status = response.status;

    // Try to read the response body as text first, then parse
    const text = await response.text();

    if (!text) {
      // Empty body — serverless crash or 204
      return {
        ok: false,
        status,
        data: null,
        error: response.ok
          ? 'Server returned empty response'
          : `Request failed (${status}): empty response body`,
      };
    }

    // Try to parse as JSON
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON — probably an HTML error page from Vercel
      return {
        ok: false,
        status,
        data: null,
        error: `Server returned non-JSON response (${status}). This usually means a serverless function crash.`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status,
        data: null,
        error: parsed?.error?.message || parsed?.message || `Request failed with status ${status}`,
      };
    }

    return {
      ok: true,
      status,
      data: (parsed.data !== undefined ? parsed.data : parsed) as T,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
