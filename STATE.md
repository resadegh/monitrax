# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.
> **No session is notified of anything.** Merge-awareness and "what changed" are a session-start PULL, never a subscription.

**Last verified against HEAD:** `94742ea` (merge of #1439 — the Calc-SSOT Wall docs) · **on:** 2026-07-17 · **by:** Code session (Calc-SSOT Wall Part 1) — **WALL PART 1 BUILT (A1+A2+A3+B1+B2+B3, one draft PR on `claude/phase-59-managed-rental-yhm8ug` restarted from main, per-part commits):** A1 source-lock lint (`npm run lint:source-lock` in `vercel-build`; raw-row reads in `app/**/page.tsx`+routes fail CI; debt seeded 84 matches/35 pairs, line-free `{file,pattern,count}`, RATCHET-DOWN-ONLY — over OR under the count fails). A2 `MATRIX_FIX_DISCIPLINE.md` wired load-bearing: CLAUDE.md §0.4 four clauses on every fix, §12.2.1 detection kit, §20.6 fix-PR 5-item checklist required for Logic 10/10; FIX_PROTOCOL Stage-1 step-0 holistic SSOT audit; `.github/pull_request_template.md` created. A3 MON-081…086 raised DIAGNOSED (loan-$0 · expenses-isRecurring · one-off-cadence · SALARY-reuse-guard · cross-scope-dedup · managed-cashflow-double-count) + MON-079/080 re-scoped ("VR-011 verified TAX only; cross-surface Ring-3 not met"). B1 `resolveLoanMonthlyCost()` (declared cadence-normalised → actuals-first → interest floor, NEVER $0) extracted + 7 surfaces migrated. B2 `monthlyRunRate()`/`annualRunRate()` (one-off → 0) + Mechanism-C form (frequency hidden for one-offs). B3 (critical): `computePropertyCashflow` grosses managed rent back up when actuals resolve NET (recurring derived fees, per stream) — fee counted EXACTLY once, cf.rent ≡ tax gross, cashflow = net received; DIRECT/declared untouched; threaded through masterFinancialService + portfolio snapshot. Ratchet `tests/golden/ring2.calcSsotWall.test.ts` (Broadbeach 2,946.67 gross / 431.67 once / 2,515 net; taxable ≡ cashflow×12). Neomatrix: 2 new nodes + 6 edges, 2 anchors re-pinned, 270 nodes green. **Next: Reza merges the draft PR → deploy READY → the Matrix runs the CROSS-SURFACE Ring-3 on live data (Broadbeach loan · HOME one-offs · Broadbeach managed cashflow) → MON-081/082/083/086 VERIFIED; Mechanism A (MON-084/085) + the 84-site ratchet queue are the next Wall parts.**
> _Prior pin: `78711bf` (merge of #1436) · 2026-07-17 · Code session (MON-080) — **MON-080 BUILT (D0+D1+D2, one draft PR on `claude/phase-59-managed-rental-yhm8ug` restarted from main): Phase 59's managed-rental deduction now works on real data.** §19.2 EXECUTED-verified root cause corrected the handoff's suspect (N≥2 normalisation always worked; the real D0 was the N=1 fallback comparing weekly gross to a monthly payout → gap −$1,835). D0: deposit-size cadence inference in the ONE engine (Broadbeach $680/wk + one $2,515 deposit → MONTHLY, gap $431.67 material, Float=Decimal). D1: retroactive reconcile on the MANAGED transition (income PUT returns the card; GET /api/rental-reconciliation powers the now click-to-claim chip). D2: 422 GROSS_REQUIRED gate (never persist gross=net, ITAA s6-5), pre-filled confirm-or-correct prompt, RENTAL streams get the Edit amount field. Ratchets: Ring-0 Broadbeach fixtures + Ring-2 order-independence golden (manage→link == link→manage) + R1 wiring lock. **Stitch (Reza directive 2026-07-17: ALL UI/UX strictly through Stitch, self-review >9/10 → his final review):** reconcile-card light (9.3/10 after one iteration) + dark (9.3/10) committed under `.stitch/designs/mon-080/`; mobile + D2 form-state screens awaiting Reza's direction. Registry: MON-080 FIXING; VR-010 verdicts applied (11 → VERIFIED, MON-053 → CLOSED, MON-031 note). Full suite 4,072 green; all static gates green. **Next: Reza reviews/merges the draft PR → deploy READY → Matrix per-fix Ring-3 on Broadbeach (~$432/mo captured without unlink/relink; gross unchanged $2,947/mo; net-only stream blocked) → MON-080 VERIFIED → unblocks MON-079 → VERIFIED → CLOSED → VR re-baseline.**
> _Prior pin: `d50ff6a` (merge of #1432) · 2026-07-16 · Code session (Phase 59) —_ **PHASE 59 BUILT (Parts 0–5, one draft PR on `claude/phase-59-managed-rental-yhm8ug`): Managed Rental Income & Agent-Cost Reconciliation** per spec PR #1433 §9. Issue **MON-079** raised + modelled (`number.rental.agentCostDeduction`/`grossDeclared`). Schema (rentalMode/managingAgentName, derived Expense fields, AgentDisbursementRule, additive migration — **awaits Reza's §12.11/§12.12 approval**); ONE engine `reconcileManagedRental()` (Float+Decimal, cadence via the canonical detector) + Neomatrix Model step same PR; suggest-and-confirm card (spec §8 tokens) + learn-once rule + anomaly re-confirm; grounded Neobrain statement parser (+ RENTAL_STATEMENT doc type); D4 rent-gap detector + R0/R1/R2 ratchets (golden $650/wk-vs-$1,100/ft locked on both engines). **Next: Reza reviews/merges the draft PR → deploy READY → hand back to the Matrix for the Ring-3 (Part 6) → VERIFIED → re-baseline → close MON-079.**
> _Prior pin: `4cd44afe` (post-#1424) · 2026-07-15 · Code session (cluster ①, continued) —_ **MON-053 VERIFIED (Ring-3 PASS — Reza reclassified the ATO rows; Total Income $412,768 / est. tax $141,548, arithmetic exact). MON-045 STAGE 2 SHIPS IN PR #1425 (draft):** deductible loan interest auto-derived in the ONE engine (actuals-first, HOME-gated, expense de-dup); all four rogue neg-gearing producers deleted (taxIntegration P1+P2, portfolioEngine P3, orphaned property-roi route P4); CFO benefit derived from the canonical position (≤ deductions by construction); Ratchet `tests/tax/mon045PropertyLoanInterest.test.ts`; Neomatrix moved with the fix. Awaits Reza merge approval + per-fix Ring-3 vs the healed base.
> _Prior pin: `f19cb31a` (merge of #1420) · 2026-07-15 · Code session (cluster ①) — MON-053 FIX SHIPPED:_ `Income.isRecurring` (schema + additive migration), one-off guard on BOTH tax-engine annualisation paths (Float + Decimal), producers P1–P3 + link-dialog gate + income-form control threaded, run-rate excludes one-offs, Ring-1 source-lock (all 4 annualisation sites guarded, count locked). Awaits Ring-3 (the two ATO rows → reclassify via Edit → declared gross falls ~$120.6K from $524,831). **Sequencing: MON-053 lands BEFORE MON-045 stage 2** (else stage 2's Ring-3 verifies against an inflated base). Re-baseline (VR-008) after this deploys.
> _Prior pin: `818a2db` (merge of #1418) · 2026-07-15 · Cowork "The Matrix" — VR-007 CONSOLIDATION: the VR-007 intake was renumbered **+2 → MON-053…MON-074** (its original MON-051…MON-072 collided with the Matrix-ingestion MON-051/052 registered in #1418). Any reference to VR-007's internal numbering maps +2._
> _Prior pin: `38abeee` (merge of #1416) · 2026-07-15 · Cowork session — The Matrix HQ (full-repo ingestion + cursor truth-restore; prior cursor was ~250 PRs stale at `b03975d`). That truth-restore stands; VR-007 only ADDS to it._

> **OPEN THREADS (Code session 2026-06-16/17) — ⚠️ status UNVERIFIED-current as of 2026-07-15; re-verify each in live logs/env before acting:** (1) **Per-item Documents upload — THIS PR**: `DocumentsSection`
> on Properties/Investments/Assets (Super deferred — needs `SUPER` LinkedEntityType + migration). (2) **Mobile scan
> recognition BROKEN** — `/api/documents/analyze-for-form` 500s at the Vision OCR step; Vision API is *enabled* but
> shows ZERO traffic → auth failing before the call. Vision authenticates via `GCS_SERVICE_ACCOUNT_KEY`
> (`visionService.ts:69-91`) with NO keyless fallback → **do NOT delete that key** (breaks OCR) until Vision is made
> keyless (WIF as `vercel-monitrax-db`). Next: make Vision keyless + get the exact `analyze-for-form` error.
> (3) GCS keyless cutover: bucket + `vercel-monitrax-db` `objectUser` granted; factory gate fixed (#1127 merged);
> key NOT yet deleted (and must not be until Vision is keyless).
**Freshness gate:** on session start, compare this HEAD to live `git rev-parse HEAD`. If they differ,
the repo moved — re-verify the cursor below against the live plan BEFORE acting. Do not trust a stale cursor.

---

## A. WHAT MONITRAX IS  (north-star — for detail, see `docs/blueprint/MASTER_BLUEPRINT.md`)

- **Product:** Monitrax (monitrax.com.au) — an Australian Wealth Operating System. Brings property, loans,
  super, investments, cashflow, tax position and entity structures into one picture so users can model the next move.
- **Built by:** Reza, under ReNew Holding Company Pty Ltd (ACN 675 267 311).
- **Regulatory boundary (HARD):** a financial *information* service, NOT a licensed adviser. Surfaces maths and
  mechanisms; never gives personal financial advice, recommends products, or implies licensing not held.
  Respects the AFSL/Credit/Tax boundary + CDR. *(Confirm current ICP/positioning live — see cursor SEC C.)*

## B. THE MAP  (authority order — full registry in `docs/00_INDEX.md`)

0. `SYSTEM_MAP.md` (repo root) — **orientation pointer-map.** What Monitrax is, every authoritative doc +
   what it owns, architecture overview, calc-engine inventory, tool stack. Start here after this STATE.md.
1. `CLAUDE.md` (repo root) — **law.** Governance, four-lens mindset, SSOT + single-calc-engine rule, warm-words,
   session protocol (Parts 1/7/10). When anything conflicts with CLAUDE.md, CLAUDE.md wins.
2. `docs/IMPLEMENTATION_PLAN.md` (hub) + `docs/implementation/*` (spokes) — **status SSOT.** Shipped / active /
   queued / blocked / reversed. Split from one 884 KB file into a thin hub + spokes (F-8, 2026-06-15) so each
   stays connector-writable: `01_ACTIVE_WORKSTREAMS` / `02_UP_NEXT` / `03_OPEN_QUESTIONS_AND_BACKLOG` /
   `04_RECENTLY_COMPLETED`. Start at the hub; read the relevant spoke. STATE.md holds the *cursor*; the spokes hold the *detail*.
3. `docs/00_INDEX.md` — **the map** of every doc. Start here to locate anything.
4. Topic authorities: architecture -> `docs/architecture/`; phases -> `docs/blueprint/MASTER_BLUEPRINT.md`;
   compliance -> `docs/compliance/`; GTM -> `docs/marketing/` (+ `docs/marketing/gtm/`); design -> Stitch system
   (`docs/design/`); calc engines -> `lib/calculations/*` + `lib/services/masterFinancialService.ts`.

## C. RESUME CURSOR  (regenerated at every session END — the live "where we are")

> Re-pinned 2026-07-15 (Cowork "The Matrix" HQ session) at live HEAD `38abeee` = merge of #1416 (was stale at `b03975d` = #1164, 2026-06-21 — ~250 PRs of drift closed this session).
> **Landed since `b03975d` (#1165–#1416, condensed):** SSOT-dedup + MON-issue fix arc (dual tax engines reconciled, depreciation 100× bug, equity floor overstatement, cashflow-tile producer unification — see `docs/issues/ISSUES.md`); CSV-import hardening (#1326–1328); AI = Gemini-only (#1323, Anthropic disabled); **NeoAudit core build COMPLETE 2026-07-14** (CLAUDE.md Part 23: Ring-2 Golden Household + parity matrix + §20.6 pre-PR gate + `issues:raise` + Release Scorecard; standing/LIVE system); verification runs **VR-001→VR-006**, accepted baseline = **VR-006** (`docs/verification/baselines/BASELINE.md`); **Issue registry live:** 50 MON issues (32 FIXING · 9 VERIFIED · 4 DIAGNOSED · 2 OPEN · 2 CLOSED · 1 RETRACTED at this pin — re-read `docs/issues/ISSUES.json` before acting, statuses move fast); **RECTIFICATION_PLAN_2026-07-14** ready with DECISION 1 (one-offs excluded from run-rate) + DECISION 2 (trailing-12-month single producer) both ✅ DECIDED by Reza 2026-07-14.
> **UPDATED 2026-07-15 by the VR-007 landing (this PR):** verification runs now **VR-001→VR-007** (`docs/verification/runs/VR-007.md` + the raw capture `VR-007-capture.md`). **Registry is now 74 MON issues** (29 FIXING · 24 OPEN · 12 VERIFIED · 6 DIAGNOSED · 2 CLOSED · 1 RETRACTED) — MON-053…MON-074 raised from VR-007, and MON-039/042/018 → VERIFIED, MON-049 → DIAGNOSED. **Accepted baseline is STILL VR-006** — VR-007 *proposes* a replacement in this PR but §3.4 says expected deltas are "Reza confirms", so it is **awaiting Reza's decision**, not settled. VR-007's Part F diff vs VR-006: **48/49 leaf values unchanged, ONE expected delta** (`Guildford.cashflowYrList null → −7387` = MON-039c via #1412), **zero unexplained, zero regressions**.

- **Current focus: 0·RECTIFY — Reza gave the "rectify" GO on 2026-07-15 (Cowork session).** Work the clusters per `docs/issues/FIX_PROTOCOL.md` (Part 24), ONE issue at a time, own PR each, per-fix Ring-3 Chrome verification before VERIFIED. Cluster order per RECTIFICATION_PLAN §4 (① MON-037 one-off hub first) — but NOTE: VR-004/VR-006 already moved some cluster issues (MON-035/036 VERIFIED); **re-read the registry for per-issue status before starting any issue.**
  - **⚠️ CLUSTER ① NOW HAS A TWIN (VR-007, 2026-07-15): `MON-053` is `MON-037`'s INCOME-SIDE twin** — the same one-off bug, the same engine file (`lib/tax-engine/position/taxPositionCalculator.ts`), the same fix shape. MON-037 guarded EXPENSES only (`:194-197` + Decimal twin `:694-697`); income is still annualised unguarded (`:128` and Decimal `:636`), so two single ATO deposits become **~$120.6K of phantom income inside the declared gross of $524,831/yr — and it is taxed** (`critical`). **Work ① as ONE cluster (MON-037 + MON-053), not as unrelated issues** — the Ring-1 source-lock (ANY IncomeItem/ExpenseItem annualisation must be one-off-guarded) covers BOTH sides and is the ratchet that kills the pattern rather than one instance.
  - **⚠️ SEQUENCING: MON-053 lands BEFORE MON-045 stage 2.** MON-045's Ring-3 verifies against the tax base; if it goes first it verifies against a base inflated by ~$120.6K, and MON-053 then moves the number again — invalidating that Ring-3 and burning a full real-data cycle of Reza's time. Order: **MON-053 → re-baseline → MON-045 stage 2.**
- **Launch decision (Reza, 2026-07-15, Cowork):** 31 July = **friendlies beta + broker outbound** (NOT consumer bank-feeds launch — Basiq stays MRR-gated/parked). Gate plan: `docs/operational/LAUNCH_PROGRAM_2026-07.md` (added this PR).
- **Immediate next action (re-pinned 2026-07-15 by the VR-007 landing):** (1) cluster ① — **MON-037 + MON-053 together** per FIX_PROTOCOL stages 1–6 (MON-053 carries a §19.2-verified root cause with 18 `file:line` anchors + the corrected producer census — the registry entry is self-contained; a cold session can build it from `docs/issues/ISSUES.json` alone); (2) **then** MON-045 stage 2 — never before MON-053; (3) then remaining DIAGNOSED/OPEN (MON-001, 006, 047, 049, 050, and the VR-007 intake MON-054…MON-074) in plan order. The 2026-07-15 VR-007 findings **are now filed** (MON-053…MON-074, `tracker: neoaudit-run:VR-007`) — no re-raise needed.
- **Open decisions / blockers (awaiting Reza):** Q-GTM-7 friendlies cohort (blocks invite send) · Q-GTM-5 fintech-lawyer engagement (blocks Reviews to strangers) · Stripe live-mode (parked) · Q-BASIQ-1/Basiq (parked, MRR-gated) · Q-GTM-4 VA timing · mobile D2/D3/D4. Dependabot major-bump PRs (#811–#816: Prisma 5→7, Next 15→16, ESLint 8→10…) — recommendation: PARK pre-launch, do not merge.
- **New findings (Cowork ingestion 2026-07-15):** (a) **= MON-051** and (b) **= MON-052**, registered via #1418; (c)–(f) remain open notes. (a) `lib/cfo/intelligenceEngine.ts:274-275` hardcodes `savingsOpportunities: 3` / `pendingActions: 5` — user-facing placeholder metrics (MON-018 class); (b) `lib/tax-engine` PAYG `paygCalculator.ts:197` TODO — HECS-HELP withholding component not implemented; (c) VR-005 run file absent though referenced; (d) `lib/calc-audit/runDifferential.ts` header cites non-existent `npm run audit:fixtures`; (e) `docs/architecture/09` top table stale (Render-era; its own §5.3 says so); (f) GCS prod provisioning state CONFLICTS between arch doc ("pending, uploads → Postgres bytea") and the pre-refresh STATE.md ("live via key") — **re-verify in Vercel env + logs before any doc claims either.**
- **HQ note:** Monitrax program orchestration now runs from the Cowork project "Monitrax HQ — The Matrix" (Mission Control artifact + daily ops brief + this cursor discipline). Repo stays the only truth; the Matrix duplicates nothing (§12.2.1).

- **0·MOB (Mobile companion app) — design phase.** Live tracker: docs/implementation/05_MOBILE_WORKSTREAM.md.
  LOCKED light+dark set — 7 screens on the canonical Stitch system; next = commit Stitch artefacts + realign design docs; RN build gated on Basiq-live + §15.1 P0. Open for Reza: D2/D3/D4 (unchanged since 2026-06-21).

## D. THE SESSION RITUAL  (all surfaces; Code ALSO follows CLAUDE.md Parts 1/7/10)

**START (before any work):**
0. RESUME CHECK. List open + recently-merged PRs on `resadegh/monitrax` (GitHub connector). If a tracked PR
   (continuity / plan / workstream) merged since this cursor's HEAD, pull the new HEAD, read what changed, and
   continue from the updated next action. There is NO notification — this pull is how a session learns a PR merged.
1. Pull live HEAD. Run freshness gate (above).
2. Read this STATE.md -> then CLAUDE.md -> then the relevant `IMPLEMENTATION_PLAN.md` section for the active task.
3. Print a <=5-line orientation: what Monitrax is (1 line) - current task (1) - next action (1) - blockers (1) - HEAD (1).
4. Open a session ledger (verified-vs-unverified, pinned to HEAD).

**DURING (every response):**
- **Cite or stop.** No state claim without a this-session source (`file:line` / tool result / HEAD). Can't cite -> flag unverified + re-pull.
- **Re-pull, don't recall.** Uncertain = read it again. Recollection is the silently-wrong option.
- **One unit at a time.** Close + write the finding before opening the next. Never hold "the whole app" in context.
- **Standing compliance check.** Anything touching user-facing money language -> AFSL/CDR boundary check before it ships.

**END (before closing):**
1. Update the RESUME CURSOR (Section C) — new HEAD, what changed, exact stop-point, next action, blockers.
2. Update `IMPLEMENTATION_PLAN.md` + changelog in the SAME PR (CLAUDE.md Sections 15/16.5).
3. Leave the next action explicit enough that a cold session resumes in <1 min.

## E. HOW THIS STAYS TRUE  (integration + enforcement)

- **Owns:** current position (cursor) + the universal session ritual. **Defers to:** CLAUDE.md (law),
  IMPLEMENTATION_PLAN (detail), 00_INDEX (map), SYSTEM_MAP (what-owns-what). No content is duplicated from
  those here — only pointers + position.
- **Enforced by:** (a) `.claude/hooks/session-start.sh` prints this cursor + HEAD at the start of every Code session
  (skip-on-failure, never blocks the session); (b) `.github/workflows/continuity-gate.yml` fails a PR that changes
  workstream files without updating STATE.md + IMPLEMENTATION_PLAN in the same PR (soft-launch first, then required;
  workflow scope GRANTED 2026-06-15 — arming is a repo-admin step); (c) chat/Cowork: read-STATE-first is the hard first instruction (project instructions Section 0).
- **Update cadence:** cursor every session end; Section A/Section B only on a real change, via PR, never ad hoc.
