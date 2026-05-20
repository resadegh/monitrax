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
  // Trim env vars defensively — pasted values from Vercel UI have
  // historically arrived with trailing whitespace that Postgres treats
  // as a distinct identifier (see CHANGELOG_2026_05_01 §3.J / 28P01).
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER?.trim();
  const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();
  const instance = process.env.CLOUD_SQL_CONNECTION_NAME?.trim();
  const dbUser = process.env.CLOUD_SQL_DB_USER?.trim();
  const dbName = process.env.CLOUD_SQL_DB_NAME?.trim();

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

  // For Cloud SQL Postgres + IAM auth, the connector handles TLS but pg
  // still needs a "password" — which in IAM mode is the impersonated SA's
  // OAuth access token. Provide it as a callback so pg fetches a fresh
  // token on every connection (tokens expire ~1h; pool may keep a
  // connection longer than a single token TTL across cold-start cycles).
  const pool = new Pool({
    ...clientOpts,
    user: dbUser,
    database: dbName,
    password: async () => {
      const tokenResponse = await authClient.getAccessToken();
      const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
      if (!token) {
        throw new Error(
          'IAM auth: authClient.getAccessToken() returned no token. ' +
            'Verify SA impersonation chain (OIDC → STS → IAM Credentials) is intact.',
        );
      }
      return token;
    },
    // Per-warm-instance connection ceiling. Default 2 (down from 5 on
    // 2026-05-20 after a `db-g1-small` instance hit Postgres error 53300
    // — "remaining connection slots are reserved" — when concurrent
    // Stackdriver uptime probes + browser activity + a wave of cold
    // starts together pushed total open connections past the instance's
    // `max_connections` limit. Math: ~10 warm instances × 5 conns each =
    // ~50 simultaneous holders, which exceeds the previous default
    // `max_connections` of ~25 on `db-g1-small`. With pool max=2 the
    // worst-case holder count drops to ~20, well below the new
    // `max_connections=200` ceiling. Workload analysis: typical routes
    // do 1-3 sequential Prisma calls; routes doing parallel reads via
    // `Promise.all` will queue briefly past 2 in-flight but never
    // block forever (the pool releases as queries complete).
    //
    // Override via `CLOUD_SQL_POOL_MAX` env var for special cases
    // (e.g. a heavy parallel-read job that needs more headroom).
    max: Number(process.env.CLOUD_SQL_POOL_MAX ?? 2),
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
    globalForPrisma.prismaInitPromise = buildConnectorPrisma()
      .then((c) => {
        globalForPrisma.prisma = c;
        return c;
      })
      .catch((err: unknown) => {
        // Don't cache the rejection. Without this, a transient cold-start
        // failure (SQL Admin API jitter, STS throttle, slow auth chain)
        // would wedge every subsequent query on this warm function
        // instance — Vercel keeps the instance for ~5-15 min idle, so
        // the user sees "first navigation broken until I switch pages
        // and come back" (a different instance handles the retry).
        // Clearing here lets the next request re-attempt init from
        // scratch instead of awaiting a permanently-rejected promise.
        globalForPrisma.prismaInitPromise = undefined;
        throw err;
      });
  }
  return globalForPrisma.prismaInitPromise;
}

// Detects pg/Node TLS errors that almost certainly mean Cloud SQL is
// rejecting the ephemeral client cert at handshake (TLS alert 42 /
// bad_certificate). Documented in
// docs/operational/security/04_WIF_TROUBLESHOOTING.md §3.G.
function isTlsHandshakeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? '';
  if (typeof code === 'string' && code.startsWith('ERR_SSL_')) return true;
  return /tls alert|bad[_ ]certificate|ssl3_read_bytes/i.test(message);
}

