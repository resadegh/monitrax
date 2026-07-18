# Monitrax Implementation Plan

> **This is the live, single source of truth for "what is being worked on, what is queued, what is blocked, what changed recently."**
>
> Every session starts here. Every PR that materially changes a workstream updates the relevant spoke below. If a workstream isn't in this plan, it isn't real.
>
> See CLAUDE.md §1 (Session Startup Protocol) and §15 (Implementation Plan Protocol) for the rules that govern this document.

**Last updated:** 2026-07-18b (**MON-020/060 tax-producer collapse built** — ONE canonical tax assembler (`getUserTaxPosition` + `engineInputs`) now feeds the Tax page route (verbatim-equal, zero number change), the master snapshot tax summary (adapter — the activity Sankey's divergent Tax figure converges), /cashflow + CFO (already on it); the dead `/api/tax` fourth assembler deleted; golden `ring2.taxParity` locks route ≡ bundle ≡ master (pin 124,800/30,724); recorded finding for Reza: folding rental-dedup + isTaxable into the canonical assembler is the remaining semantic unification. Draft PR pending Reza's merge → Matrix cross-surface Ring-3. Prior: 2026-07-18 (**MON-087 Sev-1 form crash fixed** — property-context Add Expense crashed on Radix's empty-value SelectItem invariant (VR-014); the whole 15-site class removed (plain div rows / ALL·NONE sentinels), MON-083 recurring/one-off control added to the canonical ExpenseDialog, static-scan ratchet `tests/ui/selectItemEmptyValue.test.ts`; draft PR pending Reza's merge → Matrix re-runs VR-014 (MON-081 numbers + MON-083/087 form checks). Prior: 2026-07-17c (**VR-013 loan-cost actuals-first fix built** — the Matrix's cross-surface Ring-3 on #1440 PASSED B2/B3 (MON-079/080/082/086 → VERIFIED) but FAILED B1 (MON-081: expenses/overview showed the $1,271 floor vs $1,191 actuals — surfaces fed the canonical resolver NO transactions); fixed via `lib/services/loanCosts.ts` (ONE trailing-12-month linked-repayment feed → canonical resolver, fed into /api/loans + 5 routes; Overview card actuals-first + "contractual estimate" relabel); source-lock debt 84→80; draft PR pending Reza's merge → Matrix Ring-3 #2. See 0·WALL. Prior: 2026-07-17b (**Calc-SSOT Wall Part 1 built** — A1 source-lock lint (ratchet-down, 84-match debt seeded, in `vercel-build`) · A2 MATRIX_FIX_DISCIPLINE wired into CLAUDE.md §0.4/§12.2.1/§20.6 + FIX_PROTOCOL Stage-1 step-0 + the new `.github/pull_request_template.md` · A3 MON-081…086 raised + MON-079/080 re-scoped ("VR-011 verified TAX only") · B1 `resolveLoanMonthlyCost()` (interest floor, 7 surfaces migrated) · B2 `monthlyRunRate()` one-off gate + Mechanism-C form · B3 managed-rental fee double-count fixed at `computePropertyCashflow` (gross-up on actuals; cf ≡ tax by construction). Draft PR pending Reza's merge → Matrix cross-surface Ring-3. See 0·WALL in `01_ACTIVE_WORKSTREAMS.md`. Prior: 2026-07-17 (**MON-080 built** — Phase 59 managed-rental activation fixed (D0 deposit-size cadence inference · D1 retroactive reconcile on the MANAGED transition · D2 gross-integrity gate), draft PR pending Reza's merge; VR-010 verdicts applied to the registry; Stitch artefacts light+dark ≥9/10; see 0·P59 in `01_ACTIVE_WORKSTREAMS.md`. Prior: 2026-07-16b (**Phase 59 — Managed Rental Income queued + build started**: spec PR #1433, issue MON-079 raised (`changesNumbers: true`), workstream added to `02_UP_NEXT.md` with the §9 sequence; build on `claude/phase-59-managed-rental-yhm8ug`. Prior same day: **Intake-Integrity Wall built** — keystone #1429 + C1/D2 #1430 + D1 #1431 merged, R3 fixtures #1432 open; Part 4 MON-076 gated on Reza; see `01_ACTIVE_WORKSTREAMS.md`. Prior: 2026-07-15b (**MON-045 stage 2 shipped — PR #1425 draft**: deductible loan interest auto-derived in the ONE tax engine, four rogue neg-gearing producers deleted, MON-045 → FIXING; MON-053 Ring-3 PASS → VERIFIED. Earlier same day: **VR-007 consolidated into the issue registry (Matrix, renumbered +2 → MON-053…MON-074 to avoid the #1418 MON-051/052 collision)** — Ring-3 real-data run VR-007 recorded (`docs/verification/runs/VR-007.md` + raw capture); registry now **74 MON issues** (MON-053…MON-074 raised, `tracker: neoaudit-run:VR-007`); MON-039/042/018 → VERIFIED, MON-049 → DIAGNOSED; six `#PENDING` fixPR placeholders resolved. **MON-053 (critical)** — one-off income annualised ×12, ~$120.6K phantom income in the tax base — is **MON-037's income-side twin** and **must land before MON-045 stage 2**. Baseline replacement is **PROPOSED, awaiting Reza** (§3.4 "Reza confirms"). _Verification Machine workstream detail NOT updated in `01_ACTIVE_WORKSTREAMS.md` — that spoke is **390 KB**, far above the ~63 KB ceiling this hub records as unreliable for a verbatim connector rewrite; it needs a git-capable session (see § Per-spoke size budget)._)
> _Prior: 2026-07-15 (**Cursor truth-restore + The Matrix HQ (Cowork)** — STATE.md re-pinned to `38abeee`/#1416; `docs/operational/LAUNCH_PROGRAM_2026-07.md` added; Q-GTM-3 reconciled; Reza decisions 2026-07-15: rectify GO + 31-July scope = friendlies beta + broker outbound.) — that truth-restore stands; VR-007 only ADDS to it._
---

## How this plan is structured (read me first)

The plan is a **hub (this file) + spokes** (under [`docs/implementation/`](implementation/)). The hub holds only navigation, the status legend, and the update rules. The detail lives in the spokes so each file stays small enough to (a) write via the GitHub connector in one call and (b) scan without scrolling forever. **`docs/IMPLEMENTATION_PLAN.md` remains the canonical entry point** — links elsewhere in the repo that point at "the plan" land here and route onward.

| Spoke | What it holds | Open it |
|---|---|---|
| 🟡 **Active Workstreams** | Work in flight right now — phase checklists, owners, risk, blockers. Sorted by priority. | [`implementation/01_ACTIVE_WORKSTREAMS.md`](implementation/01_ACTIVE_WORKSTREAMS.md) |
| 📋 **Up Next & Demo-Complete** | Agreed + queued, not started; plus the frozen Lighthouse demo-complete band. | [`implementation/02_UP_NEXT.md`](implementation/02_UP_NEXT.md) |
| ❓🚧🗑️↩️ **Questions, Blocked & Backlog** | Open Questions (strategic, undecided), Blocked items, Dead Code / Tech-Debt, Reversed Decisions. | [`implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md) |
| ✅ **Recently Completed** | Rolling 30-day completion log (older items roll into the changelog). | [`implementation/04_RECENTLY_COMPLETED.md`](implementation/04_RECENTLY_COMPLETED.md) |
| 📱 **Mobile Workstream** | The `0·MOB` mobile companion app live tracker (design + main-repo backend). | [`implementation/05_MOBILE_WORKSTREAM.md`](implementation/05_MOBILE_WORKSTREAM.md) |
| 📚 **Older history** | Pre-30-day session log + the relocated preamble narrative. | [`docs/changelog/IMPLEMENTATION_CHANGELOG.md`](changelog/IMPLEMENTATION_CHANGELOG.md) |

**Freshness gate:** a spoke is the SSOT for its slice. When a claim in another doc (STATE.md, SYSTEM_MAP.md, a Phase doc) disagrees with the relevant spoke, the spoke wins — re-pull and fix the pointer.

---

## Status legend

| Symbol | Meaning |
|---|---|
| 🟢 | Active and healthy |
| 🟡 | Active, in progress, on track |
| 🔴 | Active, stuck or risk flagged — see notes |
| 🚧 | Blocked, awaiting decision or external dependency |
| 📋 | Queued — agreed, not started |
| ❓ | Idea / open question — not committed |
| 🗑️ | Dead code / tech-debt — pending cleanup |
| ↩️ | Reversed decision — preserved here so we don't re-do it |
| ✅ | Recently completed (rolling 30 days) |

---

## How to update this document (rules)

> **Mandatory.** See CLAUDE.md §15 (Implementation Plan Protocol) for full rule text. Edit the relevant **spoke**, not this hub (except the **Last updated** date above, which every plan-touching PR bumps).

1. **Every PR that starts a workstream** adds it to [`01_ACTIVE_WORKSTREAMS.md`](implementation/01_ACTIVE_WORKSTREAMS.md) with all the fields filled in (§15.2).
2. **Every PR that advances a workstream** ticks off the relevant `[ ]` checkbox(es) in that workstream's phase list and updates `Last touched`.
3. **Every PR that completes a workstream** moves it from `01_ACTIVE_WORKSTREAMS.md` to [`04_RECENTLY_COMPLETED.md`](implementation/04_RECENTLY_COMPLETED.md) with the date and PR number.
4. **Every PR that surfaces a tech-debt item** (e.g. removes a duplicate, identifies dead code) adds it to the Dead Code / Tech-Debt backlog in [`03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md).
5. **Every PR that reverts a previous attempt** adds an entry to Reversed Decisions in [`03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md) so the same dead-end isn't re-attempted.
6. **Every PR that introduces an open question** the user hasn't decided adds it to Open Questions in [`03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md).
7. **Bump the `Last updated` date** in this hub on every plan-touching PR. CI fails if it falls behind the newest `04_RECENTLY_COMPLETED.md` entry (finding F-1, `scripts/check-plan-freshness.sh`).
8. **Reviewers reject PRs** that materially change a workstream without updating the plan. Same hygiene rule as the changelog.

### Per-spoke size budget (finding F-8)

- **Target: each spoke ≤ ~600 lines / ≤ ~150 KB** so it stays connector-writable in one call and scannable. _Practical caveat surfaced 2026-06-15 (Phase 3): even a 63 KB spoke is unreliable to rewrite verbatim from a Cowork/connector session — the safe ceiling for an in-place connector rewrite is well under that. Prefer git-capable edits, or split further._
- When a spoke exceeds budget, **retire settled content**: completed workstreams → `04_RECENTLY_COMPLETED.md`; recently-completed items older than 30 days → [`IMPLEMENTATION_CHANGELOG.md`](changelog/IMPLEMENTATION_CHANGELOG.md).
- **Known over-budget (carried, not yet pruned):** `01_ACTIVE_WORKSTREAMS.md` (~289 KB) and `04_RECENTLY_COMPLETED.md` (~296 KB). This PR did the structural split only; the **next hygiene pass** retires the completed §0x workstreams (e.g. 0·WI, 0·DG, 0·StD, 0·WX) and rolls >30-day completions into the changelog to bring both under budget. Tracked as a Dead Code / Tech-Debt item in `03_OPEN_QUESTIONS_AND_BACKLOG.md`.
