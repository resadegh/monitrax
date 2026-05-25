# 13 — Legal document version-bump playbook

**Owner:** Reza (operator) + Counsel (content review)
**Date:** 2026-05-24
**Status:** ACTIVE
**Phase:** 47 PR 3 closeout

---

## When to use this runbook

Run this playbook whenever you need to publish a **material change** to any of the three mandatory consumer-facing legal documents:

- `docs/legal/terms-of-service.md`
- `docs/legal/privacy-policy.md`
- `docs/legal/afsl-credit-tax-boundary-disclosure.md`

A "material change" is anything that:

- Adds, removes, or substantively rewords a clause that affects user obligations or rights
- Changes the way personal information is collected, used, or disclosed (Privacy Act APP 1.4 trigger)
- Changes the licensing posture (AFSL / NCCP / TASA boundary statement)
- Updates contact details, governing law, or dispute-resolution pathway
- Adds or removes a data processor or overseas-disclosure recipient
- Counsel says it's material

Non-material changes (typo fixes, formatting, broken-link repairs, the same clause restated more clearly with no change in meaning) **do not require a version bump**. Just edit the markdown and ship.

When in doubt, bump.

---

## The two-paragraph version of how this works

Each legal document carries a `version: vX.Y-YYYY-MM-DD` field in its YAML frontmatter. The `lib/legal/content.ts` loader reads that field. The `POST /api/auth/consent` endpoint pins the version the user accepted into the `user_consents.documentVersion` column. The `GET /api/auth/consent/status` endpoint compares each user's latest non-revoked version against the current frontmatter version; if any of the mandatory three differ, it returns `requiresConsent: true`.

The `<ConsentMigrationModal />` mounted in `DashboardLayout` (Phase 47 PR 2) fires on `requiresConsent: true` and forces re-acceptance before the user can use `/dashboard/*`. **All you have to do is bump the frontmatter `version` field and redeploy.** The modal does the rest, idempotently, audit-trailed, and version-pinned per user.

---

## Step-by-step playbook

### 1. Edit the document

Open the markdown file under `docs/legal/`. Make the change.

### 2. Bump the frontmatter `version` field

Frontmatter looks like:

```yaml
---
title: Privacy Policy
slug: privacy-policy
version: v0.1-draft-2026-05-24
effectiveFrom: 2026-05-24
status: DRAFT
audience: public
summary: How Monitrax collects, uses, stores, and protects your personal information.
---
```

Choose a new `version` string following this convention:

| Change scope | Version bump | Example |
|---|---|---|
| Patch — clarification within an existing clause, no new obligation | `v1.0.1-YYYY-MM-DD` | `v1.0 → v1.0.1` |
| Minor — added/changed a clause, no fundamental restructure | `v1.1-YYYY-MM-DD` | `v1.0 → v1.1` |
| Major — restructure, new sections, materially different obligations | `v2.0-YYYY-MM-DD` | `v1.5 → v2.0` |
| Draft → published | drop the `-draft` suffix | `v0.1-draft-2026-05-24 → v1.0-2026-06-15` |

**Also update `effectiveFrom`** to the date the new version takes effect (typically the day of deploy, or a future date if there is a notice period).

**And update the `Effective from:` line at the top of the body** to match.

### 3. Counsel review (mandatory for material changes)

Send the diff to your AU fintech lawyer. Wait for sign-off. Apply any requested edits. Bump the `version` field again **only if** counsel changes substantive content (their formatting/wording polish doesn't require another bump within the same review cycle).

### 4. Update the operational record

Append a row to `docs/IMPLEMENTATION_PLAN.md` § Recently Completed, e.g.:

> 2026-08-12 — Privacy Policy bumped v1.0 → v1.1 (added CDR Representative arrangement disclosure under Basiq; counsel-reviewed by [firm], engagement #XYZ). Migration modal will re-prompt every existing user on next dashboard load.

If the change affects CDR posture, also update `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`.

### 5. Commit + deploy

Single PR. Title: `docs(legal): bump <doc-slug> to <new-version>`. Body should include:

- What changed (bullet points)
- Why it changed (regulator change / operational change / counsel advice / etc.)
- Counsel sign-off note + reference
- Expected user impact ("All existing users will see the migration modal on next dashboard load.")

Once merged, Vercel deploys. The modal fires automatically for every user whose latest accepted version no longer matches.

### 6. No notification email is needed UNLESS:

- The change affects CDR data handling (then notify by email under CDR Privacy Safeguard 5)
- The change is a Privacy Act APP 1.4 trigger (then notify per APP 5)
- Counsel says you need to notify

When notification is required, draft and send via the same channel used for transactional emails (Resend). Reference: `docs/operational/runbooks/11_EMAIL_NOTIFICATIONS_AUDIT.md`.

### 7. Verify after deploy

- Sign in as a test user (any user that already had consent on the prior version).
- The migration modal should appear immediately on `/dashboard`.
- Tick the bundle, click Accept.
- Modal closes. `user_consents` table has a new row with the new `documentVersion`. `audit_logs` has a `CONSENT_<TYPE>_ACCEPTED` row with `consentSource: 'EXISTING_USER_MIGRATION'` and metadata `documentVersion: <new>`.

If the modal does NOT appear, the most likely cause is that the loader is caching the prior version (Next.js static-generation cache). Re-deploy via Vercel; the build re-reads `docs/legal/*.md`.

---

## What NOT to do

- **Never edit a published document without bumping the version.** That silently shifts the meaning of the consent that existing users already gave — exactly the trap CDR Privacy Safeguard 5 + Privacy Act APP 5 are designed to prevent.
- **Never reset or delete a `user_consents` row.** History is the audit trail. If a user wants their record removed, that's the right-to-erasure path (User.deletionRequestedAt → 30-day grace → CDR data lifecycle).
- **Never bypass the modal.** If a user reaches `/dashboard` without current consent, the modal must fire. Don't add escape hatches.
- **Never bump the version on the AFSL document without counsel re-review** — the AFSL boundary is the most regulator-sensitive doc and the cheapest place to accidentally shift from "general information" framing to "personal advice" framing.

---

## Related

- `docs/legal/*.md` — the documents themselves
- `lib/legal/content.ts` — the loader (`getCurrentDocumentVersion()`)
- `app/api/auth/consent/route.ts` — POST endpoint (signup + migration + opt-in)
- `app/api/auth/consent/status/route.ts` — GET endpoint (drives the modal)
- `app/api/auth/consent/revoke/route.ts` — POST endpoint (marketing only)
- `app/api/auth/consent/record/route.ts` — GET endpoint (Privacy Act APP 12 download)
- `components/auth/ConsentMigrationModal.tsx` — the modal mounted in `DashboardLayout`
- `app/dashboard/settings/legal/page.tsx` — user-facing consent state surface
- `CLAUDE.md` §13 (CDR), §13.3 (audit everything), §16 (doc-sync)
