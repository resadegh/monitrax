/**
 * Prisma client factory.
 *
 * Two branches, selected by `USE_CLOUD_SQL_CONNECTOR`:
 *
 *  - **Standard branch (default, flag unset or `false`):**
 *    `PrismaClient` reads `DATABASE_URL` directly. Same behaviour as before
 *    this PR. Used in dev, in CI, and as the production fallback while
 *    Phase 9 of WIF is being verified.
 *
 *  - **Cloud SQL Connector branch (`USE_CLOUD_SQL_CONNECTOR=true`):**
 *    Authenticates to Cloud SQL via Workload Identity Federation (no
 *    long-lived password in the connection string). The Vercel runtime
 *    OIDC token (`VERCEL_OIDC_TOKEN`) is exchanged via STS for a
 *    short-lived GCP access token, which the Cloud SQL Connector uses to
 *    open a TLS tunnel to the instance. Postgres-level auth is IAM
 *    database authentication — the service account is a Cloud SQL IAM
 *    user with `CONNECT` + `USAGE` + table grants in the `public` schema.
 *
 * Required env vars when `USE_CLOUD_SQL_CONNECTOR=true`:
 *  - `GCP_WORKLOAD_IDENTITY_PROVIDER` — full resource path
 *    (`projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`)
 *  - `GCP_SERVICE_ACCOUNT_EMAIL` — SA to impersonate
 *  - `CLOUD_SQL_CONNECTION_NAME` — `<project>:<region>:<instance>`
 *  - `CLOUD_SQL_DB_USER` — Postgres username (for IAM auth this is the
 *    SA email with `.gserviceaccount.com` stripped, e.g.
 *    `vercel-monitrax-db@monitrax-479700.iam`)
 *  - `CLOUD_SQL_DB_NAME` — database name
 *  - `VERCEL_OIDC_TOKEN` — auto-injected by Vercel runtime when OIDC
 *    federation is enabled at the project level
 *
 * See `docs/operational/security/04_WIF_TROUBLESHOOTING.md` and
 * `docs/IMPLEMENTATION_PLAN.md` (Step 1a / WIF) for context.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const useConnector = process.env.USE_CLOUD_SQL_CONNECTOR === 'true';

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
  ] = await Promise.all([
    import('@google-cloud/cloud-sql-connector'),
    import('google-auth-library'),
    import('pg'),
    import('@prisma/adapter-pg'),
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
        const token = process.env.VERCEL_OIDC_TOKEN;
        if (!token) {
          throw new Error(
            'VERCEL_OIDC_TOKEN not set; ensure Vercel OIDC federation is enabled at the project level',
          );
        }
        return token;
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

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (useConnector ? await buildConnectorPrisma() : buildStandardPrisma());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
