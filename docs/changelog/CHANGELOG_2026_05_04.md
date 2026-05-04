# Changelog — 2026-05-04

## Session: claude/irp-wif-appendix-lS5cs (PR #600 — merged)

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

Surfaces changed:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new failure mode / diagnostic / lesson — formalising five existing modes into IRP framing)
- [ ] strategic decision

Docs updated:
- `docs/policy/INCIDENT_RESPONSE_PLAN.md` — version + §2 + §3 + §9 + new §10
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #6 closed, items renumbered, Recently Completed entry, Last-updated header
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file (above)

### Risk
- **Risk:** None. Docs-only change. No code path, no runtime behaviour, no schema, no infra.
- **Reversibility:** Trivial — single-PR revert restores prior IRP.

### PR
- Branch: `claude/irp-wif-appendix-lS5cs`
- PR URL: https://github.com/resadegh/monitrax/pull/600 (merged)

---

## Session: claude/phase-36-2a-loan-detail-dialog-lS5cs (PR #601)

### Changes Made
- **Type:** Refactor + Feature (UX)
- **Scope:** Phase 36 Phase 2a — extract `LoanDetailDialog` and wire it inline on `/dashboard/balances`
- **Description:** Closes the first sub-phase of Phase 36 Phase 2 (legacy `/dashboard/accounts` + `/dashboard/loans` retirement). The inline 6-tab loan detail dialog living in `app/dashboard/loans/page.tsx` (lines 633–963) is now a shared component at `components/loans/LoanDetailDialog.tsx`, mirroring the `AccountDetailDialog` pattern from Phase 1. Used on both the legacy loans page (replacing the inline — parity refactor) and on Balances (new — loan rows now open the dialog inline instead of navigating to `/dashboard/loans/{id}`).

### Why this matters
Phase 1 already did this for accounts: clicking an account row on Balances opens an inline dialog instead of forcing a redirect-then-second-click. Phase 2a extends the same pattern to loans, which closes the last "have to leave Balances to drill in" gap and unblocks Phase 2d (the actual route redirect). Per CLAUDE.md §12.2 (SSOT), this PR also pulls the dialog's calculations into the canonical `lib/utils/calculations.ts` and `lib/utils/frequencies.ts` helpers — the legacy page was duplicating `Math.max(0, principal - offset)` math and a hand-rolled frequency-to-annual switch.

### Files Modified
- `components/loans/LoanDetailDialog.tsx` (NEW, ~620 lines) — shared loan detail modal. 6 tabs (Overview / Property / Offset / Expenses / Strategy / Linked). Footer: Close + optional Delete (with AlertDialog two-step confirmation) + Edit. Self-contained `LoanDetail` + `LoanDetailExpense` types, structurally compatible with `/api/loans`. Calculations: `calculateEffectivePrincipal`, `calculateLVR`, `toAnnual` — all canonical SSOT. File-header JSDoc per CLAUDE.md §16.4.
- `app/dashboard/loans/page.tsx` — replaced the inline detail dialog with the new component (parity refactor; behaviour preserved end-to-end except Delete now uses the AlertDialog confirmation instead of `window.confirm()`). Removed dead helpers `convertToAnnual` + `calculateLinkedExpenses` (only used by the extracted dialog). Removed unused imports (`Dialog`, `Tabs`, `LinkedDataPanel`, `EntityStrategyTab`, `Lightbulb`, `Link2`).
- `app/dashboard/balances/page.tsx` — widened `LoanRow` type to carry every field the dialog needs (`isInterestOnly`, `termMonthsRemaining`, `minRepayment`, `repaymentFrequency`, `extraRepaymentCap`, `expenses`, `_links`/`_meta`, plus richer `property` and `offsetAccount` fields). All these fields are already returned by `/api/loans` — just declared. New state hooks: `editingLoan`, `detailLoan`, `loanDetailOpen`. New handlers: `openLoanDetail`, `openLoanEdit` (lazy-loads property + asset lookups same way `openLoanCreate` does), `handleDeleteLoan` (mirrors `handleDeleteAccount`). `LoanRowView` is now a `<button>` calling `onClick` instead of a `<Link>` redirecting to `/dashboard/loans/{id}`. `LoanFormDialog` `editing` prop now driven by `editingLoan` state (was hard-coded `null`); reset to create mode on close. `LoanDetailDialog` rendered at page level with full callbacks wired (edit / delete / GRDCS-linked-navigate).

