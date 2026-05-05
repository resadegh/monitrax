---
title: Investments page
audience: consumer
slug: investment-accounts-and-holdings
category: My Wealth
routeContext: /dashboard/investments/*
lastReviewed: 2026-05-09
order: 10
summary: How to navigate the Investments page — adding accounts, adding holdings, refreshing prices, and where each metric appears.
tags: [investments, holdings, navigation]
---

# Investments page

`/dashboard/investments/accounts` is where every investment account and its holdings live. This article walks the page.

## How to get here

Sidebar → **My Wealth** → **Investments**.

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Header** | Top | Page title + **+ Add investment account** button |
| **Account tiles** | Main grid | One tile per account (broker, super, managed fund). Tile shows total value + holding count |
| **Account detail page** | Click any tile | Holdings list + cash balance + per-account actions |
| **Holdings table** | Within account detail | Each holding (symbol, qty, avg buy price, current price, value, unrealised gain) |

## Common tasks

**To add an investment account:**
1. Click **+ Add investment account** at the top.
2. Pick the **Provider** (CommSec, SelfWealth, Vanguard, super fund, etc.).
3. Set **Account type** (BROKERAGE / SUPER / MANAGED_FUND / OTHER).
4. Enter cash balance.
5. Pick **Owner entity** (defaults to your personal entity; see [My Structure](/help/consumer/my-structure) for SMSF / trust holdings).
6. Save → the tile appears on the page.

**To add a holding:**
1. Click the account tile → account detail page.
2. Click **+ Add holding**.
3. Enter symbol (e.g. `VAS.AX`), quantity, average buy price.
4. Current price auto-fills for ASX symbols, manual for others.
5. Save → the holding appears in the holdings table.

**To refresh prices:**
1. Open the account detail page.
2. Click **Refresh prices** in the page header.
3. ASX symbols update; manual ones unchanged.

**To delete an account or holding:**
1. Click the account or holding → detail / dialog opens.
2. Click **Delete** in the footer.
3. Confirm.

**To record a distribution / dividend:**
1. Sidebar → **My Budget** → **My Plan** → **Income**.
2. **+ Add** → choose **Investment income** → link to the holding.
3. Save → the distribution flows into your tax position.

## Common navigation questions

**Q: Where does my super balance show?**
Add a `SUPER` type investment account with the fund balance. Holdings inside super aren't tracked here — your fund's website has those. Monitrax cares about super for caps + Div 293 thresholds.

**Q: International / US shares?**
Add them with their currency. Monitrax converts to AUD for the net-worth view.

**Q: Where does the concentration warning appear?**
Top of the Investments page — banner appears if any single holding exceeds 25% of total invested (excluding super).

**Q: I want to import from CommSec / Sharesight.**
Not yet — manual add for now. CSV import is queued. (For banks, CDR import via Basiq is live — see [Managing accounts and loans](/help/consumer/managing-accounts-and-loans).)

**Q: Where does this account contribute to net worth?**
Net worth on `/dashboard` aggregates from every account here. Drill the Net Worth tile to see the breakdown.

## What's next

- See [My Structure](/help/consumer/my-structure) for assigning holdings to a trust or SMSF.
- See [Your tax position](/help/consumer/your-tax-position) for distribution + capital-gain treatment.
