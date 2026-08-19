# preview/dev-full-app — standing Preview branch

This branch exists to hold a current Vercel Preview deployment of `main` for full-app testing against the dev database (all 13 module flags ON in dev per PROD_SIMPLIFICATION_PLAN.md §7).

**Why it is needed (defect workaround):** module-gated routes are statically pre-rendered at build time, so a runtime flag flip does NOT change their visibility until a redeploy — the guard verdict is baked into the build. Until Code fixes the gated layouts to render dynamically (registry issue raised 2026-08-11, see PR #1587 comments), re-push this branch (empty commit or bump the line below) after any dev flag change that must be reflected in Preview.

Last rebuild: 2026-08-11 · reason: dev DB refreshed from PROD (P2.5) + all module flags set ON.
