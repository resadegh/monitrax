import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The @ alias is handled by tsconfig.json paths
  // No custom webpack config needed for basic aliasing

  // Ensure Prisma works properly with serverless/edge
  serverExternalPackages: ['@prisma/client', 'prisma'],

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
