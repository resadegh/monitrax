import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The @ alias is handled by tsconfig.json paths
  // No custom webpack config needed for basic aliasing

  // Ensure Prisma works properly with serverless/edge
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
