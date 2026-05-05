---
title: Marketplace listing editor
audience: org-admin
slug: marketplace-listing
category: Marketplace
routeContext: [/portal/marketplace/listing, /portal/marketplace/*]
lastReviewed: 2026-05-09
order: 2
summary: How to navigate the marketplace listing editor — drafting your firm's public profile, the submit-for-review flow, and the discipline-conditional compliance fields.
tags: [marketplace, listing, navigation, submit, approve]
---

# Marketplace listing editor

`/portal/marketplace/listing` is where you draft and manage your firm's public marketplace profile. This article walks the page.

## How to get here

Direct URL: `/portal/marketplace/listing`. (Not in the v1 sidebar — coverage map row queued for sidebar addition.)

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Status banner** | Top | Current status: DRAFT / PENDING_REVIEW / APPROVED / REJECTED / SUSPENDED + reason if applicable |
| **Identity** | Top form section | Firm name · Tagline · Public slug (auto-derived from firm name; editable) |
| **Blurb** | Mid form | The longer description (≥100 chars to submit) |
| **Discipline + compliance fields** | Conditional | AFSL number (financial advisers) · Credit rep number (mortgage brokers) · TPB registration (tax agents / accountants) — fields show based on your org's `profession` |
| **Specialisations** | Mid form | Checkbox group — pick ≥1 (tax / retirement / refinance / property / smsf / wealth / etc.) |
| **Target tier** | Mid form | Best-fit client wealth band (Emerging / Growing / Established / HNW) |
| **Regions** | Mid form | Checkbox group — pick ≥1 region |
| **Lead-fee rate** | Lower form | Per-tier lead-fee defaults (read-only at v1; admin can override) |
| **Action bar** | Sticky bottom | **Save draft** · **Submit for review** (or **Re-submit** if rejected) |

## Common tasks

**To draft a new listing:**
1. Land on `/portal/marketplace/listing`. The status banner shows DRAFT.
2. Fill the identity, blurb, discipline-specific compliance number, specialisations, target tier, regions.
3. Click **Save draft** in the action bar.
4. Listing is saved but NOT public.

**To submit for review:**
1. With the form filled (passes validation), click **Submit for review**.
2. Status changes to PENDING_REVIEW.
3. Form fields lock (you can't edit while pending).
4. Monitrax admin reviews the listing + cross-checks ASIC / TPB registers.
5. You receive an email when status changes to APPROVED, REJECTED, or SUSPENDED.

**To edit an APPROVED listing:**
1. Click any field — the form unlocks.
2. Edit → **Save**.
3. Status flips back to PENDING_REVIEW (re-check). The public listing reverts to the previous APPROVED version until re-approved.

**To respond to REJECTED status:**
1. The status banner shows the admin's reason in red.
2. Edit the form to address the issue.
3. Click **Save draft** → status flips back to DRAFT.
4. Re-submit when ready.

**To preview the public listing:**
1. APPROVED listings appear at `/marketplace/[your-slug]`.
2. Open that URL in a new tab to preview.

## Common navigation questions

**Q: Why can't I see the AFSL field?**
Your org's `profession` doesn't include financial advice. AFSL only shows for `FINANCIAL_ADVISOR` profession. To change profession, contact Monitrax support — it's set at registration and only re-set by admin.

**Q: My listing was REJECTED — what now?**
Check the rejection reason in the red status banner. Edit the form → Save (returns to DRAFT) → Re-submit.

**Q: Who can see my draft?**
Only your org seats. Drafts are not public; only APPROVED listings appear at `/marketplace`.

**Q: How does a D2C user find my listing?**
Public marketplace at `/marketplace` — filtered by discipline, region, specialisation. Listings sort by averageRating, accepted-request count, then alphabetical.

**Q: Where do incoming D2C requests appear?**
Sidebar → **Tasks** OR Sidebar → **Clients** → **Pending requests** (Phase 32C PR4c).

**Q: Can I have multiple listings?**
One listing per org at v1. Multiple specialisations / regions on a single listing handle most cases.

## What's next

- See [Practice dashboard overview](/help/org-professional/practice-overview) for handling incoming clients.
- For the public detail page (what D2C users see), navigate to `/marketplace/[your-slug]` after approval.
