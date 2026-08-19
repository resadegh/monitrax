/**
 * Next.js Middleware
 * Phase 10: Frontend Security Hardening
 *
 * Note: This middleware runs on the Edge runtime.
 * Only use Web APIs that are Edge-compatible.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MODULE_REGISTRY } from '@/lib/featureFlags/moduleRegistry';

// MON-161: module-gated routes must never serve a cacheable response —
// after an admin flips a flag, a cached 404 (or cached page) on the bare
// URL would hide the flip for as long as the cache lives, breaking the
// admin panel's ~30s promise that every R-stage return relies on. Derived
// from MODULE_REGISTRY (SSOT — no second route list); the registry is
// pure data, so this import is Edge-safe. MODULE_HOME (`redirect`
// behaviour) matches its prefix exactly: /dashboard itself flips between
// redirect and page, but /dashboard/* kept routes stay cacheable.
const GATED_ROUTE_MATCHERS: RegExp[] = MODULE_REGISTRY.flatMap((m) => {
  const toRegex = (prefix: string, exact: boolean) =>
    new RegExp(
      `^${prefix.replace(/[.*+^${}()|\\]/g, '\\$&').replace(/\[[^\]]+\]/g, '[^/]+')}${exact ? '$' : '(/|$)'}`,
    );
  return m.routePrefixes.map((p) => toRegex(p, m.behaviour === 'redirect'));
});

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // MON-161: flag-gated surface — the verdict (404 vs page vs redirect)
  // is request-time state and must never be cached at any layer.
  if (GATED_ROUTE_MATCHERS.some((r) => r.test(request.nextUrl.pathname))) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP — includes Firebase/GCP Identity Platform domains for authentication
  // 'self' in frame-src is required because Firebase SDK loads a hidden iframe
  // at /__/auth/iframe on the same domain for popup auth communication.
  const connectSrc = [
    "'self'",
    'https://*.googleapis.com',
    'https://*.firebaseauth.com',
    'https://securetoken.googleapis.com',
    'https://identitytoolkit.googleapis.com',
  ];
  // E2E ONLY: when the Firebase Auth emulator is configured, allow its local
  // origin in connect-src so the client SDK can reach it without a CSP
  // violation. NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST is inlined at build and
  // is set ONLY in the Playwright CI job (see .github/workflows/tests.yml) —
  // never in prod or Vercel preview, so the production CSP is unchanged.
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost) {
    connectSrc.push(`http://${emulatorHost}`, 'http://127.0.0.1:9099', 'http://localhost:9099');
  }
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src ${connectSrc.join(' ')}; frame-src 'self' https://*.firebaseapp.com https://*.google.com https://accounts.google.com; frame-ancestors 'none'`
  );

  // Allow popup-based auth flows (e.g. signInWithPopup) to communicate back
  // to the opener window. Without this, Cross-Origin-Opener-Policy may sever
  // the window.opener relationship and block window.closed checks.
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}

// ============================================
// MIDDLEWARE CONFIG
// ============================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - __/auth and __/firebase (proxied Firebase Auth handler — must not
     *   have our CSP applied because the handler loads its own scripts
     *   from gstatic.com, googleapis.com, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|__/).*)',
  ],
};
