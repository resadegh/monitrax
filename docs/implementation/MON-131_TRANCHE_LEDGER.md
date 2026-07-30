# MON-131 Tranche Ledger — the per-tranche gate evidence record

> **One row of evidence per gate, per tranche, recorded AS THE WORK HAPPENS — never
> reconstructed.** This ledger is the audit trail that makes the tranche discipline checkable:
> every tranche PR cites its §3 entry; every §3 entry cites the machine outputs (gate prints,
> test counts, relay run ids) rather than asserting them. Rules of the programme:
> `REFERENCE_NUMBERS_DESIGN.md` §7 (never fix a number · producer count only goes down · Float
> and Decimal twins move together · every tranche re-runs the census).
>
> **expectedMoves are COMPUTED, never hand-written** (Reza directive 2026-07-30): the old and
> new producers run against the SAME real data through the Matrix Relay
> (`GET /api/admin/matrix/golden-baseline` capture before merge → capture after deploy →
> `POST …/diff`), and the diff's three-outcome verdict (unchanged / EXPECTED / MOVED-UNDECLARED
> → STOP) is the evidence. A hand-written expectedMove is a guess wearing a number.

## §1 The sequence of record

| # | PR | Scope | Status |
|---|---|---|---|
| 0 | MON-135 (this PR) | T3 precondition — AI categoriser `isRecurring` tri-state. **Moves NOTHING on screen.** | 🟡 built, awaiting Reza's merge |
| 1 | MON-128 | Tranche 1 — income (brief to be supplied post-merge of #0) | ⬜ blocked on #0 merge + verify |
| 2+ | MON-130 / MON-129 / T4–T7 | per `REFERENCE_NUMBERS_DESIGN.md` §4 | ⬜ |

## §2 The gates every tranche entry must show

1. **Census ratchet** — `npm run census:producers:check` print, with the per-quantity
   "was N, now M" line for the tranche's quantity (M ≤ N).
2. **Source-lock** — debt count unchanged or DOWN (number quoted).
3. **Tests** — suites + counts, with the tranche's new permanent fixtures named, and coverage
   stated as "verifies X, does NOT verify Y" (§22.2.4).
4. **Neomatrix** — anchors green, semantic changes named (or "no lineage change" stated).
5. **Relay-computed moves** — baseline capture id/sha BEFORE merge, capture AFTER deploy, diff
   verdict. For a moves-nothing PR the required verdict is **unchanged (CLEAN)**; for a
   number-moving tranche, every move must match a COMPUTED expectedMove, and any
   MOVED-UNDECLARED is a STOP.
6. **Registry** — the MON id's lifecycle transition with the run id that justified it.

## §3 Gate evidence (append-only, newest first)

### §3.0 — MON-135: AI-categoriser `isRecurring` tri-state (T3 precondition; moves NOTHING)

**Branch:** `fix/mon-135-ai-isrecurring-precondition` · **Base:** main @ `49ec7054` · **PR:** #TBD
**changesNumbers:** NO (registry MON-135 raised `changesNumbers: false` at Phase A0 — this PR
changes what a default MEANS, not what any number IS; the composition risk it defuses was T3's).

**Anchor verification at HEAD (brief warned ~⅓ drift):**
- Brief's `lib/ai/aiCategorisation.ts:248-250` → actual `lib/bank/aiCategorisation.ts` (path
  drift); the four stamp sites verified at :90 / :203 / :249 / :365, plus the legitimate
  learned-path read at :390.
- `frequencies.ts:45` gate → verified strictly `=== false` at `:50`; null/undefined flows as
  recurring. All seven `isRecurring === false` gates in `lib/` are strict — **no falsy-treating
  producer exists** (the brief's "second defect of the same class": NONE FOUND).

**What shipped:**
- `AICategorizationPrediction.isRecurring: boolean | null`; the three no-determination sites
  emit **null** (fallback builder / cascade adapter / transfer branch); the learned-merchant
  path keeps its real determination; `mapNormalisedToUnified`'s value is a cascade-input
  type-filler (cascade reads zero `isRecurring` — verified) and is never emitted or persisted.
- **§3.2 evidence-based determination:** `categoriseWithLearning` step 4b now uses the
  previously fetched-but-UNUSED `getRecurringPatterns` (user-confirmed MerchantMapping rows) —
  merchant match + amount within the ONE canonical ≤10% tolerance → `isRecurring: true` +
  learned cadence. No new heuristic, no new producer.
- **Schema:** `TransactionReviewQueue.aiIsRecurring` + `AICategorizationLearning.aiIsRecurring`
  → nullable (constraint loosening only; migration `20260730000000_mon135_nullable_ai_isrecurring`).
- `UnifiedTransaction.isRecurring` stays a non-null VIEW flag (feeds the Recurring-tab filter;
  never a run-rate — verified: `monthlyRunRate` consumers read declared rows only); writes
  coalesce `?? false` with the honest null retained on queue/learning rows.
- **Permanent fixtures:** Wall-B2 tri-state (Float `monthlyRunRate`/`annualRunRate`: null/unset
  → full rate, explicit false → 0; Decimal: strict `!== false` filter + `toMonthlyDecimal`
  composition) in `tests/golden/ring2.calcSsotWall.test.ts`; categoriser never-emits-false on
  the REAL prediction paths + the §3.2 overlay + transfer branch in
  `tests/neobrain/cascadeReconcile.test.ts`.

**§3.3 remediation census (static — no DB in the build sandbox):**
- **Declared `Income`/`Expense` rows: the feared AI-stamped cohort is structurally EMPTY.** The
  AI paths never mint declared rows — every declared-row producer routes recurrence through
  `classifyIntake` (CI-enforced by the intake source-lock), and the link dialog prefills from
  TRANSACTION-CADENCE evidence (MON-025/MON-053), not the AI stamp. Historical
  `isRecurring=false` on declared rows traces to user forms or the evidence-based one-off
  classification Reza already ratified (MON-053) — plus a pre-MON-053 dialog-default cohort
  that is **indistinguishable from user choice in the schema (the provenance gap, stated —
  Reza's call whether to census it live):**
  `SELECT COUNT(*) FROM "Expense" WHERE "isRecurring" = false AND "createdAt" < '2026-07-15';`
- Queue/learning rows: historical `aiIsRecurring=false` is ambiguous (default vs determination)
  and left untouched; every NEW row carries the honest tri-state. No user-set value was
  overwritten anywhere (no data migration ships).

**Gate prints (at build, commit TBD):**
- tsc `--noEmit`: clean.
- vitest: `ring2.calcSsotWall` 15/15 · `cascadeReconcile` 16/16 (incl. 4 new MON-135 tests).
- neomatrix:check: schema valid · invariants hold · markdown fresh · 182/182 anchors ·
  census gate 0 uncovered (5 semantic anchors re-pinned: 4× aiCategorisation +
  reviewQueue.confirmReviewItem; structural lines refreshed mechanically — graphify binary
  unavailable in sandbox, same deterministic path as MON-134 PR-2).
- census:producers:check / lint:source-lock / lint:financial-surfaces / issues:check: run at
  final commit — see PR body for the prints.

**Relay evidence (§2 item 5) — REQUIRED BEFORE T3, owner: the Matrix:**
- Pre-merge baseline: capture at prod sha `49ec7054`-era (the post-#1536 baseline of record).
- Post-deploy capture + `POST /diff` → **required verdict: unchanged/CLEAN** (this PR must move
  NOTHING; a single moved leaf is itself the finding per brief §4).
- Additionally: `/dashboard/expenses` recurring figures eyeballed unchanged (Ring-3).
- **Run id: PENDING** — recorded here when the Matrix runs it post-merge.

**Coverage boundary:** the fixtures verify the gate tri-state and the categoriser's emission
contract against the real pure paths; they do NOT verify the import route against a live
database, do NOT verify the review UI rendering of an undetermined suggestion, and the
no-screen-movement claim is verified by the relay diff on real data — not by these tests.
