'use client';

/**
 * Session Expiry Handler
 *
 * Catches 401 responses from /api/* that indicate an expired Firebase ID
 * token, forces one token refresh + retry, and falls through to
 * `logout()` + redirect if the session is genuinely gone.
 *
 * Why this exists: the codebase's hooks read the cached `token` from
 * React state (snapshot of the last `onIdTokenChanged` event). Firebase
 * ID tokens have a 1-hour TTL. If the user idles for ~25 min (under the
 * 30-min `IdleTimeoutGuard` threshold) and then clicks something, the
 * cached token is sent stale, the server returns 401, and the UI is
 * left in a broken state with no path back to a clean re-auth.
 *
 * This component installs a `window.fetch` wrapper on mount (only when
 * `firebaseUser` is set — i.e. the user thinks they're authenticated)
 * that:
 *
 *   1. Awaits the original fetch.
 *   2. If it returns 401 AND the URL is `/api/*` AND not an `/api/auth/*`
 *      endpoint (those legitimately 401 during signup / login):
 *      a. Force-refresh the Firebase ID token via
 *         `firebaseUser.getIdToken(true)` (one shared in-flight refresh
 *         across concurrent 401s — see `refreshPromiseRef`).
 *      b. If the refresh succeeds AND the original request had an
 *         `Authorization` header, retry once with the fresh token.
 *      c. If the retry succeeds, return it. The seamless path.
 *   3. If still 401 (or refresh failed), call `logout()` and redirect
 *      to `/signin?reason=session_expired&next=<current-path>` so the
 *      user can sign back in and land where they were.
 *
 * Falls through silently on public pages (signin / register / etc.) so
 * we never trigger a redirect loop.
 *
 * Spec: CLAUDE.md §13.5 (30-minute idle timeout, token refresh handled
 * by Firebase SDK). Companion to `IdleTimeoutGuard`.
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

/** Paths where 401s should NOT trigger a logout redirect. */
const PUBLIC_PATH_PREFIXES = [
  '/signin',
  '/register',
  '/resend-verification',
  '/verify-email',
  '/oauth-callback',
  '/portal/signin',
  '/portal/login',
  '/portal/register',
];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isOurApiUrl(input: RequestInfo | URL): boolean {
  let url: string;
  if (typeof input === 'string') url = input;
  else if (input instanceof URL) url = input.href;
  else url = input.url;
  // Match relative `/api/...` and absolute URLs that point at our origin.
  if (url.startsWith('/api/')) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return (
      parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')
    );
  } catch {
    return false;
  }
}

function isAuthFlowEndpoint(input: RequestInfo | URL): boolean {
  let url: string;
  if (typeof input === 'string') url = input;
  else if (input instanceof URL) url = input.href;
  else url = input.url;
  return /\/api\/auth\//.test(url);
}

function hasAuthorizationHeader(init: RequestInit | undefined): boolean {
  if (!init?.headers) return false;
  if (init.headers instanceof Headers) {
    return init.headers.has('authorization') || init.headers.has('Authorization');
  }
  if (Array.isArray(init.headers)) {
    return init.headers.some(([k]) => k.toLowerCase() === 'authorization');
  }
  return Object.keys(init.headers).some((k) => k.toLowerCase() === 'authorization');
}

function withFreshAuth(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  return { ...(init ?? {}), headers };
}

export function SessionExpiryHandler() {
  const { firebaseUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Hold the latest pathname in a ref so the fetch wrapper effect doesn't
  // re-install on every route change.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Single in-flight refresh shared across all concurrent 401s, so a wave
  // of failing requests doesn't trigger a thundering herd of refreshes.
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!firebaseUser) return;

    const originalFetch = window.fetch.bind(window);

    const refreshOnce = (): Promise<string | null> => {
      if (refreshPromiseRef.current) return refreshPromiseRef.current;
      refreshPromiseRef.current = firebaseUser
        .getIdToken(true)
        .catch(() => null)
        .finally(() => {
          refreshPromiseRef.current = null;
        });
      return refreshPromiseRef.current;
    };

    const wrapped: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      if (response.status !== 401) return response;
      if (!isOurApiUrl(input)) return response;
      if (isAuthFlowEndpoint(input)) return response;

      // Try a single token refresh + retry, if the original request was
      // sending an Authorization header (otherwise no token was the issue).
      if (hasAuthorizationHeader(init)) {
        const fresh = await refreshOnce();
        if (fresh) {
          const retry = await originalFetch(input, withFreshAuth(init, fresh));
          if (retry.status !== 401) return retry;
        }
      }

      // Genuinely expired session — log out and bounce to /signin (only if
      // we're on a protected page; on public pages, let the response bubble
      // so callers like the /signin page itself can react normally).
      if (!isPublicPath(pathnameRef.current)) {
        logout();
        const next = encodeURIComponent(pathnameRef.current || '/dashboard');
        router.push(`/signin?reason=session_expired&next=${next}`);
      }
      return response;
    };

    window.fetch = wrapped;

    return () => {
      // Only restore if no one else patched on top of us in the meantime.
      if (window.fetch === wrapped) window.fetch = originalFetch;
    };
  }, [firebaseUser, logout, router]);

  return null;
}
