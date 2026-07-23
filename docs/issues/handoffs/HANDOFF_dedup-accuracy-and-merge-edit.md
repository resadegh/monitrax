# CODE BRIEF — Duplicate-detection accuracy (systemic guardrail) + merge-with-edit

**Two coupled fixes to the Housekeeping → Duplicate income tool, from Reza's live review (2026-07-23).** Fix A is a **systemic correctness/guardrail fix** (subtle data-integrity → **Fable 5**, ships FIRST). Fix B is **merge-with-edit + a clearer view** (UI → **Stitch design-first per §18.2.1, then Opus 4.8**). Do NOT touch the tax engine or MON-094.

## Why (Reza's live findings)
On `/dashboard/housekeeping/duplicates`, three groups were offered:
- **AIA — FALSE POSITIVE.** `Aia Australia . 68718123 /26` ($131) and `Aia Australia . 68718100 /26` ($158) are **two DIFFERENT policies** (different policy numbers, 20%-different premiums) — wrongly grouped as duplicates. Merging would DELETE a real policy.
- **QBE / Mate — genuine duplicates, but wrong cadence.** QBE survivor kept `MONTHLY` (Reza: should be one-off); Mate kept `One-off` (Reza: it's a recurring mobile bill). The merge picks the survivor's cadence and **cannot correct it** — `executeMerge` explicitly leaves the survivor's own fields unchanged.

Reza's directive: **still merge genuine duplicates, but give the option to edit the surviving row's details (frequency + amount) as part of the merge.** And: this must be a guardrail for ALL users, not a one-off patch for his data.

---

## FIX A — matcher accuracy (Fable 5, systemic; ships first)
**Root cause (verified):** `lib/bank/merchantNormalize.ts:27` strips any 5+ digit run (`/\b\d[\d\s-]{3,}\d\b/`), so a **policy/account/member number is discarded** before names are compared — `Aia … 68718123` and `Aia … 68718100` both normalise to `"aia"`. Then `sameMerchant` (`:38`) returns true on normalised-name equality **with NO amount check**, so the two distinct AIA policies group as *exact* duplicates. This same `classifyIntake` **source-signature** path (`lib/intake/classifyIntake.ts:245`) is the **intake guardrail (#1458)** — so the false-positive is systemic: a genuinely NEW distinct policy could be silently auto-absorbed into an existing row at import, for any user.

**The fix (one shared decision layer — the guardrail + the merge tool both read it):**
1. **Amount guard on the EXACT path.** Two rows may group as duplicates only when their normalised names match **AND** their amounts are within the existing near-duplicate band (reuse `isNearDuplicateEntry`'s ≤10% tolerance — do not invent a second threshold). AIA $131 vs $158 (20%) → **no longer groups**; QBE $216/$216 and Mate $150/$150 (0%) → still group. This alone fixes Reza's data and the whole "same insurer, different premium" class.
2. **§20.5 FORK (surface to Reza, don't guess) — identifier preservation.** The stronger fix is to keep a *distinguishing* identifier (policy/account/member number) so two sources with the SAME amount but DIFFERENT policy numbers still stay distinct. The hard part is telling a meaningful identifier from transaction-ref noise (the reason `:27` strips digits at all). Options: (a) amount-guard only (minimal, low-risk, fixes the observed class); (b) also retain a trailing identifier token when it co-occurs with a provider name; (c) never auto-merge at intake when a differing long-digit token is present — flag for review instead. **Recommend (a) now + (c) for the guardrail** (fail safe: at intake, a differing identifier → do NOT auto-absorb, surface it), with (b) as a later refinement. Reza confirms the guardrail's fail-safe behaviour.
3. **Ratchet:** golden — two same-provider rows with different identifiers + >10% amount do NOT group (fails on current code — reproduces the AIA bug); two same-provider rows with ~equal amount still group; the intake guardrail does NOT auto-absorb a differing-identifier new row. Neo-sync: the signature/normalisation change is modelled on `engine.intake.classifyIntake`; Neobrain updated.

**Effect:** after Fix A ships, the AIA group **disappears** from the review list (correctly), leaving only genuine duplicates. This is why it ships first — it removes the dangerous option before Reza merges anything.

---

## FIX B — merge-with-edit + a clearer kept/removed view (Stitch-first → Opus 4.8)
**Design-first (§18.2.1):** generate the new merge-confirm view in Stitch (dark app DS, desktop+mobile) BEFORE building. The view must make two things unmistakable:
- **Which row is KEPT vs REMOVED** — Reza found the current green/amber table too subtle. Lead with an explicit "Keeping this row / Removing these" hierarchy, not a colour cue in a table cell.
- **Editable target details on the surviving row** — inline, pre-filled **Amount** + **Frequency** (and the one-off↔recurring toggle) fields on the KEPT row, so the user corrects the cadence/amount *as part of* the merge (solves QBE monthly→one-off, Mate one-off→recurring).

**Build (after design approval):**
1. **Route** — `POST /api/intake/duplicates` accepts an optional `survivorEdits: { amount?, frequency?, isRecurring? }` alongside `{ kind, survivorId, mergeIds, confirm:"MERGE" }`. §12.11: apply ONLY the fields present, ONLY to the survivor, ONLY after the existing server-side re-derivation + `GROUP_STALE` guard, inside the same `prisma.$transaction` as `executeMerge`. Re-validate the edited values (valid Frequency enum; amount ≥ 0). Audit-log the edited fields.
2. **`executeMerge`** stays the FK-repoint + delete engine (unchanged); the survivor-field update is a separate, explicit step in the route (keeps the merge engine pure). Frequency stored via the canonical path — no inline frequency arithmetic (§12.2.1 / source-lock).
3. **Page** (`app/dashboard/housekeeping/duplicates/page.tsx`) — render the approved view; the typed-**MERGE** confirm still gates; the edit fields default to the survivor's current values (a no-edit merge behaves exactly as today).
4. **Naming nit (same PR):** the sub-tab reads "Duplicate income" but lists **expense** duplicates too (QBE/AIA/Mate are expenses) — rename to **"Duplicate records"** (nav + tab).

**Ratchet:** golden — a merge with `survivorEdits.frequency` set updates the survivor's cadence + repoints links in one transaction; a merge with no edits is byte-identical to today; an invalid frequency 400s. Neo-sync: the route's new edit step modelled; nothing sandbox-only.

---

## Sequencing & authority
Fix A (Fable) → merges list shows only genuine duplicates (AIA gone). Then Fix B (Stitch design → Reza >9/10 → Opus build). **Reza merges both**; every merge remains his per-group typed-MERGE click (§12.11). **Until Fix A ships, do not merge AIA** (distinct policies). QBE/Mate: hold until Fix B so the cadence is corrected in the same step. After both: the Matrix re-checks the Housekeeping duplicates tab live.

---
*Prepared by The Matrix from Reza's live review + a source read (HEAD `0a4256e`). Fix A = systemic guardrail (matcher over-strips identifiers + ignores amount on the exact path — a false-positive class for all users). Fix B = merge-with-edit + clearer view (Stitch-first). No tax-engine changes; MON-094 untouched.*
