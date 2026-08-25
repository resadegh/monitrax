# Changelog - 2026-08-25

## Session: m2-depth-pr1 (Code, Fable 5) — BRIEF_M2_KEPT_DEPTH execution, PR 1 of 3 (the intake pipeline)

### Changes Made
- **Type**: Fix (kept-surface depth, D-22 refinement-only). `changesNumbers: NO` — no money
  producer is touched; the changes are UI state binding, edit persistence, a count read, a
  vendor-string picker, an upload limit, and error-message plumbing.
- **Scope**: Smart Inbox intake pipeline + vault counts + upload truth
  (`docs/strategy/BRIEF_M2_KEPT_DEPTH.md` PR-1; evidence baseline = the P-9 envelope on #1613)
- **Description**:
  - **§Registry** — F1–F10 registered as **MON-187…196** (187–191/193/194 DIAGNOSED→FIXING
    in this PR; 192/195 OPEN and 196 DIAGNOSED for PR-3). Also **MON-180…184/186 →
    VERIFIED** citing the RING3_M3_PUNCH_FIXES PASS on #1606 (the outstanding Code duty
    from the plan cursor).
  - **MON-187 (F1)** — every inbox checkbox was born disabled: the component read
    suggestedAction `.type` while the analyzers store `.action` (types.ts:229;
    receiptAnalyzer pushes `action:'CREATE_EXPENSE'`), so every row resolved actionless →
    Select-all selected nothing, the counter pinned at 0, Approve unreachable. SECOND
    latent leg found in the same diagnosis: the approve payload spread WRAPPED
    `{value, confidence}` fields into a confirm route that reads FLAT scalars
    (`Number(data.amount)` → NaN). Both fixed: the row model + payload moved to the pure,
    analyzer-typed `lib/documents/intelligence/inboxModel.ts` (reads `action ?? type`,
    flattens the payload) — the field-mismatch class is now a compile-time tie plus a
    worked-fixture test. The old component test was source-scan only; it never exercised
    the contract.
  - **MON-188 (F2)** — Done was `setEditingId(null)`: a local close. It now persists via
    `onPersistEdits` → PATCH `/api/documents/analyze` (same route family, §12.4), which
    merges ONLY the four editable fields into `DocumentAnalysis.extractedData` as
    `{value, confidence: 1, source: 'user'}`, guarded by document ownership +
    `userVerified: false`. Edits survive reload and flow into approve.
  - **MON-190 (F4)** — the tree's "All Documents" summed the category buckets AND the
    tax-status buckets (each covers every doc once → exactly 2×, +2/upload). The page now
    produces THE total (`counts['total'] = documents.length` — the same list the hero
    renders) and the tree reads it.
  - **MON-191 (F5)** — extractVendor's first-plausible-line fallback let a garbled
    document-type header ("Invnice") beat the merchant. It now rejects document-type
    vocabulary including fuzzy OCR garblings (edit distance), refuses money/boilerplate
    lines, scores merchant prominence (repetition across the document + uppercase
    masthead shape), and returns null rather than inventing when nothing plausible
    survives. Amount/date paths untouched (they were right).
  - **MON-193 (F7)** — the app promised 10 MB in five independent constants while the
    platform rejects request bodies at ~4.5 MB. Choice stated (brief offered raise-or-
    lower): the promise is LOWERED to ONE constant — `MAX_FILE_SIZE = 4 MB`
    (headroom for multipart overhead) in `lib/documents/constants.ts`; types.ts
    re-exports it (its duplicate deleted, §12.2.1), and the drop-zone copy, quick-capture
    scanner, form upload, onboarding accelerator and server validator all read it.
    Direct-to-storage upload (the raise path) is new infrastructure — D-22 rules it out
    here; when storage moves to GCS, raise the one constant.
  - **MON-194 (F8)** — `await res.json()` on a plain-text 413 body surfaced the raw
    parse exception as the error banner. One guarded reader now exists
    (`lib/utils/responseError.ts`): JSON error shapes pass through; non-JSON bodies map
    to a human sentence by status. Wired at the three upload seams.
  - **Ledger** — the #1579 row's dropped final clause restored ("…— the validator rule
    this same PR added") per the Matrix's #1613 transcription note; PR-1 §6 row added.

### Files Modified
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-187…196 registered; MON-180…184/186 VERIFIED
- `lib/documents/intelligence/inboxModel.ts` — NEW: pure analyzer-typed row model + flatten
- `components/documents/SmartInbox.tsx` — consumes the model; Done persists; saving/error states
- `app/api/documents/analyze/route.ts` — PATCH persist handler (guarded, four fields only)
- `app/dashboard/documents/page.tsx` — persist handler, guarded upload error, THE total
- `components/documents/FolderTree.tsx` — root count reads the one total
- `lib/documents/intelligence/analyzers/receiptAnalyzer.ts` — MON-191 vendor picker
- `lib/documents/constants.ts` + `types.ts` — ONE 4MB limit (duplicate deleted)
- `components/documents/GlobalScanReceipt.tsx` · `FormDocumentUpload.tsx` ·
  `components/onboarding/wizard/DocumentUploadAccelerator.tsx` — shared limit + guarded errors
- `lib/utils/responseError.ts` — NEW: the one guarded response-error reader
- `tests/documents/inboxModel.test.ts` · `receiptVendor.test.ts` ·
  `intakePipelineGuards.test.ts` — NEW Ring-0/Ring-1 suites (worked fixtures + wiring pins)
- `tests/components/SmartInbox.test.tsx` — stale pins modernized to the model
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — two anchors
  re-pinned (analyzeReceipt, documentAnalyze.POST); Layer-0 allowlist +5
- `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — cursor + §5 F1–F10 row + §9 line
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — §6 row + the #1579 clause restore

### Build Status
- [x] `npx tsc --noEmit` clean · documents/components suites 95/95 green
- [x] `issues:check` (183 valid) · `neomatrix:check` (anchors current, 0 uncovered) ·
      `census:producers:check` (AT seed) · `lint:source-lock` · `lint:financial-surfaces` ·
      plan-freshness — all green
- [x] Full vitest suite: run before push (result in the PR body)

### Coverage boundary
Ring-0 proves the row model, payload flatten, vendor picker and error reader on fixtures;
Ring-1 pins the wiring in source. Does NOT prove: the rendered checkbox/approve behaviour on
live data (the brief's PR-1 Ring-3 — the stranded Bunnings $203.78 item edited, selected,
approved into FY2026-27), the platform's actual 413 boundary, or the PATCH endpoint against
a real DB (guarded logic pinned in source; exercised at Ring-3).
