import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Check if we're in a build environment without Prisma binaries
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

function createPrismaClient(): PrismaClient {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  } catch (error) {
    if (isBuildPhase) {
      // During build, return a mock that won't crash the build
      console.warn('Prisma client not available during build phase');
      return new Proxy({} as PrismaClient, {
        get: (_, prop) => {
          if (prop === '$connect' || prop === '$disconnect') {
            return () => Promise.resolve();
          }
          // Return a proxy for model operations
          return new Proxy(
            {},
            {
              get: () => () => Promise.resolve([]),
            }
          );
        },
      });
    }
    throw error;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
