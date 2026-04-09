# Vercel Deployment

## Overview

Monitrax is deployed on Vercel as a Next.js 15.2.6 application. Vercel handles builds, hosting, serverless functions (API routes), and TLS. Production serves `monitrax.com.au` from the `main` branch. All other branches produce preview deployments.

---

## Project Configuration

| Setting | Value |
|---------|-------|
| Framework | Next.js (auto-detected) |
| Build Command | `prisma generate && next build` |
| Output Directory | `.next` (default) |
| Install Command | `npm install` (default) |
| Node.js Version | 18.x or 20.x (check Vercel project settings) |
| Root Directory | `/` (monorepo root) |
| Production Branch | `main` |
| Production Domain | `monitrax.com.au` |

---

## Environment Variables

Environment variables in Vercel are scoped to **Production**, **Preview**, or both. This is how the same codebase connects to different databases and services per environment.

| Variable | Scope | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Production | PROD PostgreSQL connection string (GCP Cloud SQL) |
| `DATABASE_URL` | Preview | DEV PostgreSQL connection string (GCP Cloud SQL) |
| `NEXT_PUBLIC_FIREBASE_*` | Both | Firebase Auth configuration (API key, auth domain, project ID, etc.) |
| `FIREBASE_ADMIN_*` | Both | Firebase Admin SDK credentials (service account) |
| `NEXT_PUBLIC_APP_URL` | Production | `https://monitrax.com.au` |
| `NEXT_PUBLIC_APP_URL` | Preview | Set per preview or omitted (uses relative URLs) |

**Important:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser bundle. Never put secrets in `NEXT_PUBLIC_` variables.

### How to Update Environment Variables

1. Go to Vercel Dashboard > Project > Settings > Environment Variables.
2. Add or edit the variable.
3. Select the correct scope (Production, Preview, or both).
4. Save. New deployments will pick up the change. Existing deployments are NOT affected -- you must redeploy for changes to take effect.

---

## Build Process

When Vercel receives a push, it runs:

```
npm install
prisma generate        # Generates Prisma Client from schema.prisma
next build             # Compiles Next.js app (pages, API routes, static assets)
```

The `prisma generate` step reads `prisma/schema.prisma` and generates the typed Prisma Client into `node_modules/.prisma/client`. This does NOT touch the database.

**CRITICAL:** The build process must NEVER run `prisma db push` or `prisma migrate deploy`. These commands modify the database schema and could destroy legacy tables. See `03_DATABASE_MIGRATIONS.md` for details.

---

## Firebase Auth Proxy (Rewrites)

Firebase Auth requires serving certain paths from the Firebase project domain. Vercel rewrites handle this transparently.

Configured in `next.config.js` (or `vercel.json`):

| Source Path | Destination |
|------------|-------------|
| `/__/auth/*` | `https://monitrax-479700.firebaseapp.com/__/auth/*` |

This allows Firebase Auth UI flows (email verification, password reset, OAuth callbacks) to work on the `monitrax.com.au` domain without CORS issues.

### Troubleshooting Firebase Auth Proxy

- If auth flows break after a Vercel config change, verify the rewrite rules are still present.
- Check that the Firebase project ID (`monitrax-479700`) is correct.
- Test by hitting `https://monitrax.com.au/__/auth/handler` directly -- it should return a Firebase response, not a 404.

---

## Health Check Endpoint

| Endpoint | Method | Expected Response |
|----------|--------|-------------------|
| `/api/health` | GET | `200 OK` with JSON body indicating service status |

Use this endpoint for:
- Post-deployment verification.
- Uptime monitoring (external services can poll this).
- Confirming the API layer is functional after a deploy.

---

## Preview URL Patterns

When a branch is pushed, Vercel creates a preview deployment. URLs follow these patterns:

| Pattern | Example |
|---------|---------|
| Branch-based | `{branch-name}-{vercel-project}.vercel.app` |
| Commit-based | `{project}-{hash}-{team}.vercel.app` |
| PR-based | Shown as a deployment check on the GitHub PR |

Slashes and special characters in branch names are converted to hyphens. Long branch names may be truncated.

---

## Manual Redeploy

To trigger a redeployment without pushing new code:

### Via Vercel Dashboard
1. Go to Vercel Dashboard > Project > Deployments.
2. Find the deployment you want to redeploy (or the latest on `main`).
3. Click the three-dot menu > **Redeploy**.
4. Optionally check "Redeploy with existing Build Cache" for faster builds, or uncheck to do a clean build.

### Via Vercel CLI
```bash
vercel --prod          # Redeploy production
vercel                 # Redeploy current branch as preview
```

### When to Redeploy
- After updating environment variables (existing deployments do not pick up new env vars).
- After a transient build failure (network issue during `npm install`, etc.).
- To refresh the build cache if stale dependencies are suspected.

---

## Rollback a Deployment

If a production deployment introduces a problem, roll back to the previous working deployment.

### Via Vercel Dashboard (Instant Rollback)
1. Go to Vercel Dashboard > Project > Deployments.
2. Find the last known good production deployment.
3. Click the three-dot menu > **Promote to Production**.
4. This instantly routes production traffic to the previous deployment. No rebuild required.

### Via Git Revert
```bash
git revert {bad-commit-hash}
git push origin main
```
Vercel will auto-deploy the revert commit. This is slower (requires a new build) but creates a clear audit trail in git history.

### Choosing Between Rollback Methods
- **Instant Rollback (Vercel):** Use for emergencies. Fast (seconds), but the bad code is still the latest commit on `main`. You must still revert in git afterward.
- **Git Revert:** Use for non-emergencies. Slower (minutes for build), but the git history is clean and the bad code is explicitly reverted.

---

## Viewing Deployment Logs

### Build Logs
1. Vercel Dashboard > Project > Deployments > select deployment.
2. Click **Building** or the build step to see the full build output.
3. Useful for diagnosing: TypeScript errors, Prisma generation failures, missing env vars.

### Function (Runtime) Logs
1. Vercel Dashboard > Project > Logs.
2. Filter by environment (Production / Preview), time range, status code, or path.
3. Shows `console.log`, `console.error`, and unhandled exceptions from API routes.
4. Useful for diagnosing: runtime errors, database connection issues, auth failures.

### Real-time Logs
```bash
vercel logs --follow
```
Streams logs in real-time from the Vercel CLI. Useful during active testing.

---

## Common Issues

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| Build fails with Prisma error | `prisma/schema.prisma` syntax error or missing `prisma generate` in build command | Fix schema, verify build command |
| 500 errors on API routes | Missing or incorrect environment variables (especially `DATABASE_URL`) | Check env var scoping in Vercel settings |
| Firebase auth not working | Rewrite rules missing or incorrect | Verify `/__/auth/*` rewrite in config |
| Preview works, production broken | Env vars differ between Production and Preview scopes | Compare env vars for both scopes |
| Old code still serving after merge | Deployment still in progress or cached | Wait for deployment to complete, or redeploy |

---

*Last Updated: 2026-04-09*
