# CODE BRIEF — M2: kept-surface correctness (THE LAUNCH GATE)

**For:** a fresh Code session · **Kind:** BUILD + DIAGNOSIS (mixed — model routing per section below).
**Prepared by:** Matrix HQ (Cowork), 2026-08-19 · **Pinned HEAD:** `bea895f1` (merge of #1592) — re-pull before quoting anything.
**Spec of record:** `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — **the plan wins any disagreement with this brief.**

## BOOT FIRST (plan §0, non-negotiable)
`CLAUDE.md` → `STATE.md` → the master plan (cursor → §2 decision record → §4 M2 → §5 issue table) → this brief. **Read live, never recall.**

## Why M2 exists (read this before touching code)
M0/M1 were exposure control — hiding modules changed *what is visible*, not *what is correct*. **M2 is the correctness programme**, resumed from the MON-131 work and filtered to the kept v1 surface. It is **the launch gate**: nothing publishes, and no AI automation is authorised (D-18), until the kept surface's numbers are right on live data. Automation on wrong numbers is wrong numbers, faster.

**Held doctrine #1 (binding):** scope by **producer reaching a kept surface**, never "whatever is left of a tranche". Hidden-module issues stay **HELD** (P0.2 freeze) — do not fix them, do not re-open them.

## Hard lines (violations are defects)
- **Never fix a number in passing** (§23.2.1). A wrong number found outside your brief → `npm run issues:raise` → registry issue. Never an inline patch.
- **`changesNumbers` is per-PR and must be honest.** §B numbers-moving work needs its expected-movement written and Ring-0-walked BEFORE the fix code, per MON-131 discipline.
- Hidden ≠ deleted. No deletions of module code.
- No schema changes. No `.github/workflows/`. No new capability (D-18) — if you believe something new is required, write the proposal into the plan's M2.6 gate-review slot and STOP.
- §20.6 tri-axis + §16.5 doc-sync block in every PR body. Plan checkboxes + cursor updated in the SAME PR.

---

## §A — M1.3 carry-over: tracker pointers (do this FIRST, its own commit; docs only)

Cowork could not land these (STATE.md is 78 KB; the trackers exceed the GitHub connector's safe carry size — P0.1 precedent). Verbatim texts:

**1. `STATE.md`** — add to the cursor area (do not restructure the file), directly after the existing PROD SIMPLIFICATION block:
```
**MONITRAX V1 MASTER PLAN (2026-08-19):** `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` (#1592) is now THE single tracking doc for the v1 programme — one document read, ticked and cursored by Reza, Matrix (Cowork), Code and the Chrome relay. Boot order for EVERY session: CLAUDE.md → STATE.md → that plan's §0 → its cursor → your brief. New rulings D-10…D-18 (identity = per-property record system + accountant pack · AI = intake propose→confirm only · pack not portal · EOFY nudges · dashboard returns rebuilt as the v1 scoreboard at M3 · gate review at every milestone · NO new capability without Reza's explicit GO). M0 (simplification) and M1 (mechanics + R0) are CLOSED; M2 = kept-surface correctness is the LAUNCH GATE.
```

**2. `docs/implementation/01_ACTIVE_WORKSTREAMS.md`** — replace the `0·SIMP` entry's Status line and append a pointer (keep the entry; do not delete history):
```
- **Status:** ✅ M0+M1 CLOSED (2026-08-19). Live tracking moved to `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — that doc is the state; this entry is a pointer (SSOT). Current milestone: M2 — kept-surface correctness (the launch gate).
```

**3. `docs/strategy/PROD_SIMPLIFICATION_PLAN.md`** — add directly under the title, and freeze its cursor block:
```
> **📍 SUPERSEDED FOR TRACKING (2026-08-19).** Live state, roadmap and checkboxes now live in `MONITRAX_V1_MASTER_PLAN.md`. **This document remains binding as the module-gate DECISION RECORD (§0 rulings D-1…D-9) and DESIGN ARCHIVE (§2 route/API inventory, §3 registry, §4 gate shape).** Do not update its cursor — it is frozen at the M1 close-out.
```
Also update its §1 story line to point at the master plan §1 (D-10 replaced the wealth-OS framing).

**4. `CLAUDE.md`** — one line in the session-boot section (so landing on the plan is law, not habit):
```
**Programme boot (2026-08-19):** after this file and STATE.md, every session reads `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` §0 (boot protocol) and its cursor before doing any work. That plan is the single tracker for the v1 programme across Reza, Cowork, Code and the Chrome relay.
```

**5.** Bump `Last updated` in `docs/IMPLEMENTATION_PLAN.md`.

**6. Register MON-162** (no fix — Reza deferred it):
```
npm run issues:raise -- --title "Admin portal and the app cannot hold independent sessions in one browser — signing into either signs the other out" \
  --area auth --surface app/admin/login/page.tsx --severity low --no-changes-numbers \
  --plain-issue "The staff admin portal and the customer app are separate surfaces but share one browser session, so signing in to one signs you out of the other. Verifying a change as an admin and as a user needs two browsers or two profiles." \
  --tracker "MONITRAX_V1_MASTER_PLAN.md §5 · found during the R0 acceptance run 2026-08-19 (Reza) · fix DEFERRED by Reza's ruling"
```

---

## §B — M2 core: correctness on the kept surface

### B-1 · M2.1 Kept-surface producer census (DIAGNOSIS — **Opus, highest effort**)
Re-run `npm run census:producers` at your HEAD and **filter to the §2.1 kept surface only** (`MON-131_SCOPE_FILTER.md §1.1` is the method; expect ≈8–10 quantities — the 10 SPLIT + 2 loan sub-quantities, minus anything the Sankey removal took dark). Deliverable: a table in the plan under M2.1 — quantity · producers reaching a kept surface · convergence status · the issue ids attached. **T5–T7 fall out of scope → HELD.**

### B-2 · M2.3 The launch-blocking defect cluster (statuses pulled live at `bea895f1` — re-pull, do not trust this list)
| Issue | Live status | Severity | Note for scoping |
|---|---|---|---|
| MON-001 | **FIXING** | critical | Fortnightly rent treated as monthly (~54% off). Kept surface (properties). **The single highest-value fix in M2.** |
| MON-129 | **OPEN** | critical | Class sweep: 23 `lib/` producers convert rows to run-rates with no one-off gate. Scope to producers that reach a KEPT surface only. |
| MON-145 | **OPEN** | high | `Loan.interestRateAnnual` is an undated scalar while repayments are dated. Feeds the pack's per-loan interest (pain 3) — **in scope**. |
| MON-146 | **OPEN** | medium | Rate rendered 100× too small — but the cited surface is `/dashboard/expenses`, which is **HIDDEN** (MODULE_HOUSEKEEPING/HOUSEHOLD). **SCOPING QUESTION for B-1: does the same render path appear on any KEPT surface?** If yes → fix. If no → mark HELD under the freeze and say so in the PR. Do not fix a hidden surface by reflex. |
| MON-143 | **VERIFIED already** | high | Offset netting — closed. The plan's §5 table said OPEN; **correct the plan** in your PR (this is exactly the drift the tracker exists to catch). |

Route each fix per `brief-model-routing`: **Opus for diagnosis briefs**, Fable for mechanical sweeps once the cause is proven.

### B-3 · M2.4 Kill the properties-list inline re-derivation (BUILD)
`app/dashboard/properties/page.tsx` (~:1200, `selectedProperty.type === 'INVESTMENT'` block) re-derives annual income/expense/loan and a budget-vs-actual cashflow **inline in the component**, bypassing `computePropertyCashflow` — the SSOT engine. This is a screen doing arithmetic (SSOT law: screens only read). Replace with the engine's stated values. **`changesNumbers` may be YES** — if the inline math disagrees with the engine, that gap IS a finding: write the expected movement first, then fix.

### B-4 · M2.5 Five-condition done + ratchet
Apply MON-131's five-condition definition of done to the **kept** quantities only; `census:producers:check` green; registry statuses updated in `ISSUES.json` + `ISSUES.md` (same PR).

### B-5 · Registry hygiene
Flip **MON-160** to VERIFIED citing the live flip test (#1591 comment, 2026-08-19).

---

## §C — MON-161: stale cached 404 after a flag flip (BUILD, small, high trust value)

**Observed on PROD 2026-08-19** during the R0 run: after flipping `MODULE_HOUSEKEEPING` ON, the route's **bare URL** kept serving a 404 for ~2 minutes, while the same URL with a cache-busting query returned the correct (rendered) page immediately. So MON-160's request-time gating is sound; the artefact is the **404 response being cached** for that exact URL.

Register it, then fix at the ONE shared guard (SSOT — not per-route):
```
npm run issues:raise -- --title "Gated-route 404 responses are cacheable — a module flip is invisible on the bare URL until the cached 404 expires" \
  --area gating --surface lib/featureFlags/moduleRouteGuard.ts --severity medium --no-changes-numbers \
  --plain-issue "After switching a module back on, its pages could still show 'not found' for a couple of minutes unless you changed the address slightly. The switch had worked; the browser was showing a saved copy of the old 'not found' answer." \
  --tracker "MONITRAX_V1_MASTER_PLAN.md §5 · found in the R0 acceptance run 2026-08-19"
```
**Fix:** ensure gated-route not-found responses carry `Cache-Control: no-store` (or equivalent) so a flip is visible on the bare URL inside the ~30s cache window the admin panel promises. **Acceptance:** a test locking the header/no-store behaviour on the shared guard, plus a note in the PR describing how to re-run the live flip check.
**Why it matters:** every R-stage return depends on the panel's promise being literally true.

---

## Model routing
§A: Fable (mechanical docs) · §B-1 + the MON-129/MON-145 diagnosis: **Opus, highest effort** · §B-2 mechanical fixes + §B-3 + §C: Fable · §B-4/B-5: Fable.

## Deliver as
**PR-1 (§A + §C + §B-5)** — docs, registrations, the no-store fix; `changesNumbers: NO`; safe to merge fast.
**PR-2 (§B-1 → B-4)** — the correctness slice; expect `changesNumbers: YES` with written expected movements. **Hand back to Matrix HQ for the Ring-3 verdict on live data (M2.2) — that verdict, not CI, closes the M2 gate.**

**Done =** plan boxes M2.1/M2.3/M2.4/M2.5 ticked in the same PRs · cursor updated · MON statuses correct in both registry files · handback posted for M2.2 Ring-3 · Matrix records the M2.6 gate review.
