---
title: Tax page
audience: consumer
slug: your-tax-position
category: My Guide
routeContext: /dashboard/tax
complianceClass: afsl
lastReviewed: 2026-05-09
order: 6
summary: How to navigate the Tax page — what each section shows, where to find your bracket, super contribution headroom, and deductions breakdown.
tags: [tax, navigation, super, deductions]
---

# Tax page

The Tax page at `/dashboard/tax` shows your end-of-year tax estimate. This article walks the page.

## How to get here

Sidebar → **My Guide** → **Tax** tab.

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Headline summary** | Top | Estimated taxable income · Tax owed · PAYG withheld · Net position (refund or balance owing) |
| **Bracket indicator** | Below summary | Which tax bracket you're currently in, with the next bracket threshold |
| **Brackets table** | Top-right or expanded | Full list of FY brackets with rates |
| **Income breakdown** | Mid-page | Each income type (salary, rental, investment, other) and how it adds to taxable income |
| **Deductions** | Mid-page | Allowed deductions by category |
| **Super contributions** | Lower section | Concessional contributions used vs cap, salary-sacrifice opportunity card |
| **Offsets** | Lower section | LITO / SAPTO / franking credits / foreign offsets, where applicable |
| **FY selector** | Top-right | Switch between FY24-25 (current) / FY23-24 / FY25-26 |

## Common tasks

**To switch financial years:**
1. Click the **FY selector** at the top-right.
2. Pick the year. The page recomputes.

**To see what's in a deduction category:**
1. Click the category row in the **Deductions** section.
2. A drilldown shows every deduction row that contributed.

**To act on a salary-sacrifice opportunity:**
1. Find the **Salary-sacrifice opportunity** card in the Super Contributions section.
2. Click **Ask a Professional** to confirm with your accountant before action.
3. (Implementation is via your employer / payroll, not via Monitrax.)

**To add a missing deduction:**
1. Sidebar → **My Budget** → **My Plan** → expense rows.
2. Edit the row → toggle **Tax deductible** → Save.
3. Return to the Tax page — the deduction appears in the breakdown.

## Common navigation questions

**Q: Which financial year am I looking at by default?**
The current FY (e.g. FY24-25 from 1 July 2024 to 30 June 2025). Use the FY selector to view others.

**Q: My estimate doesn't match my accountant's number.**
This is general info only — your accountant has the full picture. The page is for **early-warning + opportunity-spotting**, not tax-return replacement.

**Q: Where do realised capital gains live?**
Not yet — Phase 41e ships full CGT event tracking. v1 covers income tax only.

**Q: Where do property deductions show up?**
The **Income breakdown** section shows each investment property's net rental income (rent − expenses − interest − depreciation). Negative gearing reduces taxable income; positive gearing adds.

**Q: I see a UC-DEED-… alert on my trust — what does it mean?**
If you've [uploaded and confirmed a trust deed](/help/consumer/uploading-trust-deed), the tax engine validates your annual trustee resolution against the deed. Common alerts:

- **`UC-DEED-BENEFICIARY-NOT-IN-DEED`** — you distributed to someone the deed doesn't list. Either the deed is out of date, or the resolution is wrong.
- **`UC-DEED-BENEFICIARY-EXCLUDED`** (CRITICAL) — you distributed to someone the deed marks `EXCLUDED`. The resolution is invalid against the deed; may trigger s100A consequences. Speak to your accountant.
- **`UC-DEED-FIXED-DISTRIBUTION-MISMATCH`** — your trust has a `FIXED` or `PROPORTIONATE` rule and the runtime split drifts >1c from the deed share.
- **`UC-DEED-PRESENT-NO-RESOLUTION`** — trust has a deed but no FY trustee resolution — Div 6 needs the resolution to flow income.
- **`UC-DEED-SUB-TRUST-UPE-PRESENT`** — informational; deed has sub-trust UPE provisions, so Div 7A applies the sub-trust path if any beneficiary has an unpaid present entitlement.

**Q: How do I file my tax return from here?**
You don't — Monitrax doesn't lodge returns. Use `myTax` or your accountant. The Tax page is reference material to bring to that conversation.

## Compliance footer

This page provides **general information only** about your estimated tax position based on the data you've entered and the current FY's published rates. It is NOT tax agent services within the meaning of the *Tax Agent Services Act 2009* (s90-5). For lodgement, deduction substantiation, complex structures (trusts, companies, SMSF), and any matter affecting your tax return, engage a registered tax agent (TPB-registered) or accountant via **Ask a Professional**. See `docs/help/compliance/asic-rg244-rg36-boundary-statement.md`.
