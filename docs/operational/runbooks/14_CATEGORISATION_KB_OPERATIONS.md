# Runbook 14 — Shared Categorisation KB Operations (Phase 52)

> **BAU operational reference for the shared categorisation knowledge base** (Phase 52).
> Covers the feature flags, the operator endpoints, monitoring, re-seeding, housekeeping, and
> troubleshooting. Design: `docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md`. Compliance:
> `docs/policy/CDR_KB_DEIDENTIFICATION_PROCEDURE.md`, `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`.

## 1. What it is (one paragraph)
A de-identified, cross-user knowledge base (`transaction_signatures` + private `signature_contributions`)
that the categoriser consults: **user mapping → rules → shared-KB prior → Gemini-on-miss → fallback**.
User confirmations write de-identified votes; a pattern graduates to a shared default at **k = 5 distinct
users**. Seeded with ~275 curated AU merchants. The shared table holds **no userId/amount/date** — only
merchant patterns + aggregate votes.

## 2. Feature flags (Vercel → monitrax → Settings → Environment Variables → Production)
| Flag | Default | Effect | Notes |
|---|---|---|---|
| `KB_WRITE_ENABLED` | `false` | confirmations write de-identified votes to the KB | enable only after the de-id procedure sign-off + privacy-PDF regen |
| `KB_READ_ENABLED` | `false` | categoriser consults the shared-KB prior | safe to enable with no data (returns null); useful once patterns graduate/seeded |
| `KB_GEMINI_ENABLED` | `false` | Gemini-on-miss runs for the unknown tail (cost) | leave off until you want the LLM tail; ~per-call cost |
| `CRON_SECRET` | (set) | bearer for the operator endpoints below | same secret as the CDR-lifecycle job |

**Flags are read at module load → an env change needs a REDEPLOY to take effect.** Rollback = set back to `false` + redeploy (no data loss).

## 3. Operator endpoints (auth: `Authorization: Bearer <CRON_SECRET>`)
| Endpoint | Method | Purpose | Cadence |
|---|---|---|---|
| `/api/categorisation/kb/seed` | POST | (re)load the curated AU merchant seed (idempotent) | once after deploy; re-run when the seed list grows |
| `/api/categorisation/kb/housekeeping` | POST | prune stale sub-k provisionals + return KB-health report | **weekly** via Cloud Scheduler |

Use the canonical host (`https://www.monitrax.com.au`) and **single-quote / variable** the secret to avoid shell mangling:
```bash
SECRET='<cron-secret>'
curl -X POST 'https://www.monitrax.com.au/api/categorisation/kb/seed' -H "Authorization: Bearer $SECRET"
curl -X POST 'https://www.monitrax.com.au/api/categorisation/kb/housekeeping' -H "Authorization: Bearer $SECRET"
```

## 4. Set up the weekly housekeeping job (GCP Cloud Scheduler) — operator TODO
```
gcloud scheduler jobs create http kb-housekeeping \
  --schedule="0 3 * * 0" --time-zone="Australia/Sydney" \
  --uri="https://www.monitrax.com.au/api/categorisation/kb/housekeeping" \
  --http-method=POST \
  --headers="Authorization=Bearer <CRON_SECRET>"
```

## 5. Monitoring (KB-health, from the housekeeping response)
`{ totalSignatures, globalSignatures, provisionalSignatures, prunedStaleProvisionals, ranAt }`.
- **`globalSignatures` rising** → the KB is graduating real patterns (good). Flip `KB_READ_ENABLED` on once > 0.
- **`totalSignatures` flattening while `globalSignatures` rises** → richer, not bloated (the goal).
- **`totalSignatures` growing ~linearly with transaction volume** → normalisation is leaking variants → tune the scrubber (see PHASE_52 §6b).

## 6. Re-seeding
The seed endpoint is idempotent (`createMany skipDuplicates`): existing patterns are skipped, new ones created. Re-run after any expansion of `lib/categorisation/kb/seedData.ts`. Expected shape: `{ total, created, skipped, rejected }` (rejected should be 0).

## 7. Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `Redirecting...` HTML from curl | apex→www redirect; `curl` drops auth on cross-host hop | use `https://www.monitrax.com.au` directly, or `curl -L --location-trusted` |
| `{"error":{"code":"UNAUTHORIZED"}}` | token ≠ `CRON_SECRET`, or shell mangled a special char | single-quote the secret / use a `SECRET=` variable; re-copy from Vercel (Production scope) |
| `CRON_SECRET not configured` (500) | env var missing in the running deployment | set it + redeploy |
| READ on but nothing categorising | no patterns graduated yet | seed (§3) and/or wait for ≥5-user graduation; check `globalSignatures` |

## 8. Compliance guardrails (do not bypass)
- The shared KB is **de-identified by construction** (no userId/amount/date); the PII-scrubber rejects transfers/PII before any write.
- **Never** feed Basiq/CDR enrichment output into the shared KB — CDR derived-data is consent/purpose-bound (see the de-id procedure + compliance matrix).
- Before enabling `KB_WRITE_ENABLED`: de-id procedure signed off + privacy-policy PDF (with §4.1) published.

---

Last Updated: 2026-06-22 — created for Phase 52 (shared categorisation KB) enablement + BAU.
