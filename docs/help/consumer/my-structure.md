---
title: My Structure (entity layer) page
audience: consumer
slug: my-structure
category: My Accounts
routeContext: [/dashboard/entities, /dashboard/entities/*]
lastReviewed: 2026-05-09
order: 11
summary: How to navigate the My Structure page — the entity tree, adding entities, moving assets between entities, and the Money Flow tab.
tags: [entities, structure, navigation, trust, smsf]
---

# My Structure page

The My Structure page at `/dashboard/entities` shows the entity tree — the legal entities you own things through (yourself, Pty Ltd, trust, SMSF). This article walks the page.

## How to get here

Sidebar → **My Accounts** → **My Structure**. (Third sub-tab under My Accounts.)

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Tab toggle** | Top | Switch between **Structure** (tree view) and **Money Flow** (Sankey) |
| **People row** | Top of tree | Household members from `/dashboard/household-profile` |
| **Entity row** | Centre | Coloured tiles per entity, role-coded by colour |
| **Owned-objects chips** | Within each entity tile | Properties / loans / accounts owned by that entity. Clickable. |
| **Trustee → trust connectors** | Between entity tiles | Dashed fuchsia lines for corporate trustee → trust hierarchies |
| **+ Add entity** | Top right | Opens the new-entity form |

## Common tasks

**To add a new entity:**
1. Click **+ Add entity** at the top right.
2. Fill the form: name, type, role, ABN/ACN if applicable.
3. (Optional) TFN — encrypted at rest, never logged.
4. (For trusts) Pick the **Trustee entity** (the corporate trustee Pty Ltd).
5. Save → the tile appears in the tree.

**To edit an entity:**
1. Click the entity tile → detail dialog opens.
2. Click **Edit** in the footer.
3. Change fields → Save.

**To remove an entity:**
1. Click the entity tile → detail dialog.
2. Click **Remove** in the footer.
3. Confirm. (Entities with owned objects are blocked from removal — re-assign the objects first.)

**To move a property / loan / account into a different entity:**
1. Open the object (e.g. property tile on `/dashboard/properties`).
2. Click **Edit** → change the **Owner entity** dropdown.
3. Save. The chip moves to the new entity in the tree.

**To view the Money Flow visualisation:**
1. Click the **Money Flow** tab at the top of the page.
2. The Sankey shows: Income sources → Entities → Outflows (Tax, Essentials, Discretionary, Loans, Surplus).
3. Hover any flow line for the AUD amount.

## Common navigation questions

**Q: I'm a single person — do I need this page?**
Probably not. Your default `PERSONAL_NAME` entity owns everything. The page is for households with trusts, SMSFs, Pty Ltds, partnerships.

**Q: Why are entities colour-coded?**
By role — PERSONAL (warm amber), OPERATING (emerald), HOLDING (indigo), SUPERANNUATION (violet), INVESTMENT (fuchsia). Hover any tile for a tooltip explaining the role.

**Q: My trust has a corporate trustee — how do I show that?**
Add the corporate trustee Pty Ltd first (type COMPANY, role HOLDING). Add the trust (type DISCRETIONARY_TRUST or UNIT_TRUST) and set its **Parent entity** to the Pty Ltd. The dashed line appears in the tree.

**Q: How do I refresh the tree after adding entities?**
The tree auto-refreshes on save. If you see stale data, refresh the page.

**Q: What does the Money Flow Sankey show me?**
Where money comes from → which entity holds the income → where it goes (tax, essentials, discretionary, loans, surplus). The version on this page is entity-aware; the version on `/cashflow` is the simpler aggregate.

## What's next

- See [Adding properties](/help/consumer/adding-properties) for assigning a property to an entity.
- See [Investments page](/help/consumer/investment-accounts-and-holdings) for assigning a holding to an entity.
- See [Your tax position](/help/consumer/your-tax-position) for the per-entity tax view (limited at v1; full Phase 41e ships per-entity Div 6/6E correctness).
