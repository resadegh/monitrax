# CODE BRIEF — M2: kept-surface correctness **and depth** (THE LAUNCH GATE)

**For:** a fresh Code session · **Kind:** BUILD + DIAGNOSIS (model routing per section).
**Prepared by:** Matrix HQ (Cowork), 2026-08-19 · **Pinned HEAD:** re-pull before quoting anything.
**Spec of record:** `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — **the plan wins any disagreement with this brief.**

## BOOT FIRST (plan §0, non-negotiable)
`CLAUDE.md` → `STATE.md` → the master plan (cursor → §2 decision record → §4 M2 → §5 issue table) → this brief. **Read live, never recall.**

---

## ✅ AUTHORISATION — read this before you touch a producer (D-21, Reza 2026-08-19)

Reza asked directly whether M2 changes Monitrax's code, and ruled:

> **D-21 — number-moving fixes are AUTHORISED for M2.** The M2 correctness slice (§B) may change displayed numbers, because some are wrong today (MON-001: fortnightly rent treated as monthly, rent ≈54% off). **Conditions, all mandatory:** (1) every numbers-moving fix writes its **expected movement first**, before the fix code (MON-131 discipline) — movement is predicted, never discovered; (2) the **golden-baseline self-diff** must show only the predicted leaves moving — any unexpected leaf STOPS the phase; (3) **Ring-3 on live data** verifies the movement was correct, not merely different; (4) **Reza merges every PR** — nothing reaches PROD without his click.

**What is NOT authorised, restated:** no new features · no deletions · no scope expansion · no work on hidden modules (D-20) · no new capability of any kind (D-18). **The end state of the programme is today's Monitrax with every module unhidden — plus its numbers corrected and its dead ends closed.** If a change you are about to make would alter *what Monitrax does* rather than *whether it does it correctly*, STOP and hand back.

---

## THE TWO LAWS THAT GOVERN THIS ENTIRE MILESTONE

**D-20 — DEPTH BEFORE SURFACE (Reza, 2026-08-19).** *"Work on the depth and quality of Monitrax rather than expanding a shallow surface."* Work that makes an **existing kept function** deeper, more correct or more complete outranks everything else — including every hidden-module improvement. **No hidden-module work proceeds while a kept-surface defect or gap is open.**

**M2.0 — THE SCOPING LAW.** The census (§B-1) decides scope, **not** the issue list. A defect enters M2 **only if a producer or surface it reaches is on the plan's §2.1 KEPT list**. Everything else is **HELD** — named in the PR, never fixed. `/dashboard/expenses`, `/dashboard/income`, `/dashboard/cfo`, `/dashboard/tax` and every other §2.2 route are hidden; a defect whose only surface is one of them is out of scope **no matter how easy the fix looks**.

> If you find yourself opening a file under a hidden module's route tree, stop. You have left the brief.

## Why M2 exists
M0/M1 were *exposure* control — they changed what is visible, not what is correct. **M2 is where Monitrax gets deep.** It is the launch gate: nothing publishes, and no AI automation is authorised (D-18), until the kept surface is both **right** (numbers trace to one converged producer, Ring-3-verified on live data) and **whole** (no dead ends, no shallow empty states, every path completes). Automation on wrong numbers is wrong numbers faster; a polished shell with 404s behind it is not a product.

## Hard lines (violations are defects)
- **Never fix a number in passing** (§23.2.1) → `npm run issues:raise`, never an inline patch.
- Numbers-moving work: expected movement written and Ring-0-walked **before** the fix code. `changesNumbers` honest, per PR.
- Hidden ≠ deleted. No deletions of module code. No schema changes. No `.github/workflows/`.
- **No new capability** (D-18). Believe something new is needed? Write it into the plan's M2.7 gate-review slot and STOP.
- §20.6 tri-axis + §16.5 doc-sync in every PR body. Plan checkboxes + cursor updated in the SAME PR.

---

## §A — M1.3 carry-over: tracker pointers (FIRST, own commit, docs only)

Cowork could not land these (STATE.md is 78 KB; ISSUES.json/md ~510 KB each — beyond the GitHub connector's safe carry, P0.1 precedent). Verbatim:

**1. `STATE.md`** — add to the cursor area (do not restructure), after the existing PROD SIMPLIFICATION block:
```
**MONITRAX V1 MASTER PLAN (2026-08-19):** `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` (#1592) is now THE single tracking doc for the v1 programme — one document read, ticked and cursored by Reza, Matrix (Cowork), Code and the Chrome relay. Boot order for EVERY session: CLAUDE.md → STATE.md → that plan's §0 → its cursor → your brief. Rulings D-10…D-21 (identity = per-property record system + accountant pack · AI = intake propose→confirm only · pack not portal · EOFY nudges · dashboard returns rebuilt as the v1 scoreboard at M3 with stage-aware tiles · gate review at every milestone · NO new capability without Reza's GO · DEPTH BEFORE SURFACE · number-moving fixes authorised for M2 under the four conditions). M0 (simplification) and M1 (mechanics + R0) are CLOSED; M2 = kept-surface correctness + depth is the LAUNCH GATE.
```

**2. `docs/implementation/01_ACTIVE_WORKSTREAMS.md`** — replace the `0·SIMP` Status line (keep the entry; do not delete history):
```
- **Status:** ✅ M0+M1 CLOSED (2026-08-19). Live tracking moved to `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — that doc is the state; this entry is a pointer (SSOT). Current milestone: M2 — kept-surface correctness + depth (the launch gate).
```

**3. `docs/strategy/PROD_SIMPLIFICATION_PLAN.md`** — add directly under the title, and freeze its cursor block:
```
> **📍 SUPERSEDED FOR TRACKING (2026-08-19).** Live state, roadmap and checkboxes now live in `MONITRAX_V1_MASTER_PLAN.md`. **This document remains binding as the module-gate DECISION RECORD (§0 rulings D-1…D-9) and DESIGN ARCHIVE (§2 route/API inventory, §3 registry, §4 gate shape).** Do not update its cursor — it is frozen at the M1 close-out.
```
Also point its §1 story line at the master plan §1 (D-10 replaced the wealth-OS framing).

**4. `CLAUDE.md`** — one line in the session-boot section:
```
**Programme boot (2026-08-19):** after this file and STATE.md, every session reads `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` §0 (boot protocol) and its cursor before doing any work. That plan is the single tracker for the v1 programme across Reza, Cowork, Code and the Chrome relay. Its D-18 (no new capability without Reza's GO) and D-20 (depth before surface) bind every session.
```

**5.** Bump `Last updated` in `docs/IMPLEMENTATION_PLAN.md`.

**6. Register MON-162** (no fix — Reza deferred it, P-3/P-5):
```
npm run issues:raise -- --title "Admin portal and the app cannot hold independent sessions in one browser — signing into either signs the other out" \
  --area auth --surface app/admin/login/page.tsx --severity low --no-changes-numbers \
  --plain-issue "The staff admin portal and the customer app are separate surfaces but share one browser session, so signing in to one signs you out of the other. Verifying a change as an admin and as a user needs two browsers or two profiles." \
  --tracker "MONITRAX_V1_MASTER_PLAN.md §5 · found during the R0 acceptance run 2026-08-19 (Reza) · fix DEFERRED (P-3/P-5)"
```

---

## §B — Correctness on the kept surface *(authorised to move numbers — D-21 conditions apply)*

### B-1 · M2.1 Kept-surface producer census (DIAGNOSIS — **Opus, highest effort**) — DO THIS FIRST
`npm run census:producers` at your HEAD, **filtered to the plan's §2.1 kept surface** (`MON-131_SCOPE_FILTER.md §1.1` is the method; expect ≈8–10 quantities). Deliverable: a table in the plan under M2.1 — quantity · producers reaching a kept surface · convergence status · attached issue ids. **T5–T7 fall out → HELD.** This table is the scope contract for B-2; anything not in it does not get fixed.

### B-2 · M2.3 The defect cluster (statuses pulled live 2026-08-19 — re-pull; do not trust this table)
| Issue | Live status | Scope call |
|---|---|---|
| MON-001 | **FIXING**, critical | Fortnightly rent treated as monthly (~54% off), kept surface. **The highest-value fix in M2** — rent is the top line of every property number and of the pack. Expected movement written first. |
| MON-129 | **OPEN**, critical | 23 `lib/` producers convert rows to run-rates with no one-off gate. **Scope strictly to producers B-1 proves reach a kept surface.** Do not sweep all 23 by reflex — that is breadth, and D-20 forbids it. |
| MON-145 | **OPEN**, high | Undated `Loan.interestRateAnnual` vs dated repayments. **In scope** — feeds the pack's per-loan interest (pain 3, the #1 ATO error class). |
| MON-146 | **OPEN**, medium | Rate rendered 100× too small — cited surface `/dashboard/expenses` is **HIDDEN**. **Scoping question for B-1: does the same render path appear on any KEPT surface?** Yes → fix. No → **mark HELD and say so in the PR**. |
| MON-143 | **VERIFIED already** | Closed. The plan's §5 said OPEN — that was drift; corrected. Nothing to do. |

### B-3 · M2.4 Kill the properties-list inline re-derivation (BUILD)
`app/dashboard/properties/page.tsx` (~:1200, inside the `selectedProperty.type === 'INVESTMENT'` block) re-derives annual income/expense/loan totals and a budget-vs-actual cashflow **inline in the component**, bypassing `computePropertyCashflow` — the SSOT engine. A screen doing arithmetic violates the first law (screens only read). Replace with the engine's stated values. **`changesNumbers` may be YES** — if the inline math disagrees with the engine, that gap IS the finding: write the expected movement first, then fix.

### B-4 · M2.5 Five-condition done + ratchet
MON-131's five-condition definition of done applied to the **kept** quantities only; `census:producers:check` green; registry statuses updated in `ISSUES.json` + `ISSUES.md` (same PR).

### B-5 · Registry hygiene
Flip **MON-160** to VERIFIED citing the live flip test (#1591 comment, 2026-08-19).

---

## §C — MON-161: stale cached 404 after a flag flip (BUILD, small, high trust value)

**Observed on PROD 2026-08-19** during the R0 run: after flipping `MODULE_HOUSEKEEPING` ON, the route's **bare URL** kept serving a 404 for ~2 minutes, while the same URL with a cache-busting query rendered correctly at once. MON-160's request-time gating is sound; the artefact is the **404 response being cached** for that exact URL.

```
npm run issues:raise -- --title "Gated-route 404 responses are cacheable — a module flip is invisible on the bare URL until the cached 404 expires" \
  --area gating --surface lib/featureFlags/moduleRouteGuard.ts --severity medium --no-changes-numbers \
  --plain-issue "After switching a module back on, its pages could still show 'not found' for a couple of minutes unless you changed the address slightly. The switch had worked; the browser was showing a saved copy of the old 'not found' answer." \
  --tracker "MONITRAX_V1_MASTER_PLAN.md §5 · found in the R0 acceptance run 2026-08-19"
```
**Fix** at the ONE shared guard (SSOT — not per-route): gated not-found responses carry `Cache-Control: no-store` (or equivalent) so a flip is visible on the bare URL inside the ~30s window the admin panel promises. **Acceptance:** a test locking the behaviour, plus PR notes on re-running the live flip check. **Why it matters:** every R-stage return depends on that promise being literally true.

---

## §D — MON-163: kept pages link into hidden routes (BUILD — **launch-blocking, live in PROD today**)

**Found by static scan 2026-08-19 and confirmed against the running app.** The KEPT property-detail page links to hidden routes:

| File | Line | Link | Target module |
|---|---|---|---|
| `app/dashboard/properties/[id]/page.tsx` | :556 | `/dashboard/tax` | MODULE_TAX (hidden, R2) |
| " | :746, :758 | `/dashboard/income` | MODULE_HOUSEHOLD (hidden, R3) |
| " | :403, :548 | `/dashboard/cfo/what-if/sellProperty?propertyId=…` | MODULE_CFO (hidden, R4) |

A v1 user on the core property page clicks any of these and gets a 404. **The P2.1 sweep checked that hidden routes hide; nobody checked that kept routes stopped pointing at them** — the whole class was missed.

```
npm run issues:raise -- --title "Kept property-detail page links into hidden modules (tax, income, CFO what-if) — v1 users hit 404s from the core surface" \
  --area navigation --surface "app/dashboard/properties/[id]/page.tsx" --severity high --no-changes-numbers \
  --plain-issue "On a property's page, some buttons and links pointed to sections that are switched off in this release, so clicking them landed on a 'page not found' screen instead of doing anything useful." \
  --tracker "MONITRAX_V1_MASTER_PLAN.md §5 · found by Matrix static scan 2026-08-19, confirmed live in PROD"
```

**Fix pattern (SSOT — do it once, not five times):** client-gate each link with `useModuleEnabled(<key>)` from `ModuleGateContext` — the same pattern P1 used for the Strategy tabs. When the module is off the affordance is **absent** (not disabled-and-confusing); when a stage returns, it reappears by itself. Do **not** hardcode a second list of hidden routes — derive from `MODULE_REGISTRY`.

**Then generalise it — this is the real deliverable:** add a **repo-wide guard** (a lint/test in `tests/featureFlags/`) that walks every KEPT page/component and **fails the build** if it contains a link whose href matches any `routePrefixes` entry of a module that is not itself gating that component. This class of defect must be impossible to reintroduce, not just fixed once. *(Matrix's scan found 2 files; the guard must scan all of them, including string-interpolated hrefs.)*

---

## §E — M2.6 KEPT-SURFACE DEPTH SWEEP (D-20 — the quality half of the gate)

Separate from "are the numbers right" (§B). This asks: **does the v1 surface actually work, end to end, for a real user, on PROD data?** Walk every §2.1 kept route and catalogue what is shallow, broken or dead-ended. Findings become registry issues; launch-blocking ones are fixed in M2, the rest become **the M3.6 depth backlog**.

Checklist (evidence per item — a transcript, screenshot or test, not an assertion):
- **(a) Dead links** — §D's guard makes this mechanical. Run it repo-wide, fix every hit.
- **(b) Empty states** — does each kept page explain what to do next, or does it silently look "done" when it is actually missing capability or data?
- **(c) Screen arithmetic** — grep kept pages for arithmetic on financial values (§B-3 is one instance; find the rest). Every displayed number should be *stated by* a producer, not computed in the view.
- **(d) Intake, end to end** — CSV/QIF · manual · cash quick-add · receipt OCR · reconcile→link · managed-rental reconciliation: each path actually lands a row against the right property, with the right category and deductibility.
- **(e) Documents** — upload → OCR → auto-link → visible on the property, with the evidence reachable from the transaction.
- **(f) The reports pack** — generates on real PROD-shaped data without error; note (do not fix) every gap vs the M3.1 ATO-headings target.
- **(g) Mobile** — sidebar, bottom nav, tab bar and the More sheet with 13 modules hidden; nothing throws, nothing is stranded.
- **(h) Errors and loading** — every kept page handles API failure and slow loads without a blank screen.

**Deliverable:** one catalogued table in the PR (route · finding · severity · launch-blocking Y/N · issue id). **Be exhaustive and honest — an incomplete sweep is worse than none, because it will be trusted.**

---

## Model routing
§A: Fable · §B-1 + MON-129/MON-145 diagnosis: **Opus, highest effort** · §B-2 mechanical fixes, §B-3, §C, §D: Fable (**§D's repo-wide guard: Opus** — the AST/href walk needs care) · §E sweep: **Opus** (judgement-heavy) with Fable for the mechanical greps.

## Deliver as
**PR-1 (§A + §C + §D + §B-5)** — docs, registrations, the no-store fix, the dead-link fix + its permanent guard. `changesNumbers: NO`. Safe to merge fast; **§D ships a live-PROD fix, so prioritise it.**
**PR-2 (§B-1 → B-4)** — the correctness slice; expect `changesNumbers: YES` with written expected movements (D-21). **Hand back to Matrix HQ for the Ring-3 verdict on live data (M2.2) — that verdict, not CI, closes the correctness half of the gate.**
**PR-3 (§E)** — the depth sweep catalogue + any launch-blocking fixes it surfaces.

**Done =** plan boxes M2.1/M2.3/M2.4/M2.5/M2.6 ticked in their PRs · cursor updated · MON statuses correct in both registry files · the dead-link guard green in CI · handback posted for M2.2 Ring-3 · Matrix records the M2.7 gate review.
