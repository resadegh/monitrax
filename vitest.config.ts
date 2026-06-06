import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Next.js handles JSX via SWC in app code; tsconfig.json sets
  // "jsx": "preserve". Vitest uses esbuild and defaults to the classic
  // runtime, which would require `import React from 'react'` in every
  // component. Setting "automatic" mirrors Next.js's production behavior
  // so components don't need to import React just to pass tests.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts', 'components/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // `server-only` is a Next.js runtime guard. In vitest's node
      // environment we stub it so server-side libs can still be
      // unit-tested without spinning up Next.
      'server-only': path.resolve(__dirname, './tests/setup/server-only-stub.ts'),
    },
  },
});