### Files NOT modified (intentional)
- `lib/utils/calculations.ts` / `lib/utils/frequencies.ts` — canonical SSOT, used as-is per CLAUDE.md §12.2.
- `app/api/loans/route.ts` — no API contract change; the dialog consumes the existing response shape.
- `prisma/schema.prisma` — no schema change.
- Sidebar, sidebar `matchRoutes`, `BasiqHeroCard`, `DashboardEmptyStateGrid`, `SetupNextActionPanel` — left for Phase 2b / 2e (separate PR).

### Build Status
- [x] `npm run build` passes locally.
- [x] TypeScript compiles clean.

### Tests
- [x] Manual code-review: dialog mounts on legacy loans page (parity) and on Balances (new). Edit flow plumbs back to `LoanFormDialog` in edit mode. Delete flow uses AlertDialog confirmation, calls `/api/loans/{id}` DELETE, reloads list.
- [ ] Preview deploy: open Balances → click any loan row → verify all 6 tabs render with the same numbers as the legacy `/dashboard/loans` detail. Click Edit → verify the form opens populated. Confirm Delete → verify the loan disappears from the Cash + Debt sections.
- [ ] Preview deploy: open `/dashboard/loans` directly → confirm the dialog still renders identically (parity check — this is the safety net before Phase 2d redirects the route away).

### Doc-sync (CLAUDE.md §16)

Surfaces changed:
- [x] visual design system / component pattern (new shared component; per §16.4 file-header JSDoc + canonical pattern reference)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #4 reflowed with sub-phase status (2a ✅ shipped; 2c + 2e flagged no-op; 2b + 2d remain). Last-updated header rewritten. Recently Completed entry under 2026-05-04.
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file.
- File-header JSDoc on `components/loans/LoanDetailDialog.tsx` documents the design rules + SSOT mapping per CLAUDE.md §16.4.

Phase 36 spec (`docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md`) is left for the closing Phase 2d PR — that's where the route retirement is recorded.

### Risk
- **Risk:** Low.
- **Surfaces touched:** one shared component (new), two pages (one is being retired anyway, one is the migration target). API contract unchanged. Schema unchanged. Calculations now flow through canonical SSOT (was duplicated; now reuses `lib/utils/calculations.ts`).
- **Reversibility:** Trivial single-PR revert; the legacy inline dialog is preserved verbatim in git history if rollback is needed.
- **Behavioural delta:** Loan delete on the legacy page now uses an AlertDialog instead of `window.confirm()` — this is a UX upgrade matching the AccountDetailDialog pattern, not a regression.

### PR
- Branch: `claude/phase-36-2a-loan-detail-dialog-lS5cs`
- PR URL: https://github.com/resadegh/monitrax/pull/601

---

## Session: install-claude-skills-g5tYW (continuation — architect-mode revision)

### Changes Made
- **Type:** Refactor / governance enhancement (skill content)
- **Scope:** `.claude/skills/architect-mode/SKILL.md`
- **Description:** Revised the architect-mode skill to (1) add a 7th lens (Security & Compliance Consultant), (2) codify a decision-ready synthesis mandate so the seven lenses operate as internal cognitive work and the user-facing output is a single consolidated recommendation, (3) tighten the output structure to require a specific Next Best Action.

### Rationale

Reza explicitly clarified the operating contract on 2026-05-04:

> *"although I want you to view every change from multiple lenses of designer, architect, security consultant, human behaviour psych, I always need you to give me an informed, and consolidated feedback as well. I want you to help with making decisions based on that. write up this into your skills"*

