# Launch Program — 31 July 2026 (Friendlies Beta + Broker Outbound)

> **Status:** ACTIVE · **Owner:** Reza (decisions) + The Matrix / Claude (execution) · **Created:** 2026-07-15 (Cowork)
> **Scope decision (Reza, 2026-07-15):** 31 July = **friendlies private beta + broker outbound Phase 2 live + $197 Review sellable to friendlies.**
> Explicitly OUT of scope: Basiq/bank feeds (MRR-gated, Q-BASIQ-1 parked), Stripe live-mode (parked), Reviews to strangers (lawyer-gated, Q-GTM-5), mobile app (design phase), consumer-scale public signup.
> **SSOT note:** this doc is a POINTER/gate plan only. Status truth lives in the implementation-plan spokes + `docs/issues/ISSUES.json`; GTM detail in `docs/marketing/GTM_EXECUTION_PLAN.md` + `docs/marketing/gtm/*`. Nothing here duplicates those — on conflict, they win.

## Gate sequence

| # | Gate | Owner | Truth source | Target |
|---|------|-------|--------------|--------|
| G1 | Rectification clusters ①–⑥ VERIFIED (per-fix Ring-3, FIX_PROTOCOL) | Claude (fix) + Reza (merge/verify) | `docs/issues/ISSUES.json` + RECTIFICATION_PLAN_2026-07-14 §4 | rolling, wk1–2 |
| G2 | Remaining DIAGNOSED/OPEN MON issues dispositioned (fix or accepted-known) | Claude + Reza | `docs/issues/ISSUES.json` | wk2 |
| G3 | `playwright (UAT)` armed as required check on main | Reza (repo-admin step) | `.github` ruleset | wk2 |
| G4 | Full VR run green vs baseline (no unexplained deltas) | Claude (brief) + Reza (Chrome relay) | `docs/verification/runs/` + `baselines/BASELINE.md` | wk2–3 |
| G5 | AFSL/CDR user-facing language sweep (CLAUDE.md Part 13 + boundary doc) | Claude | `docs/legal/afsl-credit-tax-boundary-disclosure.md` | wk3 |
| G6 | Friendlies cohort named (Q-GTM-7) + invites sent per playbook | **Reza** (cohort) + Claude (prep) | `docs/marketing/gtm/FRIENDLIES_INVITE_PLAYBOOK.md` | wk3 |
| G7 | Broker outbound Phase 2 live (try-monitrax.com sequences) | Reza + Claude | `docs/marketing/GTM_EXECUTION_PLAN.md` Phase 2 | wk3–4 |
| G8 | $197 Review deliverable to friendlies (scope per REVIEW_SCOPE_AND_BOUNDARIES — friendlies OK pre-lawyer) | Reza | `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` | wk4 |
| G9 | Go/no-go review | **Reza** | this doc + Release Scorecard (`neoaudit:scorecard`) | 30–31 Jul |

## Standing risks / decisions still open
Q-GTM-7 (blocks G6) · Q-GTM-5 lawyer (post-launch path to strangers) · Q-GTM-4 VA timing · dependabot major bumps (recommend PARK) · GCS prod provisioning state (needs live verify) · HECS PAYG gap + CFO placeholder metrics (registered as issues — disposition before G5).

## Update rule
Gate status changes are recorded here in the same PR as the work that moves them (CLAUDE.md §15.3). Session cursor stays in STATE.md §C.
