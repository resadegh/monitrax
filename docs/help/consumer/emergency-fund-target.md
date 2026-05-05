---
title: Safety Net page
audience: consumer
slug: emergency-fund-target
category: My Safety Net
routeContext: /dashboard/safety-net
lastReviewed: 2026-05-09
order: 7
summary: How to navigate the Safety Net page — coverage status, target, eligible accounts, and how to change the override.
tags: [safety-net, emergency-fund, navigation]
---

# Safety Net page

The Safety Net page at `/dashboard/safety-net` shows your emergency-fund status. This article walks the page.

## How to get here

Sidebar → **My Safety Net**. (Between **My Budget** and **My Wealth**.)

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Status banner** | Top | Coverage state (red <1mo / amber 1–3mo / sky-blue 3–6mo / emerald 6mo+) + months covered |
| **Headline numbers** | Below banner | Current safety-net balance · Monthly essentials · Target balance · Gap to target |
| **Eligible accounts** | Mid-page | The accounts that count toward coverage, with each balance |
| **Excluded accounts** | Mid-page | Accounts that don't count + the reason (locked, illiquid, etc.) |
| **Target settings** | Bottom | Override the months-of-coverage default for your situation |

## Common tasks

**To change the months-of-coverage target:**
1. Scroll to **Target settings** at the bottom of the page.
2. Adjust the **Months covered** slider (default: 1 / 3 / 6 based on TRAIL stage).
3. Click **Save**. The page recomputes immediately.

**To see what counts as essentials:**
1. Click **Monthly essentials** in the headline numbers.
2. Drilldown shows every essential expense row.
3. To re-categorise a row, edit it on `/dashboard/expenses` (or **My Plan** tab).

**To add a savings account so it counts toward coverage:**
1. Sidebar → **My Accounts** → **Balances**.
2. **+ Add** → **Account** → set **Type** to `EVERYDAY`, `SAVER`, or `OFFSET`.
3. Save → return to Safety Net page. The new account appears in **Eligible accounts**.

**To exclude an account from safety-net counting:**
1. Open the account on `/dashboard/balances`.
2. Edit → **Settings** tab → toggle **Exclude from safety net**.
3. Save.

## Common navigation questions

**Q: Why is term deposit not counted?**
Term deposits are excluded if they have more than 1 month until maturity. Within 1 month of maturity, they automatically include.

**Q: Why doesn't my super count?**
Super is preservation-locked (you can't access until preservation age) and isn't an emergency-grade fund. By design.

**Q: Why doesn't my credit-card limit count?**
A credit card is borrowed money, not saved money. Same answer for any line of credit.

**Q: I think my essentials are wrong.**
Audit `/dashboard/categories` — make sure expenses you'd cut in a crisis (subscriptions, dining, gym) are tagged discretionary, not essential. The default essentials list is conservative; your override wins.

**Q: How does the target relate to my TRAIL stage?**
Default coverage targets are: TRACK = 1mo, REDUCE / ANCHOR = 3mo, INVEST and beyond = 6mo. Override at the bottom of this page if you want a different target.

## What's next

- See [Reading your cashflow](/help/consumer/reading-your-cashflow) for the surplus you're banking into the safety net.
- See [Managing accounts and loans](/help/consumer/managing-accounts-and-loans) for adding more savings accounts.
