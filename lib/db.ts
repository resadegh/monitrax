/**
 * Prisma client factory.
 *
 * Two branches, selected by `USE_CLOUD_SQL_CONNECTOR`:
 *
 *  - **Standard branch (default, flag unset or `false`):**
 *    `PrismaClient` reads `DATABASE_URL` directly. Same behaviour as before
 *    the WIF workstream landed. Used in dev, in CI, and as the production
 *    fallback while WIF is being verified. Eager init at module load — the
 *    same shape Monitrax has had since day one.
 *
 *  - **Cloud SQL Connector branch (`USE_CLOUD_SQL_CONNECTOR=true`):**
 *    Authenticates to Cloud SQL via Workload Identity Federation (no
 *    long-lived password). The Vercel runtime OIDC token is delivered as
 *    the `x-vercel-oidc-token` request header (NOT as an env var — see
 *    https://vercel.com/docs/oidc), which means token retrieval can only
 *    happen inside a request context.
 *
 *    Consequence: the connector branch is **lazy-initialised** behind a
 *    Proxy. Module load only constructs the Proxy (no GCP calls). On the
 *    first prisma method call inside a request handler, the Proxy
 *    triggers `buildConnectorPrisma()` once, caches the resulting client
 *    on `globalThis`, and forwards all subsequent calls.
 *
 *    Token reading uses `getVercelOidcToken()` from `@vercel/oidc`,
 *    which checks the request context header first and falls back to the
 *    `VERCEL_OIDC_TOKEN` env var (build/local-dev only).
 *
 * Required env vars when `USE_CLOUD_SQL_CONNECTOR=true`:
 *  - `GCP_WORKLOAD_IDENTITY_PROVIDER` — full resource path
 *  - `GCP_SERVICE_ACCOUNT_EMAIL` — SA to impersonate
 *  - `CLOUD_SQL_CONNECTION_NAME` — `<project>:<region>:<instance>`
 *  - `CLOUD_SQL_DB_USER` — IAM-mapped Postgres user
 *  - `CLOUD_SQL_DB_NAME` — database name
 *  - OIDC Federation must be enabled at the Vercel project level so the
 *    runtime injects the `x-vercel-oidc-token` header per request.
 *
 * See `docs/operational/security/04_WIF_TROUBLESHOOTING.md` and
 * `docs/IMPLEMENTATION_PLAN.md` (Step 1a / WIF) for context.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaInitPromise: Promise<PrismaClient> | undefined;
};

const useConnector =
  process.env.USE_CLOUD_SQL_CONNECTOR === 'true' &&
  process.env.NEXT_PHASE !== 'phase-production-build';

async function buildConnectorPrisma(): Promise<PrismaClient> {
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER;
  const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const instance = process.env.CLOUD_SQL_CONNECTION_NAME;
  const dbUser = process.env.CLOUD_SQL_DB_USER;
  const dbName = process.env.CLOUD_SQL_DB_NAME;

  const missing = [
    ['GCP_WORKLOAD_IDENTITY_PROVIDER', provider],
    ['GCP_SERVICE_ACCOUNT_EMAIL', saEmail],
    ['CLOUD_SQL_CONNECTION_NAME', instance],
    ['CLOUD_SQL_DB_USER', dbUser],
    ['CLOUD_SQL_DB_NAME', dbName],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `USE_CLOUD_SQL_CONNECTOR=true but missing required env var(s): ${missing.join(', ')}`,
    );
  }

  const [
    { Connector, IpAddressTypes, AuthTypes },
    { IdentityPoolClient },
    pgModule,
    { PrismaPg },
    { getVercelOidcToken },
  ] = await Promise.all([
    import('@google-cloud/cloud-sql-connector'),
    import('google-auth-library'),
    import('pg'),
    import('@prisma/adapter-pg'),
    import('@vercel/oidc'),
  ]);

  const Pool = (pgModule as { Pool?: typeof import('pg').Pool; default?: { Pool: typeof import('pg').Pool } }).Pool
    ?? (pgModule as { default: { Pool: typeof import('pg').Pool } }).default.Pool;

  const authClient = new IdentityPoolClient({
    type: 'external_account',
    audience: `//iam.googleapis.com/${provider}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: async () => {
        try {
          return await getVercelOidcToken();
        } catch (err) {
          const cause = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Failed to retrieve Vercel OIDC token (cause: ${cause}). ` +
              `Ensure OIDC Federation is enabled at the Vercel project level and the function ` +
              `runs in a request context (Node.js runtime, not middleware, not at module top-level).`,
          );
        }
      },
    },
  });

  const connector = new Connector({ auth: authClient });

  const clientOpts = await connector.getOptions({
    instanceConnectionName: instance!,
    ipType:
      (process.env.CLOUD_SQL_IP_TYPE as 'PUBLIC' | 'PRIVATE' | 'PSC' | undefined) === 'PRIVATE'
        ? IpAddressTypes.PRIVATE
        : IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  });

  const pool = new Pool({
    ...clientOpts,
    user: dbUser,
    database: dbName,
    max: Number(process.env.CLOUD_SQL_POOL_MAX ?? 5),
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function buildStandardPrisma(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function getOrInitConnectorClient(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return Promise.resolve(globalForPrisma.prisma);
  if (!globalForPrisma.prismaInitPromise) {
    globalForPrisma.prismaInitPromise = buildConnectorPrisma().then((c) => {
      globalForPrisma.prisma = c;
      return c;
    });
  }
  return globalForPrisma.prismaInitPromise;
}

// Proxy handler that defers all property access until the underlying
// PrismaClient has been initialised. Matches the two access patterns the
// codebase uses:
//   prisma.<model>.<method>(...)   → handled by the inner `get` trap
//   prisma.$<method>(...)          → handled by the inner `apply` trap
const lazyConnectorHandler: ProxyHandler<PrismaClient> = {
  get(_target, prop) {
    if (prop === 'then') return undefined; // never appear thenable
    if (typeof prop === 'symbol') return undefined;

    return new Proxy(function () {} as unknown as object, {
      apply: async (_t, _thisArg, args: unknown[]) => {
        const client = await getOrInitConnectorClient();
        const fn = (client as unknown as Record<string, unknown>)[prop as string];
        if (typeof fn !== 'function') {
          throw new TypeError(`prisma.${String(prop)} is not a function`);
        }
        return (fn as (...a: unknown[]) => unknown).apply(client, args);
      },
      get: (_t, methodProp) => {
        if (typeof methodProp === 'symbol') return undefined;
        return async (...args: unknown[]) => {
          const client = await getOrInitConnectorClient();
          const namespace = (client as unknown as Record<string, unknown>)[prop as string];
          if (!namespace || typeof namespace !== 'object') {
            throw new TypeError(`Unknown prisma namespace: ${String(prop)}`);
          }
          const fn = (namespace as Record<string, unknown>)[methodProp as string];
          if (typeof fn !== 'function') {
            throw new TypeError(`prisma.${String(prop)}.${String(methodProp)} is not a function`);
          }
          return (fn as (...a: unknown[]) => unknown).apply(namespace, args);
        };
      },
    });
  },
};

let exportedClient: PrismaClient;

if (useConnector) {
  // Connector branch: defer init until the first method call (must run
  // inside a request context to read the OIDC token from the request header).
  exportedClient = new Proxy({} as PrismaClient, lazyConnectorHandler);
} else {
  // Standard branch: eager init, identical to the original implementation.
  exportedClient = globalForPrisma.prisma ?? buildStandardPrisma();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = exportedClient;
}

export const prisma = exportedClient;
export default exportedClient;
