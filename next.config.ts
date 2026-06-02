import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The @ alias is handled by tsconfig.json paths
  // No custom webpack config needed for basic aliasing

  // Ensure Prisma works properly with serverless/edge
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // Lint is a separate, explicit CI gate (`npm run lint` + the security-audit
  // workflow's lint step), NOT a build blocker. `next build` runs ESLint
  // automatically whenever an ESLint config is present; with the committed
  // .eslintrc.json (added when migrating off the deprecated `next lint`),
  // that would fail the build on pre-existing `react/no-unescaped-entities`
  // errors that have always lived in the codebase and never blocked a deploy.
  // Decoupling keeps builds about compilation and lint about quality.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Override Cross-Origin-Opener-Policy on the proxied Firebase auth handler
  // pages. Firebase Hosting may send COOP: same-origin which severs the
  // window.opener relationship and prevents the popup from communicating the
  // auth result back to the parent window.
  async headers() {
    return [
      {
        source: '/__/auth/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },

  // Proxy Firebase Auth handler through our domain so Google sign-in popup
  // shows "www.monitrax.com.au" instead of "monitrax-479700.firebaseapp.com".
  // Requires NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.monitrax.com.au in env.
  // Phase 47 — Legal-doc slug renamed when v1.0 published 2026-05-24.
  // 301 keeps old bookmarks + any externally cached links working.
  async redirects() {
    return [
      {
        source: '/legal/afsl-boundary-disclosure',
        destination: '/legal/afsl-credit-tax-boundary-disclosure',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://monitrax-479700.firebaseapp.com/__/auth/:path*',
      },
      // Serve init.json from our own API because the Firebase project may not
      // have Hosting deployed (returns 403/404 otherwise).
      {
        source: '/__/firebase/init.json',
        destination: '/api/firebase-init',
      },
      {
        source: '/__/firebase/:path*',
        destination: 'https://monitrax-479700.firebaseapp.com/__/firebase/:path*',
      },
    ];
  },
};

export default nextConfig;
