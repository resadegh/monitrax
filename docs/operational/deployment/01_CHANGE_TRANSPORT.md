# Change Transport Process

## Overview

All code changes in Monitrax follow a branch-based deployment pipeline. Vercel automatically deploys every push: preview branches deploy to DEV/UAT, and the `main` branch deploys to production. There is no manual deployment step beyond merging a pull request.

---

## Environments

| Environment | Branch | URL | Database |
|-------------|--------|-----|----------|
| **Production** | `main` | `monitrax.com.au` | PROD (GCP Cloud SQL) |
| **DEV/UAT (Preview)** | Any non-main branch | `{branch-name}.vercel.app` | DEV (GCP Cloud SQL) |

---

## Step-by-Step Workflow

### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b claude/{feature-name}-{session-suffix}
```

Branch naming convention: `claude/{feature-name}-{session-suffix}` for Claude Code sessions, or `feat/{feature-name}` / `fix/{bug-name}` for manual work.

### 2. Develop and Commit

- Make changes locally.
- Run `npm run build` and `npm run lint` before committing.
- Commit with descriptive messages following the format: `type(scope): description`.

### 3. Push to Remote

```bash
git push -u origin claude/{feature-name}-{session-suffix}
```

**What happens:** Vercel detects the push and automatically starts a preview deployment. This preview deployment uses the **Preview** environment variables, which point to the DEV database.

### 4. Verify Preview Deployment

1. Find the preview URL in the Vercel dashboard or GitHub PR checks. The URL pattern is `{branch-name}-{project}.vercel.app` or a unique hash-based URL.
2. Open the preview URL in a browser.
3. Hit the health check endpoint: `GET https://{preview-url}/api/health` -- confirm it returns a success response.
4. Manually test the changed functionality against the DEV database.
5. Confirm no regressions on core flows (login, dashboard load, financial data display).

### 5. Create a Pull Request

```bash
gh pr create --title "feat(scope): description" --body "Summary of changes..."
```

Or create via GitHub UI. The PR should target `main`.

### 6. Review the Pull Request

- Reviewer checks the code diff.
- Reviewer verifies the preview deployment works correctly.
- Vercel build status must be green (shown as a GitHub check).
- All documentation requirements from CLAUDE.md must be met (changelog, phase docs, etc.).

### 7. Merge to Main

Once approved, merge the PR into `main` (squash merge preferred for clean history).

**What happens:** Vercel detects the push to `main` and automatically starts a production deployment. This deployment uses the **Production** environment variables, which point to the PROD database.

### 8. Verify Production Deployment

1. Wait for the Vercel deployment to complete (watch the Vercel dashboard or GitHub deployment status).
2. Hit the production health check: `GET https://monitrax.com.au/api/health`.
3. Log in and verify the changed functionality works against the PROD database.
4. Check Vercel deployment logs for any runtime errors.

---

## Verification Checklist

After every production deployment, confirm:

- [ ] Health check returns success (`/api/health`)
- [ ] Login flow works (Firebase Auth)
- [ ] Dashboard loads without errors
- [ ] Changed feature works as expected
- [ ] No console errors in the browser
- [ ] Vercel function logs show no unexpected errors

---

## Troubleshooting

### Build Fails on Vercel

1. Check the Vercel build logs (Vercel Dashboard > Deployments > select deployment > Build Logs).
2. Common causes: TypeScript errors, missing environment variables, Prisma generation failure.
3. Fix locally, run `npm run build` to confirm, push again.

### Preview Works but Production Fails

1. Check that Production environment variables are correctly set in Vercel (they are scoped separately from Preview).
2. Verify the PROD database is accessible and has the required schema.
3. Check Vercel Function Logs for runtime errors.

### Deployment Succeeds but Feature is Broken

1. Check Vercel Function Logs for runtime errors.
2. Confirm the correct branch was merged (check the deployment commit hash).
3. If the issue is database-related, check whether a schema migration was required but not applied to PROD (see `03_DATABASE_MIGRATIONS.md`).

### Need to Revert

1. Revert the merge commit on `main`: `git revert {merge-commit-hash} && git push origin main`.
2. Vercel will auto-deploy the reverted state.
3. Alternatively, use Vercel's instant rollback feature (see `02_VERCEL_DEPLOYMENT.md`).

---

## Diagram

```
Developer Machine          GitHub                    Vercel
─────────────────       ─────────────            ─────────────
                                                  
git push branch  ──────► Branch pushed  ────────► Preview Deploy
                                                   (DEV DB)
                         PR created                   │
                         PR reviewed                  │
                         PR merged to main ─────► Production Deploy
                                                   (PROD DB)
```

---

*Last Updated: 2026-04-09*
