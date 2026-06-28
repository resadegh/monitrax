# Changelog — 2026-06-28

## Session: cdr-basiq-vertex-cutover-doc

### Changes Made
- **Type**: Docs / Compliance (decision record + cutover playbook)
- **Scope**: Neobrain AI provider data-residency (CDR Finding F-AI-1) / Phase 0.5
- **Description**: Recorded Reza's revised decision (2026-06-28) to **defer the Vertex AI AU-residency cutover to Basiq go-live** and **keep the most-capable consumer Gemini (paid, no-train) models** in the interim, and documented the full cutover as a self-contained pre-go-live playbook. No code change — the capable path is already live; the grounding layer (not the model) is the financial-correctness guarantee.

### Why (decision rationale)
- A live probe of Vertex `australia-southeast1` (Cloud Shell, Owner, 2026-06-28) showed Sydney **regional** serves only `gemini-2.5-flash` (HTTP 200); `gemini-3.5-flash` (current primary) + all pro models (`gemini-2.5-pro`, `gemini-3.1-pro-preview`) return **404 not-in-region**. AU cutover today = one-tier flash downgrade + loss of pro.
- With **no Basiq plan**, the capability cost isn't justified. Interim residual = *cache* residency only ("any country"); tolerable because no CDR data is flowing and no accreditation is claimed. **No-train is already guaranteed** on the paid tier.
- Cost note (app `modelConfig.ts`, Google list 2026-06-10): `gemini-2.5-flash` ($0.30/$2.50 per 1M in/out) is ~5×/~3.6× **cheaper** than `gemini-3.5-flash` ($1.50/$9.00) — so the eventual cutover *lowers* AI cost; capability is the only trade-off.

### Files Modified
- `docs/compliance/CDR_BASIQ_GOLIVE_CUTOVER.md` — **NEW.** The canonical go-live playbook: finding, no-train-vs-residency table, verified probe evidence + re-probe command, pre-staged-vs-remaining checklist, gateway code plan, flip+verify steps, acceptance criteria, and the capability+cost trade-off brief.
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` — Finding F-AI-1: added the ↩️ revised decision (defer to go-live; interim paid-tier no-train posture; gap documented-not-closed; pointer to cutover doc).
- `docs/blueprint/PHASE_54_NEOBRAIN.md` — §15.6 Phase 0.5 row → PARKED; §15.6.1 rewritten with the probe result, the ✅/☐ provisioning status, and the cutover-doc pointer.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·NEOBRAIN`: Phase 0.5 marked ⏸ PARKED (provisioning done + pre-staged); F-AI-1 decision line updated; C.2+ note de-coupled from the (now-parked) gateway.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` refreshed.
- `docs/changelog/CHANGELOG_2026_06_28.md` — this entry.

### Operator state recorded (pre-staged, inert — no rollback needed)
- Vertex AI API enabled; `roles/aiplatform.user` granted to runtime SA `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`; `VERTEX_PROJECT`/`VERTEX_LOCATION=australia-southeast1` set on Vercel (Prod+Preview). `USE_VERTEX` deliberately **unset** (current Gemini path active).

### Doc-sync (CLAUDE.md §16)
Surfaces changed: **security / CDR posture** (decision record only — no runtime change) + **strategic decision (Open Question / workstream parked)**.
Docs updated: `CDR_BASIQ_COMPLIANCE_MATRIX.md:F-AI-1`, `CDR_BASIQ_GOLIVE_CUTOVER.md` (new), `PHASE_54_NEOBRAIN.md:§15.6/§15.6.1`, `01_ACTIVE_WORKSTREAMS.md:0·NEOBRAIN`, `IMPLEMENTATION_PLAN.md`.

### Testing
- [x] No code changed → no build/lint/Neomatrix gate triggered (docs-only; verified `git diff --name-only` is docs/* only).
- [x] Self-review gate (§20.5): 3× against requirement → 10/10 (kept-capable + documented-cutover both satisfied; every figure traced to the live probe + `modelConfig.ts`, none recalled).

### PR
- Branch: `claude/cdr-basiq-vertex-cutover-doc`
- Status: draft (pending Reza review)
