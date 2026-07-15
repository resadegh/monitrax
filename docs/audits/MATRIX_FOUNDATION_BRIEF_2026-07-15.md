# THE MATRIX — Foundation Brief (ingestion record, 2026-07-15)

> **Session:** Cowork ("The Matrix" HQ) · Pinned HEAD `38abeee` (merge of #1416, 2026-07-15)
> **What this is:** the verified comprehension ledger produced by the full-repo ingestion (six parallel deep
> reviews) that preceded The Matrix HQ build. Kept in `docs/audits/` as a point-in-time record — statuses
> below are AS OF the pinned HEAD; live truth is always STATE.md + the implementation-plan spokes +
> `docs/issues/ISSUES.json` (SSOT, §12.2.1 — on conflict, they win).
> **Rule zero (standing, every session): never guess, assume, or hallucinate.** Coverage is a build output,
> never a claim (CLAUDE.md §22.2.4); correctness is evidenced by VR runs (§23.2.5).

---

## 1. WHAT MONITRAX IS (verified)

- AI-driven **Australian Wealth Operating System** (monitrax.com.au) — property, loans, super,
  investments, cashflow, tax, entity structures in one picture (MASTER_BLUEPRINT §1; STATE.md §A).
- Built by Reza under **ReNew Holding Company Pty Ltd, ACN 675 267 311**.
- **Hard regulatory boundary:** software only — no AFSL, no Credit Licence, no tax-agent
  registration. No product advice, no credit assistance, no tax agent services
  (`docs/legal/afsl-credit-tax-boundary-disclosure.md` v1.0 §3–14).
- Organised on the **TRAIL** framework (CLAUDE.md Part 14); design SSOT = Stitch
  (`docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md`).

## 2. THE STACK (verified from source at pinned HEAD)

| Layer | Fact | Source |
|---|---|---|
| Framework | Next.js 15.5.19, React 19, TS 5, App Router | package.json |
| Data | Prisma 5.22 → PostgreSQL on GCP Cloud SQL `australia-southeast1`, WIF keyless | package.json; docs/architecture/09 §5.3 |
| Hosting | Vercel | docs/architecture/09 |
| Auth | Firebase Auth + MFA/passkeys | package.json; schema |
| Storage | GCS keyless (WIF) designed; prod bucket provisioning state needs live re-verification (doc conflict flagged) | arch doc vs pre-refresh STATE.md |
| Scale | 135 Prisma models · 354 API routes · 145 pages · 264 test files | schema.prisma; app/; tests/ |
| Build gate | `vercel-build`: lint:financial-surfaces → lint:ai-grounding → neomatrix:check → migrate → build | package.json |
| AI | Gemini-only since #1323; Vertex AU cutover deferred (F-AI-1) | changelog 07-01; GOLIVE_CUTOVER §4 |

## 3. THE NEO FAMILY (the governance machine)

- **Neomatrix (Phase 53) — the MAP.** `docs/financial-logic/graph/financial-graph.json`: 262 nodes /
  347 edges all verified; L0 structural graph over 1092 files; 145 semantic engines, 83 proven via
  calc-audit (FULL_ALIGNMENT_AUDIT 2026-07-14 §1). Build-gated (`neomatrix:check`). Explorer at
  `/admin/neomatrix`. **Neomatrix-FIRST comprehension is law** (§21.5).
- **NeoBrain (Phase 54) — the PERCEPTION.** "Neobrain perceives; the Neomatrix calculates."
  Implemented: `lib/neobrain/` factPack, grounding validator, narrative-figure verifier, debt
  projections; `lint:ai-grounding` build gate live. Factual-grounding-layer design signed off, build
  not started (01_ACTIVE_WORKSTREAMS 0·NEOBRAIN).
- **NeoAudit (Part 23) — the PROOF.** Four rings (R0 fixtures → R1 wiring/SSOT → R2 Golden Household
  → R3 real-data Chrome). Core build COMPLETE 2026-07-14; standing/LIVE — coverage only grows
  (§23.2.6). Runs VR-001→VR-006; accepted baseline VR-006 (`baselines/BASELINE.md`). VR-005 file
  absent (gap noted).
- **Neo Inventory (Part 22) — the DENOMINATOR.** `calcEngineRegistry` = the one inventory
  (36 registered engines / 45 fixtures counted from source; larger published figures are
  semantic-graph counts). NI-0/1/2 shipped; NEO_INVENTORY.md header still "awaiting Reza sign-off".
- **FIX_PROTOCOL.md (Part 24)** — the per-issue pipeline; extended 2026-07-15 by Reza to the
  ten-step loop with mandatory **Model** (Neomatrix same-PR, §21.2.1) and **Promote**
  (grow NeoAudit + update the Chrome brief, §23.2.6) stages.

## 4. PROGRAM POSITION (as of pinned HEAD — live truth: ISSUES.json + spokes)

- Registry: 50 MON issues at pin (32 FIXING · 9 VERIFIED · 4 DIAGNOSED · 2 OPEN · 2 CLOSED ·
  1 RETRACTED) + MON-051/052 raised by this ingestion (registered in the same PR as this brief).
- RECTIFICATION_PLAN_2026-07-14: DECISIONS 1 & 2 ✅ DECIDED (Reza 2026-07-14); **rectify GO given
  2026-07-15** (cluster ① MON-037 first — re-read registry before starting).
- Open PRs at pin: #986, #963, #910, #907 + 6 dependabot MAJOR bumps (#811–#816) — recommend PARK
  pre-launch.

## 5. COMMERCIAL & COMPLIANCE POSITION (verified)

- **GTM is B2B-first:** brokers (Finsure-aggregated) via `try-monitrax.com` outbound; paid Financial
  Health Review AU$197; consumer subs post-Basiq (GTM_EXECUTION_PLAN; Q-GTM-3 DECIDED per
  BROKER_ICP.md, drift reconciled in #1417).
- **Basiq/CDR parked** (MRR-gated; GOLIVE_CUTOVER "PARKED"; readiness ~65–72%; F-AI-1 Vertex AU
  residency + pen test + insurance are hard pre-conditions).
- **Monetisation built but parked:** Stripe billing real (Studio $199/Practice $599) — test-mode;
  live-mode PROD-deferred; entitlements dormant.
- **Legal docs final v1.0**; Reviews to strangers blocked pending fintech-lawyer sign-off (Q-GTM-5).
- **Launch decision (Reza 2026-07-15): 31 July = friendlies beta + broker outbound** —
  gates in `docs/operational/LAUNCH_PROGRAM_2026-07.md`.

## 6. DRIFT & DEFECTS FOUND BY THE INGESTION (disposition)

1. STATE.md cursor ~250 PRs stale → **FIXED** (#1417).
2. Q-GTM-3 doc drift → **FIXED** (#1417).
3. Infra doc 09 stale top table → open (flagged in STATE.md §C).
4. GCS prod provisioning doc-conflict → open — verify live before asserting.
5. CFO hardcoded metrics (`lib/cfo/intelligenceEngine.ts:274-275`) → **MON-051**.
6. HECS-HELP PAYG TODO (`paygCalculator.ts:197`) → **MON-052**.
7. `runDifferential.ts` header cites non-existent `npm run audit:fixtures` → open (minor).
8. VR-005 run file absent → open (minor).
9. Cowork FUSE mount can't host git operations → operational note: sandbox clone is TRANSIT ONLY;
   every document lives in the repo (Reza directive 2026-07-15).

## 7. THE MATRIX — OPERATING MODEL (approved by Reza 2026-07-15)

Cowork project "Monitrax HQ — The Matrix" = orchestration surface over repo machinery (duplicates
nothing, §12.2.1): Mission Control artifact (live GitHub-rendered), weekday ops brief, session boot
ritual (pull → pin HEAD → PRs → STATE.md → CLAUDE.md → plan → ≤5-line orientation + ledger),
release-manager role (nothing to PROD untested; gates + §17.2 post-merge + Ring-3), ten-step fix
loop, autonomy grant (merge routine PRs when gates green; Reza confirms critical lane: number
changes pre-Ring-3, schema/destructive, CDR/AFSL language, majors, spend, external comms). All code
sessions run in desktop Claude Code, visible to Reza. Every proposal self-scored honest 10/10
(§20.6/§20.7).

---

*Sources: session ledger pinned to HEAD `38abeee`; six parallel deep-review reports over
docs/blueprint+verification, financial-logic+lib, implementation+issues, architecture+infra,
compliance+legal, marketing+strategy. Prepared by The Matrix (Cowork orchestrator).*
