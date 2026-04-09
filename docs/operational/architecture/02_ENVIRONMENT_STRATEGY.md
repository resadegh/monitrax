# Environment Strategy

Monitrax uses a 2-tier environment model: **Production** and **DEV/UAT**. This document covers how environments are structured, how to identify which one you are looking at, and the rules governing CDR data separation.

---

## Environment Summary

| Aspect | Production | DEV/UAT |
|--------|-----------|---------|
| Branch | `main` | Any non-main branch |
| URL | `monitrax.com.au` | `{branch-name}.vercel.app` or Vercel preview URL |
| Database | `monitrax-db-prod` (Cloud SQL) | `monitrax-db-dev` (Cloud SQL) |
| GCP Project | `monitrax-prod` | `monitrax-dev` |
| Cloud SQL Region | us-west1 (Oregon) | us-west1 (Oregon) |
| Real CDR data | Yes | **Never** -- synthetic/mock only |
| Firebase Auth | Shared project (same users across envs) | Shared project |
| Triggered by | Merge PR to `main` | Push to any non-main branch |

---

## How Vercel Environment Scoping Works

Vercel provides automatic environment separation. Every push triggers a build, but the environment variables injected depend on which branch was pushed.

### Branch-to-Deployment Mapping

```
main branch  ──push──>  Vercel Production Deployment
                         - Uses PROD env vars
                         - URL: monitrax.com.au
                         - Database: monitrax-db-prod

any other branch  ──push──>  Vercel Preview Deployment
                              - Uses DEV/UAT env vars
                              - URL: {branch-slug}.vercel.app
                              - Database: monitrax-db-dev
```

### Vercel Environment Variable Scoping

Vercel allows environment variables to be scoped to specific deployment contexts:

| Scope | When Applied | Typical Use |
|-------|-------------|-------------|
| **Production** | Builds from `main` branch only | Production database URL, production API keys |
| **Preview** | Builds from any non-main branch | Dev database URL, test API keys |
| **Development** | Local `vercel dev` only | Local overrides |

**Key environment variables that differ between environments:**

| Variable | Production | DEV/UAT |
|----------|-----------|---------|
| `DATABASE_URL` | Points to `monitrax-db-prod` | Points to `monitrax-db-dev` |
| `BASIQ_API_KEY` | Production Basiq key | Sandbox Basiq key (if configured) |
| `NEXT_PUBLIC_APP_URL` | `https://monitrax.com.au` | Preview URL |
| `NODE_ENV` | `production` | `production` (Vercel always builds in production mode) |

**Note:** Firebase Auth configuration (`NEXT_PUBLIC_FIREBASE_*` vars) is the same across both environments -- there is a single Firebase project shared by all deployments.

---

## How to Tell Which Environment You Are Looking At

### By URL

| Pattern | Environment |
|---------|-------------|
| `monitrax.com.au` | Production |
| `*.vercel.app` | DEV/UAT (Preview) |
| `localhost:3000` | Local development |

### By Vercel Dashboard

1. Go to the Vercel project dashboard
2. **Deployments** tab shows all deployments
3. Each deployment shows its branch name and environment label (`Production` vs `Preview`)
4. Click any deployment to see its URL, branch, build logs, and environment variables used

### By Database Content

- Production: Contains real user data and potentially real CDR data from connected banks
- DEV/UAT: Contains test/seed data only. Should never contain real CDR data

---

## Database Instance Mapping

Each environment has its own dedicated Cloud SQL instance. There is no shared database.

```
+-------------------+          +-------------------+
|  Vercel PROD      |          |  Vercel Preview   |
|  (main branch)    |          |  (all other)      |
+---------+---------+          +---------+---------+
          |                              |
          v                              v
+---------+---------+          +---------+---------+
| monitrax-db-prod  |          | monitrax-db-dev   |
| Cloud SQL (PROD)  |          | Cloud SQL (DEV)   |
| GCP: monitrax-prod|          | GCP: monitrax-dev |
+-------------------+          +-------------------+
```

| Property | Production | Development |
|----------|-----------|-------------|
| Instance name | `monitrax-db-prod` | `monitrax-db-dev` |
| GCP Project | `monitrax-prod` | `monitrax-dev` |
| PostgreSQL version | 15 | 15 |
| SSL | Required | Required |
| Region | us-west1 | us-west1 |

### Schema Parity

Both databases should have the same schema (83 Prisma models). Schema changes are applied manually -- see [Database Migrations](../deployment/03_DATABASE_MIGRATIONS.md).

**Important:** Schema changes must be applied to BOTH instances when ready. A schema change in dev does not automatically propagate to prod.

---

## CDR Data Separation Rules

The Consumer Data Right (CDR) imposes strict rules about where real financial data can exist.

### The Rules

| Rule | Detail |
|------|--------|
| Real CDR data exists **only** in production | No exceptions |
| DEV/UAT must use synthetic/mock data | Never seed dev with real bank account data |
| No real account numbers in dev | Even for testing, use fake data |
| No real transaction data in dev | Generate synthetic transactions for testing |
| Production DB not accessible from dev machines | Access only via GCP Console / IAM |

### What Counts as CDR Data

Any data received from a consumer's financial institution via Basiq:
- Account balances
- Transaction histories
- Account numbers and BSBs
- Loan details from connected banks
- Any data derived from the above (aggregations, scores, insights based on real bank data)

### Basiq Environment Separation

| Aspect | Production | DEV/UAT |
|--------|-----------|---------|
| API key | Production key | Sandbox key (if available) |
| Bank connections | Real bank connections | Test connections / mock data |
| Consent data | Real user consents | Test consents |

---

## Deployment Workflow Summary

```
Developer creates branch
       |
       v
Push to GitHub
       |
       v
Vercel auto-builds Preview (DEV/UAT)
       |
       v
Test on preview URL ({branch}.vercel.app)
       |
       v
Create Pull Request
       |
       v
Review + Merge to main
       |
       v
Vercel auto-builds Production (monitrax.com.au)
```

- There is no manual deployment step -- merging to `main` IS the production deployment
- Rollback = revert the merge commit or deploy a previous commit via Vercel dashboard
- Preview deployments are ephemeral -- each push to a branch creates a new one

---

## Firebase Auth: Shared Across Environments

Firebase Auth is a **single shared project** across all environments. This means:

- The same user accounts exist in both prod and dev
- A user who signs up on a preview deployment also exists in production
- MFA settings are shared
- OAuth provider configurations are shared

**Implications for support:**
- User account issues (locked out, MFA reset) affect all environments
- Firebase Auth changes in the GCP console apply globally
- There is no "dev-only" user in Firebase -- all users are real

---

## Common Support Scenarios

| Scenario | Action |
|----------|--------|
| "Is this production or dev?" | Check the URL: `monitrax.com.au` = prod, `*.vercel.app` = preview |
| "Preview shows old code" | Check if the branch has been pushed recently. Each push triggers a new build |
| "Dev database is empty" | Run seed scripts. Dev data is not persisted across schema resets |
| "CDR data appearing in dev" | This should not happen. Investigate immediately -- check `DATABASE_URL` env var in Vercel |
| "Schema mismatch between envs" | Apply pending schema changes to the lagging environment manually |

---

Last Updated: 2026-04-09
