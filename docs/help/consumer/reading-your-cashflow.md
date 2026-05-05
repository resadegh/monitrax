---
title: Reading your cashflow page
audience: consumer
slug: reading-your-cashflow
category: My Budget
routeContext: /cashflow
lastReviewed: 2026-05-09
order: 4
summary: How to navigate the cashflow page — what each section shows, where the numbers come from, and how to drill in.
tags: [cashflow, budget, navigation]
---

# Reading your cashflow page

The cashflow page at `/cashflow` shows your monthly money picture. This article walks the page section-by-section.

## How to get here

Sidebar → **My Budget** → **Cashflow** (default tab when you click My Budget).

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Headline summary** | Top of page | Your monthly Income, Total Expenses, and Surplus / Deficit. Click any number to see its breakdown. |
| **Money In** | Left column | Income rows (salary, rental, investment income, other) — each clickable. |
| **Money Out** | Right column | Expense rows grouped by category — each clickable. |
| **Loan repayments** | Below Money Out | Sum of minimum repayments across all loans. Click → drills to `/dashboard/balances` Loans group. |
| **Sankey** | Bottom of page | Visual flow from Income → categories → Surplus/Deficit. |
| **Tabs at top** | Below page header | Switch between **Cashflow** / **My Plan** / **Debt Freedom**. |

## Common tasks

**To see what's in a category (e.g. "Groceries"):**
1. Click the category row in the Money Out column.
2. A drilldown lists every expense row that contributed.

**To add a missing income or expense:**
1. Sidebar → **My Budget** → **My Plan** tab.
2. **+ Add** → choose Income or Expense.
3. Fill the form → Save.
4. Return to **Cashflow** tab — it appears in the breakdown.

**To change a row's category:**
1. Sidebar → **My Budget** → **My Plan** tab.
2. Find the row → click **Edit** (pencil icon).
3. Change the **Category** dropdown → Save.

**To change frequency on an existing row:**
1. Same as above — edit the row.
2. Change the **Frequency** field (weekly / fortnightly / monthly / annually) → Save.
3. Cashflow recomputes immediately.

## Common navigation questions

**Q: Where did `/dashboard/budget-analysis` go?**
Phase 37 made `/cashflow` the default landing for My Budget. The legacy URL still resolves and redirects here.

**Q: How do I see the same view but yearly instead of monthly?**
The **Period** toggle in the top-right of the headline summary switches between monthly / quarterly / annual. The view recomputes.

**Q: Where does the Sankey live separately?**
Sidebar → **My Accounts** → **My Structure** → **Money Flow** tab is the entity-aware version. The Sankey on `/cashflow` is the simpler aggregate view.

**Q: Why does my surplus look wrong?**
Most common cause: a row is on the wrong frequency, or a recurring bill isn't entered yet. Edit on **My Plan** tab.

**Q: Where do tax-related figures live?**
Sidebar → **My Guide** → **Tax** tab. Cashflow is post-tax (take-home).

## What's next

- See [Debt freedom plan](/help/consumer/debt-freedom-plan) for the **Debt Freedom** tab.
- See [Emergency fund target](/help/consumer/emergency-fund-target) for what to do with your surplus.
