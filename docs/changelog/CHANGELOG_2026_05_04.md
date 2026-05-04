# Changelog — 2026-05-04

## Session: claude/irp-wif-appendix-lS5cs

### Changes Made
- **Type:** Docs / Policy
- **Scope:** `docs/policy/INCIDENT_RESPONSE_PLAN.md` (Appendix A — WIF & Cloud SQL Auth-Chain Failure Patterns)
- **Description:** Closes Up Next #6 — formally captured the five Phase 9 production-cutover failure patterns inside the Incident Response Plan so future on-call sessions can recognise the failure mode and reach for the matching runbook step (`04_WIF_TROUBLESHOOTING.md` §3.A–§3.K) instead of re-diagnosing from scratch. The runbook had the technical fixes; the IRP now has the incident-response framing (severity classification, rollback decision, post-incident scoping).

### Why this matters

When Production cut over from `DATABASE_URL` → WIF + Cloud SQL Connector + IAM DB auth on 2026-05-01, four distinct failure modes surfaced inside one day, plus a fifth (cold-start init wedge) was caught and patched late the same night. Each looked like "the database is down" from the user's side, but the root causes spanned five different layers of the auth chain. Without an IRP-side playbook, the next operator (or the next AI session) has to re-derive "is this a breach or an availability failure? do I roll back or forward-fix? does the OAIC NDB clock start?" — questions the runbook does not answer. This appendix answers them.

### Files Modified
- `docs/policy/INCIDENT_RESPONSE_PLAN.md` — version 1.0 → 1.1; added `Last revised: 2026-05-04` header line; §2 scope adds "WIF / Cloud SQL auth-chain failures" pointer to §10; §3 classification table adds "HIGH (Availability)" severity row for auth-chain failures (explicitly noting no data-breach implication); §9 References adds the WIF runbook + WIF compliance evidence pack; new §10 (Appendix A) — `Last Updated` footer rewritten.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #6 struck through and marked DONE (this PR); items 7→12 renumbered to 6→11; Last-updated header rewritten; new Recently Completed entry under 2026-05-04.

### What §10 contains
- **§10.1 Why this appendix exists** — incident-response framing for WIF auth-chain failures.
- **§10.2 The auth chain** — 6-step reference (Layer 1 OIDC token → Layer 6 schema authorisation) so operators identify the broken layer first.
- **§10.3 Observed failure patterns** — table of the five cutover modes:
  | # | Pattern | Layer | Runbook |
  |---|---|---|---|
  | 1 | OIDC token retrieval | 1 | §3.A |
  | 2 | mTLS handshake / TLS alert 42 | 4 | §3.G |
  | 3 | SCRAM no-password / SASL | 5 | §3.H |
  | 4 | Trailing-whitespace `28P01` on `CLOUD_SQL_DB_USER` | 5 | §3.J |
  | 5 | Cold-start init wedge (intermittent) | 4 init cache | §3.K |
- **§10.4 First-response playbook** — confirm layer → rollback vs forward-fix decision (with the documented `USE_CLOUD_SQL_CONNECTOR=false` rollback while Phase 11 fallback path still exists) → apply runbook step → verify (with cold-start retest reminder).
- **§10.5 CDR-containment escape-hatch** — for the unlikely overlap of availability failure + suspected breach: rollback flag + revoke SA Cloud SQL Client role + drop IAM DB user.
- **§10.6 Bounds** — explicitly NOT the runbook (operators in flight stay in `04_WIF_TROUBLESHOOTING.md`); explicitly NOT exhaustive — future failure modes append rows to §10.3.

### Build Status
- N/A — docs-only PR. No code changes.

### Tests
- N/A — docs-only PR.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new failure mode / diagnostic / lesson — formalising five existing modes into IRP framing)
- [ ] strategic decision

Docs updated in this PR:
- `docs/policy/INCIDENT_RESPONSE_PLAN.md` — version + §2 + §3 + §9 + new §10
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #6 closed, items renumbered, Recently Completed entry, Last-updated header
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file

### Risk
- **Risk:** None. Docs-only change. No code path, no runtime behaviour, no schema, no infra.
- **Reversibility:** Trivial — single-PR revert restores prior IRP.

### PR
- Branch: `claude/irp-wif-appendix-lS5cs`
- PR URL: (to be added after `mcp__github__create_pull_request`)