Two gaps in the original architect-mode skill (PR #596) needed closing:

1. **Security as a first-class lens.** The original six lenses folded security under "architect" via §13 CDR references. For a CDR-regulated financial product approaching Basiq accreditation, security deserves its own explicit lens with an explicit set of "asks" (threat model, credential surface, privacy implications, log-leak vectors, environment separation). Now: 7th lens added with discipline-specific questions.
2. **Synthesis vs enumeration.** The original skill said "operate as six experts in parallel" but didn't explicitly forbid lens-by-lens output. In practice, multi-lens output ("From the financial-adviser lens... From the designer lens...") is homework, not synthesis — the user wants the answer that *emerges* from the lenses, not the lenses themselves. Now: explicit Synthesis section, 6th operating principle ("Consolidate, don't enumerate"), anti-pattern list, and a tightened output structure that requires a single Next Best Action with Implementation specific enough to act on without further clarification.

### Files Modified

- `.claude/skills/architect-mode/SKILL.md` —
  - YAML `description` updated: 787 → ~970 chars (within 1024 limit). Now names seven lenses + the synthesis mandate.
  - Lens table: added row 7 "Security & Compliance Consultant" with discipline-specific asks.
  - Closing sentence after lens table: "consult at least three of the six lenses" → "consult at least four of the seven lenses (and ALWAYS the security lens for any change touching data, auth, infra, or external integrations)".
  - Critical operating principles: added principle 6 — "Consolidate, don't enumerate" with the user's verbatim quote.
  - NEW section "Synthesis: how the lenses become an answer" — explicit mechanic for running the seven lenses internally, detecting agreement, arbitrating disagreement (architect lens), surfacing dissent only when load-bearing, producing decision-ready output. Anti-patterns enumerated. The "explicit fork" exception named.
  - "Output structure" section: tightened to require a single Next Best Action with Implementation specific enough to act on without further clarification.
  - "Relationship to existing CLAUDE.md governance" section updated to reflect: 7 lenses (was 6), Consolidate-don't-enumerate principle, Synthesis mechanic.

- `docs/IMPLEMENTATION_PLAN.md` — entry added under `✅ Recently Completed (2026-05-04)`.

- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block (third on the page).

### Documentation Updated

- `docs/IMPLEMENTATION_PLAN.md` ✅ (CLAUDE.md §15 SSOT)
- `docs/changelog/CHANGELOG_2026_05_04.md` ✅ (CLAUDE.md §11 daily changelog — this file)
- `CLAUDE.md` — **NOT modified.** The §0.4 cross-reference to architect-mode (added 2026-05-03 in PR #596) still applies; the skill behind it has been revised but the cross-reference itself doesn't need to change. The four-lens content in §0 stands; the skill remains a superset.

### Doc-sync (CLAUDE.md §16)

Surfaces changed:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture — *Strengthens posture (adds explicit security lens) but does not change CDR rules. Light yes; no canonical CDR docs need updating.*
- [x] operational procedure — *The skill is itself an operational procedure for design/architect decisions. Revising it = revising procedure.*
- [x] strategic decision (Open Question resolved / workstream parked or revived) — *Resolved a latent ambiguity about whether security was first-class or sub-architect, and codified the synthesis-output contract.*

Docs updated:
- `.claude/skills/architect-mode/SKILL.md` — the skill content itself (the doc and the procedure are the same artifact)
- `docs/IMPLEMENTATION_PLAN.md:✅ Recently Completed (2026-05-04)` — entry for the revision
- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block

### Testing
- [x] YAML frontmatter validates (`name` lowercase + hyphens, matches dir; `description` ~970 chars, within 1024 limit)
- [x] Skill body coherent — read end-to-end after edits; no orphan references to "six lenses"
- [x] No bundled scripts, no executable surface, no network calls — pure-instruction skill (LOW per skill-security-review methodology)
- [x] No conflicts with existing skills
- [x] Skill is project-scoped (`.claude/skills/architect-mode/`) — auto-triggers only in Monitrax sessions
- [ ] Trigger evaluation under future Monitrax sessions — pending production use

### PR
- Branch: `claude/install-claude-skills-g5tYW`
- PR URL: TBD on push (this is a follow-up to merged PRs #596 + #599)
- Status: Untracked → committed → pushed in this session

### Out-of-scope (this session, not this PR)

None. This PR is a focused revision to one skill plus the supporting docs the §16 protocol mandates.
