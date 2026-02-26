import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The @ alias is handled by tsconfig.json paths
  // No custom webpack config needed for basic aliasing

  // Ensure Prisma works properly with serverless/edge
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // Proxy Firebase Auth handler through our domain so Google sign-in popup
  // shows "www.monitrax.com.au" instead of "monitrax-479700.firebaseapp.com".
  // Requires NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.monitrax.com.au in env.
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://monitrax-479700.firebaseapp.com/__/auth/:path*',
      },
      {
        source: '/__/firebase/:path*',
        destination: 'https://monitrax-479700.firebaseapp.com/__/firebase/:path*',
      },
    ];
  },
};

export default nextConfig;
