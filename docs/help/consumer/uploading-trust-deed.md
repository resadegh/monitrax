---
title: Uploading a trust deed
audience: consumer
slug: uploading-trust-deed
category: My Accounts
routeContext: [/dashboard/entities/*/trust-deed]
lastReviewed: 2026-05-07
order: 12
summary: How to upload a trust deed PDF, review the extracted rules, and confirm them so your tax engine + AI advisor can use them.
tags: [trust, deed, entities, structure, navigation]
---

# Uploading a trust deed

If you have a Discretionary Trust or Unit Trust on the My Structure page, Monitrax can read your trust deed PDF and extract the rules — beneficiaries, distribution rules, vesting date, sub-trust UPE provisions — so your tax position uses what the deed actually says, not generic defaults.

> **Scope boundary:** Monitrax does **not** create or modify legal documents. It only reads what's in your existing deed and stores the extracted rules so the tax engine and AI advisor can reference them. The deed PDF is encrypted at rest and only you and the system can read it. Per [PHASE_41F_BOOKKEEPING_INTEGRATION.md §1.1](../../blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md).

## How to get here

Sidebar → **My Accounts** → **My Structure** → click a trust entity tile → **Upload trust deed** button.

Direct URL: `/dashboard/entities/<entity-id>/trust-deed`.

The flow is restricted to entity types `DISCRETIONARY_TRUST` and `UNIT_TRUST`. If the button doesn't appear, double-check the entity's type on the My Structure page.

## The 4-step flow

The deed flow is **confirm-before-apply**: nothing the AI extracts touches your tax engine until you confirm it. Steps:

| Step | What happens | What you do |
|---|---|---|
| **1. Upload** | You drag-drop / select your trust deed PDF (max 25 MB). It uploads encrypted-at-rest. | Pick the latest signed version of the deed. |
| **2. Extract** | Monitrax reads the PDF text and Gemini structures it into typed rules. Each rule gets a confidence score (0–1). Takes ~10–30 seconds. | Wait for the extraction to finish. |
| **3. Review** | The page shows extracted beneficiaries, distribution rules, loan provisions, and the vesting date. Each rule shows a **confidence chip** (≥0.7 emerald = high confidence; <0.7 amber = "review carefully"). Verbatim deed text is shown for any clause Gemini flagged as uncertain. | Read each rule. Click into low-confidence rules to verify against the deed text. |
| **4. Confirm or Reject** | Confirm locks the rules in as `CONFIRMED` — they flow to the tax engine + AI advisor. Reject discards the extraction. Re-upload starts step 1 again. | Confirm if the rules match your deed; reject and re-upload if Monitrax misread something. |

## What happens once confirmed

- **Tax engine.** Phase 41e's MasterTaxPosition orchestrator validates your annual trustee resolution against the deed's beneficiary list. If you distribute to someone the deed marks `EXCLUDED`, you'll see a `UC-DEED-BENEFICIARY-EXCLUDED` flag on your Tax page (CRITICAL severity, cites s100A ITAA 1936). If a beneficiary you distribute to isn't in the deed at all, you'll see `UC-DEED-BENEFICIARY-NOT-IN-DEED`. If your deed has a `FIXED` or `PROPORTIONATE` rule and the runtime allocation drifts more than 1c from the deed share, you'll see `UC-DEED-FIXED-DISTRIBUTION-MISMATCH`. These are **alerts**, not blockers — they help you reconcile your trustee resolution against the deed, not stop you working.
- **AI advisor.** Ask "what does my trust deed say?" or "who can my Smith Family Trust distribute to?" and the advisor can read the deed structure (counts of primary / general / excluded beneficiaries, distribution rule types, loan provisions) and narrate it. The advisor will not invent any rule that isn't in your CONFIRMED deed.
- **Sub-trust UPE.** If the deed has `SUB_TRUST_UPE` loan provisions, the Div 7A path on your Tax page will surface a `UC-DEED-SUB-TRUST-UPE-PRESENT` flag whenever a beneficiary has an unpaid present entitlement to this trust — so your Div 7A classification references the sub-trust terms.

## Common tasks

1. **Re-upload an updated deed** — open the trust deed page → click **Re-upload**. The previous CONFIRMED rules stay in place until you confirm the new extraction. Old uploads are kept for audit.
2. **Reject a bad extraction** — open the trust deed page → click **Reject**. The extracted rules are dropped; the deed PDF stays on file. Re-upload to try again.
3. **Override a low-confidence rule** — at step 3, edit the field directly before confirming (most fields are inline-editable). Your edit becomes part of the CONFIRMED record.
4. **Check what the AI sees** — open the AI advisor (`/dashboard/cfo/ask`) and ask "list the beneficiaries on my [entity name] trust." The advisor returns counts + types per HR-1.

## Common navigation questions

- **"Why is my deed extracted but not used yet?"** — the lifecycle is `EXTRACTED → CONFIRMED | REJECTED`. Until you confirm, the rules sit in a draft state and the tax engine ignores them.
- **"Why is the Confirm button greyed out?"** — there are required fields that haven't been filled. Look for amber confidence chips on each rule and verify low-confidence ones manually.
- **"My deed is scanned (image PDF) — will it work?"** — Monitrax surfaces `UC-TRUST-DEED-SCANNED-PDF` if the extracted text length is < 100 characters, which usually means the PDF is image-based with no embedded text. Run the PDF through any OCR tool (e.g. macOS Preview's "Export as PDF" with text-recognition) and re-upload.
- **"What if I have multiple trusts?"** — each trust entity has its own deed slot. Repeat the flow per entity.

## What's next

- **My Structure** — see the entity tree and click any entity to open its detail.
- **Tax page** — check whether any UC-DEED-* flags surface for the current FY.
- **Ask the Advisor** — ask "show my trust deed structure for [entity name]" to verify what the AI sees.
