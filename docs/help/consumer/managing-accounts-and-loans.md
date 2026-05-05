---
title: Managing accounts and loans
audience: consumer
slug: managing-accounts-and-loans
category: My Accounts
routeContext: [/dashboard/balances, /dashboard/balances/*, /dashboard/accounts, /dashboard/loans]
lastReviewed: 2026-05-09
order: 3
summary: How to navigate /dashboard/balances — adding, editing, and deleting accounts and loans, and connecting your bank for live import.
tags: [accounts, loans, balances, navigation, bank-connection]
---

# Managing accounts and loans

`/dashboard/balances` is the home for everything *current* — bank accounts, savers, credit cards, loans, offsets. This article walks the page and the common actions.

## How to get here

Sidebar → **My Accounts** → **Balances**. (My Accounts is the third item from the top, between **My Household** and **My Budget**.)

## What's on the page

| Section | Where it is | What it does |
|---|---|---|
| **Header** | Top | Page title + **+ Add** button |
| **Total balance summary** | Below header | Net of accounts − loans, by type |
| **Account groups** | Main body | Accounts grouped by type (Everyday, Savings, Credit, Loans, Offsets) |
| **Account row** | Within each group | One row per account with balance + last-updated time. Click any row to open the detail dialog. |
| **Detail dialog** | Opens on row click | Tabs: Overview · Transactions · Linked · Strategy. Edit + Delete actions in the footer. |

## Common tasks

**To add a manual account or loan:**
1. Click **+ Add** at the top.
2. Pick **Account**, **Loan**, or **Connect bank**.
3. Fill the form (name, type, balance, etc.).
4. Click **Save**.

**To connect your bank for live import (CDR via Basiq):**
1. Click **+ Add** → **Connect bank**.
2. Pick your bank from the list.
3. You'll be redirected to your bank's secure portal — log in there, not in Monitrax.
4. Grant Monitrax read-only access. Click **Allow**.
5. Wait 30–60 seconds for the connection to complete; balances appear in your account groups.

**To edit an account:**
1. Click the account row → detail dialog opens.
2. Click **Edit** at the bottom of the dialog.
3. Change the fields → **Save**.

**To delete an account:**
1. Click the account row.
2. Click **Delete** at the bottom-right.
3. Confirm in the two-step dialog.

**To link an offset to a loan:**
1. Open the loan (click the loan row).
2. Open the **Offset** tab in the detail dialog.
3. Pick the offset account from the dropdown → **Save**.

**To disconnect a bank:**
1. Sidebar → **Settings** → **Security** → **CDR consents**.
2. Find the bank → click **Revoke**.
3. Confirm.

## Common navigation questions

**Q: Where do I see my transactions?**
Sidebar → **My Accounts** → **Activity**, or open an account → **Transactions** tab.

**Q: I added a loan but it's not showing on the page.**
Check the filter chips at the top of the page — make sure **Loans** is selected (or **All**).

**Q: How do I see which property a loan is linked to?**
Click the loan row → **Linked** tab.

**Q: I need to refresh the bank balance manually.**
Open the account → click **Refresh** in the detail dialog header.

**Q: Where did `/dashboard/accounts` go (legacy URL)?**
Phase 36 consolidated `/dashboard/accounts` and `/dashboard/loans` into `/dashboard/balances`. The old URLs still work and redirect here.

## What's next

- See [Reading your cashflow](/help/consumer/reading-your-cashflow) for how account + loan data feeds the cashflow page.
- See [CDR consent walkthrough](/help/compliance/cdr-consent-walkthrough) for the legal side of bank connection.