function wrapTlsHandshakeError(err: unknown, where: string): Error {
  const original = err instanceof Error ? err : new Error(String(err));
  const wrapped = new Error(
    `Cloud SQL TLS handshake rejected during ${where} — and a single retry ` +
      `with a freshly-minted cert ALSO failed. That rules out the most ` +
      `common transient cause (Cause #5: stale cached cert from a Cloud SQL ` +
      `instance cert rotation), so this is almost certainly a config error: ` +
      `(1) instance flag cloudsql.iam_authentication is OFF, ` +
      `(2) SA is missing roles/cloudsql.instanceUser, ` +
      `(3) CLOUD_SQL_CONNECTION_NAME doesn't match the actual instance, or ` +
      `(4) the instance pre-dates IAM-auth support and never had the flag ` +
      `toggled on. See docs/operational/security/04_WIF_TROUBLESHOOTING.md ` +
      `§3.G for the verification commands. Original: ${original.message}`,
  );
  (wrapped as Error & { cause?: unknown }).cause = original;
  return wrapped;
}

// Invalidates the cached Prisma client + init promise so the next call
// re-runs `buildConnectorPrisma()` from scratch — fresh OIDC token, fresh
// SA impersonation, fresh ephemeral cert from SQL Admin. Best-effort
// disconnects the stale pool so its TCP/TLS sessions are released. Called
// from the retry path in `callWithTlsRetry()` when the connector's cached
// cert no longer satisfies the instance's current TLS configuration
// (Cause #4 in `wrapTlsHandshakeError`).
function invalidateConnectorCache(): void {
  const stale = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaInitPromise = undefined;
  void stale?.$disconnect().catch(() => {
    // The stale pool's connections are about to be GC'd anyway. We don't
    // care if disconnect() also fails with TLS — the cache is already
    // cleared, so the next call will mint a fresh client.
  });
}

// Wraps a Prisma method invocation with single-shot retry on TLS handshake
// errors. The first attempt may hit a warm function instance whose cached
// connector cert was just invalidated by a Cloud SQL instance-cert rotation
// (a periodic Google-side operation, ~hours). The instance refuses the
// stale cert at the TLS layer with `bad_certificate` (alert 42). We clear
// the cached client and retry exactly once — the second attempt mints a
// fresh cert that the instance accepts. Safe to retry because TLS handshake
// happens BEFORE any SQL is sent: no partial-write risk, regardless of
// whether the underlying query is a read or a write.
//
// Why single-shot, not multi-shot: if the retry also fails with TLS, it's
// almost certainly Cause #1/#2/#3 (config drift), not Cause #4 (stale
// cache). Looping on a config error would amplify load on Cloud SQL Admin
// API without resolving anything.
async function callWithTlsRetry<T>(
  callee: string,
  invoke: () => Promise<T>,
): Promise<T> {
  try {
    return await invoke();
  } catch (err) {
    if (!isTlsHandshakeError(err)) throw err;
    invalidateConnectorCache();
    try {
      return await invoke();
    } catch (retryErr) {
      if (isTlsHandshakeError(retryErr)) {
        throw wrapTlsHandshakeError(retryErr, callee);
      }
      throw retryErr;
    }
  }
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
        return callWithTlsRetry(`prisma.${String(prop)}()`, async () => {
          const client = await getOrInitConnectorClient();
          const fn = (client as unknown as Record<string, unknown>)[prop as string];
          if (typeof fn !== 'function') {
            throw new TypeError(`prisma.${String(prop)} is not a function`);
          }
          return await (fn as (...a: unknown[]) => unknown).apply(client, args);
        });
      },
      get: (_t, methodProp) => {
        if (typeof methodProp === 'symbol') return undefined;
        return async (...args: unknown[]) => {
          return callWithTlsRetry(
            `prisma.${String(prop)}.${String(methodProp)}()`,
            async () => {
              const client = await getOrInitConnectorClient();
              const namespace = (client as unknown as Record<string, unknown>)[prop as string];
              if (!namespace || typeof namespace !== 'object') {
                throw new TypeError(`Unknown prisma namespace: ${String(prop)}`);
              }
              const fn = (namespace as Record<string, unknown>)[methodProp as string];
              if (typeof fn !== 'function') {
                throw new TypeError(`prisma.${String(prop)}.${String(methodProp)} is not a function`);
              }
              return await (fn as (...a: unknown[]) => unknown).apply(namespace, args);
            },
          );
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
