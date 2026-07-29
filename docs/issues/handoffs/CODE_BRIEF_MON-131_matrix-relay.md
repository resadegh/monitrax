# CODE BRIEF — MON-131 Tranche −1b: the Matrix Relay (admin-side capture endpoints)

**Model: Fable 5. Branch off `main` (PR #1525 is now merged at `31abb65c`).**
**changesNumbers: NO.** Read-only endpoints. No money value is computed differently, stored, or displayed.

---

## §1 The problem this fixes

`scripts/matrix/golden-baseline.mjs` (PR #1525, Tranche −1) requires `DATABASE_URL` and therefore
must run from a terminal that can reach Cloud SQL. Neither the Matrix's cloud sandbox nor the
device bridge has network access to the database, so **every capture and every post-tranche diff
requires Reza to hand-run a command and paste the output back.**

MON-131 is a multi-tranche programme. Its control loop is *capture → migrate → diff → verify*, run
once per tranche, plus the full Number Ledger at completion. At the current arrangement that is
dozens of manual terminal round-trips. **That is the bottleneck, and it is a tooling gap, not a
process gap.**

The deployed app already reaches the database. The admin portal already exists, is live at
`https://www.monitrax.com.au/admin`, and already carries exactly this class of surface —
`app/api/admin/calc-audit/route.ts` runs the L1 differential against every registered calc engine
server-side and returns the report as JSON, behind `verifyAdminGCPAuth` + `hasPermission`.

**Do the same for the baseline and the census.** Then the Matrix captures over an authenticated
browser session and Reza's terminal leaves the loop permanently.

## §2 What to build

Three routes under a new `app/api/admin/matrix/` group, all modelled **exactly** on
`app/api/admin/calc-audit/route.ts` — same `isAdminPortalAccessible()` gate, same
`verifyAdminGCPAuth`, same `ADMIN_ERROR_CODES` shapes, same audit logging.

### 2.1 `GET /api/admin/matrix/golden-baseline`

Returns the capture that `scripts/matrix/golden-baseline.mjs` writes to disk, as the response body.

- **Refactor, do not duplicate.** Extract the `CAPTURES` table and the capture routine out of the
  `.mjs` script into `lib/matrix/goldenBaseline.ts`, exporting
  `captureGoldenBaseline(userId: string): Promise<BaselineTree>` and the `plain()` serializer.
  The script becomes a thin CLI wrapper over that module. **Adding a second capture implementation
  would be a MON-131 violation in the tool built to detect MON-131 violations.**
- Query params: `?userId=<id>` (defaults to the sole user, same resolution the script uses).
- Response: `{ sha, capturedAt, userId, tree }` — `sha` from `process.env.VERCEL_GIT_COMMIT_SHA`,
  falling back to the build-time SHA. **The SHA must be the deployed commit, not a git call** —
  there is no git in the Lambda.
- Permission: reuse `'audit:read'`.

### 2.2 `POST /api/admin/matrix/golden-baseline/diff`

Body: `{ baseline: <a previously captured tree>, expectedMoves?: [{pathPrefix, why, arithmetic}] }`.
Runs the script's existing `--diff` logic — same three outcomes, unchanged wording:
`unchanged` · `EXPECTED` · `MOVED-UNDECLARED`. Returns
`{ verdict: 'CLEAN' | 'EXPECTED_ONLY' | 'STOP', moves: [...] }`.
`verdict: 'STOP'` is a 200 with that body, **not** an HTTP error — the Matrix records the verdict.
Same refactor rule: the comparison logic moves to `lib/matrix/goldenBaseline.ts` and both the CLI
and the route call it.

### 2.3 `GET /api/admin/matrix/census`

Returns the current contents of `.audit/producer-census.json` and `.audit/source-lock-exceptions.json`
as JSON, plus their seeded totals. Static-file reads, no DB — this exists so the Matrix can read the
ratchet state at the deployed SHA without a checkout. If bundling the JSON is awkward under Next's
file tracing, `import` the JSON directly rather than reading from `process.cwd()`.

## §3 Explicitly out of scope

- **No user-facing variant.** HR-3 (`app/api/admin/calc-audit/route.ts:8-9`) forbids it and the
  same prohibition applies here verbatim — carry the comment across.
- **No write endpoints.** Nothing in this group mutates data, and nothing accepts a value to store.
  The Matrix reads; Reza clicks merges.
- **No new producer.** These routes call the existing orchestrators through the existing entry
  points. If a capture needs a number that no canonical producer exposes, that is a Phase A
  contract gap — record it, do not compute it here.

## §4 Verification

- The route's output for the same userId at the same SHA must be **byte-identical** to the CLI's
  `.audit/golden-baseline-<sha>.json` (minus the `capturedAt` field). Add a test that asserts both
  paths call the same module; a golden-file comparison is not required in CI (no DB).
- `census:producers:check`, `lint:source-lock`, `neomatrix:check`, `issues:check` green.
- Coverage boundary, stated in the PR: these routes verify that the Matrix can *reach* the capture;
  they do not verify that any captured number is correct. Correctness is Axis C of
  `docs/verification/PROTOCOL_NUMBER_LEDGER.md` and stays with the Matrix.

## §5 Neo-sync (§21.2.2)

Neomatrix re-pin for the extracted `lib/matrix/goldenBaseline.ts` module; NeoAudit gains the
route-vs-CLI parity test; changelog + `0·REF` workstream entry. Nothing sandbox-only.

## §6 Why this is worth a tranche slot

Every remaining MON-131 tranche is gated on a baseline diff. Building the relay once removes a
manual step from **every** subsequent tranche, from the completion Number Ledger, and from every
standing re-run thereafter. It is the difference between a programme Reza has to operate and one
the Matrix operates.

---
*Prepared by The Matrix, 2026-07-29. Depends on: PR #1525, merged at `31abb65c`.
Pattern source: `app/api/admin/calc-audit/route.ts`. Admin portal confirmed live and reachable at
`https://www.monitrax.com.au/admin/login`.*
