# STITCH DESIGN BRIEF — Fix B: merge-with-edit + clearer kept/removed view (Housekeeping · Duplicate records)

**Design-first (FOURTH LAW / §18.2.1) for Fix B.** Generate in Stitch where the connector lives (desktop session, dark Monitrax app design system — the same DS behind `.stitch/designs/housekeeping/*` and `activity-redesign`). **Do NOT hand-roll HTML** — this is the Stitch generation input. Engineering side is already specified in the build brief (PR #1480 / `HANDOFF_dedup-accuracy-and-merge-edit.md`); this brief is only the screen design that gates that build.

## Why
Reza's live review found the current merge view has two problems: (1) **kept-vs-removed is too subtle** (a green/amber word in a table cell), and (2) a merge **can't correct the surviving row's cadence** — so QBE (kept Monthly, should be one-off) and Mate (kept One-off, should be recurring) would merge with the wrong frequency. Fix B redesigns the merge-confirm view to make kept/removed unmistakable AND let the user edit the surviving row's **amount + frequency** as part of the merge. Nothing merges without a typed-MERGE confirm (§12.11).

## Design-system note (for the Stitch operator)
- Dark Monitrax dashboard DS; pass the app's `designSystem` id — **do NOT put hex/fonts/roundness in the generation prompt** (skill rule).
- `deviceType: DESKTOP` first, then a MOBILE variant (the app has a bottom-nav). Emerald primary, amber only for genuine warnings.

---

## ENHANCED STITCH PROMPT (paste into `generate_screen_from_text`)

> A "merge duplicate records" confirmation card inside a personal-finance web app's Housekeeping section, where the app has found two-or-more records of the same real expense/income and the user reviews, optionally corrects, and confirms merging them into one. Calm, deliberate, reversible-feeling; the outcome of each row must be obvious at a glance, and the user can fix the surviving row's details before committing.
>
> **PLATFORM:** Web, Desktop-first
>
> **PAGE STRUCTURE:**
> 1. **Section header:** "Housekeeping" with a tab row — "Tax classification" and "Duplicate records" (active). Short explainer: "When the same real source is recorded more than once, the copies inflate your totals. Merge each group into one row — links are repointed, nothing is lost, and nothing merges until you confirm."
> 2. **Group card (repeated per duplicate group):** a card with a category eyebrow (e.g. "EXPENSE · INSURANCE") and a title ("QBE Insurance — 2 copies → 1 record"). Inside, a clear two-zone layout, NOT a flat table:
>    - **"Keeping this record" zone** (visually dominant, top): the surviving row shown as an editable summary — the merchant name, and inline **editable fields**: an **Amount** input (pre-filled), a **Frequency** dropdown (Weekly / Fortnightly / Monthly / … pre-filled), and a **One-off ⇄ Recurring** toggle. A helper line: "This is the record you'll keep — correct its amount or how often it repeats if needed."
>    - **"Removing these" zone** (secondary, below, de-emphasised with a subtle strikethrough or muted tone): the other row(s) listed read-only (name · amount · cadence) with a small "merges into the record above · links repointed" caption.
>    - A one-line **effect summary**: "Declared annual effect: $X" (0 when both are one-offs).
>    - **Confirm control:** a "Review & merge" button that expands an inline confirm step requiring the user to type **MERGE** before an enabled "Confirm merge" button; a "Cancel" beside it. If the user edited any surviving-row field, the confirm step shows a tiny "will also update: frequency → Monthly" recap so the change is explicit.
> 3. **Empty state:** when no duplicate groups exist — a centered calm illustration, "Nothing to merge", "No records look like duplicates right now."
> 4. **Footer:** small disclaimer line "General information only — not personal tax or financial advice. Confirmations here only change how Monitrax classifies your own records." (NO licence number.)
>
> **INTERACTIONS:** per-group confirmation only (no "merge all"); editable fields on the KEPT record default to its current values so an untouched merge behaves exactly as before; the typed-MERGE gate stays; on confirm the card animates out and any downstream badge count decrements. Hover on a "Removing" row highlights which record it folds into.

---

## After generation
1. Download HTML + PNG → `.stitch/designs/housekeeping/duplicate-merge-edit-{desktop,mobile}-{light,dark}.*` (4-variant matrix, §18.7.2).
2. Surface Stitch's `outputComponents` (text description + suggestions) to Reza.
3. Reza reviews → iterate via `edit_screens` to >9/10 → his §18.2.1 approval.
4. THEN the Opus 4.8 build per the existing build brief: `survivorEdits { amount?, frequency?, isRecurring? }` applied to the survivor only, inside the same transaction, after the `GROUP_STALE` re-derivation; "Duplicate income" → "Duplicate records" rename; keep `executeMerge` pure. Then Reza merges QBE + Mate with corrected cadence → the Matrix runs the final duplicates re-check.

---
*Prepared by The Matrix. Stitch generation runs where the connector is available; this is the input, not a substitute for the Stitch design. Engineering spec: PR #1480.*
